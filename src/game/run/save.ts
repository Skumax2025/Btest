/**
 * L2: persistence for a run.
 *
 * The world itself is never saved — it is a pure function of the seed. Only what
 * the player did is: their body, their bag, the creatures that are awake and the
 * per-chunk deltas. That keeps the save small and makes reloading exact.
 */

import type { StreamSave } from '@game/level';
import type { PlayerState } from '@game/player';
import type { StatsState } from '@game/stats';
import type { InventoryState } from '@game/inventory';
import type { WorldSnapshot } from '@core/world';
import { chunkKey } from '@game/level';
import type { Run, RunPhase } from './run';
import type { SearchProgress } from './world-access';

export const SAVE_VERSION = 4;

export interface RunSave {
  readonly seed: number;
  readonly tick: number;
  readonly levelIndex: number;
  readonly phase: RunPhase;
  readonly collected: number;
  readonly distance: number;
  readonly flashlightOn: boolean;
  readonly meleeCooldown: number;
  readonly lastNoiseTick: number;
  readonly lastFootstepTick: number;
  readonly rngState: number;
  readonly player: PlayerState;
  readonly stats: StatsState;
  readonly inventory: InventoryState;
  /** Entities and their components, exactly as the store holds them. */
  readonly world: WorldSnapshot;
  readonly search: SearchProgress | null;
  readonly level: StreamSave;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const snapshotRun = (run: Run): RunSave => ({
  seed: run.config.seed,
  tick: run.tick,
  levelIndex: run.levelIndex,
  phase: run.phase,
  collected: run.collected,
  distance: run.distance,
  flashlightOn: run.flashlightOn,
  meleeCooldown: run.meleeCooldown,
  lastNoiseTick: run.lastNoiseTick,
  lastFootstepTick: run.lastFootstepTick,
  rngState: run.rng.getState(),
  player: clone(run.player),
  stats: clone(run.stats),
  inventory: clone(run.inventory),
  world: clone(run.world.serialize()),
  search: run.search ? clone(run.search) : null,
  level: clone(run.level.save()),
});

export const restoreRun = (run: Run, save: RunSave): void => {
  run.tick = save.tick;
  run.levelIndex = save.levelIndex;
  run.phase = save.phase;
  run.collected = save.collected;
  run.distance = save.distance;
  run.flashlightOn = save.flashlightOn;
  run.meleeCooldown = save.meleeCooldown;
  run.lastNoiseTick = save.lastNoiseTick;
  run.lastFootstepTick = save.lastFootstepTick;
  run.search = save.search ? clone(save.search) : null;
  run.rng.setState(save.rngState);

  Object.assign(run.player, clone(save.player));
  Object.assign(run.stats, clone(save.stats));
  const inventory = clone(save.inventory);
  run.inventory.stacks = inventory.stacks;
  run.inventory.nextId = inventory.nextId;
  run.inventory.hand = inventory.hand;

  run.world.restore(clone(save.world));

  run.level = run.createLevel(save.levelIndex);
  run.level.restore(clone(save.level));
  run.level.prime(run.player.x, run.player.y);

  // The restored creature list is authoritative: mark the chunks that are back
  // as already spawned so nothing is duplicated on the next tick.
  run.spawnedChunks.clear();
  for (const chunk of run.level.loadedChunks()) {
    run.spawnedChunks.add(chunkKey(chunk.cx, chunk.cy));
  }
  run.level.drainLoaded();
  run.level.drainUnloaded();
  run.noise.clear();
  run.rebuildPropIndex();
};
