/**
 * L3: the shape of the guidebook.
 *
 * Which sections exist, in what order, which keys they list, and — the important
 * part — which numbers they quote. Every figure in the text is read from the
 * tuning tables here and substituted as a parameter, so re-balancing the game
 * rewrites the guidebook with it. The prose lives in the locale files.
 */

import type { TextParams } from '@core/i18n';
import { ARMOR, FRESHNESS, GEOMETRY, INVENTORY, LIGHTING, NOISE, STATS, WEAPONS } from './tuning';
import { ITEMS } from './items';
import { SIM } from './tuning';

export interface GuideSection {
  readonly titleKey: string;
  readonly bodyKeys: readonly string[];
  /** Values substituted into this section's paragraphs. */
  readonly params?: () => TextParams;
  /** Actions listed as a control table under the text. */
  readonly controls?: readonly string[];
}

const minutes = (points: number, perSecond: number): number =>
  Math.round(points / perSecond / 60);

/**
 * A tile is about a metre here. Always one decimal place: in Russian a decimal
 * always takes the same case, so "0.9 метра" and "4.1 метра" both read right
 * without a plural rule inside a sentence.
 */
const tiles = (worldUnits: number): string => (worldUnits / GEOMETRY.tileSize).toFixed(1);

const seconds = (ticks: number): number => Math.round((ticks / SIM.ticksPerSecond) * 10) / 10;

const statParams = (): TextParams => ({
  hungerMinutes: minutes(STATS.maxHunger, STATS.hungerPerSecond),
  thirstMinutes: minutes(STATS.maxThirst, STATS.thirstPerSecond),
  sprintFactor: STATS.sprintHungerFactor,
  sprintSeconds: Math.round(STATS.maxStamina / STATS.staminaDrainPerSecond),
  breathBack: Math.round(STATS.staminaRegenPerSecond),
  crouchFactor: STATS.staminaCrouchRegenFactor,
  nervePercent: Math.round(STATS.lowSanityFraction * 100),
  silenceSeconds: seconds(NOISE.silenceTicks),
});

/** Seconds of burn time one unit of an item pours into a lamp, read from L3. */
const chargeOf = (id: string): number => {
  for (const effect of ITEMS[id]?.use?.effects ?? []) {
    if (effect.kind === 'charge') return effect.seconds;
  }
  return 0;
};

const lightParams = (): TextParams => ({
  torchMinutes: minutes(ITEMS['item.flashlight'].charge, 1),
  batteryMinutes: minutes(chargeOf('item.battery'), 1),
  litTiles: tiles(LIGHTING.visionRadius),
  darkTiles: tiles(LIGHTING.darkVisionRadius),
});

const soundParams = (): TextParams => ({
  walkTiles: tiles(NOISE.walk),
  sprintTiles: tiles(NOISE.sprint),
  wetFactor: NOISE.wetFactor,
});

const combatParams = (): TextParams => ({
  handsTiles: tiles(WEAPONS.hands.reach),
  pipeTiles: tiles(WEAPONS.pipe.reach),
  blockSeconds: seconds(WEAPONS.pipe.blockCooldownTicks),
  swingCost: WEAPONS.pipe.staminaCost,
  extraCost: WEAPONS.pipe.staminaPerExtraTarget,
  noiseTiles: tiles(WEAPONS.pipe.noise),
  extraNoiseTiles: tiles(WEAPONS.pipe.noisePerExtraTarget),
});

const bagParams = (): TextParams => ({
  baseCells: INVENTORY.baseCells,
  quickSlots: INVENTORY.quickSlots,
  packCells: ITEMS['item.schoolbag'].carry?.cells ?? 0,
  waterMinutes: minutes(FRESHNESS.scale, ITEMS['item.water'].durability?.perSecond ?? 1),
  crackerMinutes: minutes(FRESHNESS.scale, ITEMS['item.crackers'].durability?.perSecond ?? 1),
  armorPercent: Math.round(ARMOR.maxShare * 100),
  throughPercent: Math.round(ARMOR.minDamageFraction * 100),
});

const paragraphs = (section: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `guide.${section}.p${i + 1}`);

export const GUIDE_SECTIONS: readonly GuideSection[] = [
  { titleKey: 'guide.place.title', bodyKeys: paragraphs('place', 4) },
  { titleKey: 'guide.body.title', bodyKeys: paragraphs('body', 6), params: statParams },
  { titleKey: 'guide.light.title', bodyKeys: paragraphs('light', 4), params: lightParams },
  { titleKey: 'guide.sound.title', bodyKeys: paragraphs('sound', 4), params: soundParams },
  { titleKey: 'guide.creatures.title', bodyKeys: paragraphs('creatures', 5) },
  { titleKey: 'guide.combat.title', bodyKeys: paragraphs('combat', 6), params: combatParams },
  { titleKey: 'guide.items.title', bodyKeys: paragraphs('items', 4), params: bagParams },
  {
    titleKey: 'guide.controls.title',
    bodyKeys: ['guide.controls.p1'],
    controls: [
      'up',
      'down',
      'left',
      'right',
      'sprint',
      'crouch',
      'interact',
      'handMain',
      'handOff',
      'throwItem',
      'drop',
      'inventory',
      'quick1',
      'swapHands',
      'controls',
      'flashlight',
      'guide',
      'pause',
    ],
  },
];
