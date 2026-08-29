/**
 * L2 module: player body.
 *
 * Knows: how the body accelerates, turns and collides, and which stance it is
 * in. Does not know: stamina, health, items or sound — the run tells it whether
 * sprinting is allowed and reads back how loud the result was.
 */

import type { InputFrame } from '@core/input';
import { isHeld } from '@core/input';
import { angleDelta, clamp } from '@core/math';
import { moveCircle } from '@systems/collision';
import type { SolidSampler } from '@systems/collision';

export type Stance = 'stand' | 'crouch' | 'sprint';

export interface PlayerConfig {
  readonly radius: number;
  readonly walkSpeed: number;
  readonly sprintSpeed: number;
  readonly crouchSpeed: number;
  readonly wetSpeedFactor: number;
  readonly acceleration: number;
  readonly turnRate: number;
}

export interface PlayerState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  facing: number;
  prevFacing: number;
  stance: Stance;
  /** Distance covered this tick, in world units — the run turns it into noise. */
  moved: number;
  onWet: boolean;
}

export interface PlayerActions {
  readonly sprint: string;
  readonly crouch: string;
}

export interface PlayerStepContext {
  readonly input: InputFrame;
  readonly config: PlayerConfig;
  readonly actions: PlayerActions;
  readonly tileSize: number;
  readonly stepSeconds: number;
  readonly isSolid: SolidSampler;
  readonly isWet: (tx: number, ty: number) => boolean;
  /** False when stamina is spent; the body then refuses to sprint. */
  readonly canSprint: boolean;
}

export const createPlayer = (x: number, y: number): PlayerState => ({
  x,
  y,
  prevX: x,
  prevY: y,
  vx: 0,
  vy: 0,
  facing: 0,
  prevFacing: 0,
  stance: 'stand',
  moved: 0,
  onWet: false,
});

const stanceOf = (context: PlayerStepContext): Stance => {
  if (isHeld(context.input, context.actions.crouch)) return 'crouch';
  if (isHeld(context.input, context.actions.sprint) && context.canSprint) return 'sprint';
  return 'stand';
};

const speedFor = (stance: Stance, config: PlayerConfig): number => {
  switch (stance) {
    case 'sprint':
      return config.sprintSpeed;
    case 'crouch':
      return config.crouchSpeed;
    default:
      return config.walkSpeed;
  }
};

export const stepPlayer = (state: PlayerState, context: PlayerStepContext): void => {
  const { input, config } = context;
  state.prevX = state.x;
  state.prevY = state.y;
  state.prevFacing = state.facing;

  const tileX = Math.floor(state.x / context.tileSize);
  const tileY = Math.floor(state.y / context.tileSize);
  state.onWet = context.isWet(tileX, tileY);

  state.stance = stanceOf(context);
  const wetFactor = state.onWet ? config.wetSpeedFactor : 1;
  const speed = speedFor(state.stance, config) * wetFactor;

  const targetVx = input.axisX * speed;
  const targetVy = input.axisY * speed;
  const blend = clamp(config.acceleration, 0, 1);
  state.vx += (targetVx - state.vx) * blend;
  state.vy += (targetVy - state.vy) * blend;
  if (Math.abs(state.vx) < 0.01) state.vx = 0;
  if (Math.abs(state.vy) < 0.01) state.vy = 0;

  const moved = moveCircle(
    state.x,
    state.y,
    config.radius,
    state.vx * context.stepSeconds,
    state.vy * context.stepSeconds,
    context.tileSize,
    context.isSolid,
  );
  if (moved.hitX) state.vx = 0;
  if (moved.hitY) state.vy = 0;
  state.moved = Math.hypot(moved.x - state.x, moved.y - state.y);
  state.x = moved.x;
  state.y = moved.y;

  const aimX = input.pointerX - state.x;
  const aimY = input.pointerY - state.y;
  if (aimX !== 0 || aimY !== 0) {
    const target = Math.atan2(aimY, aimX);
    state.facing += angleDelta(state.facing, target) * clamp(config.turnRate, 0, 1);
  }
};

/** Interpolated facing for rendering; handles the wrap at ±π. */
export const facingAt = (state: PlayerState, alpha: number): number =>
  state.prevFacing + angleDelta(state.prevFacing, state.facing) * alpha;
