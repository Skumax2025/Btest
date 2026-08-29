/**
 * L1: visibility polygons.
 *
 * Casts a fan of rays and returns where each one stops. Light and sight both
 * use it, which is what stops a lamp from shining through a wall — the reason
 * lighting is a mechanic here and not a decoration.
 */

import { castRay } from './raycast';
import type { SolidSampler } from './collision';

export interface VisibilityOptions {
  readonly rayCount: number;
  readonly tileSize: number;
  /** Radians; use Math.PI for a full circle. */
  readonly halfAngle: number;
  /** Centre direction of the fan, in radians. */
  readonly facing: number;
  /**
   * Distance past a blocking tile the ray is allowed to reach, in world units.
   * Without it the polygon stops at the wall face and the wall itself stays
   * unlit, which reads as a hole rather than a room.
   */
  readonly overshoot: number;
}

/** Flat [x0, y0, x1, y1, ...] ring of the visible area, in world units. */
export const visibilityPolygon = (
  originX: number,
  originY: number,
  radius: number,
  isSolid: SolidSampler,
  options: VisibilityOptions,
  out?: Float32Array,
): Float32Array => {
  const count = Math.max(3, options.rayCount);
  const points = out && out.length === count * 2 ? out : new Float32Array(count * 2);
  const full = options.halfAngle >= Math.PI;
  const span = full ? Math.PI * 2 : options.halfAngle * 2;
  const start = full ? 0 : options.facing - options.halfAngle;
  const stepAngle = span / (full ? count : count - 1);

  for (let i = 0; i < count; i++) {
    const angle = start + stepAngle * i;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const hit = castRay(
      originX,
      originY,
      originX + dirX * radius,
      originY + dirY * radius,
      options.tileSize,
      isSolid,
      true,
    );
    const distance = hit.blocked ? Math.min(hit.distance + options.overshoot, radius) : radius;
    points[i * 2] = originX + dirX * distance;
    points[i * 2 + 1] = originY + dirY * distance;
  }
  return points;
};

/** True when the point is inside the ring produced by `visibilityPolygon`. */
export const polygonContains = (points: Float32Array, x: number, y: number): boolean => {
  let inside = false;
  const count = points.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
