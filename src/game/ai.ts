/**
 * L2 module: creature minds.
 *
 * Knows: the three archetypes and how each one changes its mind given what it
 * heard, what it can see and how tired it is. `decide` is a pure function, so
 * every behaviour claim in the tests is checked without a world.
 *
 * Does not know: how a creature moves, collides, or is drawn, and it never
 * reads the player directly — the run measures perception and hands it in.
 * A creature that "sees the player" is really a creature handed `canSee: true`.
 */

import type { RandomStream } from '@core/rng';

export type CreatureArchetype = 'wanderer' | 'hunter' | 'sentinel';

export interface CreatureDef {
  readonly id: string;
  readonly nameKey: string;
  readonly archetype: CreatureArchetype;
  readonly sprite: string;
  readonly radius: number;
  readonly walkSpeed: number;
  readonly chaseSpeed: number;
  /** Loudness in [0, 1] below which a noise is ignored. */
  readonly hearingThreshold: number;
  readonly sightRange: number;
  readonly sightHalfAngle: number;
  /** Ticks of no new evidence before the creature gives up on a target. */
  readonly loseInterestTicks: number;
  /** Ticks a hunter can keep chasing before it has to stop. */
  readonly staminaTicks: number;
  readonly restTicks: number;
  readonly damage: number;
  readonly attackRange: number;
  readonly attackCooldownTicks: number;
  readonly health: number;
  /** Radius of the noise the creature itself makes while moving. */
  readonly noiseRadius: number;
  /** Radius at which a stationary threat can be recognised before it is lethal. */
  readonly telegraphRadius: number;
  readonly sanityRadius: number;
  readonly killsOnContact: boolean;
  /** Distance a wanderer picks its next idle destination within. */
  readonly wanderRange: number;
  /** Closest share of `wanderRange` an idle destination may be. */
  readonly wanderMinFactor: number;
}

export type CreatureCatalog = Readonly<Record<string, CreatureDef>>;

export type CreatureMode = 'idle' | 'wander' | 'investigate' | 'chase' | 'rest';

export interface CreatureState {
  readonly defId: string;
  /** Prop key of the spawn it came from, so a kill can be recorded. */
  readonly spawnKey: string;
  /** Chunk that owns this creature; when that chunk unloads, so does it. */
  readonly homeCx: number;
  readonly homeCy: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  facing: number;
  mode: CreatureMode;
  targetX: number;
  targetY: number;
  /** Ticks spent in the current mode. */
  modeTicks: number;
  /** Ticks of continuous chasing; a hunter has to rest when it runs out. */
  chaseTicks: number;
  attackCooldown: number;
  health: number;
  /** Ticks left before the walk path is recomputed. */
  repathIn: number;
  /** Flat [tx, ty, ...] route being followed, empty when steering directly. */
  path: number[];
  pathIndex: number;
  /** Ticks until this creature makes its own noise again. */
  noiseIn: number;
}

/** What the run measured for one creature this tick. */
export interface CreaturePerception {
  /** Loudest noise the creature can hear, in [0, 1]. */
  readonly loudness: number;
  readonly noiseX: number;
  readonly noiseY: number;
  readonly canSeePlayer: boolean;
  readonly playerX: number;
  readonly playerY: number;
  readonly playerDistance: number;
}

export interface Decision {
  readonly mode: CreatureMode;
  readonly targetX: number;
  readonly targetY: number;
}

const keep = (state: CreatureState, mode: CreatureMode): Decision => ({
  mode,
  targetX: state.targetX,
  targetY: state.targetY,
});

/**
 * One creature, one tick. The archetypes differ only here:
 *  - wanderer: hears, never sees, forgets quickly;
 *  - hunter: hears and sees, commits hard, then has to stop and breathe;
 *  - sentinel: never moves at all.
 */
export const decide = (
  state: CreatureState,
  def: CreatureDef,
  perception: CreaturePerception,
  rng: RandomStream,
): Decision => {
  if (def.archetype === 'sentinel') return { mode: 'idle', targetX: state.x, targetY: state.y };

  const heard = perception.loudness >= def.hearingThreshold;
  const seen = def.archetype === 'hunter' && perception.canSeePlayer;

  if (state.mode === 'rest') {
    if (state.modeTicks < def.restTicks) return keep(state, 'rest');
    return wander(state, def, rng);
  }

  if (seen) {
    if (def.archetype === 'hunter' && state.chaseTicks >= def.staminaTicks) {
      return { mode: 'rest', targetX: state.x, targetY: state.y };
    }
    return { mode: 'chase', targetX: perception.playerX, targetY: perception.playerY };
  }

  if (heard) {
    if (def.archetype === 'hunter' && state.mode === 'chase' && state.chaseTicks < def.staminaTicks) {
      return { mode: 'chase', targetX: perception.noiseX, targetY: perception.noiseY };
    }
    return { mode: 'investigate', targetX: perception.noiseX, targetY: perception.noiseY };
  }

  if (state.mode === 'chase') {
    if (state.chaseTicks >= def.staminaTicks) {
      return { mode: 'rest', targetX: state.x, targetY: state.y };
    }
    // Keep running at the last known position for a while, then downgrade.
    if (state.modeTicks < def.loseInterestTicks) return keep(state, 'chase');
    return keep(state, 'investigate');
  }

  if (state.mode === 'investigate') {
    const arrived = Math.hypot(state.targetX - state.x, state.targetY - state.y) < def.attackRange;
    if (!arrived && state.modeTicks < def.loseInterestTicks) return keep(state, 'investigate');
    return wander(state, def, rng);
  }

  const arrived = Math.hypot(state.targetX - state.x, state.targetY - state.y) < def.attackRange * 2;
  if (state.mode === 'wander' && !arrived && state.modeTicks < def.loseInterestTicks) {
    return keep(state, 'wander');
  }
  return wander(state, def, rng);
};

const wander = (state: CreatureState, def: CreatureDef, rng: RandomStream): Decision => {
  const angle = rng.float(0, Math.PI * 2);
  const distance = rng.float(def.wanderRange * def.wanderMinFactor, def.wanderRange);
  return {
    mode: 'wander',
    targetX: state.x + Math.cos(angle) * distance,
    targetY: state.y + Math.sin(angle) * distance,
  };
};

export const speedFor = (mode: CreatureMode, def: CreatureDef): number => {
  switch (mode) {
    case 'chase':
      return def.chaseSpeed;
    case 'investigate':
      return (def.walkSpeed + def.chaseSpeed) / 2;
    case 'wander':
      return def.walkSpeed;
    default:
      return 0;
  }
};

/** How much a creature at this distance presses on the player's nerve, in [0, 1]. */
export const sanityPressure = (distance: number, def: CreatureDef): number => {
  if (def.sanityRadius <= 0 || distance >= def.sanityRadius) return 0;
  return 1 - distance / def.sanityRadius;
};

export const applyDecision = (state: CreatureState, decision: Decision): void => {
  if (decision.mode !== state.mode) {
    state.mode = decision.mode;
    state.modeTicks = 0;
  } else {
    state.modeTicks++;
  }
  state.targetX = decision.targetX;
  state.targetY = decision.targetY;
  if (state.mode === 'chase') state.chaseTicks++;
  else if (state.mode === 'rest') state.chaseTicks = Math.max(0, state.chaseTicks - 2);
  else state.chaseTicks = Math.max(0, state.chaseTicks - 1);
};
