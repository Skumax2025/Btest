/**
 * L2: block-level carving helpers used by the chunk generator.
 *
 * Knows tile geometry and reachability inside a single block. Knows nothing
 * about chunks, levels or the player.
 */

import { hashInts } from '@core/rng';
import type { RandomStream } from '@core/rng';
import type { LandmarkTemplate, LevelGeometry, LevelSpec, PropSpawn, RoomTemplate } from './types';
import { LAMP_DEAD, LAMP_FLICKER, LAMP_LIT, TILE, isSolidTile } from './types';

export const isLandmarkTemplate = (template: RoomTemplate): template is LandmarkTemplate =>
  'marker' in template;

export interface BlockFrame {
  readonly tiles: Uint8Array;
  readonly size: number;
  readonly originX: number;
  readonly originY: number;
  readonly interior: number;
}

/**
 * Removes floor pockets no doorway can reach, so a generated block never
 * contains an unreachable zone.
 */
export const sealUnreachable = (
  frame: BlockFrame,
  doorStart: number,
  doorEnd: number,
  hasHorizontalLane: boolean,
): void => {
  const { tiles, size, originX, originY, interior } = frame;
  const stride = interior + 1;
  const seen = new Uint8Array(stride * stride);
  const stack: number[] = [];
  const push = (ox: number, oy: number): void => {
    if (ox < 1 || oy < 1 || ox > interior || oy > interior) return;
    const local = oy * stride + ox;
    if (seen[local]) return;
    if (isSolidTile(tiles[(originY + oy) * size + (originX + ox)])) return;
    seen[local] = 1;
    stack.push(ox, oy);
  };
  for (let i = doorStart; i <= doorEnd; i++) {
    if (hasHorizontalLane) push(1, i);
    push(i, 1);
  }
  while (stack.length > 0) {
    const oy = stack.pop() as number;
    const ox = stack.pop() as number;
    push(ox + 1, oy);
    push(ox - 1, oy);
    push(ox, oy + 1);
    push(ox, oy - 1);
  }
  for (let oy = 1; oy <= interior; oy++) {
    for (let ox = 1; ox <= interior; ox++) {
      const index = (originY + oy) * size + (originX + ox);
      if (!isSolidTile(tiles[index]) && !seen[oy * stride + ox]) tiles[index] = TILE.WALL;
    }
  }
};

export interface PropContext {
  readonly spec: LevelSpec;
  readonly geo: LevelGeometry;
  readonly seed: number;
  readonly levelIndex: number;
  readonly topic: number;
}

/** Turns one template character into a spawn, or nothing if the roll fails. */
export const makeProp = (
  char: string,
  tx: number,
  ty: number,
  rng: RandomStream,
  ctx: PropContext,
): PropSpawn | null => {
  const { spec, geo, seed, levelIndex, topic } = ctx;
  const base = {
    key: `${tx}:${ty}:${char}`,
    tx,
    ty,
    x: (tx + 0.5) * geo.tileSize,
    y: (ty + 0.5) * geo.tileSize,
    seed: hashInts(seed, levelIndex, tx, ty, topic),
  };
  switch (char) {
    case 'L': {
      if (!rng.chance(spec.lampChance)) return null;
      const roll = rng.next();
      const variant =
        roll < spec.lampWorkingChance
          ? LAMP_LIT
          : roll < spec.lampWorkingChance + spec.lampFlickerChance
            ? LAMP_FLICKER
            : LAMP_DEAD;
      return { ...base, kind: 'lamp', defId: 'lamp', variant };
    }
    case 'c': {
      if (spec.containers.length === 0 || !rng.chance(spec.containerChance)) return null;
      return {
        ...base,
        kind: 'container',
        defId: rng.pickWeighted(spec.containers, (entry) => entry.weight).id,
        variant: 0,
      };
    }
    case 's': {
      if (spec.creatures.length === 0 || !rng.chance(spec.creatureChance)) return null;
      return {
        ...base,
        kind: 'creature',
        defId: rng.pickWeighted(spec.creatures, (entry) => entry.weight).id,
        variant: 0,
      };
    }
    default:
      return null;
  }
};

/** Puts the level exit on the first walkable tile of a block, centre first. */
export const placeExit = (
  frame: BlockFrame,
  chunkX: number,
  chunkY: number,
  ctx: PropContext,
): PropSpawn | null => {
  const { tiles, size, originX, originY, interior } = frame;
  const centre = Math.round(ctx.geo.blockSize / 2);
  const order: Array<readonly [number, number]> = [[centre, centre]];
  for (let oy = 1; oy <= interior; oy++) {
    for (let ox = 1; ox <= interior; ox++) order.push([ox, oy]);
  }
  for (const [ox, oy] of order) {
    if (isSolidTile(tiles[(originY + oy) * size + (originX + ox)])) continue;
    const tx = chunkX * size + originX + ox;
    const ty = chunkY * size + originY + oy;
    return {
      key: `${tx}:${ty}:exit`,
      kind: 'exit',
      defId: 'exit',
      tx,
      ty,
      x: (tx + 0.5) * ctx.geo.tileSize,
      y: (ty + 0.5) * ctx.geo.tileSize,
      seed: hashInts(ctx.seed, ctx.levelIndex, tx, ty, ctx.topic),
      variant: 0,
    };
  }
  return null;
};

/** Floor decal marking a landmark room, so the place is recognisable again. */
export const makeMarker = (
  markerId: string,
  tx: number,
  ty: number,
  ctx: PropContext,
): PropSpawn => ({
  key: `${tx}:${ty}:marker`,
  kind: 'marker',
  defId: markerId,
  tx,
  ty,
  x: (tx + 0.5) * ctx.geo.tileSize,
  y: (ty + 0.5) * ctx.geo.tileSize,
  seed: hashInts(ctx.seed, ctx.levelIndex, tx, ty, ctx.topic),
  variant: 0,
});
