/**
 * The frame budget claim, checked rather than asserted in a README.
 *
 * The bound is deliberately loose (a CI box is not a gaming desktop); what it
 * really guards against is an accidental O(n^2) creeping into the tick — which
 * is why the spatial index exists and why this test spawns far more creatures
 * than a real level ever holds.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '@core/input';
import { Run } from '@game/run';
import type { CreatureState } from '@game/ai';
import { createRunConfig } from '@content/run-config';

const ENTITIES = 200;
const TICKS = 300;
/**
 * One simulation tick must leave nearly all of a 16.6 ms frame for rendering,
 * which is where the cost actually is.
 *
 * The bound is loose for a CI box but no longer generous: a tick of this crowd
 * measures around 0.6 ms. It was 4.7 ms until a creature that could not reach
 * its target was found to be running a full A* search, to the whole node budget,
 * on every single tick — so what this really guards is that a *failed* search
 * still waits for the repath timer like a successful one does.
 */
const BUDGET_MS = 2;
/** Generating a chunk is allowed more: it happens on a handful of ticks, not all. */
const CHUNK_BUDGET_MS = 8;

const crowd = (run: Run, count: number): void => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const distance = 60 + (i % 17) * 24;
    const creature: CreatureState = {
      defId: i % 3 === 0 ? 'creature.hound' : i % 3 === 1 ? 'creature.drifter' : 'creature.bloom',
      spawnKey: `perf:${i}`,
      homeCx: 0,
      homeCy: 0,
      x: run.player.x + Math.cos(angle) * distance,
      y: run.player.y + Math.sin(angle) * distance,
      prevX: run.player.x,
      prevY: run.player.y,
      facing: angle,
      mode: 'wander',
      targetX: run.player.x,
      targetY: run.player.y,
      modeTicks: 0,
      chaseTicks: 0,
      attackCooldown: 10_000,
      blockCooldown: 0,
      health: 1_000_000,
      repathIn: 0,
      path: [],
      pathIndex: 0,
      noiseIn: i % 40,
    };
    run.spawn(run.creatures, creature);
  }
};

describe('frame budget', () => {
  it(`steps ${ENTITIES} active creatures well inside a frame`, () => {
    const run = new Run(createRunConfig(0xbeef));
    // Immortal for the duration, so the crowd stays a crowd.
    run.stats.health = Number.MAX_SAFE_INTEGER;
    // The level's own creatures are already there; top the crowd up to the target.
    crowd(run, Math.max(0, ENTITIES - run.creatures.size));
    expect(run.creatures.size).toBeGreaterThanOrEqual(ENTITIES);

    const input = { ...EMPTY_INPUT, axisX: 1 };
    for (let i = 0; i < 30; i++) run.step(input); // warm up the JIT

    const start = performance.now();
    for (let i = 0; i < TICKS; i++) run.step(input);
    const perTick = (performance.now() - start) / TICKS;

    expect(run.creatures.size).toBeGreaterThan(ENTITIES / 2);
    expect(perTick).toBeLessThan(BUDGET_MS);
  });

  it('generates a chunk fast enough to stream without a hitch', () => {
    const run = new Run(createRunConfig(0xfeed));
    const start = performance.now();
    for (let i = 0; i < 40; i++) run.level.prime(i * run.level.chunkWorldSize, 0);
    const perChunk = (performance.now() - start) / 40;
    expect(perChunk).toBeLessThan(CHUNK_BUDGET_MS);
  });
});
