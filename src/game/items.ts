/**
 * L2 module: item vocabulary.
 *
 * Knows: the shape of an item definition, which slot it fits, how its single
 * condition value is read, and what one use of it does. Every one of those is a
 * pure function of data, so an item is never code — it is one entry in L3 plus
 * a set of effects this module already knows how to execute.
 *
 * Does not know: any actual item.
 */

import type { WeaponStats } from './combat';

/** Every place a thing can be worn or held. One item per slot, no exceptions. */
export type EquipSlot =
  | 'head'
  | 'face'
  | 'body'
  | 'vest'
  | 'legs'
  | 'feet'
  | 'back'
  | 'hand'
  | 'offhand';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'head',
  'face',
  'body',
  'vest',
  'legs',
  'feet',
  'back',
  'hand',
  'offhand',
];

export type ItemTag =
  | 'drink'
  | 'food'
  | 'medical'
  | 'light'
  | 'battery'
  | 'weapon'
  | 'lure'
  | 'clothing'
  | 'armor'
  | 'pack'
  | 'tool';

/**
 * One thing a use does. The list is closed: `useStack` executes exactly these
 * kinds, so a new item is a new combination of them and never a new branch.
 */
export type ItemEffect =
  /** Instant change to the body. */
  | {
      readonly kind: 'stat';
      readonly health?: number;
      readonly hunger?: number;
      readonly thirst?: number;
      readonly stamina?: number;
      readonly sanity?: number;
    }
  /** The same, spread over `seconds` — the way a side effect arrives late. */
  | {
      readonly kind: 'lasting';
      readonly seconds: number;
      readonly health?: number;
      readonly hunger?: number;
      readonly thirst?: number;
      readonly stamina?: number;
      readonly sanity?: number;
    }
  /** Seconds of burn time poured into the light source being carried. */
  | { readonly kind: 'charge'; readonly seconds: number }
  /** A noise made where the item is used. Opening things is loud. */
  | { readonly kind: 'noise'; readonly radius: number }
  /** Condition restored to one worn piece of equipment. */
  | { readonly kind: 'repair'; readonly amount: number };

export interface UseSpec {
  /** Whether one unit is spent by using it. */
  readonly consumed: boolean;
  readonly effects: readonly ItemEffect[];
  /**
   * Used instead of `effects` once condition has run out — the reason spoiled
   * food is still worth carrying, and still a bad idea.
   */
  readonly spoiled?: readonly ItemEffect[];
}

/** What condition means for this item, and what running out of it does. */
export type WearOutcome =
  /** Works like bare hands from now on. Weapons. */
  | 'break'
  /** Gone. Armour that has taken its last hit. */
  | 'destroy'
  /** Stays, doing less. Clothes, packs, spoiled food. */
  | 'keep';

export interface DurabilityDef {
  readonly max: number;
  /** Lost every second the item is carried — freshness. */
  readonly perSecond: number;
  /** Lost on every footstep while worn. */
  readonly perStep: number;
  /** Lost per point of damage the piece soaks up. */
  readonly perDamage: number;
  /** Lost on every use. */
  readonly perUse: number;
  readonly atZero: WearOutcome;
}

/** Damage taken out of an incoming hit, at full condition. */
export interface ArmorDef {
  readonly flat: number;
  readonly share: number;
  /** Share of that protection still working at zero condition. */
  readonly wornFactor: number;
}

/** Cells an item adds to the bag: a pack on the back, pockets on clothes. */
export interface CarryDef {
  readonly cells: number;
  /** Cells left once the item is worn out — a torn pocket holds nothing. */
  readonly wornCells: number;
}

/**
 * What wearing a thing does while you simply walk around. Multipliers are 1 at
 * neutral; `wornPassive` is the same block at zero condition and everything in
 * between is interpolated, so wear changes behaviour without a single branch.
 */
export interface PassiveDef {
  /** Multiplier on footstep noise. */
  readonly noiseFactor: number;
  /** Extra multiplier applied only on wet carpet. */
  readonly wetNoiseFactor: number;
  /** Multiplier on how fast breath comes back. */
  readonly staminaRegenFactor: number;
  /** Multiplier on nerve lost to the dark, the quiet and the creatures. */
  readonly nerveFactor: number;
  readonly speedFactor: number;
  /** Multiplier on how long searching a container takes, and how loud it is. */
  readonly searchFactor: number;
}

export const NEUTRAL_PASSIVE: PassiveDef = {
  noiseFactor: 1,
  wetNoiseFactor: 1,
  staminaRegenFactor: 1,
  nerveFactor: 1,
  speedFactor: 1,
  searchFactor: 1,
};

/** A light this item casts while it is switched on. */
export interface LightDef {
  readonly radius: number;
  readonly halfAngle: number;
  readonly strength: number;
}

/** A thrown item that keeps making noise where it landed. */
export interface BeaconDef {
  readonly radius: number;
  readonly seconds: number;
  readonly intervalSeconds: number;
}

export interface ItemDef {
  readonly id: string;
  /** Localization key for the display name; the string itself lives in L3 locales. */
  readonly nameKey: string;
  readonly descriptionKey: string;
  /** Slots this item may be equipped into. Empty means it is only carried. */
  readonly slots: readonly EquipSlot[];
  readonly maxStack: number;
  readonly tags: readonly ItemTag[];
  readonly sprite: string;
  readonly use: UseSpec | null;
  /**
   * How this item fights when it is the one in hand. `null` means it is not a
   * weapon: swinging it falls back to the bare-hands stat block.
   */
  readonly melee: WeaponStats | null;
  readonly armor: ArmorDef | null;
  readonly carry: CarryDef | null;
  readonly passive: PassiveDef | null;
  /** The same passive block at zero condition. Defaults to `passive`. */
  readonly wornPassive: PassiveDef | null;
  readonly durability: DurabilityDef | null;
  /** Radius of the noise the item makes when it lands, in world units. */
  readonly noise: number;
  readonly throwable: boolean;
  /** Seconds of light this item can provide while switched on. */
  readonly charge: number;
  readonly light: LightDef | null;
  readonly beacon: BeaconDef | null;
}

export type ItemCatalog = Readonly<Record<string, ItemDef>>;

export const hasTag = (def: ItemDef, tag: ItemTag): boolean => def.tags.includes(tag);

export const isLightSource = (def: ItemDef): boolean => hasTag(def, 'light') && def.charge > 0;

export const isStackable = (def: ItemDef): boolean => def.maxStack > 1;

export const fitsSlot = (def: ItemDef, slot: EquipSlot): boolean => def.slots.includes(slot);

export const maxDurability = (def: ItemDef): number => def.durability?.max ?? 0;

/**
 * 0 is worn out, 1 is untouched. An item without a condition value is always 1,
 * which is what makes every formula below safe to apply to everything.
 */
export const condition = (def: ItemDef, durability: number): number => {
  const max = maxDurability(def);
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, durability / max));
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The passive block as it actually is right now, worn down towards `wornPassive`. */
export const passiveOf = (def: ItemDef, durability: number): PassiveDef => {
  const full = def.passive;
  if (!full) return NEUTRAL_PASSIVE;
  const worn = def.wornPassive ?? full;
  const t = condition(def, durability);
  return {
    noiseFactor: lerp(worn.noiseFactor, full.noiseFactor, t),
    wetNoiseFactor: lerp(worn.wetNoiseFactor, full.wetNoiseFactor, t),
    staminaRegenFactor: lerp(worn.staminaRegenFactor, full.staminaRegenFactor, t),
    nerveFactor: lerp(worn.nerveFactor, full.nerveFactor, t),
    speedFactor: lerp(worn.speedFactor, full.speedFactor, t),
    searchFactor: lerp(worn.searchFactor, full.searchFactor, t),
  };
};

/** Cells this item is worth right now. Pockets tear before the coat does. */
export const carryCells = (def: ItemDef, durability: number): number => {
  const carry = def.carry;
  if (!carry) return 0;
  return Math.round(lerp(carry.wornCells, carry.cells, condition(def, durability)));
};

/** Protection this piece still offers, faded by wear down to `wornFactor`. */
export const armorOf = (def: ItemDef, durability: number): { flat: number; share: number } => {
  const armor = def.armor;
  if (!armor) return { flat: 0, share: 0 };
  const factor = lerp(armor.wornFactor, 1, condition(def, durability));
  return { flat: armor.flat * factor, share: armor.share * factor };
};

/** True once condition has run out on something that measures freshness. */
export const isSpoiled = (def: ItemDef, durability: number): boolean =>
  maxDurability(def) > 0 && durability <= 0;

/** The effect list one use applies right now — spoiled food is a different item. */
export const effectsOf = (def: ItemDef, durability: number): readonly ItemEffect[] => {
  const use = def.use;
  if (!use) return [];
  if (use.spoiled && isSpoiled(def, durability)) return use.spoiled;
  return use.effects;
};
