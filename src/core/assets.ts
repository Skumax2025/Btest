/**
 * L0: asset access.
 *
 * Game code only ever asks the store for a sprite id. Today the store builds
 * placeholder sprites procedurally from shape specs; swapping in an atlas means
 * writing another `SpriteProvider` and changing one line at the entry point.
 */

export interface Sprite {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  readonly sx: number;
  readonly sy: number;
}

export type ShapeSpec =
  | { readonly kind: 'rect'; readonly color: string; readonly inset?: number }
  | { readonly kind: 'circle'; readonly color: string; readonly inset?: number }
  | { readonly kind: 'ring'; readonly color: string; readonly inset?: number; readonly thickness?: number }
  | { readonly kind: 'bar'; readonly color: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly kind: 'noise'; readonly color: string; readonly density: number; readonly seed: number };

/** A placeholder sprite: a stack of primitive shapes drawn into an offscreen canvas. */
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

const drawShape = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  shape: ShapeSpec,
  width: number,
  height: number,
): void => {
  ctx.fillStyle = shape.color;
  switch (shape.kind) {
    case 'rect': {
      const inset = shape.inset ?? 0;
      ctx.fillRect(inset, inset, width - inset * 2, height - inset * 2);
      break;
    }
    case 'circle': {
      const inset = shape.inset ?? 0;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - inset, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ring': {
      const inset = shape.inset ?? 0;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.thickness ?? 2;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 2 - inset, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'bar': {
      ctx.fillRect(shape.x * width, shape.y * height, shape.w * width, shape.h * height);
      break;
    }
    case 'noise': {
      let state = shape.seed >>> 0;
      const total = Math.floor(width * height * shape.density);
      for (let i = 0; i < total; i++) {
        state = (Math.imul(state ^ (state >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0;
        const px = state % width;
        const py = (state >>> 8) % height;
        ctx.fillRect(px, py, 1, 1);
      }
      break;
    }
  }
};

/** Builds sprites on demand from placeholder specs and caches them. */
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
    ctx.imageSmoothingEnabled = false;
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
