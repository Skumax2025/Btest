/**
 * L2: pure chunk generation.
 *
 * Knows: how blocks tile the plane, which doorways must exist for the world to
 * stay connected, and how to stamp a room template.
 * Does not know: what a lamp does, what loot is, or that a player exists.
 *
 * Every result is a function of (seed, level, chunk coordinates) alone, so a
 * chunk generated after a long detour is identical to one generated on arrival.
 */

import { hashInts, streamFor } from '@core/rng';
import type { RandomStream } from '@core/rng';
import { mod } from '@core/math';
import type { Chunk, LevelGeometry, LevelSpec, PropSpawn, RoomTemplate } from './types';
import { TILE, charToTile, isSolidTile } from './types';
import { isLandmarkTemplate, makeMarker, makeProp, placeExit, sealUnreachable } from './carve';

const TOPIC = {
  ROOM: 101,
  DOOR_WEST: 102,
  DOOR_NORTH: 103,
  LINK: 104,
  PROP: 105,
  LANDMARK: 106,
  EXIT: 107,
} as const;

export interface GenerateParams {
  readonly seed: number;
  readonly levelIndex: number;
  readonly cx: number;
  readonly cy: number;
  readonly spec: LevelSpec;
  readonly geo: LevelGeometry;
}

/**
 * Connectivity lattice. Every `period`-th block row is an open east-west run and
 * every `period`-th block column an open north-south run; those spines all cross
 * at (0, 0) modulo the period, so they form one component. Every block off the
 * lattice gets exactly one forced doorway, west or north. Following those links
 * strictly decreases x or y each step, so the chain always lands on a spine
 * within a bounded number of steps — which is the connectivity proof, and also
 * why the off-lattice pockets come out as trees full of dead ends. Extra
 * doorways only ever add loops, so they can never disconnect anything.
 */
export interface DoorRules {
  readonly seed: number;
  readonly levelIndex: number;
  readonly period: number;
  readonly extraChance: number;
}

const forcedLinkIsWest = (rules: DoorRules, bx: number, by: number): boolean =>
  hashInts(rules.seed, rules.levelIndex, bx, by, TOPIC.LINK) % 2 === 0;

const extraDoor = (rules: DoorRules, bx: number, by: number, topic: number): boolean =>
  streamFor(rules.seed, rules.levelIndex, bx, by, topic).next() < rules.extraChance;

export const doorOpenWest = (rules: DoorRules, bx: number, by: number): boolean => {
  const period = Math.max(2, rules.period);
  if (mod(by, period) === 0) return true;
  if (mod(bx, period) !== 0 && forcedLinkIsWest(rules, bx, by)) return true;
  return extraDoor(rules, bx, by, TOPIC.DOOR_WEST);
};

export const doorOpenNorth = (rules: DoorRules, bx: number, by: number): boolean => {
  const period = Math.max(2, rules.period);
  if (mod(bx, period) === 0) return true;
  if (mod(by, period) !== 0 && !forcedLinkIsWest(rules, bx, by)) return true;
  return extraDoor(rules, bx, by, TOPIC.DOOR_NORTH);
};

/** Chunks carrying a guaranteed feature form a lattice of period `stride`. */
const isStrideChunk = (
  seed: number,
  levelIndex: number,
  cx: number,
  cy: number,
  stride: number,
  topic: number,
): boolean => {
  if (stride <= 1) return true;
  const offsets = hashInts(seed, levelIndex, topic);
  return (
    mod(cx - (offsets % stride), stride) === 0 && mod(cy - ((offsets >>> 8) % stride), stride) === 0
  );
};

/** Certainty for the opening block: lit lamp, real containers, no creature. */
const startSpec = (spec: LevelSpec): LevelSpec => ({
  ...spec,
  rooms: spec.rooms,
  landmarks: spec.landmarks,
  lampChance: 1,
  lampWorkingChance: 1,
  lampFlickerChance: 0,
  containerChance: 1,
  creatureChance: 0,
});

const pickTemplate = (
  spec: LevelSpec,
  isLandmark: boolean,
  forcedId: string | null,
  rng: RandomStream,
): RoomTemplate => {
  if (forcedId) {
    const forced =
      spec.rooms.find((room) => room.id === forcedId) ??
      spec.landmarks.find((room) => room.id === forcedId);
    if (forced) return forced;
  }
  if (isLandmark && spec.landmarks.length > 0) {
    return rng.pickWeighted(spec.landmarks, (room) => room.weight);
  }
  return rng.pickWeighted(spec.rooms, (room) => room.weight);
};

export const generateChunk = ({ seed, levelIndex, cx, cy, spec, geo }: GenerateParams): Chunk => {
  const size = geo.blockSize * geo.chunkBlocks;
  const interior = geo.blockSize - 1;
  const doorStart = Math.floor((geo.blockSize - geo.doorWidth) / 2);
  const doorEnd = doorStart + geo.doorWidth - 1;
  const tiles = new Uint8Array(size * size).fill(TILE.WALL);
  const props: PropSpawn[] = [];
  const propCtx = { spec, geo, seed, levelIndex, topic: TOPIC.PROP };
  const doorRules: DoorRules = {
    seed,
    levelIndex,
    period: spec.spinePeriod,
    extraChance: spec.extraDoorChance,
  };

  const blockCount = geo.chunkBlocks * geo.chunkBlocks;
  const landmarkBlock = isStrideChunk(seed, levelIndex, cx, cy, spec.landmarkStride, TOPIC.LANDMARK)
    ? streamFor(seed, levelIndex, cx, cy, TOPIC.LANDMARK).int(0, blockCount)
    : -1;
  const exitBlock = isStrideChunk(seed, levelIndex, cx, cy, spec.exitStride, TOPIC.EXIT)
    ? streamFor(seed, levelIndex, cx, cy, TOPIC.EXIT).int(0, blockCount)
    : -1;

  let landmarkId: string | null = null;
  let hasExit = false;

  for (let by = 0; by < geo.chunkBlocks; by++) {
    for (let bx = 0; bx < geo.chunkBlocks; bx++) {
      const blockIndex = by * geo.chunkBlocks + bx;
      const gx = cx * geo.chunkBlocks + bx;
      const gy = cy * geo.chunkBlocks + by;
      const originX = bx * geo.blockSize;
      const originY = by * geo.blockSize;
      const frame = { tiles, size, originX, originY, interior };
      const at = (ox: number, oy: number): number => (originY + oy) * size + (originX + ox);

      const rng = streamFor(seed, levelIndex, gx, gy, TOPIC.ROOM);
      const isLandmark = blockIndex === landmarkBlock;
      const isStart = gx === 0 && gy === 0 && spec.startRoomId !== null;
      const template = pickTemplate(spec, isLandmark, isStart ? spec.startRoomId : null, rng);
      // The opening block never rolls dice: its lamp is lit and its containers
      // are there, so the first thirty seconds teach reliably.
      const blockPropCtx = isStart ? { ...propCtx, spec: startSpec(spec) } : propCtx;
      // Keep a deterministic teaching cache in the opening block; elsewhere
      // containers remain intentionally rare.
      const isOpeningBlock = isStart && blockIndex === 0;

      const marks: Array<{ char: string; ox: number; oy: number }> = [];
      for (let oy = 1; oy <= interior; oy++) {
        const row = template.rows[oy - 1] ?? '';
        for (let ox = 1; ox <= interior; ox++) {
          const char = row[ox - 1] ?? '.';
          tiles[at(ox, oy)] = charToTile(char);
          if (char === 'L' || char === 'c' || char === 's') marks.push({ char, ox, oy });
        }
      }

      const west = doorOpenWest(doorRules, gx, gy);
      const north = doorOpenNorth(doorRules, gx, gy);
      const east = doorOpenWest(doorRules, gx + 1, gy);
      const south = doorOpenNorth(doorRules, gx, gy + 1);

      if (west) for (let i = doorStart; i <= doorEnd; i++) tiles[at(0, i)] = TILE.FLOOR;
      if (north) for (let i = doorStart; i <= doorEnd; i++) tiles[at(i, 0)] = TILE.FLOOR;

      // Access lanes guarantee every open doorway reaches the middle of the room.
      if (west || east) {
        for (let oy = doorStart; oy <= doorEnd; oy++) {
          for (let ox = 1; ox <= interior; ox++) tiles[at(ox, oy)] = TILE.FLOOR;
        }
      }
      if (north || south) {
        for (let ox = doorStart; ox <= doorEnd; ox++) {
          for (let oy = 1; oy <= interior; oy++) tiles[at(ox, oy)] = TILE.FLOOR;
        }
      }

      sealUnreachable(frame, doorStart, doorEnd, west || east);

      const propRng = streamFor(seed, levelIndex, gx, gy, TOPIC.PROP);
      for (const mark of marks) {
        if (isSolidTile(tiles[at(mark.ox, mark.oy)])) continue;
        if (isOpeningBlock && mark.char === 'c' && props.some((prop) => prop.kind === 'container')) continue;
        const spawn = makeProp(
          isOpeningBlock && mark.char === 'c' ? 'c' : mark.char,
          cx * size + originX + mark.ox,
          cy * size + originY + mark.oy,
          propRng,
          blockPropCtx,
        );
        if (spawn) props.push(spawn);
      }

      if (blockIndex === exitBlock && !hasExit) {
        const exit = placeExit(frame, cx, cy, { ...propCtx, topic: TOPIC.EXIT });
        if (exit) {
          props.push(exit);
          hasExit = true;
        }
      }

      if (isLandmark && isLandmarkTemplate(template)) {
        landmarkId = template.id;
        const centre = Math.round(geo.blockSize / 2);
        props.push(
          makeMarker(
            template.marker,
            cx * size + originX + centre,
            cy * size + originY + centre,
            propCtx,
          ),
        );
      }
    }
  }

  return { cx, cy, size, tiles, props, landmarkId, hasExit };
};
