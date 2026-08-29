/**
 * L0: rendering abstraction.
 *
 * Everything above this file draws through the `Renderer` interface; only
 * `Canvas2DRenderer` knows what a CanvasRenderingContext2D is. The darkness
 * API is part of the interface on purpose — lighting is a mechanic, so it must
 * not be implemented by reaching for a raw context somewhere in game code.
 */

import type { CameraView } from './camera';
import type { Sprite } from './assets';

export interface TextStyle {
  readonly font: string;
  readonly color: string;
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
}

export interface SpriteOptions {
  readonly width?: number;
  readonly height?: number;
  readonly rotation?: number;
  readonly alpha?: number;
}

export interface Renderer {
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  beginFrame(clearColor: string): void;
  endFrame(): void;
  /** Pushes the world transform; all following coordinates are world units. */
  pushWorld(view: CameraView): void;
  popWorld(): void;
  setAlpha(alpha: number): void;
  fillRect(x: number, y: number, width: number, height: number, color: string): void;
  strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number,
  ): void;
  fillCircle(x: number, y: number, radius: number, color: string): void;
  strokeCircle(x: number, y: number, radius: number, color: string, lineWidth: number): void;
  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number): void;
  drawSprite(sprite: Sprite, x: number, y: number, options?: SpriteOptions): void;
  drawText(text: string, x: number, y: number, style: TextStyle): void;
  /** Full-viewport colour wash, in screen space. */
  overlay(color: string, alpha: number): void;
  /** Starts a darkness pass; light is subtracted from it until `endDarkness`. */
  beginDarkness(color: string, view: CameraView): void;
  punchLight(x: number, y: number, radius: number, strength: number): void;
  punchCone(
    x: number,
    y: number,
    angle: number,
    halfAngle: number,
    radius: number,
    strength: number,
  ): void;
  endDarkness(): void;
}

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

export class Canvas2DRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly darkCanvas: HTMLCanvasElement;
  private readonly darkCtx: CanvasRenderingContext2D;
  private pixelRatio = 1;
  private worldDepth = 0;

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

  overlay(color: string, alpha: number): void {
    const previousAlpha = this.ctx.globalAlpha;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = previousAlpha;
  }

  beginDarkness(color: string, view: CameraView): void {
    this.darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.darkCtx.globalCompositeOperation = 'source-over';
    this.darkCtx.globalAlpha = 1;
    this.darkCtx.fillStyle = color;
    this.darkCtx.fillRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);
    applyWorldTransform(this.darkCtx, view, this.pixelRatio);
    this.darkCtx.globalCompositeOperation = 'destination-out';
  }

  punchLight(x: number, y: number, radius: number, strength: number): void {
    if (radius <= 0 || strength <= 0) return;
    const gradient = this.darkCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(0.65, `rgba(0,0,0,${strength * 0.88})`);
    gradient.addColorStop(0.85, `rgba(0,0,0,${strength * 0.5})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    this.darkCtx.fillStyle = gradient;
    this.darkCtx.beginPath();
    this.darkCtx.arc(x, y, radius, 0, Math.PI * 2);
    this.darkCtx.fill();
  }

  punchCone(
    x: number,
    y: number,
    angle: number,
    halfAngle: number,
    radius: number,
    strength: number,
  ): void {
    if (radius <= 0 || strength <= 0) return;
    this.darkCtx.save();
    this.darkCtx.beginPath();
    this.darkCtx.moveTo(x, y);
    this.darkCtx.arc(x, y, radius, angle - halfAngle, angle + halfAngle);
    this.darkCtx.closePath();
    this.darkCtx.clip();
    const gradient = this.darkCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(0.7, `rgba(0,0,0,${strength * 0.6})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    this.darkCtx.fillStyle = gradient;
    this.darkCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    this.darkCtx.restore();
  }

  endDarkness(): void {
    this.darkCtx.globalCompositeOperation = 'source-over';
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.darkCanvas, 0, 0);
    this.ctx.restore();
  }
}
