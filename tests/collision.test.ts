import { describe, expect, it } from 'vitest';
import { isBlocked, moveCircle, unstick } from '@systems/collision';
import { castRay, hasLineOfSight, wallsBetween } from '@systems/raycast';

const TILE = 32;

/**
 *   0 1 2 3 4
 * 0 # # # # #
 * 1 # . . . #
 * 2 # . # . #
 * 3 # . . . #
 * 4 # # # # #
 */
const MAP = [
  '#####',
  '#...#',
  '#.#.#',
  '#...#',
  '#####',
];
const isSolid = (tx: number, ty: number): boolean =>
  tx < 0 || ty < 0 || ty >= MAP.length || tx >= MAP[ty].length || MAP[ty][tx] === '#';

const centre = (tx: number, ty: number): [number, number] => [(tx + 0.5) * TILE, (ty + 0.5) * TILE];

describe('collision', () => {
  it('reports overlap with solid tiles', () => {
    const [x, y] = centre(1, 1);
    expect(isBlocked(x, y, 8, TILE, isSolid)).toBe(false);
    expect(isBlocked(x - 12, y, 8, TILE, isSolid)).toBe(true);
  });

  it('stops at a wall instead of passing through it', () => {
    const [x, y] = centre(1, 1);
    const result = moveCircle(x, y, 10, -40, 0, TILE, isSolid);
    expect(result.hitX).toBe(true);
    expect(result.x).toBe(x);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const [x, y] = centre(1, 1);
    const result = moveCircle(x, y, 10, -40, 20, TILE, isSolid);
    expect(result.x).toBe(x);
    expect(result.y).toBeGreaterThan(y);
  });

  it('moves freely in open space', () => {
    const [x, y] = centre(1, 1);
    const result = moveCircle(x, y, 6, 4, 4, TILE, isSolid);
    expect(result.x).toBeCloseTo(x + 4);
    expect(result.y).toBeCloseTo(y + 4);
  });

  it('pushes a stuck body back into open floor', () => {
    const [x, y] = centre(2, 2);
    const freed = unstick(x, y, 8, TILE, isSolid, 3);
    expect(isBlocked(freed.x, freed.y, 8, TILE, isSolid)).toBe(false);
  });
});

describe('raycast', () => {
  it('sees along an open row', () => {
    const [ax, ay] = centre(1, 1);
    const [bx, by] = centre(3, 1);
    expect(hasLineOfSight(ax, ay, bx, by, TILE, isSolid)).toBe(true);
  });

  it('is blocked by a pillar', () => {
    const [ax, ay] = centre(1, 2);
    const [bx, by] = centre(3, 2);
    expect(hasLineOfSight(ax, ay, bx, by, TILE, isSolid)).toBe(false);
    expect(wallsBetween(ax, ay, bx, by, TILE, isSolid)).toBe(1);
  });

  it('reports the distance to the first blocking tile', () => {
    const [ax, ay] = centre(1, 2);
    const [bx, by] = centre(4, 2);
    const hit = castRay(ax, ay, bx, by, TILE, isSolid, true);
    expect(hit.blocked).toBe(true);
    expect(hit.tx).toBe(2);
    expect(hit.distance).toBeCloseTo(TILE / 2, 5);
  });

  it('handles a zero-length ray', () => {
    const [x, y] = centre(1, 1);
    expect(castRay(x, y, x, y, TILE, isSolid, true).blocked).toBe(false);
  });
});
