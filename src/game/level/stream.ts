/**
 * L2: the live level around the player.
 *
 * Knows: which chunks should exist right now, how to sample tiles in world
 * units, and what the player has already changed in each chunk.
 * Does not know: how anything is drawn, or what a prop means once spawned.
 *
 * Generation is budgeted by a fixed count per tick — never by wall-clock time —
 * so streaming can never make two identical runs diverge.
 */

import { floorDiv } from '@core/math';
import { generateChunk } from './generate';
import type { Chunk, ChunkDelta, LevelGeometry, LevelSpec, PropSpawn } from './types';
import { TILE, chunkKey, emptyDelta, isSolidTile } from './types';

export interface StreamOptions {
  /** Chebyshev radius in chunks that must be generated around the player. */
  readonly loadRadius: number;
  /** Chunks beyond this radius are dropped; their deltas are kept. */
  readonly keepRadius: number;
  /** Maximum chunks generated per simulation tick. */
  readonly chunkBudget: number;
}

export interface StreamSave {
  readonly deltas: Array<[string, ChunkDelta]>;
}

export class LevelStream {
  private readonly chunks = new Map<string, Chunk>();
  private readonly deltas = new Map<string, ChunkDelta>();
  private readonly loadedQueue: Chunk[] = [];
  private readonly unloadedQueue: Array<{ cx: number; cy: number }> = [];
  /**
   * Bumped whenever a chunk appears or disappears. An unloaded chunk reads as
   * solid, so anything that caches a shape traced against the grid — lamp
   * shadows, above all — has to know that the grid it traced is gone.
   */
  private revision = 0;

  constructor(
    private readonly seed: number,
    readonly levelIndex: number,
    readonly spec: LevelSpec,
    readonly geo: LevelGeometry,
    private readonly options: StreamOptions,
  ) {}

  get chunkTiles(): number {
    return this.geo.blockSize * this.geo.chunkBlocks;
  }

  get chunkWorldSize(): number {
    return this.chunkTiles * this.geo.tileSize;
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  /** Identity of the tile grid as it stands: same string, same walls. */
  get geometryKey(): string {
    return `${this.levelIndex}:${this.revision}`;
  }

  chunkCoordAt(worldX: number, worldY: number): { cx: number; cy: number } {
    return {
      cx: floorDiv(worldX, this.chunkWorldSize),
      cy: floorDiv(worldY, this.chunkWorldSize),
    };
  }

  /** Generates missing chunks near the player, up to the per-tick budget. */
  update(worldX: number, worldY: number): void {
    const { cx, cy } = this.chunkCoordAt(worldX, worldY);
    let budget = this.options.chunkBudget;
    for (let radius = 0; radius <= this.options.loadRadius && budget > 0; radius++) {
      for (let dy = -radius; dy <= radius && budget > 0; dy++) {
        for (let dx = -radius; dx <= radius && budget > 0; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (this.load(cx + dx, cy + dy)) budget--;
        }
      }
    }
    this.evict(cx, cy);
  }

  /** Generates every chunk in the load radius at once — used on run start. */
  prime(worldX: number, worldY: number): void {
    const { cx, cy } = this.chunkCoordAt(worldX, worldY);
    const radius = this.options.loadRadius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) this.load(cx + dx, cy + dy);
    }
  }

  private load(cx: number, cy: number): boolean {
    const key = chunkKey(cx, cy);
    if (this.chunks.has(key)) return false;
    const chunk = generateChunk({
      seed: this.seed,
      levelIndex: this.levelIndex,
      cx,
      cy,
      spec: this.spec,
      geo: this.geo,
    });
    this.chunks.set(key, chunk);
    this.loadedQueue.push(chunk);
    this.revision++;
    return true;
  }

  private evict(cx: number, cy: number): void {
    for (const [key, chunk] of this.chunks) {
      const distance = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cy - cy));
      if (distance > this.options.keepRadius) {
        this.chunks.delete(key);
        this.unloadedQueue.push({ cx: chunk.cx, cy: chunk.cy });
        this.revision++;
      }
    }
  }

  /** Chunks generated since the previous call. The caller spawns their props. */
  drainLoaded(): Chunk[] {
    return this.loadedQueue.splice(0, this.loadedQueue.length);
  }

  /** Chunks dropped since the previous call. The caller despawns their entities. */
  drainUnloaded(): Array<{ cx: number; cy: number }> {
    return this.unloadedQueue.splice(0, this.unloadedQueue.length);
  }

  chunkAt(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  loadedChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  tileAt(tx: number, ty: number): number {
    const size = this.chunkTiles;
    const chunk = this.chunks.get(chunkKey(floorDiv(tx, size), floorDiv(ty, size)));
    if (!chunk) return TILE.VOID;
    const localX = tx - chunk.cx * size;
    const localY = ty - chunk.cy * size;
    return chunk.tiles[localY * size + localX];
  }

  tileAtWorld(worldX: number, worldY: number): number {
    return this.tileAt(floorDiv(worldX, this.geo.tileSize), floorDiv(worldY, this.geo.tileSize));
  }

  readonly isSolidTileAt = (tx: number, ty: number): boolean => isSolidTile(this.tileAt(tx, ty));

  // ---- chunk deltas -------------------------------------------------------

  /** Read-only view; unlike `delta` it never allocates an entry for a quiet chunk. */
  peekDelta(cx: number, cy: number): ChunkDelta | undefined {
    return this.deltas.get(chunkKey(cx, cy));
  }

  delta(cx: number, cy: number): ChunkDelta {
    const key = chunkKey(cx, cy);
    const existing = this.deltas.get(key);
    if (existing) return existing;
    const created = emptyDelta();
    this.deltas.set(key, created);
    return created;
  }

  deltaForWorld(worldX: number, worldY: number): ChunkDelta {
    const { cx, cy } = this.chunkCoordAt(worldX, worldY);
    return this.delta(cx, cy);
  }

  /** True when a prop was already taken/killed and must not spawn again. */
  isConsumed(prop: PropSpawn): boolean {
    const { cx, cy } = this.chunkCoordAt(prop.x, prop.y);
    return this.peekDelta(cx, cy)?.consumed.includes(prop.key) ?? false;
  }

  isOpened(prop: PropSpawn): boolean {
    const { cx, cy } = this.chunkCoordAt(prop.x, prop.y);
    return this.peekDelta(cx, cy)?.opened.includes(prop.key) ?? false;
  }

  consume(worldX: number, worldY: number, key: string): void {
    const delta = this.deltaForWorld(worldX, worldY);
    if (!delta.consumed.includes(key)) delta.consumed.push(key);
  }

  open(worldX: number, worldY: number, key: string): void {
    const delta = this.deltaForWorld(worldX, worldY);
    if (!delta.opened.includes(key)) delta.opened.push(key);
  }

  /**
   * Puts a stack on the floor. Its condition travels with it, so a nearly-broken
   * weapon does not come back off the ground as good as new.
   */
  drop(
    itemId: string,
    count: number,
    worldX: number,
    worldY: number,
    condition?: { durability: number; charge: number },
  ): void {
    this.deltaForWorld(worldX, worldY).dropped.push({
      itemId,
      count,
      x: worldX,
      y: worldY,
      ...(condition ?? {}),
    });
  }

  /** Removes one dropped stack; returns false when it was already gone. */
  undrop(worldX: number, worldY: number, index: number): boolean {
    const dropped = this.deltaForWorld(worldX, worldY).dropped;
    if (index < 0 || index >= dropped.length) return false;
    dropped.splice(index, 1);
    return true;
  }

  save(): StreamSave {
    const deltas: Array<[string, ChunkDelta]> = [];
    for (const [key, delta] of this.deltas) {
      if (delta.consumed.length + delta.opened.length + delta.dropped.length > 0) {
        deltas.push([key, delta]);
      }
    }
    return { deltas };
  }

  restore(save: StreamSave): void {
    this.deltas.clear();
    for (const [key, delta] of save.deltas) this.deltas.set(key, delta);
  }
}
