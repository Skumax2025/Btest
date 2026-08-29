import { describe, expect, it } from 'vitest';
import { createRandom } from '@core/rng';
import { applyDecision, decide, sanityPressure, speedFor } from '@game/ai';
import type { CreaturePerception, CreatureState } from '@game/ai';
import { NoiseField, loudnessAt } from '@systems/sound';
import { findPath } from '@systems/pathfinding';
import { CREATURES } from '@content/entities';
import { SOUND } from '@content/tuning';

const state = (over: Partial<CreatureState> = {}): CreatureState => ({
  defId: 'creature.drifter',
  spawnKey: 'spawn',
  homeCx: 0,
  homeCy: 0,
  x: 0,
  y: 0,
  prevX: 0,
  prevY: 0,
  facing: 0,
  mode: 'idle',
  targetX: 0,
  targetY: 0,
  modeTicks: 0,
  chaseTicks: 0,
  attackCooldown: 0,
  health: 10,
  repathIn: 0,
  path: [],
  pathIndex: 0,
  noiseIn: 0,
  ...over,
});

const nothing = (over: Partial<CreaturePerception> = {}): CreaturePerception => ({
  loudness: 0,
  noiseX: 0,
  noiseY: 0,
  canSeePlayer: false,
  playerX: 500,
  playerY: 0,
  playerDistance: 500,
  ...over,
});

const rng = () => createRandom('ai');

describe('creature behaviour', () => {
  const drifter = CREATURES['creature.drifter'];
  const hound = CREATURES['creature.hound'];
  const bloom = CREATURES['creature.bloom'];

  it('sends a wanderer to a noise it can hear', () => {
    const creature = state();
    const decision = decide(
      creature,
      drifter,
      nothing({ loudness: 0.9, noiseX: 300, noiseY: 120 }),
      rng(),
    );
    expect(decision.mode).toBe('investigate');
    expect(decision.targetX).toBe(300);
    expect(decision.targetY).toBe(120);
  });

  it('leaves a wanderer alone when the noise is too faint', () => {
    const decision = decide(state(), drifter, nothing({ loudness: 0.05 }), rng());
    expect(decision.mode).toBe('wander');
  });

  it('never lets a wanderer see the player', () => {
    const decision = decide(state(), drifter, nothing({ canSeePlayer: true }), rng());
    expect(decision.mode).not.toBe('chase');
  });

  it('makes a hunter chase what it sees', () => {
    const creature = state({ defId: 'creature.hound' });
    const decision = decide(
      creature,
      hound,
      nothing({ canSeePlayer: true, playerX: 200, playerY: 40 }),
      rng(),
    );
    expect(decision.mode).toBe('chase');
    expect(decision.targetX).toBe(200);
  });

  it('forces a hunter to rest once it runs out of breath', () => {
    const creature = state({ defId: 'creature.hound', mode: 'chase', chaseTicks: hound.staminaTicks });
    const decision = decide(creature, hound, nothing({ canSeePlayer: true }), rng());
    expect(decision.mode).toBe('rest');
  });

  it('lets a hunter recover and go back to wandering after resting', () => {
    const creature = state({
      defId: 'creature.hound',
      mode: 'rest',
      modeTicks: hound.restTicks + 1,
    });
    expect(decide(creature, hound, nothing(), rng()).mode).toBe('wander');
  });

  it('gives up on a chase when the trail goes cold', () => {
    const creature = state({
      defId: 'creature.hound',
      mode: 'chase',
      modeTicks: hound.loseInterestTicks + 1,
    });
    expect(decide(creature, hound, nothing(), rng()).mode).toBe('investigate');
  });

  it('never moves a sentinel', () => {
    const creature = state({ defId: 'creature.bloom', x: 40, y: 80 });
    const decision = decide(creature, bloom, nothing({ loudness: 1, canSeePlayer: true }), rng());
    expect(decision.mode).toBe('idle');
    expect(speedFor(decision.mode, bloom)).toBe(0);
    expect(bloom.telegraphRadius).toBeGreaterThan(bloom.attackRange);
  });

  it('counts chase time up and lets it decay while resting', () => {
    const creature = state({ defId: 'creature.hound' });
    applyDecision(creature, { mode: 'chase', targetX: 1, targetY: 2 });
    applyDecision(creature, { mode: 'chase', targetX: 1, targetY: 2 });
    expect(creature.chaseTicks).toBe(2);
    expect(creature.modeTicks).toBe(1);
    applyDecision(creature, { mode: 'rest', targetX: 0, targetY: 0 });
    expect(creature.chaseTicks).toBe(0);
  });

  it('presses on the player nerve only inside its radius', () => {
    expect(sanityPressure(0, hound)).toBeCloseTo(1);
    expect(sanityPressure(hound.sanityRadius + 1, hound)).toBe(0);
    expect(sanityPressure(hound.sanityRadius / 2, hound)).toBeCloseTo(0.5);
  });

  it('cannot be outrun in a straight line, but can be outlasted', () => {
    expect(hound.chaseSpeed).toBeGreaterThan(140);
    expect(hound.staminaTicks).toBeLessThan(900);
    expect(hound.restTicks).toBeGreaterThan(120);
  });
});

describe('sound', () => {
  const open = (): boolean => false;
  const tileSize = 32;

  it('fades with distance', () => {
    const event = { x: 0, y: 0, radius: 200, tick: 0, source: 'step' };
    expect(loudnessAt(event, 0, 0, tileSize, open, SOUND)).toBeCloseTo(1);
    expect(loudnessAt(event, 100, 0, tileSize, open, SOUND)).toBeCloseTo(0.5);
    expect(loudnessAt(event, 260, 0, tileSize, open, SOUND)).toBe(0);
  });

  it('is muffled by walls', () => {
    const walls = (tx: number): boolean => tx === 2;
    const event = { x: 0, y: 0, radius: 300, tick: 0, source: 'step' };
    const clear = loudnessAt(event, 200, 0, tileSize, open, SOUND);
    const muffled = loudnessAt(event, 200, 0, tileSize, walls, SOUND);
    expect(muffled).toBeLessThan(clear);
  });

  it('forgets events once they age out', () => {
    const field = new NoiseField(SOUND);
    field.emit({ x: 0, y: 0, radius: 100, tick: 0, source: 'step' });
    field.prune(SOUND.memoryTicks + 1);
    expect(field.recent().length).toBe(0);
  });

  it('reports the loudest event and can filter by source', () => {
    const field = new NoiseField(SOUND);
    field.emit({ x: 300, y: 0, radius: 400, tick: 0, source: 'step' });
    field.emit({ x: 10, y: 0, radius: 400, tick: 0, source: 'creature' });
    expect(field.loudest(0, 0, tileSize, open)?.event.source).toBe('creature');
    expect(
      field.loudest(0, 0, tileSize, open, (event) => event.source !== 'creature')?.event.source,
    ).toBe('step');
  });
});

describe('pathfinding', () => {
  // # # # # #
  // # . # . #
  // # . # . #
  // # . . . #
  // # # # # #
  const MAP = ['#####', '#.#.#', '#.#.#', '#...#', '#####'];
  const isSolid = (tx: number, ty: number): boolean =>
    ty < 0 || ty >= MAP.length || tx < 0 || tx >= MAP[ty].length || MAP[ty][tx] === '#';

  it('walks around a wall', () => {
    const path = findPath(1, 1, 3, 1, isSolid, 500);
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThan(0);
    for (let i = 0; i < (path?.length ?? 0); i += 2) {
      expect(isSolid(path![i], path![i + 1])).toBe(false);
    }
    expect(path?.slice(-2)).toEqual([3, 1]);
  });

  it('returns null when the goal is walled off', () => {
    expect(findPath(1, 1, 2, 1, isSolid, 500)).toBeNull();
    expect(findPath(1, 1, 9, 9, isSolid, 500)).toBeNull();
  });

  it('returns an empty path when already there', () => {
    expect(findPath(1, 1, 1, 1, isSolid, 500)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(findPath(1, 1, 3, 1, isSolid, 500)).toEqual(findPath(1, 1, 3, 1, isSolid, 500));
  });
});
