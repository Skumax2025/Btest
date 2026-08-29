/**
 * L2: one run of the game.
 *
 * Knows: the order in which systems advance inside a single fixed tick, and how
 * the pieces of a run reference each other.
 * Does not know: rendering, the DOM, wall-clock time, or any concrete item,
 * creature or level — those arrive through `RunConfig`.
 */

import { SpatialGrid } from '@core/spatial';
import { World } from '@core/world';
import type { InputFrame } from '@core/input';
import { LevelStream } from '@game/level';
import type { LevelSpec, PropSpawn } from '@game/level';
import { TILE, isSolidTile } from '@game/level';
import { createPlayer, stepPlayer } from '@game/player';
import type { PlayerState } from '@game/player';
import type { RunConfig } from './config';

export type RunPhase = 'alive' | 'dead';

export class Run {
  readonly world = new World();
  readonly player: PlayerState;
  readonly config: RunConfig;

  level: LevelStream;
  levelIndex = 0;
  tick = 0;
  phase: RunPhase = 'alive';
  /** Whether the held light source is switched on this tick. */
  flashlightOn = false;

  private readonly propGrid: SpatialGrid;
  private readonly propList: PropSpawn[] = [];
  private readonly propByKey = new Map<string, PropSpawn>();

  constructor(config: RunConfig) {
    this.config = config;
    this.propGrid = new SpatialGrid(config.propCellSize);
    this.level = this.createLevel(0);
    const spawn = this.spawnPoint();
    this.player = createPlayer(spawn.x, spawn.y);
    this.level.prime(spawn.x, spawn.y);
    this.rebuildPropIndex();
  }

  get spec(): LevelSpec {
    return this.level.spec;
  }

  /** Middle of the very first block, which the generator always keeps walkable. */
  spawnPoint(): { x: number; y: number } {
    const { tileSize, blockSize } = this.config.geometry;
    const centre = Math.floor(blockSize / 2);
    return { x: (centre + 0.5) * tileSize, y: (centre + 0.5) * tileSize };
  }

  createLevel(index: number): LevelStream {
    const spec = this.config.levels[Math.min(index, this.config.levels.length - 1)];
    return new LevelStream(
      this.config.seed,
      index,
      spec,
      this.config.geometry,
      this.config.stream,
    );
  }

  readonly isSolid = (tx: number, ty: number): boolean => isSolidTile(this.level.tileAt(tx, ty));
  readonly isWet = (tx: number, ty: number): boolean => this.level.tileAt(tx, ty) === TILE.WET;

  step(input: InputFrame): void {
    this.tick++;
    this.level.update(this.player.x, this.player.y);
    const loaded = this.level.drainLoaded().length;
    const unloaded = this.level.drainUnloaded().length;
    if (loaded + unloaded > 0) this.rebuildPropIndex();
    if (this.phase !== 'alive') return;

    stepPlayer(this.player, {
      input,
      config: this.config.player,
      actions: this.config.actions,
      tileSize: this.config.geometry.tileSize,
      stepSeconds: this.config.stepSeconds,
      isSolid: this.isSolid,
      isWet: this.isWet,
      canSprint: true,
    });
  }

  /**
   * Static props of every loaded chunk, pushed into the spatial index. Rebuilt
   * only when chunks come and go, never per tick.
   */
  rebuildPropIndex(): void {
    this.propGrid.clear();
    this.propList.length = 0;
    this.propByKey.clear();
    for (const chunk of this.level.loadedChunks()) {
      for (const prop of chunk.props) {
        const id = this.propList.push(prop) - 1;
        this.propGrid.insert(id, prop.x, prop.y, 0);
        this.propByKey.set(prop.key, prop);
      }
    }
  }

  propsNear(x: number, y: number, radius: number): PropSpawn[] {
    return this.propGrid.queryCircle(x, y, radius).map((entry) => this.propList[entry.id]);
  }

  propsInRect(minX: number, minY: number, maxX: number, maxY: number): PropSpawn[] {
    return this.propGrid.queryRect(minX, minY, maxX, maxY).map((entry) => this.propList[entry.id]);
  }

  propAt(key: string): PropSpawn | undefined {
    return this.propByKey.get(key);
  }
}
