/**
 * L0: rendering abstraction.
 *
 * Everything above this file draws through the `Renderer` interface; only the
 * canvas backend knows what a CanvasRenderingContext2D is. The darkness API is
 * part of the interface on purpose — lighting is a mechanic, so it must not be
 * implemented by reaching for a raw context somewhere in game code.
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
  /**
   * Restricts every following light punch to a polygon — the player's own line
   * of sight. Without it a lit room is visible through the wall in front of it.
   */
  beginVisibility(points: Float32Array): void;
  endVisibility(): void;
  /** Light clipped to a visibility ring, so walls actually cast shadows. */
  punchPolygon(
    points: Float32Array,
    x: number,
    y: number,
    radius: number,
    strength: number,
  ): void;
  endDarkness(): void;
}
