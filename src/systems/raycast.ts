/**
 * L1: grid ray marching, shared by line of sight, lighting and sound occlusion.
 * Amanatides-Woo DDA — exact, allocation-free and deterministic.
 */

import type { SolidSampler } from './collision';

export interface RayHit {
  readonly blocked: boolean;
  /** Distance travelled before the first blocking tile, in world units. */
  readonly distance: number;
  /** Distance at which the ray leaves that blocking tile; `distance` when it hit nothing. */
  readonly exit: number;
  /**
   * Which face of the blocking tile the ray crossed: 0 for a vertical face, 1
   * for a horizontal one. Lighting measures how far it may enter a wall along
   * this axis, so that a wall lit at a glancing angle gets the same even band as
   * one lit head on.
   */
  readonly axis: 0 | 1;
  readonly tx: number;
  readonly ty: number;
  /** Number of blocking tiles crossed when the ray is allowed to continue. */
  readonly walls: number;
}

/**
 * Marches from (x0, y0) toward (x1, y1). When `stopAtFirst` the walk ends at the
 * first blocking tile; otherwise it counts how many blocking tiles it crossed,
 * which is what sound attenuation needs.
 */
export const castRay = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize: number,
  isSolid: SolidSampler,
  stopAtFirst: boolean,
): RayHit => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const total = Math.hypot(dx, dy);
  if (total === 0) {
    const tx = Math.floor(x0 / tileSize);
    const ty = Math.floor(y0 / tileSize);
    return { blocked: isSolid(tx, ty), distance: 0, exit: 0, axis: 0, tx, ty, walls: 0 };
  }
  const dirX = dx / total;
  const dirY = dy / total;
  let tx = Math.floor(x0 / tileSize);
  let ty = Math.floor(y0 / tileSize);
  const stepX = dirX > 0 ? 1 : -1;
  const stepY = dirY > 0 ? 1 : -1;
  const deltaX = dirX === 0 ? Infinity : Math.abs(tileSize / dirX);
  const deltaY = dirY === 0 ? Infinity : Math.abs(tileSize / dirY);
  let sideX =
    dirX === 0
      ? Infinity
      : dirX > 0
        ? ((tx + 1) * tileSize - x0) / dirX
        : (x0 - tx * tileSize) / -dirX;
  let sideY =
    dirY === 0
      ? Infinity
      : dirY > 0
        ? ((ty + 1) * tileSize - y0) / dirY
        : (y0 - ty * tileSize) / -dirY;

  let travelled = 0;
  let axis: 0 | 1 = 0;
  let walls = 0;
  // Bounded by the number of tiles the segment can possibly cross.
  const maxSteps = Math.ceil(total / tileSize) * 2 + 2;
  for (let step = 0; step < maxSteps; step++) {
    if (sideX < sideY) {
      travelled = sideX;
      sideX += deltaX;
      tx += stepX;
      axis = 0;
    } else {
      travelled = sideY;
      sideY += deltaY;
      ty += stepY;
      axis = 1;
    }
    if (travelled > total) break;
    if (isSolid(tx, ty)) {
      walls++;
      // Both sides have already been advanced past the entry face, so the
      // nearer of them is where this tile ends.
      if (stopAtFirst) {
        return { blocked: true, distance: travelled, exit: Math.min(sideX, sideY), axis, tx, ty, walls };
      }
    }
  }
  return { blocked: false, distance: total, exit: total, axis, tx, ty, walls };
};

export const hasLineOfSight = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize: number,
  isSolid: SolidSampler,
): boolean => !castRay(x0, y0, x1, y1, tileSize, isSolid, true).blocked;

/** Blocking tiles between two points — the currency of sound occlusion. */
export const wallsBetween = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize: number,
  isSolid: SolidSampler,
): number => castRay(x0, y0, x1, y1, tileSize, isSolid, false).walls;
