/** L0: the Canvas 2D backend for `Renderer`. The only file that touches a 2d context. */

import type { CameraView } from './camera';
import type { Sprite } from './assets';
import type {
  DarknessOptions,
  LightCone,
  LightProfile,
  PolygonLight,
  Renderer,
  SpriteOptions,
  TextStyle,
} from './renderer';

const applyWorldTransform = (
  ctx: CanvasRenderingContext2D,
  view: CameraView,
  pixelRatio: number,
): void => {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.translate(view.width / 2, view.height / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-view.x, -view.y);
};

const tracePolygon = (ctx: CanvasRenderingContext2D, points: Float32Array): void => {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
};

/** The light mask only ever carries alpha; the colour it is painted in is moot. */
const WHITE = '255,255,255';

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Halvings of the resolution light is gathered at, and a further halving for the
 * bloom. Every pixel of the light mask is about to be blurred by several of its
 * neighbours and then used only to say how much darkness to take away, so
 * gathering it at full resolution buys nothing and costs the largest fills in
 * the frame four times over.
 */
const LIGHT_SHIFT = 2;
const BLOOM_SHIFT = 1;

/** Edge of a beam mask, in texels. Bigger only buys smoothness the blur adds anyway. */
const BEAM_MASK = 256;

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The profile read at any point between its samples rather than only on them. */
const sampleProfile = (profile: LightProfile, at: number): number => {
  const last = profile.length - 1;
  if (last < 1) return 0;
  const position = clamp01(at) * last;
  const index = Math.min(last - 1, Math.floor(position));
  const blend = position - index;
  return profile[index] + (profile[index + 1] - profile[index]) * blend;
};

/**
 * Fills a light's polygon with a radial gradient built from its profile. The
 * profile decides the shape, the caller decides the colour channels: the
 * darkness layer subtracts black, the bloom layer adds the lamp's own colour.
 */
const fillProfile = (
  ctx: CanvasRenderingContext2D,
  points: Float32Array,
  light: PolygonLight,
  strength: number,
  profile: LightProfile,
  channels: string,
): void => {
  const last = profile.length - 1;
  if (last < 1) return;
  ctx.save();
  tracePolygon(ctx, points);
  ctx.clip();
  const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
  const peak = clamp01(strength);
  for (let i = 0; i <= last; i++) {
    gradient.addColorStop(i / last, `rgba(${channels},${peak * clamp01(profile[i])})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
  ctx.restore();
};

export class Canvas2DRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly darkCanvas: HTMLCanvasElement;
  private readonly darkCtx: CanvasRenderingContext2D;
  /**
   * Every light lands here first and the whole mask is subtracted from the
   * darkness in one go. Subtracting light by light meant two lights that
   * overlapped removed more darkness than either asked for, which is what turned
   * the middle of a torch beam white and drew rings where its pools met.
   */
  private readonly lightCanvas: HTMLCanvasElement;
  private readonly lightCtx: CanvasRenderingContext2D;
  private readonly glowCanvas: HTMLCanvasElement;
  private readonly glowCtx: CanvasRenderingContext2D;
  /** Where the mask is blurred, and where the bloom is blurred smaller still. */
  private readonly softCanvas: HTMLCanvasElement;
  private readonly softCtx: CanvasRenderingContext2D;
  private readonly bloomCanvas: HTMLCanvasElement;
  private readonly bloomCtx: CanvasRenderingContext2D;
  /** Both light layers, so a visibility clip is applied to each of them. */
  private readonly darknessLayers: readonly CanvasRenderingContext2D[];
  /** Colour channels of a glow colour, resolved once by the context itself. */
  private readonly channels = new Map<string, string>();
  /** Ramps and beam masks, both keyed by the shape rather than by where they land. */
  private readonly ramps = new Map<string, CanvasGradient>();
  private readonly beams = new Map<string, HTMLCanvasElement>();
  private readonly profileIds = new WeakMap<object, number>();
  private nextProfileId = 1;
  private vignetteKey = '';
  private vignetteFill?: CanvasGradient;
  private darkness: DarknessOptions = { softness: 0, bloom: 0, bloomStrength: 0 };
  private pixelRatio = 1;
  private worldDepth = 0;
  private visibilityDepth = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    maxPixelRatio: number,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    this.darkCanvas = document.createElement('canvas');
    const darkCtx = this.darkCanvas.getContext('2d');
    if (!darkCtx) throw new Error('2d canvas context unavailable for the darkness layer');
    this.darkCtx = darkCtx;
    this.lightCanvas = document.createElement('canvas');
    const lightCtx = this.lightCanvas.getContext('2d');
    if (!lightCtx) throw new Error('2d canvas context unavailable for the light layer');
    this.lightCtx = lightCtx;
    this.glowCanvas = document.createElement('canvas');
    const glowCtx = this.glowCanvas.getContext('2d');
    if (!glowCtx) throw new Error('2d canvas context unavailable for the bloom layer');
    this.glowCtx = glowCtx;
    this.softCanvas = document.createElement('canvas');
    const softCtx = this.softCanvas.getContext('2d');
    if (!softCtx) throw new Error('2d canvas context unavailable for the penumbra layer');
    this.softCtx = softCtx;
    this.bloomCanvas = document.createElement('canvas');
    const bloomCtx = this.bloomCanvas.getContext('2d');
    if (!bloomCtx) throw new Error('2d canvas context unavailable for the bloom layer');
    this.bloomCtx = bloomCtx;
    this.darknessLayers = [this.lightCtx, this.glowCtx];
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  }

  get width(): number {
    return this.canvas.width / this.pixelRatio;
  }

  get height(): number {
    return this.canvas.height / this.pixelRatio;
  }

  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(height * this.pixelRatio));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.darkCanvas.width = this.canvas.width;
    this.darkCanvas.height = this.canvas.height;
    this.lightCanvas.width = Math.max(1, this.canvas.width >> LIGHT_SHIFT);
    this.lightCanvas.height = Math.max(1, this.canvas.height >> LIGHT_SHIFT);
    this.glowCanvas.width = this.lightCanvas.width;
    this.glowCanvas.height = this.lightCanvas.height;
    this.bloomCanvas.width = Math.max(1, this.lightCanvas.width >> BLOOM_SHIFT);
    this.bloomCanvas.height = Math.max(1, this.lightCanvas.height >> BLOOM_SHIFT);
    this.softCanvas.width = this.lightCanvas.width;
    this.softCanvas.height = this.lightCanvas.height;
    this.vignetteFill = undefined;
    this.vignetteKey = '';
  }

  beginFrame(clearColor: string): void {
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = clearColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  endFrame(): void {
    this.ctx.globalAlpha = 1;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  pushWorld(view: CameraView): void {
    this.ctx.save();
    applyWorldTransform(this.ctx, view, this.pixelRatio);
    this.worldDepth++;
  }

  popWorld(): void {
    if (this.worldDepth === 0) return;
    this.ctx.restore();
    this.worldDepth--;
  }

  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = alpha;
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }

  strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, width, height);
  }

  fillCircle(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  strokeCircle(x: number, y: number, radius: number, color: string, lineWidth: number): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawSprite(sprite: Sprite, x: number, y: number, options: SpriteOptions = {}): void {
    const width = options.width ?? sprite.width;
    const height = options.height ?? sprite.height;
    const previousAlpha = this.ctx.globalAlpha;
    if (options.alpha !== undefined) this.ctx.globalAlpha = previousAlpha * options.alpha;
    if (options.rotation) {
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(options.rotation);
      this.ctx.drawImage(
        sprite.source,
        sprite.sx,
        sprite.sy,
        sprite.width,
        sprite.height,
        -width / 2,
        -height / 2,
        width,
        height,
      );
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        sprite.source,
        sprite.sx,
        sprite.sy,
        sprite.width,
        sprite.height,
        x - width / 2,
        y - height / 2,
        width,
        height,
      );
    }
    this.ctx.globalAlpha = previousAlpha;
  }

  drawText(text: string, x: number, y: number, style: TextStyle): void {
    this.ctx.font = style.font;
    this.ctx.fillStyle = style.color;
    this.ctx.textAlign = style.align ?? 'left';
    this.ctx.textBaseline = style.baseline ?? 'alphabetic';
    this.ctx.fillText(text, x, y);
  }

  fillPolygon(points: ArrayLike<number>, color: string): void {
    if (points.length < 6) return;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) this.ctx.lineTo(points[i], points[i + 1]);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * The ramp is built in the rect's own frame and the rect is moved under it, so
   * every wall face and every contact shadow in the level shares one gradient
   * object instead of allocating one per tile per frame.
   */
  fillGradientRect(
    x: number,
    y: number,
    width: number,
    height: number,
    dirX: number,
    dirY: number,
    from: string,
    to: string,
  ): void {
    const key = `${dirX}:${dirY}:${from}:${to}`;
    let ramp = this.ramps.get(key);
    if (!ramp) {
      ramp = this.ctx.createLinearGradient(0, 0, dirX, dirY);
      ramp.addColorStop(0, from);
      ramp.addColorStop(1, to);
      this.ramps.set(key, ramp);
    }
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = ramp;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  vignette(color: string, strength: number, inner: number): void {
    if (strength <= 0) return;
    const { width, height } = this;
    const key = `${width}:${height}:${color}:${inner}`;
    if (key !== this.vignetteKey || !this.vignetteFill) {
      const radius = Math.hypot(width, height) / 2;
      const fill = this.ctx.createRadialGradient(
        width / 2,
        height / 2,
        radius * clamp01(inner),
        width / 2,
        height / 2,
        radius,
      );
      fill.addColorStop(0, 'rgba(0,0,0,0)');
      fill.addColorStop(1, color);
      this.vignetteFill = fill;
      this.vignetteKey = key;
    }
    const previousAlpha = this.ctx.globalAlpha;
    this.ctx.save();
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.globalAlpha = clamp01(strength);
    this.ctx.fillStyle = this.vignetteFill;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
    this.ctx.globalAlpha = previousAlpha;
  }

  overlay(color: string, alpha: number): void {
    const previousAlpha = this.ctx.globalAlpha;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = previousAlpha;
  }

  /**
   * The darkness pass runs on two offscreen layers. One is filled with the
   * palette's darkness and has light *subtracted* from it, which is what makes
   * an unlit room unreadable; the other collects the warm bloom lights add on
   * top of the world. Painting light straight onto the frame cannot do the
   * first, and subtracting alone cannot do the second.
   */
  beginDarkness(color: string, view: CameraView, options: DarknessOptions): void {
    this.darkness = options;
    this.darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.darkCtx.globalCompositeOperation = 'source-over';
    this.darkCtx.globalAlpha = 1;
    this.darkCtx.filter = 'none';
    this.darkCtx.fillStyle = color;
    this.darkCtx.fillRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);

    for (const ctx of this.darknessLayers) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.clearRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
      applyWorldTransform(ctx, view, this.pixelRatio / (1 << LIGHT_SHIFT));
    }
    // Two lights over the same floor leave it as bright as the brighter of them
    // plus what the other still has to give — the same diminishing sum the
    // simulation counts, because plain alpha over alpha is exactly that sum.
    this.lightCtx.globalCompositeOperation = 'source-over';
    // Bloom accumulates: two lamps overlapping are brighter than either alone.
    this.glowCtx.globalCompositeOperation = 'lighter';
  }

  beginVisibility(points: Float32Array): void {
    if (points.length < 6) return;
    for (const ctx of this.darknessLayers) {
      ctx.save();
      tracePolygon(ctx, points);
      ctx.clip();
    }
    this.visibilityDepth++;
  }

  endVisibility(): void {
    if (this.visibilityDepth === 0) return;
    for (const ctx of this.darknessLayers) ctx.restore();
    this.visibilityDepth--;
  }

  punchPolygon(points: Float32Array, light: PolygonLight): void {
    if (points.length < 6 || light.radius <= 0) return;
    const { cone, glow } = light;
    if (cone) {
      if (light.strength > 0) {
        this.stampBeam(this.lightCtx, points, light, cone, light.strength, light.profile, WHITE);
      }
      if (glow && glow.strength > 0) {
        const channels = this.channelsOf(glow.colour);
        this.stampBeam(this.glowCtx, points, light, cone, glow.strength, glow.profile, channels);
      }
      return;
    }
    if (light.strength > 0) {
      fillProfile(this.lightCtx, points, light, light.strength, light.profile, WHITE);
    }
    if (glow && glow.strength > 0) {
      fillProfile(this.glowCtx, points, light, glow.strength, glow.profile, this.channelsOf(glow.colour));
    }
  }

  /**
   * Lays one pre-built beam over the floor. The mask holds the whole shape —
   * falloff along the beam and the soft edge across it — so a beam is a single
   * draw whatever its length, and nothing inside it can overlap anything else
   * inside it.
   */
  private stampBeam(
    ctx: CanvasRenderingContext2D,
    points: Float32Array,
    light: PolygonLight,
    cone: LightCone,
    strength: number,
    profile: LightProfile,
    channels: string,
  ): void {
    const mask = this.beamMask(cone, profile, channels);
    if (!mask) return;
    ctx.save();
    tracePolygon(ctx, points);
    ctx.clip();
    ctx.globalAlpha = clamp01(strength);
    ctx.translate(light.x, light.y);
    ctx.rotate(cone.facing);
    ctx.scale(light.radius, light.radius);
    ctx.drawImage(mask, -1, -1, 2, 2);
    ctx.restore();
  }

  /** One mask per beam shape, built once and then only ever rotated and scaled. */
  private beamMask(
    cone: LightCone,
    profile: LightProfile,
    channels: string,
  ): HTMLCanvasElement | undefined {
    if (profile.length < 2) return undefined;
    const key = `${this.profileId(profile)}:${cone.halfAngle.toFixed(4)}:${cone.core.toFixed(3)}:${cone.bulb.toFixed(3)}:${channels}`;
    const cached = this.beams.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = BEAM_MASK;
    canvas.height = BEAM_MASK;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const image = ctx.createImageData(BEAM_MASK, BEAM_MASK);
    const data = image.data;
    const [red, green, blue] = channels.split(',').map((part) => Number(part) || 0);
    const half = Math.max(1e-3, cone.halfAngle);
    const core = clamp01(cone.core);
    const bulb = Math.max(1e-3, cone.bulb);

    for (let py = 0; py < BEAM_MASK; py++) {
      const ny = ((py + 0.5) / BEAM_MASK) * 2 - 1;
      for (let px = 0; px < BEAM_MASK; px++) {
        const nx = ((px + 0.5) / BEAM_MASK) * 2 - 1;
        const distance = Math.hypot(nx, ny);
        const offset = (py * BEAM_MASK + px) * 4;
        data[offset] = red;
        data[offset + 1] = green;
        data[offset + 2] = blue;
        if (distance >= 1) continue;
        const across = Math.abs(Math.atan2(ny, nx)) / half;
        const shaped = across <= core ? 1 : ease(1 - (across - core) / Math.max(1e-3, 1 - core));
        // Near the lamp itself the cone is narrower than the lamp is wide, so it
        // opens out into a bulb. Without it the beam starts at a point and the
        // torch reads as floating in front of the player rather than held.
        const opening = ease(distance / bulb);
        const angular = shaped + (1 - shaped) * (1 - opening);
        data[offset + 3] = Math.round(255 * clamp01(sampleProfile(profile, distance) * angular));
      }
    }
    ctx.putImageData(image, 0, 0);
    while (this.beams.size >= 16) {
      const oldest = this.beams.keys().next();
      if (oldest.done) break;
      this.beams.delete(oldest.value);
    }
    this.beams.set(key, canvas);
    return canvas;
  }

  private profileId(profile: LightProfile): number {
    const key = profile as unknown as object;
    const known = this.profileIds.get(key);
    if (known !== undefined) return known;
    const id = this.nextProfileId++;
    this.profileIds.set(key, id);
    return id;
  }

  /**
   * `#fff3c4` as `255,243,196`. The context normalises whatever notation the
   * palette used, so this never has to know about named or short-hex colours.
   */
  private channelsOf(colour: string): string {
    const cached = this.channels.get(colour);
    if (cached) return cached;
    this.glowCtx.fillStyle = '#000000';
    this.glowCtx.fillStyle = colour;
    const normalised = this.glowCtx.fillStyle;
    const hex = typeof normalised === 'string' && /^#[0-9a-f]{6}$/i.test(normalised)
      ? normalised
      : '#ffffff';
    const value = parseInt(hex.slice(1), 16);
    const channels = `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
    this.channels.set(colour, channels);
    return channels;
  }

  /**
   * The whole light mask comes off the darkness at once, blurred by a couple of
   * pixels on the way. That blur is the penumbra: a shadow edge is a ray budget
   * away from being exact, and softening it hides both the steps between rays
   * and the way they crawl as the player moves. Bloom is blurred far harder and
   * added over its own crisp core, which is what a bright lamp does to an eye.
   */
  endDarkness(): void {
    const { bloom, bloomStrength, softness } = this.darkness;
    for (const ctx of this.darknessLayers) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    this.darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.darkCtx.globalCompositeOperation = 'destination-out';
    const mask =
      softness > 0
        ? this.reduce(this.softCtx, this.softCanvas, this.lightCanvas, softness, LIGHT_SHIFT)
        : this.lightCanvas;
    this.darkCtx.drawImage(mask, 0, 0, this.darkCanvas.width, this.darkCanvas.height);
    this.darkCtx.globalCompositeOperation = 'source-over';

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    // Dim first, then let the lights themselves put colour back into what is lit.
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.darkCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(this.glowCanvas, 0, 0, this.canvas.width, this.canvas.height);
    if (bloom > 0 && bloomStrength > 0) {
      const halo = this.reduce(
        this.bloomCtx,
        this.bloomCanvas,
        this.glowCanvas,
        bloom,
        LIGHT_SHIFT + BLOOM_SHIFT,
      );
      this.ctx.globalAlpha = clamp01(bloomStrength);
      this.ctx.drawImage(halo, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  }

  /** One layer, blurred at a fraction of its size. `copy` saves clearing it first. */
  private reduce(
    ctx: CanvasRenderingContext2D,
    into: HTMLCanvasElement,
    source: HTMLCanvasElement,
    blur: number,
    shift: number,
  ): HTMLCanvasElement {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'copy';
    // Shrinking a layer and stretching it back is itself a blur — a box one
    // reduced pixel wide. Below the point where an explicit blur would add
    // anything to that, it is skipped, because a filtered draw is the most
    // expensive kind there is.
    const radius = (blur * this.pixelRatio) / (1 << shift);
    if (radius >= 0.6) ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(source, 0, 0, into.width, into.height);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    return into;
  }
}
