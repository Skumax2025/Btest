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
  blockSize: 8,
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

export const LIGHTING = {
  lampRadius: 150,
  lampStrength: 0.9,
  falloffExponent: 1.55,
  flickerPeriod: 7,
  flickerOnChance: 0.62,
  visionRadius: 220,
  darkVisionRadius: 94,
  flashlightRadius: 430,
  flashlightHalfAngle: 0.42,
  flashlightStrength: 1,
  darkThreshold: 0.22,
  flashlightLightLevel: 0.34,
  /** How far a lit room stays visible down an unobstructed line of sight. */
  losRadius: 1100,
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

export const INVENTORY = {
  width: 8,
  height: 5,
  /** Weight budget in kilograms. */
  capacity: 14,
  /** Pixels per inventory cell in the DOM overlay. */
  cellPixels: 34,
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
  searchFallback: 180,
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

export const VISION = {
  /** Rays per light. Higher is smoother and costs a raycast each. */
  lightRays: 48,
  playerRays: 72,
  flashlightRays: 40,
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
