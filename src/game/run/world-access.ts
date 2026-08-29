/**
 * L2: the slice of a run that player actions are allowed to touch.
 *
 * `actions.ts` is written against this interface rather than against `Run`
 * itself, which keeps the module graph acyclic and makes the action code
 * testable with a hand-built stub.
 */

import type { PropSpawn } from '@game/level';
import type { LevelStream } from '@game/level';
import type { PlayerState } from '@game/player';
import type { StatsState } from '@game/stats';
import type { InventoryState } from '@game/inventory';
import type { CreatureState } from '@game/ai';
import type { ComponentStore, EntityId, World } from '@core/world';
import type { RandomStream } from '@core/rng';
import type { NoiseField } from '@systems/sound';
import type { RunConfig } from './config';

/**
 * Hint keys, resolved to text by the UI. The simulation never holds a string a
 * player reads, so translating the game touches one content file.
 */
export type HintKey =
  | 'move'
  | 'flashlight'
  | 'search'
  | 'pickup'
  | 'descend'
  | 'useHand'
  | 'full'
  | 'heavy'
  | 'nothing'
  | 'exhausted'
  | 'darkness'
  | 'listen';

export interface GroundItem {
  readonly itemId: string;
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
  /** Index inside that chunk's dropped list. */
  readonly index: number;
}

export interface Projectile {
  itemId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ticksLeft: number;
}

/** A search in progress; cancelled when the player walks away. */
export interface SearchProgress {
  key: string;
  x: number;
  y: number;
  ticksLeft: number;
  total: number;
}

export interface RunWorld {
  readonly tick: number;
  readonly config: RunConfig;
  /** Entity store. Creatures and thrown items are components on it. */
  readonly world: World;
  readonly player: PlayerState;
  readonly stats: StatsState;
  readonly inventory: InventoryState;
  readonly level: LevelStream;
  readonly noise: NoiseField;
  readonly projectiles: ComponentStore<Projectile>;
  readonly creatures: ComponentStore<CreatureState>;
  /** Gameplay randomness. Its state is part of the save, so a reload replays. */
  readonly rng: RandomStream;
  /** Chunks whose creature spawns have already been turned into creatures. */
  readonly spawnedChunks: Set<string>;
  search: SearchProgress | null;
  flashlightOn: boolean;
  meleeCooldown: number;
  /** Set when the player has stepped into an exit this tick. */
  descendRequested: boolean;
  collected: number;
  spawn<T>(store: ComponentStore<T>, value: T): EntityId;
  propsNear(x: number, y: number, radius: number): PropSpawn[];
  groundItemsNear(x: number, y: number, radius: number): GroundItem[];
  setHint(hint: HintKey | null): void;
  emitNoise(x: number, y: number, radius: number, source: string): void;
}
