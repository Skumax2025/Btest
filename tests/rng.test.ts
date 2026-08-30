import { describe, expect, it } from 'vitest';
import { createRandom, hashInts, seedFrom, streamFor } from '@core/rng';

describe('rng', () => {
  it('is reproducible for a given seed', () => {
    const a = createRandom('backrooms');
    const b = createRandom('backrooms');
    const left = Array.from({ length: 64 }, () => a.next());
    const right = Array.from({ length: 64 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 16 }, createRandom('one').next.bind(createRandom('one')));
    const b = createRandom('two');
    expect(a).not.toEqual(Array.from({ length: 16 }, () => b.next()));
  });

  it('restores from a saved state', () => {
    const stream = createRandom(42);
    for (let i = 0; i < 10; i++) stream.next();
    const state = stream.getState();
    const expected = Array.from({ length: 8 }, () => stream.next());
    stream.setState(state);
    expect(Array.from({ length: 8 }, () => stream.next())).toEqual(expected);
  });

  it('keeps values inside the requested ranges', () => {
    const stream = createRandom('range');
    for (let i = 0; i < 500; i++) {
      const value = stream.int(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
      const f = stream.float(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
    }
  });

  it('hashes coordinates statelessly and order-sensitively', () => {
    expect(hashInts(1, 2, 3)).toBe(hashInts(1, 2, 3));
    expect(hashInts(1, 2, 3)).not.toBe(hashInts(3, 2, 1));
    expect(streamFor(7, -3, 0).next()).toBe(streamFor(7, -3, 0).next());
  });

  it('derives stable seeds from strings', () => {
    expect(seedFrom('abc')).toBe(seedFrom('abc'));
    expect(seedFrom('abc')).not.toBe(seedFrom('abd'));
  });

  it('respects weights', () => {
    const stream = createRandom('weights');
    const items = [
      { id: 'common', weight: 90 },
      { id: 'rare', weight: 10 },
    ];
    const counts: Record<string, number> = { common: 0, rare: 0 };
    for (let i = 0; i < 4000; i++) counts[stream.pickWeighted(items, (i2) => i2.weight).id]++;
    expect(counts.common).toBeGreaterThan(counts.rare * 4);
  });
});
