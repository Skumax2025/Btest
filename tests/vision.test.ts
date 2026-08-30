/**
 * The one promise the lighting makes: light stops inside the wall it hits.
 *
 * Not at the wall — a wall whose face stays black reads as a hole in the floor —
 * and never past it, which is the bug this suite exists to keep fixed. The
 * middle of the tile is the only stopping point that satisfies both.
 */
import { describe, expect, it } from 'vitest';
import { castRay } from '@systems/raycast';
import { castFan, fanAngle, fanPolygon, traceFan, visibilityPolygon } from '@systems/vision';
import type { FanOptions } from '@systems/vision';

const TILE = 32;

/**
 *   0 1 2 3 4 5 6
 * 0 # # # # # # #
 * 1 # . . # . . #
 * 2 # . . # . . #
 * 3 # . . . . . #      the doorway
 * 4 # . . # . . #
 * 5 # # # # # # #
 */
const MAP = ['#######', '#..#..#', '#..#..#', '#.....#', '#..#..#', '#######'];

const isSolid = (tx: number, ty: number): boolean =>
  ty < 0 || ty >= MAP.length || tx < 0 || tx >= MAP[ty].length || MAP[ty][tx] === '#';

const centre = (tx: number, ty: number): [number, number] => [(tx + 0.5) * TILE, (ty + 0.5) * TILE];

const options = (overrides: Partial<FanOptions> = {}): FanOptions => ({
  rayCount: 180,
  tileSize: TILE,
  halfAngle: Math.PI,
  facing: 0,
  wallPenetration: 0.5,
  ...overrides,
});

/** Shoelace area of a closed ring of world points. */
const area = (points: Float32Array): number => {
  let total = 0;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    total += points[j] * points[i + 1] - points[i] * points[j + 1];
  }
  return Math.abs(total) / 2;
};

/** Ray-crossing test; the polygon is a closed ring of world points. */
const contains = (points: Float32Array, x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const yi = points[i + 1];
    const yj = points[j + 1];
    if (yi > y !== yj > y) {
      const t = (y - yi) / (yj - yi);
      if (x < points[i] + t * (points[j] - points[i])) inside = !inside;
    }
  }
  return inside;
};

describe('visibility fan', () => {
  it('stops every ray inside the wall it hits, never beyond it', () => {
    const [ox, oy] = centre(1, 1);
    const config = options();
    const reach = castFan(ox, oy, 600, isSolid, config);
    for (let i = 0; i < reach.length; i++) {
      const angle = fanAngle(i, config);
      const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
      const hit = castRay(ox, oy, ox + dx * 600, oy + dy * 600, TILE, isSolid, true);
      expect(hit.blocked, `ray ${i} should meet a wall in a closed room`).toBe(true);
      // Reach is kept as float32, hence the tolerance rather than an equality.
      expect(reach[i], `ray ${i}`).toBeGreaterThanOrEqual(hit.distance - 1e-4);

      // Wherever it stopped is wall. Nothing ever comes out the other side.
      const stopX = ox + dx * (reach[i] - 1e-4);
      const stopY = oy + dy * (reach[i] - 1e-4);
      expect(
        isSolid(Math.floor(stopX / TILE), Math.floor(stopY / TILE)),
        `ray ${i} stopped at ${stopX.toFixed(1)},${stopY.toFixed(1)}`,
      ).toBe(true);

      // And no deeper than the midplane of the face it came through.
      const face =
        hit.axis === 0 ? (hit.tx + (dx > 0 ? 0 : 1)) * TILE : (hit.ty + (dy > 0 ? 0 : 1)) * TILE;
      const depth = hit.axis === 0 ? Math.abs(stopX - face) : Math.abs(stopY - face);
      expect(depth, `ray ${i}`).toBeLessThanOrEqual(TILE * 0.5 + 1e-3);
    }
  });

  it('stops on a straight plane, not on a sawtooth', () => {
    // Every ray meeting the wall column head on has to stop at the same x, or
    // the lit strip along the wall ripples once per tile as the fan sweeps it.
    const [ox, oy] = centre(1, 2);
    const config = options({ rayCount: 512 });
    const reach = castFan(ox, oy, 600, isSolid, config);
    const stops: number[] = [];
    for (let i = 0; i < reach.length; i++) {
      const angle = fanAngle(i, config);
      const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
      const [stopX, stopY] = [ox + dx * reach[i], oy + dy * reach[i]];
      // Rays that ended on the near face of the wall column, clear of the
      // doorway lip — a ray that would slide out through the doorway stops on
      // that edge instead, which is the safety rule doing its job, not a ripple.
      if (dx <= 0 || stopY < 1.1 * TILE || stopY > 2.9 * TILE) continue;
      stops.push(stopX);
    }
    expect(stops.length).toBeGreaterThan(20);
    expect(Math.max(...stops) - Math.min(...stops)).toBeLessThan(0.01);
    expect(stops[0]).toBeCloseTo(3.5 * TILE, 2);
  });

  it('lands halfway into the wall for a ray that meets it square on', () => {
    const [ox, oy] = centre(1, 1);
    // One ray points along +x; the wall column at tx=3 spans x 96..128.
    const config = options({ rayCount: 4, halfAngle: 0.01, facing: 0 });
    const reach = castFan(ox, oy, 600, isSolid, config);
    for (let i = 0; i < reach.length; i++) {
      expect(ox + Math.cos(fanAngle(i, config)) * reach[i]).toBeCloseTo(112, 2);
    }
  });

  it('keeps a lamp out of the room behind the wall', () => {
    const [ox, oy] = centre(1, 1);
    const polygon = visibilityPolygon(ox, oy, 600, isSolid, options());
    // Its own room, through the wall: lit, blocked, and the doorway is the only
    // way anything reaches the far side at all.
    expect(contains(polygon, ...centre(2, 2))).toBe(true);
    for (const [tx, ty] of [
      [4, 1],
      [5, 1],
      [4, 2],
      [5, 2],
      [4, 4],
    ]) {
      const [x, y] = centre(tx, ty);
      expect(contains(polygon, x, y), `tile ${tx},${ty}`).toBe(false);
    }
  });

  it('stops at the wall face when told not to enter it at all', () => {
    const [ox, oy] = centre(1, 1);
    const config = options({ rayCount: 4, halfAngle: 0.01, wallPenetration: 0 });
    const reach = castFan(ox, oy, 600, isSolid, config);
    for (let i = 0; i < reach.length; i++) {
      expect(ox + Math.cos(fanAngle(i, config)) * reach[i]).toBeCloseTo(96, 2);
    }
  });

  it('reshapes one cast down to a smaller radius', () => {
    // The sight bubble is read off the line-of-sight cast rather than cast
    // again, so clamping has to be exact where nothing is in the way.
    const [ox, oy] = centre(2, 2);
    const far = traceFan(ox, oy, 600, isSolid, options());
    const near = fanPolygon(ox, oy, far, 12);
    for (let i = 0; i < near.length; i += 2) {
      expect(Math.hypot(near[i] - ox, near[i + 1] - oy)).toBeCloseTo(12, 3);
    }
  });

  it('slides shadow edges smoothly as the origin moves', () => {
    // The shimmer this guards against: with the edge rounded to the nearest ray,
    // walking past a corner makes the lit area jump a whole ray-step at a time
    // instead of growing evenly, and the shadow visibly ticks sideways.
    const config = options();
    const areas: number[] = [];
    for (let step = 0; step <= 60; step++) {
      const oy = (1.2 + (step / 60) * 1.6) * TILE;
      areas.push(area(visibilityPolygon(1.5 * TILE, oy, 600, isSolid, config)));
    }
    const deltas = areas.slice(1).map((value, i) => Math.abs(value - areas[i]));
    const typical = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
    expect(typical).toBeGreaterThan(0);
    expect(Math.max(...deltas)).toBeLessThan(typical * 6);
  });

  it('clamps an unblocked ray to the radius it was asked for', () => {
    const [ox, oy] = centre(3, 3);
    const reach = castFan(ox, oy, 8, isSolid, options());
    for (let i = 0; i < reach.length; i++) expect(reach[i]).toBe(8);
  });
});
