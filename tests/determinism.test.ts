/**
 * The load-bearing test of the whole project: the same seed and the same input
 * must produce the same world, tick for tick, with no browser in sight.
 */
import { describe, expect, it } from 'vitest';
import { fingerprint } from '@core/serialize';
import type { InputFrame } from '@core/input';
import { Run, restoreRun, snapshotRun } from '@game/run';
import { createRunConfig } from '@content/run-config';

/** A fixed script: walk, sprint, crouch, search, use, throw, swing. */
const scriptedInput = (tick: number): InputFrame => {
  const phase = tick % 120;
  const held: string[] = [];
  const pressed: string[] = [];
  let axisX = 0;
  let axisY = 0;
  if (phase < 40) axisX = 1;
  else if (phase < 70) axisY = 1;
  else if (phase < 95) axisX = -1;
  else axisY = -1;
  if (phase >= 20 && phase < 34) held.push('sprint');
  if (phase >= 80 && phase < 90) held.push('crouch');
  if (phase === 12) pressed.push('interact');
  if (phase === 50) pressed.push('interact');
  if (phase === 61) pressed.push('use');
  if (phase === 74) pressed.push('attack');
  if (phase === 101) pressed.push('flashlight');
  if (phase === 110) pressed.push('throwItem');
  return {
    axisX,
    axisY,
    held,
    pressed,
    pointerX: 400 + Math.sin(tick / 9) * 300,
    pointerY: 400 + Math.cos(tick / 7) * 300,
    pointerDown: false,
  };
};

const play = (seed: number, ticks: number): Run => {
  const run = new Run(createRunConfig(seed));
  for (let tick = 0; tick < ticks; tick++) run.step(scriptedInput(tick));
  return run;
};

describe('determinism', () => {
  it('produces identical state after 1000 ticks for the same seed and input', () => {
    const a = play(0x1234, 1000);
    const b = play(0x1234, 1000);
    expect(a.tick).toBe(1000);
    expect(fingerprint(snapshotRun(a))).toBe(fingerprint(snapshotRun(b)));
    expect(snapshotRun(a)).toEqual(snapshotRun(b));
  });

  it('produces a different world for a different seed', () => {
    const a = play(0x1234, 400);
    const b = play(0x4321, 400);
    expect(fingerprint(snapshotRun(a))).not.toBe(fingerprint(snapshotRun(b)));
  });

  it('does not depend on how far the player wandered before a chunk was reached', () => {
    const direct = new Run(createRunConfig(77));
    const detoured = new Run(createRunConfig(77));
    // Same net displacement, different route: the level must come out the same.
    for (let i = 0; i < 300; i++) {
      direct.step({ ...scriptedInput(i), axisX: 1, axisY: 0 });
    }
    for (let i = 0; i < 150; i++) {
      detoured.step({ ...scriptedInput(i), axisX: 0, axisY: 1 });
    }
    for (let i = 0; i < 150; i++) {
      detoured.step({ ...scriptedInput(i), axisX: 0, axisY: -1 });
    }
    for (let i = 0; i < 300; i++) {
      detoured.step({ ...scriptedInput(i), axisX: 1, axisY: 0 });
    }
    const sample = (run: Run): number[] => {
      const out: number[] = [];
      for (let ty = 0; ty < 40; ty++) for (let tx = 0; tx < 40; tx++) out.push(run.level.tileAt(tx, ty));
      return out;
    };
    expect(sample(direct)).toEqual(sample(detoured));
  });

  it('resumes identically from a save', () => {
    const original = play(0x99, 600);
    const save = JSON.parse(JSON.stringify(snapshotRun(original)));

    const resumed = new Run(createRunConfig(0x99));
    restoreRun(resumed, save);
    expect(fingerprint(snapshotRun(resumed))).toBe(fingerprint(snapshotRun(original)));

    for (let tick = 600; tick < 800; tick++) {
      original.step(scriptedInput(tick));
      resumed.step(scriptedInput(tick));
    }
    expect(fingerprint(snapshotRun(resumed))).toBe(fingerprint(snapshotRun(original)));
  });

  it('keeps a searched container searched across an unload and a return', () => {
    const run = new Run(createRunConfig(5));
    const prop = run
      .propsNear(run.player.x, run.player.y, 400)
      .find((candidate) => candidate.kind === 'container');
    expect(prop).toBeDefined();
    if (!prop) return;
    run.level.open(prop.x, prop.y, prop.key);
    for (let i = 0; i < 1200; i++) run.step({ ...scriptedInput(i), axisX: 1, axisY: 0 });
    for (let i = 0; i < 2000; i++) run.step({ ...scriptedInput(i), axisX: -1, axisY: 0 });
    expect(run.level.isOpened(prop)).toBe(true);
  });
});
