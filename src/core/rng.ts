/**
 * L0: deterministic pseudo-randomness.
 *
 * Two shapes are provided on purpose:
 *  - `RandomStream`: stateful, serializable — used by gameplay, must be saved.
 *  - `hashInts` / `streamFor`: stateless — used by world generation, so the same
 *    coordinates always yield the same content regardless of visit order.
 */

export interface RandomStream {
  /** Raw 32-bit unsigned value. */
  nextUint32(): number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Picks by weight; `weightOf` must return non-negative numbers. */
  pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T;
  shuffle<T>(items: T[]): T[];
  getState(): number;
  setState(state: number): void;
  /** New independent stream, deterministically derived from this one's state. */
  fork(salt: number): RandomStream;
}

const UINT32 = 0x100000000;

/** Deterministic, order-independent mix of integers (FNV-1a-flavoured avalanche). */
export const hashInts = (...values: readonly number[]): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    let v = values[i] | 0;
    for (let byte = 0; byte < 4; byte++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

export const hashString = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Turns a user-facing seed (typed or generated) into a 32-bit state. */
export const seedFrom = (value: string | number): number =>
  typeof value === 'number' ? value >>> 0 : hashString(value);

class Mulberry32 implements RandomStream {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  next(): number {
    return this.nextUint32() / UINT32;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    return minInclusive + (this.nextUint32() % (maxExclusive - minInclusive));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() from an empty list');
    return items[this.int(0, items.length)];
  }

  pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error('pickWeighted() from an empty list');
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return items[this.int(0, items.length)];
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  getState(): number {
    return this.state >>> 0;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }

  fork(salt: number): RandomStream {
    return new Mulberry32(hashInts(this.state, salt));
  }
}

export const createRandom = (seed: string | number): RandomStream =>
  new Mulberry32(seedFrom(seed));

/** Stateless stream for a coordinate/topic tuple — the world-generation workhorse. */
export const streamFor = (...values: readonly number[]): RandomStream =>
  new Mulberry32(hashInts(...values));
