/**
 * L0: uniform-grid spatial index.
 *
 * Rebuilt every simulation tick. Query results are ordered by cell then by
 * insertion, so they are stable for identical inputs. Pairwise scans over all
 * entities are never needed and never allowed.
 */

import { floorDiv } from './math';

export interface SpatialEntry {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export class SpatialGrid {
  private readonly cells = new Map<number, SpatialEntry[]>();
  private count = 0;
  private maxRadius = 0;

  constructor(readonly cellSize: number) {}

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.cells.clear();
    this.count = 0;
    this.maxRadius = 0;
  }

  insert(id: number, x: number, y: number, radius = 0): void {
    const key = this.cellKey(floorDiv(x, this.cellSize), floorDiv(y, this.cellSize));
    const bucket = this.cells.get(key);
    const entry: SpatialEntry = { id, x, y, radius };
    if (bucket) bucket.push(entry);
    else this.cells.set(key, [entry]);
    this.count++;
    if (radius > this.maxRadius) this.maxRadius = radius;
  }

  /** All entries whose centre lies within `radius` (+ their own radius) of the point. */
  queryCircle(x: number, y: number, radius: number, out: SpatialEntry[] = []): SpatialEntry[] {
    out.length = 0;
    const reach = radius + this.maxRadius;
    const minCellX = floorDiv(x - reach, this.cellSize);
    const maxCellX = floorDiv(x + reach, this.cellSize);
    const minCellY = floorDiv(y - reach, this.cellSize);
    const maxCellY = floorDiv(y + reach, this.cellSize);
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const bucket = this.cells.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (const entry of bucket) {
          const dx = entry.x - x;
          const dy = entry.y - y;
          const limit = radius + entry.radius;
          if (dx * dx + dy * dy <= limit * limit) out.push(entry);
        }
      }
    }
    return out;
  }

  queryRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    out: SpatialEntry[] = [],
  ): SpatialEntry[] {
    out.length = 0;
    const pad = this.maxRadius;
    const minCellX = floorDiv(minX - pad, this.cellSize);
    const maxCellX = floorDiv(maxX + pad, this.cellSize);
    const minCellY = floorDiv(minY - pad, this.cellSize);
    const maxCellY = floorDiv(maxY + pad, this.cellSize);
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const bucket = this.cells.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (const entry of bucket) {
          if (
            entry.x + entry.radius >= minX &&
            entry.x - entry.radius <= maxX &&
            entry.y + entry.radius >= minY &&
            entry.y - entry.radius <= maxY
          ) {
            out.push(entry);
          }
        }
      }
    }
    return out;
  }

  private cellKey(cx: number, cy: number): number {
    // Cantor-style pairing folded into a single number; collisions are impossible
    // for |cx|,|cy| < 2^15, which covers any playable distance from the origin.
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }
}
