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

/**
 * Brightness of a light sampled at evenly spaced offsets from its centre to its
 * rim, first sample at the centre. The shape of a light is a game number, so it
 * is decided above this layer and handed down; the backend only turns the
 * samples into a gradient.
 */
export type LightProfile = readonly number[];

/**
 * A light that points somewhere. The backend turns the profile and the cone into
 * one soft shape rather than stacking pools down the aim line: overlapping pools
 * compound, and compounding is what put rings and a blown-out core in the beam.
 */
export interface LightCone {
  /** Aim direction, in radians. */
  readonly facing: number;
  /** Half-angle at which the beam has fallen to nothing. */
  readonly halfAngle: number;
  /** Share of that half-angle held at full brightness before the edge softens. */
  readonly core: number;
  /** Share of the radius over which the cone opens out into a round bulb at the
   *  source, so the torch has a body instead of a mathematical point. */
  readonly bulb: number;
}

/** The warm bloom a real light source adds on top of simply being visible. */
export interface LightGlow {
  readonly colour: string;
  readonly strength: number;
  readonly profile: LightProfile;
}

export interface PolygonLight {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Brightness at the centre, 0..1. */
  readonly strength: number;
  readonly profile: LightProfile;
  /** Omitted by light that only reveals, such as the player's own eyes. */
  readonly glow?: LightGlow;
  /** Omitted by light that shines in every direction. */
  readonly cone?: LightCone;
}

/** How soft the darkness pass is. Screen pixels, so it does not change with zoom. */
export interface DarknessOptions {
  /** Blur on the light mask — the penumbra every shadow edge gets. */
  readonly softness: number;
  /** Blur on the bloom layer. */
  readonly bloom: number;
  /** How much of the blurred bloom is added on top of its own crisp core. */
  readonly bloomStrength: number;
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
  /** Flat-filled polygon in world units — the raised faces of a wall. */
  fillPolygon(points: ArrayLike<number>, color: string): void;
  /**
   * Rect filled with a ramp running from its origin to (dirX, dirY), both
   * measured from the rect's own corner so the ramp can be reused by every tile
   * that wants the same one.
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
  ): void;
  /** Full-viewport colour wash, in screen space. */
  overlay(color: string, alpha: number): void;
  /** Darkens the corners of the frame. Screen space, drawn over everything. */
  vignette(color: string, strength: number, inner: number): void;
  /** Starts a darkness pass; light is subtracted from it until `endDarkness`. */
  beginDarkness(color: string, view: CameraView, options: DarknessOptions): void;
  /**
   * Restricts every following light punch to a polygon — the player's own line
   * of sight. Without it a lit room is visible through the wall in front of it.
   */
  beginVisibility(points: Float32Array): void;
  endVisibility(): void;
  /** Light clipped to a visibility ring, so walls actually cast shadows. */
  punchPolygon(points: Float32Array, light: PolygonLight): void;
  endDarkness(): void;
}
