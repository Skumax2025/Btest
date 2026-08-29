/** L0: view transform. Knows a target point, a zoom and a viewport — nothing else. */

import { clamp, lerp } from './math';

export interface CameraView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  width = 1;
  height = 1;

  private previousX = 0;
  private previousY = 0;
  private shakeAmount = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.previousX = x;
    this.previousY = y;
  }

  /** Called once per simulation tick; `smoothing` in [0, 1] per tick. */
  follow(targetX: number, targetY: number, smoothing: number): void {
    this.previousX = this.x;
    this.previousY = this.y;
    const t = clamp(smoothing, 0, 1);
    this.x = lerp(this.x, targetX, t);
    this.y = lerp(this.y, targetY, t);
  }

  addShake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Called once per rendered frame; `noise` in [-1, 1] drives the offset. */
  updateShake(decay: number, noiseX: number, noiseY: number): void {
    this.shakeOffsetX = noiseX * this.shakeAmount;
    this.shakeOffsetY = noiseY * this.shakeAmount;
    this.shakeAmount *= decay;
    if (this.shakeAmount < 0.01) this.shakeAmount = 0;
  }

  /** Interpolated view for rendering between two simulation ticks. */
  view(alpha: number): CameraView {
    return {
      x: lerp(this.previousX, this.x, alpha) + this.shakeOffsetX,
      y: lerp(this.previousY, this.y, alpha) + this.shakeOffsetY,
      zoom: this.zoom,
      width: this.width,
      height: this.height,
    };
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.width / 2) / this.zoom + this.x,
      y: (screenY - this.height / 2) / this.zoom + this.y,
    };
  }
}

export const worldToScreen = (
  view: CameraView,
  worldX: number,
  worldY: number,
): { x: number; y: number } => ({
  x: (worldX - view.x) * view.zoom + view.width / 2,
  y: (worldY - view.y) * view.zoom + view.height / 2,
});

/** World-space rectangle currently covered by the view, expanded by `pad`. */
export const viewBounds = (
  view: CameraView,
  pad = 0,
): { minX: number; minY: number; maxX: number; maxY: number } => {
  const halfW = view.width / (2 * view.zoom) + pad;
  const halfH = view.height / (2 * view.zoom) + pad;
  return {
    minX: view.x - halfW,
    minY: view.y - halfH,
    maxX: view.x + halfW,
    maxY: view.y + halfH,
  };
};
