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
  | 'spilled'
  | 'stowed'
  | 'burst'
  | 'exhausted'
  | 'darkness'
  | 'listen';

/** What just happened in melee, for the eye and the ear to report. */
export type CombatEvent = 'hit' | 'blockedByYou' | 'blockedByThem' | 'miss' | 'broke' | 'tired';

/**
 * Melee is automatic, so this is the only channel through which the player
 * learns what their character is doing. Everything a view or the audio needs is
 * here; nothing here is written outside the melee step.
 */
export interface CombatState {
  /** Ticks until the next swing may begin. */
  cooldown: number;
  /** Ticks left of the swing in flight; zero when not swinging. */
  windup: number;
  /** Bodies counted when the swing was committed — the price is fixed then. */
  committedTargets: number;
  blockCooldown: number;
  /** Reach of whatever is in hand right now, in world units. */
  reach: number;
  /** Full interval, so a view can draw a fraction of it. */
  interval: number;
  /** Bodies inside the ring this tick. */
  targets: number;
  durability: number;
  maxDurability: number;
  /** True when the item in hand has failed and the body is doing the work. */
  broken: boolean;
  /**
   * Whether a swing could happen at all right now — something in hand and not
   * crouching. The reach ring is only drawn when it is true, so it never
   * promises an attack that will not come.
   */
  canFight: boolean;
  event: CombatEvent | null;
  /** Bodies involved in that event, for "caught 3 at once". */
  eventCount: number;
  /** Bumped on every event, so two identical events are still two events. */
  eventSerial: number;
  /** Ticks the last event stays on screen. */
  eventTicks: number;
}

export const createCombatState = (): CombatState => ({
  cooldown: 0,
  windup: 0,
  committedTargets: 0,
  blockCooldown: 0,
  reach: 0,
  interval: 1,
  targets: 0,
  durability: 0,
  maxDurability: 0,
  broken: false,
  canFight: false,
  event: null,
  eventCount: 0,
  eventSerial: 0,
  eventTicks: 0,
});

export interface GroundItem {
  readonly itemId: string;
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
  /** Index inside that chunk's dropped list. */
  readonly index: number;
  /** Condition it was put down with; absent for loot that was never carried. */
  readonly durability?: number;
  readonly charge?: number;
}

/**
 * A stat change spread over time — the shape a side effect takes. Bad food and
 * anything that promises to help now writes one of these.
 */
export interface LastingEffect {
  ticksLeft: number;
  /** Total change, delivered evenly across `seconds`. */
  seconds: number;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  sanity: number;
}

/** A thrown thing that keeps calling attention to itself where it landed. */
export interface Beacon {
  x: number;
  y: number;
  radius: number;
  ticksLeft: number;
  intervalTicks: number;
  sinceLast: number;
}

export interface Projectile {
  itemId: string;
  /** Carried along so a thrown weapon lands as worn as it was thrown. */
  durability: number;
  charge: number;
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
  readonly beacons: ComponentStore<Beacon>;
  readonly creatures: ComponentStore<CreatureState>;
  /** Effects still being delivered, from something swallowed a while ago. */
  readonly lasting: LastingEffect[];
  /** Gameplay randomness. Its state is part of the save, so a reload replays. */
  readonly rng: RandomStream;
  /** Chunks whose creature spawns have already been turned into creatures. */
  readonly spawnedChunks: Set<string>;
  search: SearchProgress | null;
  flashlightOn: boolean;
  readonly combat: CombatState;
  /** Set when the player has stepped into an exit this tick. */
  descendRequested: boolean;
  collected: number;
  spawn<T>(store: ComponentStore<T>, value: T): EntityId;
  propsNear(x: number, y: number, radius: number): PropSpawn[];
  groundItemsNear(x: number, y: number, radius: number): GroundItem[];
  setHint(hint: HintKey | null): void;
  emitNoise(x: number, y: number, radius: number, source: string): void;
}
