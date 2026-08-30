/**
 * L2 module: survival stats.
 *
 * Knows: how health, hunger, thirst, stamina and sanity move over time and what
 * kills the player. Pure arithmetic on a plain state object — no rendering, no
 * items, no world.
 *
 * Does not know: where "dark", "silent" or "creature pressure" come from. The
 * run measures those and hands them in, which is what makes this file testable
 * without a level.
 */

import { clamp } from '@core/math';

export type CauseOfDeath = 'injury' | 'starvation' | 'thirst' | 'unknown';

export interface StatsConfig {
  readonly maxHealth: number;
  readonly maxHunger: number;
  readonly maxThirst: number;
  readonly maxStamina: number;
  readonly maxSanity: number;
  readonly hungerPerSecond: number;
  readonly thirstPerSecond: number;
  readonly sprintHungerFactor: number;
  readonly staminaDrainPerSecond: number;
  readonly staminaRegenPerSecond: number;
  readonly staminaCrouchRegenFactor: number;
  /** Stamina needed before a sprint may start again after it is emptied. */
  readonly sprintRecoveryStamina: number;
  readonly starvationDamagePerSecond: number;
  readonly dehydrationDamagePerSecond: number;
  readonly sanityDarkPerSecond: number;
  readonly sanitySilencePerSecond: number;
  readonly sanityCreaturePerSecond: number;
  readonly sanityRegenPerSecond: number;
  /** Share of the nerve recovery rate that applies while walking rather than resting. */
  readonly movingRegenFactor: number;
  /** Below this fraction of max sanity the world starts lying to the player. */
  readonly lowSanityFraction: number;
  readonly healthRegenPerSecond: number;
  /** Hunger and thirst must both be above this fraction for health to regenerate. */
  readonly healthRegenFraction: number;
}

export interface StatsState {
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  sanity: number;
  /** Latched once stamina bottoms out, cleared when it recovers enough. */
  exhausted: boolean;
  cause: CauseOfDeath | null;
}

export interface StatsInput {
  readonly stepSeconds: number;
  readonly sprinting: boolean;
  readonly crouching: boolean;
  readonly resting: boolean;
  readonly inDark: boolean;
  readonly inSilence: boolean;
  /** 0 when nothing is near, 1 when a creature is on top of the player. */
  readonly creaturePressure: number;
}

export const createStats = (config: StatsConfig): StatsState => ({
  health: config.maxHealth,
  hunger: config.maxHunger,
  thirst: config.maxThirst,
  stamina: config.maxStamina,
  sanity: config.maxSanity,
  exhausted: false,
  cause: null,
});

/** False while the body refuses to sprint — empty or still catching its breath. */
export const canSprint = (state: StatsState): boolean =>
  !state.exhausted && state.stamina > 0 && state.hunger > 0;

export const isLowSanity = (state: StatsState, config: StatsConfig): boolean =>
  state.sanity < config.maxSanity * config.lowSanityFraction;

export const applyDamage = (
  state: StatsState,
  amount: number,
  cause: CauseOfDeath,
  config: StatsConfig,
): void => {
  state.health = clamp(state.health - amount, 0, config.maxHealth);
  if (state.health <= 0 && state.cause === null) state.cause = cause;
};

export const stepStats = (state: StatsState, input: StatsInput, config: StatsConfig): void => {
  const dt = input.stepSeconds;

  const effort = input.sprinting ? config.sprintHungerFactor : 1;
  state.hunger = clamp(state.hunger - config.hungerPerSecond * effort * dt, 0, config.maxHunger);
  state.thirst = clamp(state.thirst - config.thirstPerSecond * effort * dt, 0, config.maxThirst);

  if (input.sprinting) {
    state.stamina = clamp(state.stamina - config.staminaDrainPerSecond * dt, 0, config.maxStamina);
    if (state.stamina <= 0) state.exhausted = true;
  } else {
    const regen =
      config.staminaRegenPerSecond * (input.crouching ? config.staminaCrouchRegenFactor : 1);
    state.stamina = clamp(state.stamina + regen * dt, 0, config.maxStamina);
    if (state.exhausted && state.stamina >= config.sprintRecoveryStamina) state.exhausted = false;
  }

  let sanityDelta = 0;
  if (input.inDark) sanityDelta -= config.sanityDarkPerSecond;
  if (input.inSilence) sanityDelta -= config.sanitySilencePerSecond;
  sanityDelta -= config.sanityCreaturePerSecond * clamp(input.creaturePressure, 0, 1);
  // Nerve comes back wherever nothing is eating it, but standing still helps most.
  if (sanityDelta === 0) {
    sanityDelta += config.sanityRegenPerSecond * (input.resting ? 1 : config.movingRegenFactor);
  }
  state.sanity = clamp(state.sanity + sanityDelta * dt, 0, config.maxSanity);

  if (state.hunger <= 0) applyDamage(state, config.starvationDamagePerSecond * dt, 'starvation', config);
  if (state.thirst <= 0) applyDamage(state, config.dehydrationDamagePerSecond * dt, 'thirst', config);

  const fed =
    state.hunger > config.maxHunger * config.healthRegenFraction &&
    state.thirst > config.maxThirst * config.healthRegenFraction;
  if (fed && state.health > 0) {
    state.health = clamp(state.health + config.healthRegenPerSecond * dt, 0, config.maxHealth);
  }
};

export const isDead = (state: StatsState): boolean => state.health <= 0;
