/**
 * L3: the item catalogue.
 *
 * To add an item: add one entry here, add a sprite spec with the same id in
 * sprites.ts, add its two locale keys, and put it in a loot table. Nothing above
 * L3 changes — behaviour is a combination of effects the item module already
 * executes, never a new branch.
 */

import type {
  ArmorDef,
  CarryDef,
  DurabilityDef,
  ItemCatalog,
  ItemDef,
  PassiveDef,
} from '@game/items';
import { NEUTRAL_PASSIVE } from '@game/items';
import type { WeaponStats } from '@game/combat';
import { FRESHNESS, LIGHTING, WEAPONS, WEAR } from './tuning';

const BASE = {
  slots: [] as ItemDef['slots'],
  maxStack: 1,
  tags: [] as ItemDef['tags'],
  use: null,
  melee: null,
  armor: null,
  carry: null,
  passive: null,
  wornPassive: null,
  durability: null,
  noise: 60,
  throwable: false,
  charge: 0,
  light: null,
  beacon: null,
} satisfies Omit<ItemDef, 'id' | 'nameKey' | 'descriptionKey' | 'sprite'>;

const item = (id: string, def: Partial<ItemDef>): ItemDef => ({
  ...BASE,
  id,
  nameKey: `item.${id}.name`,
  descriptionKey: `item.${id}.desc`,
  sprite: id,
  ...def,
});

/** Condition that only ever runs down with the clock: freshness. */
const perishes = (seconds: number): DurabilityDef => ({
  max: FRESHNESS.scale,
  perSecond: FRESHNESS.scale / seconds,
  perStep: 0,
  perDamage: 0,
  perUse: 0,
  atZero: 'keep',
});

/** A weapon's condition is the one the combat module already knows about. */
const swings = (stats: WeaponStats): DurabilityDef => ({
  max: stats.maxDurability,
  perSecond: 0,
  perStep: 0,
  perDamage: 0,
  perUse: 0,
  atZero: 'break',
});

/** Worn gear: scuffed by walking, chewed by hits, and gone or merely tired at zero. */
const worn = (
  max: number,
  spec: { perStep?: number; perDamage?: number; perUse?: number; atZero: DurabilityDef['atZero'] },
): DurabilityDef => ({
  max,
  perSecond: 0,
  perStep: spec.perStep ?? 0,
  perDamage: spec.perDamage ?? 0,
  perUse: spec.perUse ?? 0,
  atZero: spec.atZero,
});

const armor = (flat: number, share: number, wornFactor: number): ArmorDef => ({
  flat,
  share,
  wornFactor,
});

const pockets = (cells: number, wornCells: number): CarryDef => ({ cells, wornCells });

const passive = (over: Partial<PassiveDef>): PassiveDef => ({ ...NEUTRAL_PASSIVE, ...over });

export const ITEMS: ItemCatalog = {
  /**
   * Bare hands are an item like any other, so the combat module never needs a
   * special case for them. Never spawned, never carried — it is the stat block
   * a broken weapon and a non-weapon both fall back to.
   */
  'item.hands': item('item.hands', {
    sprite: 'item.ground',
    slots: ['hand'],
    melee: WEAPONS.hands,
    noise: 40,
  }),

  'item.water': item('item.water', {
    slots: ['hand', 'offhand'],
    maxStack: 3,
    tags: ['drink'],
    noise: 60,
    throwable: true,
    durability: perishes(FRESHNESS.water),
    use: {
      consumed: true,
      effects: [{ kind: 'stat', thirst: 46 }],
      spoiled: [{ kind: 'stat', thirst: 30, health: -4 }],
    },
  }),
  'item.soda': item('item.soda', {
    slots: ['hand', 'offhand'],
    maxStack: 4,
    tags: ['drink'],
    noise: 80,
    throwable: true,
    durability: perishes(FRESHNESS.soda),
    use: {
      consumed: true,
      effects: [
        { kind: 'stat', thirst: 24, hunger: 6, stamina: 12 },
        { kind: 'noise', radius: 90 },
      ],
      spoiled: [
        { kind: 'stat', thirst: 12, sanity: -5 },
        { kind: 'noise', radius: 90 },
      ],
    },
  }),
  'item.crackers': item('item.crackers', {
    slots: ['hand', 'offhand'],
    maxStack: 5,
    tags: ['food'],
    noise: 40,
    durability: perishes(FRESHNESS.crackers),
    use: {
      consumed: true,
      effects: [{ kind: 'stat', hunger: 28, thirst: -4 }],
      spoiled: [{ kind: 'stat', hunger: 14, thirst: -8, sanity: -4 }],
    },
  }),
  'item.canned': item('item.canned', {
    slots: ['hand', 'offhand'],
    maxStack: 3,
    tags: ['food'],
    noise: 90,
    throwable: true,
    durability: perishes(FRESHNESS.canned),
    use: {
      consumed: true,
      effects: [
        { kind: 'stat', hunger: 52, thirst: -6 },
        { kind: 'noise', radius: 150 },
      ],
      spoiled: [
        { kind: 'stat', hunger: 22, thirst: -6 },
        { kind: 'lasting', seconds: 30, health: -12, sanity: -8 },
        { kind: 'noise', radius: 150 },
      ],
    },
  }),
  'item.medkit': item('item.medkit', {
    slots: ['hand', 'offhand'],
    tags: ['medical'],
    noise: 70,
    use: { consumed: true, effects: [{ kind: 'stat', health: 55, sanity: 6 }] },
  }),
  'item.bandage': item('item.bandage', {
    slots: ['hand', 'offhand'],
    maxStack: 4,
    tags: ['medical'],
    noise: 20,
    use: { consumed: true, effects: [{ kind: 'stat', health: 20 }] },
  }),

  'item.flashlight': item('item.flashlight', {
    slots: ['hand', 'offhand'],
    tags: ['light'],
    noise: 60,
    charge: 300,
    light: {
      radius: LIGHTING.flashlightRadius,
      halfAngle: LIGHTING.flashlightHalfAngle,
      strength: LIGHTING.flashlightStrength,
    },
  }),
  'item.battery': item('item.battery', {
    maxStack: 6,
    tags: ['battery'],
    noise: 30,
    use: { consumed: true, effects: [{ kind: 'charge', seconds: 240 }] },
  }),

  'item.pipe': item('item.pipe', {
    slots: ['hand'],
    tags: ['weapon'],
    noise: 200,
    throwable: true,
    melee: WEAPONS.pipe,
    durability: swings(WEAPONS.pipe),
  }),
  'item.wrench': item('item.wrench', {
    slots: ['hand', 'offhand'],
    tags: ['weapon'],
    noise: 170,
    throwable: true,
    melee: WEAPONS.wrench,
    durability: swings(WEAPONS.wrench),
  }),
  'item.noisemaker': item('item.noisemaker', {
    slots: ['hand', 'offhand'],
    maxStack: 3,
    tags: ['lure'],
    noise: 460,
    throwable: true,
  }),

  'item.schoolbag': item('item.schoolbag', {
    slots: ['back'],
    tags: ['pack'],
    noise: 50,
    carry: pockets(4, 2),
    passive: passive({}),
    durability: worn(WEAR.packMax, { perStep: WEAR.packPerStep, atZero: 'keep' }),
  }),
  'item.boots': item('item.boots', {
    slots: ['feet'],
    tags: ['clothing', 'armor'],
    noise: 70,
    armor: armor(1, 0.04, 0.3),
    passive: passive({ noiseFactor: 1.3, wetNoiseFactor: 0.8, speedFactor: 1.04 }),
    wornPassive: passive({ noiseFactor: 1.7, wetNoiseFactor: 1, speedFactor: 1 }),
    durability: worn(WEAR.bootsMax, {
      perStep: WEAR.bootsPerStep,
      perDamage: WEAR.clothingPerDamage,
      atZero: 'keep',
    }),
  }),
  'item.hardhat': item('item.hardhat', {
    slots: ['head'],
    tags: ['armor'],
    noise: 90,
    throwable: true,
    armor: armor(3, 0.1, 0.25),
    passive: passive({ nerveFactor: 0.92 }),
    durability: worn(WEAR.helmetMax, {
      perDamage: WEAR.helmetPerDamage,
      atZero: 'destroy',
    }),
  }),
};
