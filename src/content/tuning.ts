/**
 * L3: every number the game runs on. Nothing here is code — modules above read
 * these values as configuration, which is why no game constant lives in L0-L2.
 */

import type { LevelGeometry, StreamOptions } from '@game/level';

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
  lampStrength: 0.95,
  flickerPeriod: 7,
  flickerOnChance: 0.62,
  visionRadius: 220,
  darkVisionRadius: 74,
  flashlightRadius: 430,
  flashlightHalfAngle: 0.42,
  flashlightStrength: 1,
  darkThreshold: 0.22,
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
  attack: ['Space'],
  throwItem: ['KeyQ'],
  drop: ['KeyG'],
  inventory: ['Tab'],
  flashlight: ['KeyR'],
  debug: ['F3', 'Backquote'],
  restart: ['Enter'],
} as const;

export const AXIS_BINDINGS = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
} as const;
