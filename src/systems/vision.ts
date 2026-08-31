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
 *
 * A plain fan puts every shadow edge on the nearest ray, and rounding it there
 * is what made shadows crawl: walking past a corner slides the true edge
 * smoothly, but the drawn one can only jump a whole ray at a time, so it ticks
 * sideways once per step. The fan is therefore refined afterwards — wherever two
 * neighbouring rays disagree wildly there is a corner between them, and a few
 * bisections find the angle of it. The polygon then pivots about the corner
 * itself, which is what the eye expects.
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

/** How far one ray reaches, in world units. */

// Scratch variables for zero-allocation corner topology
let lastHitTx = 0;
let lastHitTy = 0;
let lastHitAxis: 0 | 1 = 0;

const MAX_RAYS = 2048; // С запасом под плотные лучи
const scratchTx = new Int16Array(MAX_RAYS);
const scratchTy = new Int16Array(MAX_RAYS);
const scratchAxis = new Int8Array(MAX_RAYS);

const rayReach = (
  originX: number,
  originY: number,
  angle: number,
  radius: number,
  isSolid: SolidSampler,
  options: FanOptions,
): number => {
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

  lastHitTx = hit.tx;
  lastHitTy = hit.ty;
  lastHitAxis = hit.axis;

  if (!hit.blocked) return radius;

  const penetration = Math.min(Math.max(options.wallPenetration, 0), 1);
  return Math.min(
    wallReach(originX, originY, dirX, dirY, hit, options.tileSize, penetration, isSolid),
    radius,
  );
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
  for (let i = 0; i < count; i++) {
    reach[i] = rayReach(originX, originY, fanAngle(i, options), radius, isSolid, options);
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

  // Ограничиваем путь внутри стены так, чтобы луч никогда не проникал глубже, 
  // чем на `penetration` по ЛЮБОЙ из осей. Это не дает скользящим лучам
  // работать как оптоволокно и вылезать с обратной стороны стен толщиной в 1 тайл.
  const maxInside = (tileSize * penetration) / Math.max(Math.abs(dirX), Math.abs(dirY));
  const target = hit.distance + maxInside;

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

  // Максимум один тайл пути, так что пересекаем лишь пару границ.
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
 * A cast fan: `count` pairs of [angle, reach] in increasing angle. Most come
 * from the even ray fan; the rest are the pairs straddling a corner, which the
 * refinement pass inserts so the shadow edge sits on the corner instead of on
 * the nearest ray.
 */
export interface Fan {
  samples: Float32Array;
  count: number;
  /** Scratch for the even pass, kept so a per-frame fan allocates nothing. */
  reach: Float32Array;
}

export const createFan = (): Fan => ({
  samples: new Float32Array(0),
  count: 0,
  reach: new Float32Array(0),
});

/** A gap this much wider than a tile between neighbouring rays is a corner. */
const SILHOUETTE = 0.75;
/** Bisections per corner. Each halves the error and costs one ray. */
const REFINE_STEPS = 7;
/** Corners refined per fan. A cast that finds more than this is in open ruins. */
const REFINE_LIMIT = 96;

/**
 * Casts the even fan, then pins down every silhouette in it.
 *
 * Two neighbouring rays whose reach differs by more than a tile have a corner
 * between them. Bisecting on which of the two ends the midpoint belongs to walks
 * the interval down onto that corner, and the pair of samples left either side
 * of it is the shadow edge. Without this the edge can only ever lie on a ray, so
 * it steps sideways a whole ray at a time as the player walks — the shimmer this
 * exists to remove.
 */
export const traceFan = (
  originX: number,
  originY: number,
  radius: number,
  isSolid: SolidSampler,
  options: FanOptions,
  into: Fan = createFan(),
): Fan => {
  const rays = rayCountOf(options);
  const fan = into;
  if (fan.reach.length !== rays) fan.reach = new Float32Array(rays);

  // Layout: (angle, reach) pairs. (low, corner, high)
  const capacity = (rays + REFINE_LIMIT * 3) * 2;
  if (fan.samples.length !== capacity) fan.samples = new Float32Array(capacity);

  const reach = fan.reach;
  for (let i = 0; i < rays; i++) {
    reach[i] = rayReach(originX, originY, fanAngle(i, options), radius, isSolid, options);
    scratchTx[i] = lastHitTx;
    scratchTy[i] = lastHitTy;
    scratchAxis[i] = lastHitAxis;
  }

  const { samples } = fan;
  const gap = options.tileSize * (1 + SILHOUETTE);
  const wraps = options.halfAngle >= Math.PI;

  let at = 0;
  let refined = 0;
  const pen = Math.min(Math.max(options.wallPenetration, 0), 1);

  for (let i = 0; i < rays; i++) {
    const angle = fanAngle(i, options);
    const previous = i === 0 ? (wraps ? rays - 1 : -1) : i - 1;

    let needsRefinement = false;
    if (previous >= 0 && refined < REFINE_LIMIT) {
      const distGap = Math.abs(reach[i] - reach[previous]) > gap;
      // Is it a continuous flat wall section?
      const isFlatWall =
        scratchAxis[i] === scratchAxis[previous] &&
        (scratchAxis[i] === 0 ? scratchTx[i] === scratchTx[previous] : scratchTy[i] === scratchTy[previous]);
      if (distGap || !isFlatWall) {
        needsRefinement = true;
      }
    }

    if (needsRefinement) {
      refined++;
      let lowAngle = i === 0 ? angle - (fanAngle(1, options) - angle) : fanAngle(previous, options);
      let highAngle = angle;

      let lowReach = reach[previous];
      let lowTx = scratchTx[previous];
      let lowTy = scratchTy[previous];
      let lowAxis = scratchAxis[previous];

      let highReach = reach[i];
      let highTx = scratchTx[i];
      let highTy = scratchTy[i];
      let highAxis = scratchAxis[i];

      for (let step = 0; step < REFINE_STEPS; step++) {
        const midAngle = (lowAngle + highAngle) / 2;
        const midReach = rayReach(originX, originY, midAngle, radius, isSolid, options);
        const midTx = lastHitTx;
        const midTy = lastHitTy;
        const midAxis = lastHitAxis;

        let midIsLow: boolean;
        const sameSurfaceAsLow = midAxis === lowAxis && (lowAxis === 0 ? midTx === lowTx : midTy === lowTy);
        const sameSurfaceAsHigh = midAxis === highAxis && (highAxis === 0 ? midTx === highTx : midTy === highTy);

        if (sameSurfaceAsLow && !sameSurfaceAsHigh) {
          midIsLow = true;
        } else if (sameSurfaceAsHigh && !sameSurfaceAsLow) {
          midIsLow = false;
        } else {
          const threshold = (lowReach + highReach) / 2;
          midIsLow = (midReach < threshold) === (lowReach < highReach);
        }

        if (midIsLow) {
          lowAngle = midAngle;
          lowReach = midReach;
          lowTx = midTx;
          lowTy = midTy;
          lowAxis = midAxis;
        } else {
          highAngle = midAngle;
          highReach = midReach;
          highTx = midTx;
          highTy = midTy;
          highAxis = midAxis;
        }
      }

      samples[at * 2] = lowAngle;
      samples[at * 2 + 1] = lowReach;
      at++;

      // Вставляем идеальный 90-градусный угол ТОЛЬКО если оба луча ударили
      // в смежные поверхности, образуя непрерывный угол. 
      // Если это край силуэта (разрыв по дальности), не пытаемся их сшивать.
      const isConnected = 
        Math.abs(lowTx - highTx) <= 1 && 
        Math.abs(lowTy - highTy) <= 1 && 
        Math.abs(lowReach - highReach) <= options.tileSize * 1.5;

      if (lowAxis !== highAxis && isConnected) {
        let cx = 0;
        let cy = 0;
        if (lowAxis === 0) {
          const dirX = Math.cos(lowAngle);
          cx = (dirX > 0 ? lowTx : lowTx + 1) * options.tileSize + (dirX > 0 ? pen : -pen) * options.tileSize;
          const dirY = Math.sin(highAngle);
          cy = (dirY > 0 ? highTy : highTy + 1) * options.tileSize + (dirY > 0 ? pen : -pen) * options.tileSize;
        } else {
          const dirY = Math.sin(lowAngle);
          cy = (dirY > 0 ? lowTy : lowTy + 1) * options.tileSize + (dirY > 0 ? pen : -pen) * options.tileSize;
          const dirX = Math.cos(highAngle);
          cx = (dirX > 0 ? highTx : highTx + 1) * options.tileSize + (dirX > 0 ? pen : -pen) * options.tileSize;
        }

        samples[at * 2] = (lowAngle + highAngle) / 2;
        samples[at * 2 + 1] = Math.hypot(cx - originX, cy - originY);
        at++;
      }

      samples[at * 2] = highAngle;
      samples[at * 2 + 1] = highReach;
      at++;
    } else {
      samples[at * 2] = angle;
      samples[at * 2 + 1] = reach[i];
      at++;
    }
  }

  fan.count = at;
  return fan;
};
/**
 * Flat [x0, y0, x1, y1, ...] ring of the area a fan covers, in world units,
 * clamped to `radius`. Passing a radius smaller than the one the fan was cast at
 * is exact, not an approximation: a ray either stopped at a wall or ran to the
 * end, and both cases clamp correctly.
 */
export const fanPolygon = (
  originX: number,
  originY: number,
  fan: Fan,
  radius: number,
  out?: Float32Array,
): Float32Array => {
  const { samples, count } = fan;
  const points = out && out.length === count * 2 ? out : new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const distance = Math.min(samples[i * 2 + 1], radius);
    points[i * 2] = originX + Math.cos(samples[i * 2]) * distance;
    points[i * 2 + 1] = originY + Math.sin(samples[i * 2]) * distance;
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
): Float32Array =>
  fanPolygon(originX, originY, traceFan(originX, originY, radius, isSolid, options), radius);
