/**
 * L3: every number the game runs on. Nothing here is code — modules above read
 * these values as configuration, which is why no game constant lives in L0-L2.
 */

import type { LevelGeometry, StreamOptions } from '@game/level';
import type { StatsConfig } from '@game/stats';
import type { SoundConfig } from '@systems/sound';
import type { WeaponStats } from '@game/combat';

export const SIM = {
  /** Fixed simulation step. The only clock the game logic ever sees. */
  stepMs: 1000 / 60,
  ticksPerSecond: 60,
  /** Longest real interval one frame may consume, so tab-outs do not spiral. */
  maxFrameMs: 200,
  /** How often the run is written to localStorage, in ticks. */
  autosaveTicks: 120,
} as const;

export const GEOMETRY: LevelGeometry = {
  tileSize: 32,
  // Larger blocks create long, quiet sightlines and roughly four times the
  // walkable interior area without changing chunk streaming boundaries.
  blockSize: 16,
  chunkBlocks: 4,
  doorWidth: 2,
};

export const STREAM: StreamOptions = {
  loadRadius: 1,
  keepRadius: 2,
  chunkBudget: 2,
};

export const CAMERA = {
  zoom: 1.65,
  /** Fraction of the remaining distance covered per tick. */
  smoothing: 0.14,
  shakeDecay: 0.86,
  /** Camera kick, in world units, when the player is hurt. */
  hitShake: 7,
  maxPixelRatio: 2,
} as const;

export const PLAYER = {
  radius: 9,
  walkSpeed: 108,
  sprintSpeed: 172,
  crouchSpeed: 54,
  /** Speed multiplier on wet carpet. */
  wetSpeedFactor: 0.7,
  /** Fraction of the remaining velocity gap closed per tick. */
  acceleration: 0.34,
  /** Fraction of the remaining angle to the pointer turned per tick. */
  turnRate: 0.35,
  interactRange: 34,
  pickupRange: 30,
} as const;

/**
 * Reach is deliberately generous: the darkness reads as a pressure, not as a
 * blindfold, and a corridor you can see the end of is a corridor you can make a
 * decision about. What keeps it tense is the gap between `lampRadius` — how far
 * a lamp is *visible* — and how far it actually holds `darkThreshold` back,
 * which the falloff exponent keeps at roughly four tiles.
 */
export const LIGHTING = {
  lampRadius: 240,
  lampStrength: 0.92,
  falloffExponent: 1.7,
  flickerPeriod: 11,
  flickerOnChance: 0.66,
  /** A failing tube browns out; it does not switch itself off eight times a second. */
  flickerLow: 0.08,
  steadyPulse: 0.07,
  steadyPulsePeriod: 97,
  litThreshold: 0.16,
  visionRadius: 300,
  darkVisionRadius: 112,
  flashlightRadius: 620,
  flashlightHalfAngle: 0.46,
  flashlightStrength: 1,
  darkThreshold: 0.22,
  flashlightLightLevel: 0.34,
  /** How far a lit room stays visible down an unobstructed line of sight. */
  losRadius: 1500,
} as const;

/**
 * Balance target: a careful run lasts 5-15 minutes. Thirst is the tightest
 * clock, hunger the second; everything else kills faster but is avoidable.
 */
export const STATS: StatsConfig = {
  maxHealth: 100,
  maxHunger: 100,
  maxThirst: 100,
  maxStamina: 100,
  maxSanity: 100,
  hungerPerSecond: 0.115,
  thirstPerSecond: 0.16,
  sprintHungerFactor: 2.2,
  staminaDrainPerSecond: 16,
  staminaRegenPerSecond: 11,
  staminaCrouchRegenFactor: 1.8,
  sprintRecoveryStamina: 30,
  starvationDamagePerSecond: 1.6,
  dehydrationDamagePerSecond: 2.2,
  sanityDarkPerSecond: 1.0,
  sanitySilencePerSecond: 0.85,
  sanityCreaturePerSecond: 3.4,
  sanityRegenPerSecond: 1.4,
  movingRegenFactor: 0.45,
  lowSanityFraction: 0.35,
  healthRegenPerSecond: 0.35,
  healthRegenFraction: 0.5,
};

/**
 * Cells, not kilograms. Four cells with nothing on your back is the whole of the
 * carrying pressure: a pack is the single most valuable thing in the building,
 * and giving one up for a better one is a decision with a cost.
 */
export const INVENTORY = {
  baseCells: 4,
  quickSlots: 4,
  /** Ceiling, so no pack can outgrow the panel that draws it. */
  maxCells: 24,
  /** Pixels per inventory cell in the DOM overlay. */
  cellPixels: 52,
  /** Columns the bag grid is drawn in. */
  columns: 6,
  /** Condition below which an icon reads as worn, and below which it reads as failing. */
  wornFraction: 0.5,
  failingFraction: 0.2,
} as const;

/**
 * How long supplies stay good, in seconds of run time. A careful run lasts five
 * to fifteen minutes, so anything under ten is food you have to plan around and
 * anything over twenty is food you never think about.
 */
export const FRESHNESS = {
  /** Condition points a fresh item starts with; freshness is a percentage. */
  scale: 100,
  water: 1500,
  soda: 1100,
  crackers: 900,
  canned: 2100,
  /** Pills keep almost forever; the reason not to hoard them is the side effect. */
  pills: 6000,
} as const;

/** Condition budgets for gear, and what one scuff or one hit takes off. */
export const WEAR = {
  helmetMax: 60,
  helmetPerDamage: 0.9,
  vestMax: 90,
  vestPerDamage: 1.1,
  clothingMax: 70,
  clothingPerStep: 0.05,
  clothingPerDamage: 0.35,
  bootsMax: 80,
  bootsPerStep: 0.09,
  packMax: 120,
  /** A pack ages slowly; it is the one thing that never simply fails. */
  packPerStep: 0.02,
  /** Condition one use of the tape puts back into one piece. */
  repairAmount: 30,
  toolMax: 4,
  toolPerUse: 1,
  /** Goggles and other thin gear: they protect, then they simply break. */
  fragileMax: 30,
  fragilePerDamage: 2.4,
} as const;

/**
 * Ceilings on armour. Full plate has to make a mauling survivable without ever
 * making it harmless, or the creatures stop being a reason to walk away.
 */
export const ARMOR = {
  maxShare: 0.55,
  minDamageFraction: 0.2,
} as const;

/**
 * The test level. It is not balance — it is a workshop: everything in the game
 * within a few steps of the start, in enough copies to try stacking, wearing,
 * breaking and spoiling without hunting for a second one.
 */
export const SANDBOX = {
  copies: 3,
  /** About a tile apart, so the layout reads as shelves rather than a heap. */
  spacing: 34,
  creatureRadius: 430,
  creatureCopies: 1,
  /** Worn from the first tick; without a pack the floor cannot be picked up. */
  startingKit: [
    'item.hikingpack',
    'item.jumpsuit',
    'item.cargopants',
    'item.boots',
    'item.hardhat',
    'item.flashlight',
    'item.pipe',
  ],
} as const;

export const SOUND: SoundConfig = {
  wallAttenuation: 0.3,
  memoryTicks: 90,
};

/** Radii, in world units, of the noise the player makes. */
export const NOISE = {
  walk: 130,
  sprint: 285,
  crouch: 0,
  /** Ticks between footstep noises while moving. */
  stepInterval: 22,
  searchFallback: 260,
  /** Ticks of quiet before the silence starts eating at the player's nerve. */
  silenceTicks: 300,
  /** Wet carpet squelches. */
  wetFactor: 1.4,
} as const;

/**
 * Melee is automatic, so these numbers are the whole difficulty curve.
 *
 * Target, verified by tests and by hand: two or three drifters are survivable
 * and expensive, five kill you, and trading blows with a hound never works. The
 * lever is not damage — a swing hits everything in the ring, so damage does not
 * care how many there are — it is `staminaPerExtraTarget` and `noisePerExtraTarget`.
 */
export const WEAPONS: Readonly<Record<string, WeaponStats>> = {
  hands: {
    reach: 30,
    damage: 5,
    intervalTicks: 30,
    windupTicks: 8,
    staminaCost: 4,
    staminaPerExtraTarget: 3,
    noise: 90,
    noisePerExtraTarget: 30,
    wearPerHit: 0,
    maxDurability: 0,
    wornDamageFactor: 1,
    blockChance: 0.1,
    blockStaminaCost: 8,
    blockCooldownTicks: 120,
  },
  wrench: {
    reach: 40,
    damage: 30,
    intervalTicks: 30,
    windupTicks: 9,
    staminaCost: 7,
    staminaPerExtraTarget: 7,
    noise: 170,
    noisePerExtraTarget: 55,
    wearPerHit: 1,
    maxDurability: 40,
    wornDamageFactor: 0.45,
    blockChance: 0.18,
    blockStaminaCost: 10,
    blockCooldownTicks: 120,
  },
  /**
   * Short, quiet and quick. It kills nothing on its own; it is what you carry
   * when the plan is to not be heard, and it wears out saying so.
   */
  knife: {
    reach: 26,
    damage: 16,
    intervalTicks: 18,
    windupTicks: 5,
    staminaCost: 3,
    staminaPerExtraTarget: 3,
    noise: 70,
    noisePerExtraTarget: 20,
    wearPerHit: 1,
    maxDurability: 22,
    wornDamageFactor: 0.4,
    blockChance: 0.08,
    blockStaminaCost: 6,
    blockCooldownTicks: 120,
  },
  /** A prying bar first and a weapon second: the swing is mediocre on purpose. */
  crowbar: {
    reach: 44,
    damage: 24,
    intervalTicks: 34,
    windupTicks: 10,
    staminaCost: 6,
    staminaPerExtraTarget: 6,
    noise: 150,
    noisePerExtraTarget: 45,
    wearPerHit: 0.5,
    maxDurability: 70,
    wornDamageFactor: 0.55,
    blockChance: 0.2,
    blockStaminaCost: 10,
    blockCooldownTicks: 120,
  },
  /**
   * A cafeteria tray. It does nothing at all except catch things, which is the
   * point: the off hand is a decision, not a second weapon rack.
   */
  tray: {
    reach: 20,
    damage: 2,
    intervalTicks: 40,
    windupTicks: 14,
    staminaCost: 5,
    staminaPerExtraTarget: 4,
    noise: 120,
    noisePerExtraTarget: 30,
    wearPerHit: 2,
    maxDurability: 45,
    wornDamageFactor: 0.5,
    blockChance: 0.42,
    blockStaminaCost: 9,
    blockCooldownTicks: 90,
  },
  pipe: {
    reach: 50,
    damage: 46,
    intervalTicks: 40,
    windupTicks: 12,
    staminaCost: 10,
    staminaPerExtraTarget: 9,
    noise: 210,
    noisePerExtraTarget: 70,
    wearPerHit: 1,
    maxDurability: 55,
    wornDamageFactor: 0.45,
    blockChance: 0.22,
    blockStaminaCost: 12,
    blockCooldownTicks: 120,
  },
};

export const INTERACTION = {
  interactRange: 40,
  pickupRange: 34,
  /** Ticks a search takes when the container does not say otherwise. */
  searchFallbackTicks: 40,
  throwSpeed: 430,
  throwRange: 460,
  /** Force applied to a creature that is shoved. */
  shoveImpulse: 240,
  /** How long the opening movement line stays up, in ticks. */
  openingHintTicks: 360,
  lootSpread: 0.55,
  searchStartNoiseFactor: 0.5,
  searchCancelFactor: 1.5,
} as const;

export const COMBAT = {
  /** How long a hit, a block or a miss stays reported. Feedback, not balance. */
  eventTicks: 40,
} as const;

export const AI = {
  pathNodes: 320,
  repathTicks: 24,
  noiseTicks: 40,
  waypointReachedFactor: 0.4,
} as const;

/**
 * Rays per fan. Every ray is one DDA walk, and the angular gap between two of
 * them is the size of the jagged step a shadow edge shows: at the player's line
 * of sight radius, `playerRays` has to keep that gap under a tile or the world
 * visibly wobbles as you walk. Lamp fans are cached per lamp, so their count is
 * close to free.
 */
export const VISION = {
  lightRays: 72,
  playerRays: 256,
  flashlightRays: 48,
} as const;

export const KEY_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['ControlLeft', 'KeyC'],
  interact: ['KeyE'],
  use: ['KeyF'],
  throwItem: ['KeyQ'],
  drop: ['KeyG'],
  inventory: ['Tab'],
  quick1: ['Digit1'],
  quick2: ['Digit2'],
  quick3: ['Digit3'],
  quick4: ['Digit4'],
  swapHands: ['KeyX'],
  flashlight: ['KeyR'],
  debug: ['F3', 'Backquote'],
  restart: ['Enter'],
  guide: ['KeyH'],
  pause: ['Escape'],
  language: ['F2'],
} as const;

/** Action names the simulation reacts to; they must exist in KEY_BINDINGS. */
export const ACTIONS = {
  sprint: 'sprint',
  crouch: 'crouch',
  interact: 'interact',
  use: 'use',
  throwItem: 'throwItem',
  drop: 'drop',
  flashlight: 'flashlight',
  swapHands: 'swapHands',
  /** Belt slots, in order. The index in this list is the index on the belt. */
  quick: ['quick1', 'quick2', 'quick3', 'quick4'],
} as const;

/** Starting point for the settings screen; the player's own choices override it. */
export const SETTINGS_DEFAULTS = {
  volumeMaster: 0.7,
  volumeEffects: 0.9,
  volumeAmbient: 0.7,
  /** 1 is the palette as authored; the slider exists because monitors differ. */
  brightness: 1,
  uiScale: 1,
  debugOverlay: false,
} as const;

/** Order the controls are listed in, and which of them may be rebound. */
export const REBINDABLE_ACTIONS: readonly string[] = [
  'up',
  'down',
  'left',
  'right',
  'sprint',
  'crouch',
  'interact',
  'use',
  'throwItem',
  'drop',
  'inventory',
  'flashlight',
  'swapHands',
  'quick1',
  'quick2',
  'quick3',
  'quick4',
  'guide',
  'pause',
  'debug',
  'restart',
];

export const SETTINGS_RANGES = {
  volume: { min: 0, max: 1, step: 0.05 },
  brightness: { min: 0.6, max: 1.8, step: 0.05 },
  uiScale: { min: 0.8, max: 1.6, step: 0.1 },
} as const;

export const AXIS_BINDINGS = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
} as const;
