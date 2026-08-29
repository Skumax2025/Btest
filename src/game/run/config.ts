/**
 * L2: everything a run needs handed to it from outside. Content (L3) builds one
 * of these; the run itself contains no numbers and no data tables.
 */

import type { LevelGeometry, LevelSpec, StreamOptions } from '@game/level';
import type { PlayerConfig } from '@game/player';
import type { StatsConfig } from '@game/stats';
import type { ItemCatalog } from '@game/items';
import type { ContainerCatalog, LootTables } from '@game/loot';
import type { LightingConfig } from '@game/lighting';
import type { CreatureCatalog } from '@game/ai';
import type { SoundConfig } from '@systems/sound';

/** Names of the input actions the simulation reacts to. */
export interface ActionNames {
  readonly sprint: string;
  readonly crouch: string;
  readonly interact: string;
  readonly use: string;
  readonly attack: string;
  readonly throwItem: string;
  readonly drop: string;
  readonly flashlight: string;
}

/** All data tables a run reads. Every one of them lives in L3. */
export interface RunContent {
  readonly levels: readonly LevelSpec[];
  readonly items: ItemCatalog;
  readonly containers: ContainerCatalog;
  readonly loot: LootTables;
  readonly creatures: CreatureCatalog;
}

export interface NoiseConfig {
  readonly walk: number;
  readonly sprint: number;
  readonly crouch: number;
  readonly stepInterval: number;
  readonly searchFallback: number;
  readonly melee: number;
  readonly silenceTicks: number;
}

export interface InteractionConfig {
  readonly interactRange: number;
  readonly pickupRange: number;
  readonly searchFallbackTicks: number;
  readonly throwSpeed: number;
  readonly throwRange: number;
  readonly meleeRange: number;
  readonly meleeHalfArc: number;
  readonly meleeCooldownTicks: number;
  readonly meleeFallbackDamage: number;
  readonly meleeStaminaCost: number;
  readonly shoveImpulse: number;
}

export interface InventoryConfig {
  readonly width: number;
  readonly height: number;
  readonly capacity: number;
}

export interface RunConfig {
  readonly seed: number;
  readonly content: RunContent;
  readonly geometry: LevelGeometry;
  readonly stream: StreamOptions;
  readonly player: PlayerConfig;
  readonly stats: StatsConfig;
  readonly inventory: InventoryConfig;
  readonly lighting: LightingConfig;
  readonly sound: SoundConfig;
  readonly noise: NoiseConfig;
  readonly interaction: InteractionConfig;
  readonly actions: ActionNames;
  /** Length of one simulation step in seconds. */
  readonly stepSeconds: number;
  /** Cell size of the static prop index, in world units. */
  readonly propCellSize: number;
  /** Ticks the opening "how to move" line stays up when nothing else is nearer. */
  readonly openingHintTicks: number;
}
