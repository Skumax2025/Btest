/**
 * L1: visibility fans.
 *
 * Casts a fan of rays and records how far each one reaches. Light and sight both
 * use it, which is what stops a lamp from shining through a wall — the reason
 * lighting is a mechanic here and not a decoration.
 *
 * A ray that hits a wall does not stop dead at the wall face: it carries on to
 * the middle of that tile and no further. A face-lit wall reads as a wall; one
 * that stays black reads as a hole in the floor, and one the light crosses reads
 * as no wall at all. The middle is the only stopping point that is both.
 *
 * How far "the middle" is gets measured perpendicular to the face the ray
 * crossed, never along the ray. Along the ray, a ray that clips a corner travels
 * almost nothing before leaving the tile again and a ray straight through
 * travels a full tile — which put a sawtooth on every wall in the game. Measured
 * against the face, every ray stops on the same plane half a tile in, and the
 * lit band has an edge as straight as the wall it is on.
 *
 * Reach is kept separately from the polygon so a single cast can serve several
 * radii — the player's line of sight and their much smaller bubble of vision
 * come from one fan, and therefore can never disagree about where a wall is.
 */

import { castRay } from './raycast';
import type { SolidSampler } from './collision';

export interface FanOptions {
  readonly rayCount: number;
  readonly tileSize: number;
  /** Radians; use Math.PI for a full circle. */
  readonly halfAngle: number;
  /** Centre direction of the fan, in radians. */
  readonly facing: number;
  /**
   * Share of a blocking tile a ray may enter, measured perpendicular to the face
   * it crossed. At 0.5 light stops on the wall's midplane; anything below 1
   * keeps it out of the room behind.
   */
  readonly wallPenetration: number;
}

const rayCountOf = (options: FanOptions): number => Math.max(3, options.rayCount);

/** Direction of ray `index`. A full circle is anchored to the world, not to the
 *  viewer, so the fan does not swim while the player turns on the spot. */
export const fanAngle = (index: number, options: FanOptions): number => {
  const count = rayCountOf(options);
  const full = options.halfAngle >= Math.PI;
  const span = full ? Math.PI * 2 : options.halfAngle * 2;
  const start = full ? 0 : options.facing - options.halfAngle;
  return start + (span / (full ? count : count - 1)) * index;
};

/**
 * How far each ray of the fan reaches, in world units. One entry per ray; the
 * caller turns any prefix of that reach into a polygon with `fanPolygon`.
 */
export const castFan = (
  originX: number,
  originY: number,
  radius: number,
  isSolid: SolidSampler,
  options: FanOptions,
  out?: Float32Array,
): Float32Array => {
  const count = rayCountOf(options);
  const reach = out && out.length === count ? out : new Float32Array(count);
  const penetration = Math.min(Math.max(options.wallPenetration, 0), 1);
  for (let i = 0; i < count; i++) {
    const angle = fanAngle(i, options);
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
    if (!hit.blocked) {
      reach[i] = radius;
      continue;
    }
    reach[i] = Math.min(
      wallReach(originX, originY, dirX, dirY, hit, options.tileSize, penetration, isSolid),
      radius,
    );
  }
  return reach;
};

/**
 * Where a ray that has met a wall is allowed to stop.
 *
 * The target is half a tile in, measured against the face the ray crossed. Which
 * tile that lands in is not assumed: the walk steps on through the wall mass and
 * stops the moment the next tile would be open floor, so light entering a wall
 * at a corner cannot slip out of its far side. Travel along the ray is capped at
 * one tile, so a ray that grazes into a wall almost parallel to it cannot run
 * away down the inside of it.
 */
const wallReach = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  hit: { distance: number; axis: 0 | 1; tx: number; ty: number },
  tileSize: number,
  penetration: number,
  isSolid: SolidSampler,
): number => {
  if (penetration <= 0) return hit.distance;
  const component = Math.abs(hit.axis === 0 ? dirX : dirY);
  if (component === 0) return hit.distance;
  const target = hit.distance + Math.min((tileSize * penetration) / component, tileSize);

  let tx = hit.tx;
  let ty = hit.ty;
  const stepX = dirX > 0 ? 1 : -1;
  const stepY = dirY > 0 ? 1 : -1;
  const deltaX = dirX === 0 ? Infinity : Math.abs(tileSize / dirX);
  const deltaY = dirY === 0 ? Infinity : Math.abs(tileSize / dirY);
  let sideX =
    dirX === 0
      ? Infinity
      : dirX > 0
        ? ((tx + 1) * tileSize - originX) / dirX
        : (originX - tx * tileSize) / -dirX;
  let sideY =
    dirY === 0
      ? Infinity
      : dirY > 0
        ? ((ty + 1) * tileSize - originY) / dirY
        : (originY - ty * tileSize) / -dirY;

  // At most one tile of travel, so at most a handful of boundaries to cross.
  for (let step = 0; step < 4; step++) {
    const boundary = Math.min(sideX, sideY);
    if (boundary >= target) return target;
    if (sideX < sideY) {
      sideX += deltaX;
      tx += stepX;
    } else {
      sideY += deltaY;
      ty += stepY;
    }
    if (!isSolid(tx, ty)) return boundary;
  }
  return target;
};

/**
 * Flat [x0, y0, x1, y1, ...] ring of the area a fan covers, in world units,
 * clamped to `radius`. Passing a radius smaller than the one the fan was cast at
 * is exact, not an approximation: a ray either stopped at a wall or ran to the
 * end, and both cases clamp correctly.
 *
 * `from` and `count` take a contiguous slice of the fan instead of all of it,
 * which is how a cone is drawn as a stack of narrowing wedges off a single cast.
 */
export const fanPolygon = (
  originX: number,
  originY: number,
  reach: Float32Array,
  radius: number,
  options: FanOptions,
  out?: Float32Array,
  from = 0,
  count = reach.length,
): Float32Array => {
  const start = Math.max(0, Math.min(from, reach.length - 1));
  const total = Math.max(1, Math.min(count, reach.length - start));
  const points = out && out.length === total * 2 ? out : new Float32Array(total * 2);
  for (let i = 0; i < total; i++) {
    const angle = fanAngle(start + i, options);
    const distance = Math.min(reach[start + i], radius);
    points[i * 2] = originX + Math.cos(angle) * distance;
    points[i * 2 + 1] = originY + Math.sin(angle) * distance;
  }
  return points;
};

/** Cast and shape in one go, for a fan used at a single radius. */
export const visibilityPolygon = (
  originX: number,
  originY: number,
  radius: number,
  isSolid: SolidSampler,
  options: FanOptions,
  out?: Float32Array,
): Float32Array =>
  fanPolygon(originX, originY, castFan(originX, originY, radius, isSolid, options), radius, options, out);
