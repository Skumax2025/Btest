/**
 * L0: asset access.
 *
 * Game code only ever asks the store for a sprite id. Today the store builds
 * sprites procedurally from shape specs; swapping in an atlas means writing
 * another `SpriteProvider` and changing one line at the entry point.
 *
 * Every coordinate in a shape is a fraction of the sprite's own box, so one spec
 * describes a shape at any resolution and an icon can be authored once and drawn
 * at 18 pixels on the floor or 44 in the bag. Radii and stroke widths are
 * fractions of the shorter side, which is what keeps a circle round in a box
 * that is not square.
 */

export interface Sprite {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  readonly sx: number;
  readonly sy: number;
}

/** A stop on a gradient: where it sits, in [0, 1], and the colour there. */
export interface ColorStop {
  readonly at: number;
  readonly color: string;
}

export type ShapeSpec =
  /** Axis-aligned box, optionally with rounded corners. Defaults to the whole sprite. */
  | {
      readonly kind: 'rect';
      readonly color: string;
      readonly x?: number;
      readonly y?: number;
      readonly w?: number;
      readonly h?: number;
      readonly radius?: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'ellipse';
      readonly color: string;
      readonly cx?: number;
      readonly cy?: number;
      readonly rx?: number;
      readonly ry?: number;
      readonly rotation?: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'ring';
      readonly color: string;
      readonly cx?: number;
      readonly cy?: number;
      readonly r?: number;
      readonly width?: number;
      readonly alpha?: number;
    }
  /** Closed polygon, as a flat [x, y, x, y, ...] list of fractions. */
  | {
      readonly kind: 'poly';
      readonly color: string;
      readonly points: readonly number[];
      readonly alpha?: number;
    }
  | {
      readonly kind: 'line';
      readonly color: string;
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly width?: number;
      readonly round?: boolean;
      readonly alpha?: number;
    }
  /** Deterministic speckle — the same seed always paints the same grain. */
  | {
      readonly kind: 'noise';
      readonly color: string;
      readonly density: number;
      readonly seed: number;
      /** Speckle size in pixels; 1 is a single dot. */
      readonly cell?: number;
      readonly x?: number;
      readonly y?: number;
      readonly w?: number;
      readonly h?: number;
      readonly alpha?: number;
    }
  /** Linear gradient across a box, at `angle` radians from left to right. */
  | {
      readonly kind: 'gradient';
      readonly stops: readonly ColorStop[];
      readonly angle?: number;
      readonly x?: number;
      readonly y?: number;
      readonly w?: number;
      readonly h?: number;
      readonly alpha?: number;
    }
  /** A soft pool of colour fading to nothing at its rim. */
  | {
      readonly kind: 'glow';
      readonly color: string;
      readonly cx?: number;
      readonly cy?: number;
      readonly r?: number;
      readonly alpha?: number;
    };

/** A procedural sprite: a stack of primitive shapes drawn into an offscreen canvas. */
export interface PlaceholderSpec {
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly ShapeSpec[];
}

export interface SpriteProvider {
  sprite(id: string): Sprite;
}

export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement | OffscreenCanvas;

export const domCanvasFactory: CanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Smoothstep, so a soft pool has no ring where its gradient stops are placed. */
const ease = (t: number): number => t * t * (3 - 2 * t);

const roundedPath = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void => {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawShape = (ctx: Ctx, shape: ShapeSpec, width: number, height: number): void => {
  const shorter = Math.min(width, height);
  ctx.globalAlpha = shape.alpha ?? 1;
  ctx.fillStyle = 'color' in shape ? shape.color : '#000000';
  switch (shape.kind) {
    case 'rect': {
      const x = (shape.x ?? 0) * width;
      const y = (shape.y ?? 0) * height;
      const w = (shape.w ?? 1) * width;
      const h = (shape.h ?? 1) * height;
      if (shape.radius) {
        roundedPath(ctx, x, y, w, h, shape.radius * shorter);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(
        (shape.cx ?? 0.5) * width,
        (shape.cy ?? 0.5) * height,
        Math.max(0, (shape.rx ?? 0.5) * width),
        Math.max(0, (shape.ry ?? 0.5) * height),
        shape.rotation ?? 0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case 'ring': {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = (shape.width ?? 0.06) * shorter;
      ctx.beginPath();
      ctx.arc(
        (shape.cx ?? 0.5) * width,
        (shape.cy ?? 0.5) * height,
        Math.max(0, (shape.r ?? 0.4) * shorter),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case 'poly': {
      const points = shape.points;
      if (points.length < 6) break;
      ctx.beginPath();
      ctx.moveTo(points[0] * width, points[1] * height);
      for (let i = 2; i < points.length - 1; i += 2) {
        ctx.lineTo(points[i] * width, points[i + 1] * height);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'line': {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = (shape.width ?? 0.06) * shorter;
      ctx.lineCap = shape.round ? 'round' : 'butt';
      ctx.beginPath();
      ctx.moveTo(shape.x1 * width, shape.y1 * height);
      ctx.lineTo(shape.x2 * width, shape.y2 * height);
      ctx.stroke();
      ctx.lineCap = 'butt';
      break;
    }
    case 'noise': {
      const x = (shape.x ?? 0) * width;
      const y = (shape.y ?? 0) * height;
      const w = (shape.w ?? 1) * width;
      const h = (shape.h ?? 1) * height;
      const cell = Math.max(1, Math.round(shape.cell ?? 1));
      const columns = Math.max(1, Math.floor(w / cell));
      const rows = Math.max(1, Math.floor(h / cell));
      let state = shape.seed >>> 0;
      const total = Math.floor(columns * rows * shape.density);
      for (let i = 0; i < total; i++) {
        state = (Math.imul(state ^ (state >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0;
        const px = state % columns;
        const py = (state >>> 8) % rows;
        ctx.fillRect(x + px * cell, y + py * cell, cell, cell);
      }
      break;
    }
    case 'gradient': {
      const x = (shape.x ?? 0) * width;
      const y = (shape.y ?? 0) * height;
      const w = (shape.w ?? 1) * width;
      const h = (shape.h ?? 1) * height;
      const angle = shape.angle ?? 0;
      const dx = (Math.cos(angle) * w) / 2;
      const dy = (Math.sin(angle) * h) / 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      for (const stop of shape.stops) gradient.addColorStop(Math.min(1, Math.max(0, stop.at)), stop.color);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'glow': {
      const cx = (shape.cx ?? 0.5) * width;
      const cy = (shape.cy ?? 0.5) * height;
      const r = Math.max(1e-3, (shape.r ?? 0.5) * shorter);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      // Sampled rather than two-stop: a linear fade to transparent has a visible
      // shoulder exactly where a light should be softest.
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        gradient.addColorStop(t, withAlpha(shape.color, ease(1 - t)));
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    }
  }
  ctx.globalAlpha = 1;
};

/** `#ffcc66` at a given opacity, without asking the caller to write rgba by hand. */
const withAlpha = (color: string, alpha: number): string => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const value = parseInt(hex[1], 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha.toFixed(3)})`;
};

/** Builds sprites on demand from their specs and caches them. */
export class PlaceholderSpriteProvider implements SpriteProvider {
  private readonly cache = new Map<string, Sprite>();

  constructor(
    private readonly specs: Readonly<Record<string, PlaceholderSpec>>,
    private readonly createCanvas: CanvasFactory,
    private readonly fallbackId: string,
  ) {}

  sprite(id: string): Sprite {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const spec = this.specs[id] ?? this.specs[this.fallbackId];
    if (!spec) throw new Error(`no placeholder spec for "${id}" and no fallback`);
    const canvas = this.createCanvas(spec.width, spec.height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('2d context unavailable for placeholder sprite');
    for (const shape of spec.shapes) drawShape(ctx, shape, spec.width, spec.height);
    const sprite: Sprite = {
      id,
      width: spec.width,
      height: spec.height,
      source: canvas as CanvasImageSource,
      sx: 0,
      sy: 0,
    };
    this.cache.set(id, sprite);
    return sprite;
  }
}
