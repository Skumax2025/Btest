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


  // ── hands ────────────────────────────────────────────────────────────────
  'item.knife': item('item.knife', {
    slots: ['hand', 'offhand'],
    tags: ['weapon'],
    noise: 90,
    throwable: true,
    melee: WEAPONS.knife,
    durability: swings(WEAPONS.knife),
  }),
  'item.crowbar': item('item.crowbar', {
    slots: ['hand'],
    tags: ['weapon', 'tool'],
    noise: 180,
    throwable: true,
    melee: WEAPONS.crowbar,
    durability: swings(WEAPONS.crowbar),
    passive: passive({ searchFactor: 0.6 }),
    wornPassive: passive({ searchFactor: 0.85 }),
  }),
  'item.tray': item('item.tray', {
    slots: ['offhand', 'hand'],
    tags: ['weapon', 'armor'],
    noise: 140,
    throwable: true,
    melee: WEAPONS.tray,
    durability: swings(WEAPONS.tray),
  }),

  // ── head and face ────────────────────────────────────────────────────────
  'item.hood': item('item.hood', {
    slots: ['head'],
    tags: ['clothing'],
    noise: 20,
    passive: passive({ noiseFactor: 0.92, nerveFactor: 0.85 }),
    wornPassive: passive({ noiseFactor: 1, nerveFactor: 1 }),
    durability: worn(WEAR.clothingMax, {
      perStep: WEAR.clothingPerStep,
      perDamage: WEAR.clothingPerDamage,
      atZero: 'keep',
    }),
  }),
  'item.headlamp': item('item.headlamp', {
    slots: ['head'],
    tags: ['light'],
    noise: 40,
    charge: 220,
    light: {
      radius: LIGHTING.flashlightRadius * 0.7,
      halfAngle: LIGHTING.flashlightHalfAngle * 1.3,
      strength: LIGHTING.flashlightStrength * 0.8,
    },
  }),
  'item.respirator': item('item.respirator', {
    slots: ['face'],
    tags: ['clothing'],
    noise: 30,
    passive: passive({ nerveFactor: 0.7, staminaRegenFactor: 0.75, noiseFactor: 0.95 }),
    wornPassive: passive({ nerveFactor: 0.95, staminaRegenFactor: 0.9, noiseFactor: 1 }),
    durability: worn(WEAR.clothingMax, { perStep: WEAR.clothingPerStep * 0.6, atZero: 'keep' }),
  }),
  'item.goggles': item('item.goggles', {
    slots: ['face'],
    tags: ['clothing', 'armor'],
    noise: 30,
    armor: armor(1, 0.03, 0.2),
    passive: passive({ nerveFactor: 0.82 }),
    wornPassive: passive({ nerveFactor: 0.97 }),
    durability: worn(WEAR.fragileMax, {
      perDamage: WEAR.fragilePerDamage,
      atZero: 'destroy',
    }),
  }),

  // ── clothes ──────────────────────────────────────────────────────────────
  'item.jumpsuit': item('item.jumpsuit', {
    slots: ['body'],
    tags: ['clothing'],
    noise: 30,
    carry: pockets(2, 0),
    passive: passive({ noiseFactor: 0.95 }),
    wornPassive: passive({ noiseFactor: 1.15 }),
    durability: worn(WEAR.clothingMax, {
      perStep: WEAR.clothingPerStep,
      perDamage: WEAR.clothingPerDamage,
      atZero: 'keep',
    }),
  }),
  'item.raincoat': item('item.raincoat', {
    slots: ['body'],
    tags: ['clothing'],
    noise: 40,
    carry: pockets(1, 0),
    passive: passive({ noiseFactor: 1.35, wetNoiseFactor: 0.6, nerveFactor: 0.88 }),
    wornPassive: passive({ noiseFactor: 1.6, wetNoiseFactor: 1, nerveFactor: 1 }),
    durability: worn(WEAR.clothingMax, { perStep: WEAR.clothingPerStep, atZero: 'keep' }),
  }),
  'item.cargopants': item('item.cargopants', {
    slots: ['legs'],
    tags: ['clothing'],
    noise: 30,
    carry: pockets(2, 0),
    passive: passive({ noiseFactor: 1.08 }),
    wornPassive: passive({ noiseFactor: 1.25 }),
    durability: worn(WEAR.clothingMax, {
      perStep: WEAR.clothingPerStep,
      perDamage: WEAR.clothingPerDamage,
      atZero: 'keep',
    }),
  }),
  'item.jeans': item('item.jeans', {
    slots: ['legs'],
    tags: ['clothing'],
    noise: 30,
    carry: pockets(1, 0),
    passive: passive({ noiseFactor: 0.88 }),
    wornPassive: passive({ noiseFactor: 1.05 }),
    durability: worn(WEAR.clothingMax, { perStep: WEAR.clothingPerStep, atZero: 'keep' }),
  }),
  'item.sneakers': item('item.sneakers', {
    slots: ['feet'],
    tags: ['clothing'],
    noise: 40,
    passive: passive({ noiseFactor: 0.62, wetNoiseFactor: 1.25, speedFactor: 1.02 }),
    wornPassive: passive({ noiseFactor: 1.1, wetNoiseFactor: 1.4, speedFactor: 1 }),
    durability: worn(WEAR.bootsMax * 0.55, { perStep: WEAR.bootsPerStep * 2, atZero: 'keep' }),
  }),

  // ── armour ───────────────────────────────────────────────────────────────
  'item.vest.kevlar': item('item.vest.kevlar', {
    slots: ['vest'],
    tags: ['armor'],
    noise: 60,
    armor: armor(2, 0.24, 0.3),
    passive: passive({ speedFactor: 0.94, noiseFactor: 1.1 }),
    wornPassive: passive({ speedFactor: 0.94, noiseFactor: 1.2 }),
    durability: worn(WEAR.vestMax, { perDamage: WEAR.vestPerDamage, atZero: 'destroy' }),
  }),
  'item.vest.plate': item('item.vest.plate', {
    slots: ['vest'],
    tags: ['armor'],
    noise: 120,
    armor: armor(9, 0.12, 0.2),
    passive: passive({ speedFactor: 0.84, noiseFactor: 1.3, staminaRegenFactor: 0.85 }),
    wornPassive: passive({ speedFactor: 0.84, noiseFactor: 1.45, staminaRegenFactor: 0.85 }),
    durability: worn(WEAR.vestMax * 1.4, {
      perDamage: WEAR.vestPerDamage * 0.8,
      atZero: 'destroy',
    }),
  }),

  // ── packs ────────────────────────────────────────────────────────────────
  'item.satchel': item('item.satchel', {
    slots: ['back'],
    tags: ['pack'],
    noise: 40,
    carry: pockets(2, 2),
    passive: passive({ noiseFactor: 0.9 }),
    durability: worn(WEAR.packMax * 1.5, { perStep: WEAR.packPerStep * 0.5, atZero: 'keep' }),
  }),
  'item.hikingpack': item('item.hikingpack', {
    slots: ['back'],
    tags: ['pack'],
    noise: 80,
    carry: pockets(9, 4),
    passive: passive({ noiseFactor: 1.25, speedFactor: 0.95 }),
    wornPassive: passive({ noiseFactor: 1.45, speedFactor: 0.95 }),
    durability: worn(WEAR.packMax, { perStep: WEAR.packPerStep, atZero: 'keep' }),
  }),

  // ── things with a price ──────────────────────────────────────────────────
  'item.stim': item('item.stim', {
    slots: ['hand', 'offhand'],
    maxStack: 3,
    tags: ['medical'],
    noise: 20,
    durability: perishes(FRESHNESS.pills),
    use: {
      consumed: true,
      effects: [
        { kind: 'stat', stamina: 70, sanity: 10 },
        { kind: 'lasting', seconds: 90, sanity: -34, stamina: -20 },
      ],
      spoiled: [
        { kind: 'stat', stamina: 40 },
        { kind: 'lasting', seconds: 90, sanity: -40, health: -10 },
      ],
    },
  }),
  'item.ducttape': item('item.ducttape', {
    slots: ['hand', 'offhand'],
    tags: ['tool'],
    noise: 50,
    durability: worn(WEAR.toolMax, { perUse: WEAR.toolPerUse, atZero: 'destroy' }),
    use: {
      consumed: false,
      effects: [
        { kind: 'repair', amount: WEAR.repairAmount },
        { kind: 'noise', radius: 120 },
      ],
    },
  }),
  'item.glowstick': item('item.glowstick', {
    slots: ['hand', 'offhand'],
    maxStack: 3,
    tags: ['light'],
    noise: 20,
    throwable: true,
    charge: 150,
    light: {
      radius: LIGHTING.lampRadius,
      halfAngle: Math.PI,
      strength: LIGHTING.lampStrength * 0.7,
    },
  }),
  'item.radio': item('item.radio', {
    slots: ['hand', 'offhand'],
    tags: ['lure'],
    noise: 300,
    throwable: true,
    beacon: { radius: 420, seconds: 40, intervalSeconds: 1.5 },
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
