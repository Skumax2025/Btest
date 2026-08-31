/** L0: the Canvas 2D backend for `Renderer`. The only file that touches a 2d context. */

import type { CameraView } from './camera';
import type { Sprite } from './assets';
import type { LightProfile, PolygonLight, Renderer, SpriteOptions, TextStyle } from './renderer';

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

/** Darkness is subtracted, so what it removes is alpha over black. */
const BLACK = '0,0,0';

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

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
  private readonly glowCanvas: HTMLCanvasElement;
  private readonly glowCtx: CanvasRenderingContext2D;
  /** Both offscreen layers, so a visibility clip is applied to each of them. */
  private readonly darknessLayers: readonly CanvasRenderingContext2D[];
  /** Colour channels of a glow colour, resolved once by the context itself. */
  private readonly channels = new Map<string, string>();
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
    this.glowCanvas = document.createElement('canvas');
    const glowCtx = this.glowCanvas.getContext('2d');
    if (!glowCtx) throw new Error('2d canvas context unavailable for the bloom layer');
    this.glowCtx = glowCtx;
    this.darknessLayers = [this.darkCtx, this.glowCtx];
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
    this.glowCanvas.width = this.canvas.width;
    this.glowCanvas.height = this.canvas.height;
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

  strokeArc(
    x: number,
    y: number,
    radius: number,
    from: number,
    to: number,
    color: string,
    lineWidth: number,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0, radius), from, to);
    this.ctx.stroke();
    this.ctx.lineCap = 'butt';
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
  beginDarkness(color: string, view: CameraView): void {
    this.darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.darkCtx.globalCompositeOperation = 'source-over';
    this.darkCtx.globalAlpha = 1;
    this.darkCtx.fillStyle = color;
    this.darkCtx.fillRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);

    this.glowCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.glowCtx.globalCompositeOperation = 'source-over';
    this.glowCtx.globalAlpha = 1;
    this.glowCtx.clearRect(0, 0, this.glowCanvas.width, this.glowCanvas.height);

    applyWorldTransform(this.darkCtx, view, this.pixelRatio);
    applyWorldTransform(this.glowCtx, view, this.pixelRatio);
    this.darkCtx.globalCompositeOperation = 'destination-out';
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
    if (light.strength > 0) {
      fillProfile(this.darkCtx, points, light, light.strength, light.profile, BLACK);
    }
    const { glow } = light;
    if (glow && glow.strength > 0) {
      fillProfile(this.glowCtx, points, light, glow.strength, glow.profile, this.channelsOf(glow.colour));
    }
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

  endDarkness(): void {
    this.darkCtx.globalCompositeOperation = 'source-over';
    this.glowCtx.globalCompositeOperation = 'source-over';
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    // Dim first, then let the lights themselves put colour back into what is lit.
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.darkCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(this.glowCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  }
}
