/**
 * L2: everything a run needs handed to it from outside. Content (L3) builds one
 * of these; the run itself contains no numbers and no data tables.
 */

import type { LevelGeometry, LevelSpec, StreamOptions } from '@game/level';
import type { PlayerConfig } from '@game/player';
import type { StatsConfig } from '@game/stats';
import type { ItemCatalog } from '@game/items';
import type { ContainerCatalog, LootTables } from '@game/loot';
import type { ArmorLimits } from '@game/combat';
import type { InventoryLayout } from '@game/inventory';
import type { LightingConfig } from '@game/lighting';
import type { CreatureCatalog } from '@game/ai';
import type { SoundConfig } from '@systems/sound';

/** Names of the input actions the simulation reacts to. */
export interface ActionNames {
  readonly sprint: string;
  readonly crouch: string;
  readonly interact: string;
  readonly use: string;
  readonly throwItem: string;
  readonly drop: string;
  readonly flashlight: string;
  readonly swapHands: string;
  /** Belt slots, in order; the index here is the index on the belt. */
  readonly quick: readonly string[];
}

/** All data tables a run reads. Every one of them lives in L3. */
export interface RunContent {
  readonly levels: readonly LevelSpec[];
  readonly items: ItemCatalog;
  readonly containers: ContainerCatalog;
  readonly loot: LootTables;
  readonly creatures: CreatureCatalog;
}

/** Numbers that govern how creatures are driven, as opposed to how they think. */
export interface AiConfig {
  /** A* node budget for one path request. */
  readonly pathNodes: number;
  /** Ticks between path recomputations while a route is being followed. */
  readonly repathTicks: number;
  /** Ticks between the noises a creature makes for itself. */
  readonly noiseTicks: number;
  /** Share of a tile within which a waypoint counts as reached. */
  readonly waypointReachedFactor: number;
}

export interface NoiseConfig {
  readonly walk: number;
  readonly sprint: number;
  readonly crouch: number;
  readonly stepInterval: number;
  readonly searchFallback: number;
  readonly silenceTicks: number;
  /** Multiplier on footstep noise while standing on wet carpet. */
  readonly wetFactor: number;
}

export interface InteractionConfig {
  readonly interactRange: number;
  readonly pickupRange: number;
  readonly searchFallbackTicks: number;
  readonly throwSpeed: number;
  readonly throwRange: number;
  readonly shoveImpulse: number;
  /** Radius, in tiles, that loot is scattered over when a container is opened. */
  readonly lootSpread: number;
  /** Share of the full search noise made when the search begins. */
  readonly searchStartNoiseFactor: number;
  /** Multiple of the interact range at which walking away cancels a search. */
  readonly searchCancelFactor: number;
}

/** Timing that belongs to melee feedback rather than to melee balance. */
export interface CombatConfig {
  /** Ticks a combat event stays reported, on screen and in the ear. */
  readonly eventTicks: number;
  /** Ceilings on what worn armour may take out of a hit. */
  readonly armor: ArmorLimits;
}

/**
 * The test level. When this is present the run lays the whole catalogue out on
 * the floor and puts a sample of every creature on a ring around it, so every
 * system can be looked at in one place. A real run never has one.
 */
export interface SandboxConfig {
  /** Stacks of every catalogue item laid on the floor. */
  readonly copies: number;
  /** Distance between two laid-out stacks, in world units. */
  readonly spacing: number;
  /** Ring the sample creatures stand on, in world units. */
  readonly creatureRadius: number;
  /** Sample creatures of each kind. */
  readonly creatureCopies: number;
  /** Worn and carried from the first tick, so the floor can be picked up at all. */
  readonly startingKit: readonly string[];
}

export interface RunConfig {
  readonly seed: number;
  readonly content: RunContent;
  /** Catalogue id of the bare-hands stat block; melee falls back to it. */
  readonly handsItemId: string;
  readonly geometry: LevelGeometry;
  readonly stream: StreamOptions;
  readonly player: PlayerConfig;
  readonly stats: StatsConfig;
  readonly inventory: InventoryLayout;
  /** Set only for the test level; `null` for every real run. */
  readonly sandbox: SandboxConfig | null;
  readonly lighting: LightingConfig;
  readonly sound: SoundConfig;
  readonly noise: NoiseConfig;
  readonly interaction: InteractionConfig;
  readonly combat: CombatConfig;
  readonly ai: AiConfig;
  readonly actions: ActionNames;
  /** Length of one simulation step in seconds. */
  readonly stepSeconds: number;
  /** Cell size of the static prop index, in world units. */
  readonly propCellSize: number;
  /** Ticks the opening "how to move" line stays up when nothing else is nearer. */
  readonly openingHintTicks: number;
}
