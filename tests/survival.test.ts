import { describe, expect, it } from 'vitest';
import { createRandom } from '@core/rng';
import {
  addItem,
  canEquip,
  capacity,
  containerStacks,
  createInventory,
  equip,
  equippedStack,
  evictPockets,
  heldStack,
  mergeStacks,
  overflowFor,
  removeStack,
  setHand,
  setQuick,
  splitStack,
  stepWear,
  tickWear,
  unequip,
  wearStack,
} from '@game/inventory';
import { applyDamage, canSprint, createStats, isDead, isLowSanity, stepStats } from '@game/stats';
import type { StatsInput } from '@game/stats';
import { expectedStacks, rollLoot } from '@game/loot';
import { ITEMS } from '@content/items';
import { CONTAINERS, LOOT_TABLES } from '@content/loot-tables';
import { INVENTORY, STATS } from '@content/tuning';

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

  it('recovers nerve wherever nothing is eating it, fastest while standing still', () => {
    const resting = createStats(STATS);
    const walking = createStats(STATS);
    const haunted = createStats(STATS);
    resting.sanity = 40;
    walking.sanity = 40;
    haunted.sanity = 40;
    for (let i = 0; i < 10; i++) {
      stepStats(resting, idle({ resting: true }), STATS);
      stepStats(walking, idle(), STATS);
      stepStats(haunted, idle({ inDark: true }), STATS);
    }
    expect(resting.sanity).toBeGreaterThan(walking.sanity);
    expect(walking.sanity).toBeGreaterThan(40);
    expect(haunted.sanity).toBeLessThan(40);
    expect(isLowSanity(resting, STATS)).toBe(false);
  });

  it('records the cause of death', () => {
    const state = createStats(STATS);
    applyDamage(state, STATS.maxHealth + 10, 'injury', STATS);
    expect(isDead(state)).toBe(true);
    expect(state.cause).toBe('injury');
  });
});

describe('inventory slots', () => {
  const inv = () => createInventory(INVENTORY);

  it('takes an item only into a slot it fits', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.hardhat', 1);
    const hat = state.stacks[0];
    expect(canEquip(ITEMS, 'item.hardhat', 'head')).toBe(true);
    expect(canEquip(ITEMS, 'item.hardhat', 'feet')).toBe(false);
    expect(equip(state, ITEMS, hat.id, 'feet').ok).toBe(false);
    expect(equip(state, ITEMS, hat.id, 'head').ok).toBe(true);
    expect(equippedStack(state, 'head')?.id).toBe(hat.id);
    expect(containerStacks(state)).toHaveLength(0);
  });

  it('refuses a stack once every cell is spoken for', () => {
    const state = inv();
    expect(capacity(state, ITEMS)).toBe(INVENTORY.baseCells);
    for (let i = 0; i < INVENTORY.baseCells; i++) addItem(state, ITEMS, 'item.medkit', 1);
    expect(containerStacks(state)).toHaveLength(INVENTORY.baseCells);
    expect(addItem(state, ITEMS, 'item.medkit', 1)).toBe(1);
  });

  it('grows with a pack, and a smaller one costs room rather than things', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.schoolbag', 1);
    const pack = state.stacks[0];
    equip(state, ITEMS, pack.id, 'back');
    const grown = capacity(state, ITEMS);
    expect(grown).toBe(INVENTORY.baseCells + (ITEMS['item.schoolbag'].carry?.cells ?? 0));

    // A spare pack, worn to nothing, is worth only its `wornCells`.
    addItem(state, ITEMS, 'item.schoolbag', 1);
    const spare = state.stacks[state.stacks.length - 1];
    spare.durability = 0;
    while (containerStacks(state).length < grown) addItem(state, ITEMS, 'item.medkit', 1);
    expect(containerStacks(state)).toHaveLength(grown);

    // The pack coming off has pockets of its own, so the overflow goes into it.
    const preview = overflowFor(state, ITEMS, spare.id, 'back');
    expect(preview.stowed.length).toBeGreaterThan(0);
    expect(preview.spilled).toHaveLength(0);
    const result = equip(state, ITEMS, spare.id, 'back');
    expect(result.stowed).toHaveLength(preview.stowed.length);
    expect(capacity(state, ITEMS)).toBeLessThan(grown);
    expect(containerStacks(state).length).toBeLessThanOrEqual(capacity(state, ITEMS));
    expect(pack.contents.length).toBe(result.stowed.length);
  });

  it('spills onto the floor only once every pocket is full too', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.hikingpack', 1);
    const big = state.stacks[0];
    equip(state, ITEMS, big.id, 'back');
    addItem(state, ITEMS, 'item.satchel', 1);
    const small = state.stacks[state.stacks.length - 1];
    while (containerStacks(state).length < capacity(state, ITEMS)) {
      if (addItem(state, ITEMS, 'item.medkit', 1) > 0) break;
    }
    // A pack worn through has fewer pockets to offer, so this swap costs things.
    big.durability = 0;

    const result = equip(state, ITEMS, small.id, 'back');
    expect(result.stowed).toHaveLength(ITEMS['item.hikingpack'].carry?.wornCells ?? 0);
    expect(result.spilled.length).toBeGreaterThan(0);
    expect(containerStacks(state).length).toBeLessThanOrEqual(capacity(state, ITEMS));
  });

  it('pours a pack back into the bag when it goes on the back again', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.schoolbag', 1);
    const pack = state.stacks[0];
    pack.contents.push({
      id: 900,
      itemId: 'item.medkit',
      count: 1,
      charge: 0,
      durability: 0,
      contents: [],
    });
    equip(state, ITEMS, pack.id, 'back');
    expect(pack.contents).toHaveLength(0);
    expect(containerStacks(state).some((s) => s.itemId === 'item.medkit')).toBe(true);
  });

  it('throws out what a worn-through pocket can no longer hold', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.schoolbag', 1);
    const pack = state.stacks[0];
    for (let i = 0; i < (ITEMS['item.schoolbag'].carry?.cells ?? 0); i++) {
      pack.contents.push({
        id: 800 + i,
        itemId: 'item.medkit',
        count: 1,
        charge: 0,
        durability: 0,
        contents: [],
      });
    }
    expect(evictPockets(state, ITEMS)).toHaveLength(0);
    pack.durability = 0;
    const ejected = evictPockets(state, ITEMS);
    expect(ejected.length).toBeGreaterThan(0);
    expect(pack.contents.length).toBe(ITEMS['item.schoolbag'].carry?.wornCells ?? 0);
  });

  it('takes only belt-worthy things onto the belt', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 1);
    addItem(state, ITEMS, 'item.wrench', 1);
    const [food, wrench] = state.stacks;
    expect(setQuick(state, ITEMS, food.id, 0)).toBe(true);
    expect(setQuick(state, ITEMS, wrench.id, 1)).toBe(false);
    expect(state.quick[0]).toBe(food.id);
    expect(state.quick[1]).toBeNull();
  });

  it('will not take a pack off into the bag it was holding open', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.schoolbag', 1);
    const pack = state.stacks[0];
    equip(state, ITEMS, pack.id, 'back');
    for (let i = 0; i < capacity(state, ITEMS); i++) addItem(state, ITEMS, 'item.medkit', 1);
    expect(unequip(state, ITEMS, pack.id)).toBe(false);
    expect(equippedStack(state, 'back')?.id).toBe(pack.id);
  });

  it('stacks to the item maximum, splits and merges back', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 7);
    expect(state.stacks).toHaveLength(2);
    expect(state.stacks[0].count).toBe(ITEMS['item.crackers'].maxStack);
    expect(state.stacks[1].count).toBe(2);

    const half = splitStack(state, ITEMS, state.stacks[0].id, 2);
    expect(half?.count).toBe(2);
    expect(state.stacks[0].count).toBe(3);

    expect(mergeStacks(state, ITEMS, state.stacks[1].id, state.stacks[0].id)).toBe(true);
    expect(state.stacks[0].count).toBe(ITEMS['item.crackers'].maxStack);
  });

  it('tracks what is in hand and forgets it when the stack is gone', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.flashlight', 1);
    const stack = state.stacks[0];
    setHand(state, ITEMS, stack.id);
    expect(heldStack(state)?.itemId).toBe('item.flashlight');
    expect(stack.charge).toBe(ITEMS['item.flashlight'].charge);
    removeStack(state, stack.id);
    expect(heldStack(state)).toBeNull();
  });
});

describe('wear', () => {
  const inv = () => createInventory(INVENTORY);

  it('spoils food with the clock and keeps it edible', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.crackers', 1);
    const food = state.stacks[0];
    const full = food.durability;
    tickWear(state, ITEMS, 60);
    expect(food.durability).toBeLessThan(full);
    tickWear(state, ITEMS, 100000);
    expect(food.durability).toBe(0);
    expect(state.stacks).toHaveLength(1);
  });

  it('scuffs worn clothing on every footstep and never destroys it', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.boots', 1);
    const boots = state.stacks[0];
    equip(state, ITEMS, boots.id, 'feet');
    const full = boots.durability;
    stepWear(state, ITEMS);
    expect(boots.durability).toBeLessThan(full);
    for (let i = 0; i < 100000 && boots.durability > 0; i++) stepWear(state, ITEMS);
    expect(boots.durability).toBe(0);
    expect(equippedStack(state, 'feet')?.id).toBe(boots.id);
  });

  it('destroys armour that runs out of condition', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.hardhat', 1);
    const hat = state.stacks[0];
    equip(state, ITEMS, hat.id, 'head');
    const event = wearStack(state, ITEMS, hat.id, hat.durability + 10);
    expect(event?.outcome).toBe('destroy');
    expect(state.stacks).toHaveLength(0);
    expect(equippedStack(state, 'head')).toBeNull();
  });

  it('leaves a spent weapon in hand, to swing like bare hands', () => {
    const state = inv();
    addItem(state, ITEMS, 'item.pipe', 1);
    const pipe = state.stacks[0];
    equip(state, ITEMS, pipe.id, 'hand');
    expect(wearStack(state, ITEMS, pipe.id, pipe.durability)?.outcome).toBe('break');
    expect(heldStack(state)?.id).toBe(pipe.id);
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
