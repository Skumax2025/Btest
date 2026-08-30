/**
 * L2 module: item vocabulary.
 *
 * Knows: the shape of an item definition and what using one does to the player.
 * Does not know: any actual item — the catalogue is content (L3). Adding an item
 * means adding one entry there and nothing else.
 */

import type { WeaponStats } from './combat';

export type ItemTag = 'drink' | 'food' | 'medical' | 'light' | 'battery' | 'weapon' | 'lure';

/** What one unit does when used. Absent fields mean "no change". */
export interface ItemEffect {
  readonly health?: number;
  readonly hunger?: number;
  readonly thirst?: number;
  readonly stamina?: number;
  readonly sanity?: number;
  /** Charge added to the held light source, in seconds of burn time. */
  readonly charge?: number;
  /** Whether one unit is spent by using it. */
  readonly consumed: boolean;
}

export interface ItemDef {
  readonly id: string;
  /** Localization key for the display name; the string itself lives in L3 locales. */
  readonly nameKey: string;
  /** Footprint in inventory cells. */
  readonly width: number;
  readonly height: number;
  readonly maxStack: number;
  readonly weight: number;
  readonly tags: readonly ItemTag[];
  readonly sprite: string;
  readonly use: ItemEffect | null;
  /**
   * How this item fights when it is the one in hand. `null` means it is not a
   * weapon: swinging it falls back to the bare-hands stat block.
   */
  readonly melee: WeaponStats | null;
  /** Radius of the noise the item makes when it lands, in world units. */
  readonly noise: number;
  readonly throwable: boolean;
  /** Seconds of light this item can provide while switched on. */
  readonly charge: number;
  readonly descriptionKey: string;
}

export type ItemCatalog = Readonly<Record<string, ItemDef>>;

export const hasTag = (def: ItemDef, tag: ItemTag): boolean => def.tags.includes(tag);

export const isLightSource = (def: ItemDef): boolean => hasTag(def, 'light') && def.charge > 0;
