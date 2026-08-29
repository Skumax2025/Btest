import { describe, expect, it } from 'vitest';
import { createRandom } from '@core/rng';
import {
  addItem,
  canPlace,
  createInventory,
  heldStack,
  moveStack,
  removeStack,
  setHand,
  stackAt,
  takeFrom,
  totalWeight,
} from '@game/inventory';
import { applyDamage, canSprint, createStats, isDead, isLowSanity, stepStats } from '@game/stats';
import type { StatsInput } from '@game/stats';
import { expectedStacks, rollLoot } from '@game/loot';
import { ITEMS } from '@content/items';
import { CONTAINERS, LOOT_TABLES } from '@content/loot-tables';
import { STATS } from '@content/tuning';

const idle = (over: Partial<StatsInput> = {}): StatsInput => ({
  stepSeconds: 1,
  sprinting: false,
  crouching: false,
  resting: false,
  inDark: false,
  inSilence: false,
  creaturePressure: 0,
  ...over,
});

describe('stats', () => {
  it('drains hunger and thirst over time', () => {
    const state = createStats(STATS);
    for (let i = 0; i < 60; i++) stepStats(state, idle(), STATS);
    expect(state.thirst).toBeLessThan(STATS.maxThirst);
    expect(state.hunger).toBeLessThan(STATS.maxHunger);
    expect(state.thirst).toBeLessThan(state.hunger);
  });

  it('kills a run inside the intended window when nothing is drunk', () => {
    const state = createStats(STATS);
    let seconds = 0;
    while (!isDead(state) && seconds < 5000) {
      stepStats(state, idle(), STATS);
      seconds++;
    }
    expect(isDead(state)).toBe(true);
    // A player who never drinks should die between 8 and 25 minutes.
    expect(seconds).toBeGreaterThan(8 * 60);
    expect(seconds).toBeLessThan(25 * 60);
    expect(state.cause).toBe('thirst');
  });

  it('spends stamina while sprinting and refuses to sprint when empty', () => {
    const state = createStats(STATS);
    for (let i = 0; i < 20; i++) stepStats(state, idle({ sprinting: true }), STATS);
    expect(state.stamina).toBe(0);
    expect(state.exhausted).toBe(true);
    expect(canSprint(state)).toBe(false);
    for (let i = 0; i < 10; i++) stepStats(state, idle(), STATS);
    expect(canSprint(state)).toBe(true);
  });

  it('recovers stamina faster while crouching', () => {
    const walking = createStats(STATS);
    const crouching = createStats(STATS);
    walking.stamina = 10;
    crouching.stamina = 10;
    stepStats(walking, idle(), STATS);
    stepStats(crouching, idle({ crouching: true }), STATS);
    expect(crouching.stamina).toBeGreaterThan(walking.stamina);
  });

  it('loses nerve in the dark, in silence and next to a creature', () => {
    const dark = createStats(STATS);
    const quiet = createStats(STATS);
    const watched = createStats(STATS);
    for (let i = 0; i < 10; i++) {
      stepStats(dark, idle({ inDark: true }), STATS);
      stepStats(quiet, idle({ inSilence: true }), STATS);
      stepStats(watched, idle({ creaturePressure: 1 }), STATS);
    }
    expect(dark.sanity).toBeLessThan(STATS.maxSanity);
    expect(quiet.sanity).toBeLessThan(STATS.maxSanity);
    expect(watched.sanity).toBeLessThan(dark.sanity);
  });

  it('recovers nerve only while resting somewhere lit and noisy enough', () => {
    const state = createStats(STATS);
    state.sanity = 40;
    for (let i = 0; i < 10; i++) stepStats(state, idle({ resting: true }), STATS);
    expect(state.sanity).toBeGreaterThan(40);
    expect(isLowSanity(state, STATS)).toBe(false);
  });

  it('records the cause of death', () => {
    const state = createStats(STATS);
    applyDamage(state, STATS.maxHealth + 10, 'injury', STATS);
    expect(isDead(state)).toBe(true);
    expect(state.cause).toBe('injury');
  });
});

describe('inventory', () => {
  const inv = () => createInventory(8, 5, 14);

  it('places an item and refuses to overlap it', () => {
    const state = inv();
    expect(addItem(state, ITEMS, 'item.pipe', 1)).toBe(0);
    const pipe = state.stacks[0];
    expect(canPlace(state, ITEMS, 'item.water', pipe.x, pipe.y)).toBe(false);
    expect(canPlace(state, ITEMS, 'item.water', pipe.x + 1, pipe.y)).toBe(true);
  });

  it('respects the grid edges for multi-cell items', () => {
    const state = inv();
    expect(canPlace(state, ITEMS, 'item.pipe', 0, 3)).toBe(false);
    expect(canPlace(state, ITEMS, 'item.pipe', 0, 2)).toBe(true);
  });

  it('stacks up to the item maximum and then opens a new stack', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 7);
    expect(state.stacks.length).toBe(2);
    expect(state.stacks[0].count).toBe(5);
    expect(state.stacks[1].count).toBe(2);
  });

  it('refuses items once the weight budget is spent', () => {
    const state = inv();
    const leftover = addItem(state, ITEMS, 'item.pipe', 20);
    expect(leftover).toBeGreaterThan(0);
    expect(totalWeight(state, ITEMS)).toBeLessThanOrEqual(state.capacity);
  });

  it('moves a stack and merges compatible ones', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 2);
    const first = state.stacks[0];
    addItem(state, ITEMS, 'item.soda', 1);
    const soda = state.stacks[1];
    expect(moveStack(state, ITEMS, soda.id, 5, 4)).toBe(true);
    expect(stackAt(state, ITEMS, 5, 4)?.id).toBe(soda.id);
    expect(moveStack(state, ITEMS, soda.id, first.x, first.y)).toBe(false);
  });

  it('merges two stacks of the same item', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 5);
    addItem(state, ITEMS, 'item.crackers', 2);
    const [full, partial] = state.stacks;
    takeFrom(state, full.id, 3);
    expect(moveStack(state, ITEMS, partial.id, full.x, full.y)).toBe(true);
    expect(state.stacks.length).toBe(1);
    expect(state.stacks[0].count).toBe(4);
  });

  it('tracks what is in hand and forgets it when the stack is gone', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.flashlight', 1);
    const stack = state.stacks[0];
    setHand(state, stack.id);
    expect(heldStack(state)?.itemId).toBe('item.flashlight');
    expect(stack.charge).toBe(ITEMS['item.flashlight'].charge);
    removeStack(state, stack.id);
    expect(heldStack(state)).toBeNull();
  });
});

describe('loot', () => {
  it('is deterministic for a given stream', () => {
    const table = LOOT_TABLES['loot.crate'];
    const a = rollLoot(table, createRandom(11));
    const b = rollLoot(table, createRandom(11));
    expect(a).toEqual(b);
  });

  it('yields roughly the expected number of stacks', () => {
    const table = LOOT_TABLES['loot.crate'];
    const rng = createRandom('loot');
    let total = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) total += rollLoot(table, rng).length;
    expect(total / runs).toBeCloseTo(expectedStacks(table), 0);
  });

  it('only ever rolls items that exist', () => {
    for (const table of Object.values(LOOT_TABLES)) {
      for (const entry of table.entries) {
        expect(ITEMS[entry.itemId], `${table.id} -> ${entry.itemId}`).toBeDefined();
        expect(entry.min).toBeGreaterThan(0);
        expect(entry.max).toBeGreaterThanOrEqual(entry.min);
      }
    }
  });

  it('points every container at a table that exists', () => {
    for (const container of Object.values(CONTAINERS)) {
      expect(LOOT_TABLES[container.lootTableId], container.id).toBeDefined();
    }
  });

  it('keeps a searched container worth searching but rarely generous', () => {
    const rng = createRandom('density');
    let empty = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      if (rollLoot(LOOT_TABLES['loot.level0'], rng).length === 0) empty++;
    }
    expect(empty / runs).toBeGreaterThan(0.1);
    expect(empty / runs).toBeLessThan(0.6);
  });
});
