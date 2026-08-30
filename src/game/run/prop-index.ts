/**
 * L2: fast lookup of the things standing in the world.
 *
 * Static props are indexed once when chunks come and go, never per tick; items
 * lying on the floor are read straight out of the chunk deltas, which is where
 * they live so that they survive an unload.
 */

import { SpatialGrid } from '@core/spatial';
import type { LevelStream, PropSpawn } from '@game/level';
import type { GroundItem } from './world-access';

export class PropIndex {
  private readonly grid: SpatialGrid;
  private readonly props: PropSpawn[] = [];

  constructor(cellSize: number) {
    this.grid = new SpatialGrid(cellSize);
  }

  rebuild(level: LevelStream): void {
    this.grid.clear();
    this.props.length = 0;
    for (const chunk of level.loadedChunks()) {
      for (const prop of chunk.props) {
        this.grid.insert(this.props.push(prop) - 1, prop.x, prop.y, 0);
      }
    }
  }

  near(x: number, y: number, radius: number): PropSpawn[] {
    return this.grid.queryCircle(x, y, radius).map((entry) => this.props[entry.id]);
  }

  inRect(minX: number, minY: number, maxX: number, maxY: number): PropSpawn[] {
    return this.grid.queryRect(minX, minY, maxX, maxY).map((entry) => this.props[entry.id]);
  }
}

export const groundItemsNear = (
  level: LevelStream,
  x: number,
  y: number,
  radius: number,
): GroundItem[] => {
  const found: GroundItem[] = [];
  const origin = level.chunkCoordAt(x, y);
  const span = Math.ceil(radius / level.chunkWorldSize);
  for (let cy = origin.cy - span; cy <= origin.cy + span; cy++) {
    for (let cx = origin.cx - span; cx <= origin.cx + span; cx++) {
      const dropped = level.peekDelta(cx, cy)?.dropped;
      if (!dropped) continue;
      for (let index = 0; index < dropped.length; index++) {
        const entry = dropped[index];
        if (Math.hypot(entry.x - x, entry.y - y) > radius) continue;
        found.push({ ...entry, cx, cy, index });
      }
    }
  }
  return found;
};
