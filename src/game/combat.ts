/**
 * L2 module: melee.
 *
 * Knows: what the thing in your hand is worth right now, who is inside its
 * reach, what one swing costs, and whether a block catches an incoming hit.
 * All of it is arithmetic on plain values, so every rule here is tested without
 * a level, a renderer or a creature.
 *
 * Does not know: who is swinging. The player and the creatures use the same
 * functions with their own numbers, both supplied from L3.
 */

import { clamp } from '@core/math';
import type { RandomStream } from '@core/rng';

/** Everything a weapon is, as data. Bare hands are one of these, not a branch. */
export interface WeaponStats {
  /** Radius of the swing, in world units. Everything inside it is hit. */
  readonly reach: number;
  readonly damage: number;
  /** Ticks between the end of one swing and the start of the next. */
  readonly intervalTicks: number;
  /** Ticks between committing to a swing and it landing — the window to step back. */
  readonly windupTicks: number;
  readonly staminaCost: number;
  /** Extra stamina for every target past the first. A wide swing is expensive. */
  readonly staminaPerExtraTarget: number;
  readonly noise: number;
  /** Extra noise radius per target past the first. A wide swing carries. */
  readonly noisePerExtraTarget: number;
  readonly wearPerHit: number;
  readonly maxDurability: number;
  /** Damage multiplier when the weapon is one hit from failing. */
  readonly wornDamageFactor: number;
  readonly blockChance: number;
  readonly blockStaminaCost: number;
  readonly blockCooldownTicks: number;
}

export interface ResolvedWeapon {
  readonly stats: WeaponStats;
  /** True when the item in hand has failed and the body is doing the work. */
  readonly broken: boolean;
  /** Damage after wear, ready to apply. */
  readonly damage: number;
}

/**
 * A broken weapon, or one that was never a weapon, falls back to the bare-hands
 * stat block. That is why `item.hands` exists in the catalogue.
 */
export const resolveWeapon = (
  melee: WeaponStats | null | undefined,
  durability: number,
  hands: WeaponStats,
): ResolvedWeapon => {
  if (!melee) return { stats: hands, broken: false, damage: hands.damage };
  if (melee.maxDurability > 0 && durability <= 0) {
    return { stats: hands, broken: true, damage: hands.damage };
  }
  const wear =
    melee.maxDurability > 0 ? clamp(durability / melee.maxDurability, 0, 1) : 1;
  const factor = melee.wornDamageFactor + (1 - melee.wornDamageFactor) * wear;
  return { stats: melee, broken: false, damage: melee.damage * factor };
};

/** One worn piece, reduced to what it takes out of a hit. */
export interface ArmorPiece {
  readonly flat: number;
  readonly share: number;
}

/** Ceilings on protection, so a full set can never make a player untouchable. */
export interface ArmorLimits {
  /** Largest share of a hit all the pieces together may remove. */
  readonly maxShare: number;
  /** Smallest share of a hit that always gets through. */
  readonly minDamageFraction: number;
}

export interface AbsorbResult {
  /** Damage that reaches the body. */
  readonly damage: number;
  /** Damage the armour took instead, which is what wears it down. */
  readonly absorbed: number;
}

/**
 * Shares come off first and are capped together; flat points come off what is
 * left. `minDamageFraction` is the promise that armour slows a death down and
 * never prevents one.
 */
export const absorbDamage = (
  pieces: readonly ArmorPiece[],
  damage: number,
  limits: ArmorLimits,
): AbsorbResult => {
  if (damage <= 0) return { damage: 0, absorbed: 0 };
  let share = 0;
  let flat = 0;
  for (const piece of pieces) {
    share += Math.max(0, piece.share);
    flat += Math.max(0, piece.flat);
  }
  share = clamp(share, 0, clamp(limits.maxShare, 0, 1));
  const afterShare = damage * (1 - share);
  const floor = damage * clamp(limits.minDamageFraction, 0, 1);
  const taken = Math.max(floor, afterShare - flat);
  return { damage: taken, absorbed: damage - taken };
};

export interface Combatant {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Everything inside the ring — a swing has no arc and picks no favourites. */
export const targetsInReach = (
  x: number,
  y: number,
  reach: number,
  candidates: Iterable<Combatant>,
): Combatant[] => {
  const found: Combatant[] = [];
  for (const candidate of candidates) {
    const limit = reach + candidate.radius;
    const dx = candidate.x - x;
    const dy = candidate.y - y;
    if (dx * dx + dy * dy <= limit * limit) found.push(candidate);
  }
  return found;
};

export interface SwingCost {
  readonly stamina: number;
  readonly noise: number;
}

/** The price of one swing. Both halves grow with the number of bodies caught. */
export const swingCost = (stats: WeaponStats, targetCount: number): SwingCost => {
  const extra = Math.max(0, targetCount - 1);
  return {
    stamina: stats.staminaCost + stats.staminaPerExtraTarget * extra,
    noise: stats.noise + stats.noisePerExtraTarget * extra,
  };
};

/** Why the swing did not start. `ready` means it did. */
export type AttackVeto = 'ready' | 'crouching' | 'emptyHands' | 'cooling' | 'noTargets' | 'spent';

export interface AttackInput {
  readonly cooldown: number;
  readonly stamina: number;
  /** Crouching is the promise not to fight; it never swings. */
  readonly crouching: boolean;
  readonly hasItemInHand: boolean;
  readonly targetCount: number;
  readonly stats: WeaponStats;
}

/**
 * Crouching and empty hands are the two ways out. Both are deliberate: a player
 * must always be able to walk past something instead of fighting it.
 */
export const attackVeto = (input: AttackInput): AttackVeto => {
  if (input.crouching) return 'crouching';
  if (!input.hasItemInHand) return 'emptyHands';
  if (input.targetCount <= 0) return 'noTargets';
  if (input.cooldown > 0) return 'cooling';
  if (input.stamina < swingCost(input.stats, input.targetCount).stamina) return 'spent';
  return 'ready';
};

export const canAttack = (input: AttackInput): boolean => attackVeto(input) === 'ready';

export interface BlockInput {
  readonly cooldown: number;
  readonly stamina: number;
  readonly chance: number;
  readonly staminaCost: number;
}

export const canBlock = (input: BlockInput): boolean =>
  input.chance > 0 && input.cooldown <= 0 && input.stamina >= input.staminaCost;

/** A block that fires swallows the whole hit, never part of it. */
export const rollBlock = (input: BlockInput, rng: RandomStream): boolean =>
  canBlock(input) && rng.next() < input.chance;

/** Durability left after a swing; a weapon at zero becomes bare hands. */
export const wearAfterSwing = (stats: WeaponStats, durability: number): number =>
  stats.maxDurability > 0 ? Math.max(0, durability - stats.wearPerHit) : durability;

/**
 * A block is offered by whichever hand is better at it, so a secondary held for
 * nothing but its guard is a real choice rather than a spare weapon.
 */
export const bestBlock = (
  primary: WeaponStats,
  secondary: WeaponStats | null,
): WeaponStats => (secondary && secondary.blockChance > primary.blockChance ? secondary : primary);
