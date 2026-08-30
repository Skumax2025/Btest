import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_CHARS,
  TILE,
  doorOpenNorth,
  doorOpenWest,
  generateChunk,
  isSolidTile,
} from '@game/level';
import type { DoorRules, LevelGeometry, LevelSpec } from '@game/level';
import { GEOMETRY } from '@content/tuning';
import { LEVELS } from '@content/levels';
import { LEVEL0_START_ROOM } from '@content/rooms';

const geo: LevelGeometry = GEOMETRY;
const spec: LevelSpec = LEVELS[0];
const SEED = 0x5eed;
const chunkTiles = geo.blockSize * geo.chunkBlocks;

const chunk = (cx: number, cy: number, seed = SEED, levelIndex = 0, which: LevelSpec = spec) =>
  generateChunk({ seed, levelIndex, cx, cy, spec: which, geo });

/** Stitches a rectangle of chunks into one grid so we can flood fill across them. */
const region = (minCx: number, minCy: number, size: number, which: LevelSpec = spec) => {
  const width = size * chunkTiles;
  const tiles = new Uint8Array(width * width);
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const generated = chunk(minCx + dx, minCy + dy, SEED, 0, which);
      for (let ty = 0; ty < chunkTiles; ty++) {
        for (let tx = 0; tx < chunkTiles; tx++) {
          tiles[(dy * chunkTiles + ty) * width + dx * chunkTiles + tx] =
            generated.tiles[ty * chunkTiles + tx];
        }
      }
    }
  }
  return { tiles, width };
};

const floodFill = (tiles: Uint8Array, width: number, startX: number, startY: number) => {
  const seen = new Uint8Array(tiles.length);
  const stack = [startX, startY];
  seen[startY * width + startX] = 1;
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= width) continue;
      const index = ny * width + nx;
      if (seen[index] || isSolidTile(tiles[index])) continue;
      seen[index] = 1;
      stack.push(nx, ny);
    }
  }
  return seen;
};

describe('level generation', () => {
  it('is deterministic for a seed and coordinates', () => {
    const a = chunk(3, -2);
    const b = chunk(3, -2);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.props).toEqual(b.props);
  });

  it('produces different worlds for different seeds', () => {
    const a = chunk(0, 0, SEED);
    const b = chunk(0, 0, SEED + 1);
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
  });

  it('generates chunks independently of visit order', () => {
    const direct = chunk(5, 5);
    for (let i = 0; i < 20; i++) chunk(i, -i);
    expect(Array.from(chunk(5, 5).tiles)).toEqual(Array.from(direct.tiles));
  });

  it('keeps the whole region connected and leaves no unreachable floor', () => {
    const size = 5;
    const { tiles, width } = region(-2, -2, size);
    const startX = 2 * chunkTiles + Math.floor(geo.blockSize / 2);
    const startY = 2 * chunkTiles + Math.floor(geo.blockSize / 2);
    expect(isSolidTile(tiles[startY * width + startX])).toBe(false);
    const seen = floodFill(tiles, width, startX, startY);

    let unreachable = 0;
    let floor = 0;
    // Only the inner chunks are judged: the outer ring's own neighbours are absent.
    for (let y = chunkTiles; y < width - chunkTiles; y++) {
      for (let x = chunkTiles; x < width - chunkTiles; x++) {
        const index = y * width + x;
        if (isSolidTile(tiles[index])) continue;
        floor++;
        if (!seen[index]) unreachable++;
      }
    }
    expect(floor).toBeGreaterThan(1000);
    expect(unreachable).toBe(0);
  });

  it('leaves both open space and dead-end rooms', () => {
    const { tiles, width } = region(0, 0, 3);
    let floor = 0;
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) if (!isSolidTile(tiles[y * width + x])) floor++;
    }
    const openRatio = floor / (width * width);
    expect(openRatio).toBeGreaterThan(0.3);
    expect(openRatio).toBeLessThan(0.92);

    const rules: DoorRules = {
      seed: SEED,
      levelIndex: 0,
      period: spec.spinePeriod,
      extraChance: spec.extraDoorChance,
    };
    let deadEnds = 0;
    let blocks = 0;
    for (let by = 0; by < 24; by++) {
      for (let bx = 0; bx < 24; bx++) {
        const doors =
          Number(doorOpenWest(rules, bx, by)) +
          Number(doorOpenNorth(rules, bx, by)) +
          Number(doorOpenWest(rules, bx + 1, by)) +
          Number(doorOpenNorth(rules, bx, by + 1));
        blocks++;
        if (doors === 1) deadEnds++;
      }
    }
    // Dead ends are wanted, but a world that is mostly dead ends is a maze.
    expect(deadEnds / blocks).toBeGreaterThan(0.05);
    expect(deadEnds / blocks).toBeLessThan(0.5);
  });

  it('guarantees a landmark inside every stride-sized window of chunks', () => {
    const stride = spec.landmarkStride;
    for (let originY = -3; originY <= 3; originY++) {
      for (let originX = -3; originX <= 3; originX++) {
        let found = 0;
        for (let dy = 0; dy < stride; dy++) {
          for (let dx = 0; dx < stride; dx++) {
            if (chunk(originX + dx, originY + dy).landmarkId !== null) found++;
          }
        }
        expect(found).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('guarantees an exit inside every exit-stride window of chunks', () => {
    const stride = spec.exitStride;
    for (let originY = -2; originY <= 2; originY++) {
      for (let originX = -2; originX <= 2; originX++) {
        let found = 0;
        for (let dy = 0; dy < stride; dy++) {
          for (let dx = 0; dx < stride; dx++) {
            if (chunk(originX + dx, originY + dy).hasExit) found++;
          }
        }
        expect(found).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('keeps container and creature density inside sane bounds', () => {
    let containers = 0;
    let creatures = 0;
    let lamps = 0;
    let chunks = 0;
    for (let cy = -4; cy <= 4; cy++) {
      for (let cx = -4; cx <= 4; cx++) {
        const generated = chunk(cx, cy);
        chunks++;
        for (const prop of generated.props) {
          if (prop.kind === 'container') containers++;
          if (prop.kind === 'creature') creatures++;
          if (prop.kind === 'lamp') lamps++;
        }
      }
    }
    const blocksPerChunk = geo.chunkBlocks * geo.chunkBlocks;
    expect(containers / chunks).toBeGreaterThan(0.02);
    expect(containers / chunks).toBeLessThan(blocksPerChunk * 1.5);
    expect(creatures / chunks).toBeGreaterThan(0.05);
    expect(creatures / chunks).toBeLessThan(blocksPerChunk * 0.5);
    expect(lamps / chunks).toBeGreaterThan(blocksPerChunk * 0.3);
  });

  it('spawns the start room at the origin and keeps its centre walkable', () => {
    const origin = chunk(0, 0);
    const centre = Math.floor(geo.blockSize / 2);
    expect(origin.tiles[centre * chunkTiles + centre]).not.toBe(TILE.WALL);
    expect(isSolidTile(origin.tiles[centre * chunkTiles + centre])).toBe(false);
  });
});

describe('every level', () => {
  it.each(LEVELS.map((level, index) => [level.id, index] as const))(
    '%s stays connected with no unreachable floor',
    (_id, index) => {
      const level = LEVELS[index];
      const size = 5;
      const { tiles, width } = region(-2, -2, size, level);
      const startX = 2 * chunkTiles + Math.floor(geo.blockSize / 2);
      const startY = 2 * chunkTiles + Math.floor(geo.blockSize / 2);
      const seen = floodFill(tiles, width, startX, startY);
      let unreachable = 0;
      for (let y = chunkTiles; y < width - chunkTiles; y++) {
        for (let x = chunkTiles; x < width - chunkTiles; x++) {
          const at = y * width + x;
          if (!isSolidTile(tiles[at]) && !seen[at]) unreachable++;
        }
      }
      expect(unreachable).toBe(0);
    },
  );

  it('gives each level its own look: palette, rooms and creature mix differ', () => {
    const ids = LEVELS.map((level) => level.paletteId);
    expect(new Set(ids).size).toBe(LEVELS.length);
    const [first, second] = LEVELS;
    if (!second) return;
    expect(second.rooms.map((room) => room.id)).not.toEqual(first.rooms.map((room) => room.id));
    expect(second.ambientLight).toBeLessThan(first.ambientLight);
    expect(second.lampWorkingChance).toBeLessThan(first.lampWorkingChance);
  });
});

describe('room templates', () => {
  const all = LEVELS.flatMap((level) => [...level.rooms, ...level.landmarks]);

  it('are square and sized to the block interior', () => {
    const interior = geo.blockSize - 1;
    for (const template of all) {
      expect(template.rows.length, template.id).toBe(interior);
      for (const row of template.rows) expect(row.length, `${template.id}: "${row}"`).toBe(interior);
    }
  });

  it('use only documented characters', () => {
    for (const template of all) {
      for (const row of template.rows) {
        for (const char of row) {
          expect(TEMPLATE_CHARS.includes(char), `${template.id}: "${char}"`).toBe(true);
        }
      }
    }
  });

  it('have unique ids', () => {
    const ids = all.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('register the start room with the level that names it', () => {
    const level = LEVELS.find((candidate) => candidate.startRoomId !== null);
    expect(level).toBeDefined();
    expect(level?.rooms.some((room) => room.id === level.startRoomId)).toBe(true);
    expect(LEVEL0_START_ROOM.id).toBe(level?.startRoomId);
  });
});
