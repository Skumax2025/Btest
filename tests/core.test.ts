import { describe, expect, it } from 'vitest';
import { World } from '@core/world';
import { SpatialGrid } from '@core/spatial';
import { EventBus } from '@core/events';
import { GameLoop } from '@core/loop';
import { MemoryStorage, fingerprint, loadEnvelope, saveEnvelope, stableStringify } from '@core/serialize';

describe('world', () => {
  it('stores and removes components', () => {
    const world = new World();
    const positions = world.store<{ x: number }>('position');
    const a = world.createEntity();
    const b = world.createEntity();
    positions.set(a, { x: 1 });
    positions.set(b, { x: 2 });
    expect(positions.size).toBe(2);
    world.destroyEntity(a);
    expect(positions.has(a)).toBe(false);
    expect(world.isAlive(a)).toBe(false);
    expect(world.entityCount).toBe(1);
  });

  it('round-trips through a snapshot', () => {
    const world = new World();
    const tags = world.store<{ tag: string }>('tag');
    const first = world.createEntity();
    tags.set(first, { tag: 'lamp' });
    world.createEntity();
    const snapshot = JSON.parse(JSON.stringify(world.serialize()));
    const restored = new World();
    restored.restore(snapshot);
    expect(restored.store<{ tag: string }>('tag').get(first)).toEqual({ tag: 'lamp' });
    expect(restored.entityCount).toBe(2);
    expect(restored.createEntity()).toBe(3);
  });
});

describe('spatial grid', () => {
  it('finds only entries inside the radius', () => {
    const grid = new SpatialGrid(32);
    grid.insert(1, 0, 0, 4);
    grid.insert(2, 100, 0, 4);
    grid.insert(3, 20, 20, 4);
    const found = grid.queryCircle(0, 0, 40).map((entry) => entry.id);
    expect(found).toContain(1);
    expect(found).toContain(3);
    expect(found).not.toContain(2);
  });

  it('agrees with a brute-force scan', () => {
    const grid = new SpatialGrid(24);
    const points: Array<{ id: number; x: number; y: number }> = [];
    let state = 12345;
    const rand = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    for (let i = 0; i < 400; i++) {
      const point = { id: i, x: rand() * 900 - 450, y: rand() * 900 - 450 };
      points.push(point);
      grid.insert(point.id, point.x, point.y, 0);
    }
    const expected = points
      .filter((p) => Math.hypot(p.x - 10, p.y + 20) <= 70)
      .map((p) => p.id)
      .sort((a, b) => a - b);
    const actual = grid
      .queryCircle(10, -20, 70)
      .map((e) => e.id)
      .sort((a, b) => a - b);
    expect(actual).toEqual(expected);
  });
});

describe('event bus', () => {
  it('dispatches in registration order and unsubscribes', () => {
    const bus = new EventBus<{ noise: { volume: number } }>();
    const seen: string[] = [];
    bus.on('noise', () => seen.push('first'));
    const off = bus.on('noise', () => seen.push('second'));
    bus.emit('noise', { volume: 1 });
    off();
    bus.emit('noise', { volume: 1 });
    expect(seen).toEqual(['first', 'second', 'first']);
  });
});

describe('loop', () => {
  it('runs a fixed number of simulation steps regardless of frame length', () => {
    let time = 0;
    const pending: Array<() => void> = [];
    const ticks: number[] = [];
    const alphas: number[] = [];
    const loop = new GameLoop(
      {
        stepMs: 10,
        maxFrameMs: 100,
        now: () => time,
        schedule: (cb) => {
          pending.push(cb);
          return pending.length;
        },
        cancel: () => undefined,
      },
      {
        fixedUpdate: (tick) => ticks.push(tick),
        render: (alpha) => alphas.push(alpha),
      },
    );
    loop.start();
    for (let frame = 0; frame < 5; frame++) {
      time += 25;
      const next = pending.shift();
      next?.();
    }
    expect(ticks.length).toBe(12);
    expect(ticks[0]).toBe(0);
    expect(alphas.every((a) => a >= 0 && a < 1)).toBe(true);
  });

  it('clamps catastrophic frame gaps', () => {
    let time = 0;
    const pending: Array<() => void> = [];
    let count = 0;
    const loop = new GameLoop(
      {
        stepMs: 10,
        maxFrameMs: 50,
        now: () => time,
        schedule: (cb) => {
          pending.push(cb);
          return 1;
        },
        cancel: () => undefined,
      },
      { fixedUpdate: () => count++, render: () => undefined },
    );
    loop.start();
    time += 10_000;
    pending.shift()?.();
    expect(count).toBe(5);
  });
});

describe('serialize', () => {
  it('writes and reads a versioned envelope', () => {
    const storage = new MemoryStorage();
    saveEnvelope(storage, 'run', 3, { seed: 7 });
    expect(loadEnvelope<{ seed: number }>(storage, 'run', 3)).toEqual({ seed: 7 });
    expect(loadEnvelope(storage, 'run', 4)).toBeNull();
  });

  it('stringifies stably regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe(
      stableStringify({ a: [2, { c: 3, d: 4 }], b: 1 }),
    );
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
  });
});
