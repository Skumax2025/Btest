/**
 * Invariants, hammered rather than reasoned about.
 *
 * The rules here are the ones no single feature owns: a stack is in exactly one
 * place, the bag never holds more than it can, a worn thing is worn where it
 * fits, nothing turns into NaN, and a save is the run it came from. They are
 * checked by playing thousands of ticks of seeded nonsense and by beating on the
 * inventory API directly, which is how the two bugs this file was written to
 * find were found.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '@core/input';
import type { InputFrame } from '@core/input';
import { Run, restoreRun, snapshotRun } from '@game/run';
import {
  addItem,
  capacity,
  containerStacks,
  createInventory,
  equip,
  evictPockets,
  mergeStacks,
  removeStack,
  setQuick,
  settle,
  splitStack,
  unequip,
  unpack,
} from '@game/inventory';
import type { InventoryState } from '@game/inventory';
import { EQUIP_SLOTS, fitsBelt, fitsSlot, maxDurability } from '@game/items';
import { createRunConfig, createSandboxConfig } from '@content/run-config';
import { INVENTORY } from '@content/tuning';
import { ITEMS } from '@content/items';
import { createRandom } from '@core/rng';

const ACTIONS = [
  'interact', 'handMain', 'handOff', 'throwItem', 'drop', 'flashlight',
  'swapHands', 'quick1', 'quick2', 'quick3', 'quick4',
];

const finite = (label: string, value: number): string[] =>
  Number.isFinite(value) ? [] : [`${label} is ${value}`];

const auditInventory = (inv: InventoryState, where: string): string[] => {
  const problems: string[] = [];
  const ids = new Set<number>();
  for (const stack of inv.stacks) {
    if (ids.has(stack.id)) problems.push(`${where}: duplicate stack id ${stack.id}`);
    ids.add(stack.id);
    const def = ITEMS[stack.itemId];
    if (!def) { problems.push(`${where}: unknown item ${stack.itemId}`); continue; }
    problems.push(...finite(`${where}:${stack.itemId}.count`, stack.count));
    problems.push(...finite(`${where}:${stack.itemId}.durability`, stack.durability));
    problems.push(...finite(`${where}:${stack.itemId}.charge`, stack.charge));
    if (stack.count < 1) problems.push(`${where}: ${stack.itemId} count ${stack.count}`);
    if (stack.count > def.maxStack) {
      problems.push(`${where}: ${stack.itemId} count ${stack.count} > max ${def.maxStack}`);
    }
    if (stack.durability < 0 || stack.durability > maxDurability(def) + 1e-6) {
      problems.push(`${where}: ${stack.itemId} durability ${stack.durability}/${maxDurability(def)}`);
    }
    if (stack.charge < -1e-6 || stack.charge > def.charge + 1e-6) {
      problems.push(`${where}: ${stack.itemId} charge ${stack.charge}/${def.charge}`);
    }
    if (stack.contents.length > 0 && !def.carry) {
      problems.push(`${where}: ${stack.itemId} holds ${stack.contents.length} without pockets`);
    }
    for (const held of stack.contents) {
      if (ids.has(held.id)) problems.push(`${where}: ${held.id} both loose and in a pocket`);
    }
  }
  for (const slot of EQUIP_SLOTS) {
    const id = inv.equipment[slot];
    if (id === null) continue;
    const stack = inv.stacks.find((s) => s.id === id);
    if (!stack) { problems.push(`${where}: slot ${slot} points at missing ${id}`); continue; }
    const def = ITEMS[stack.itemId];
    if (def && !fitsSlot(def, slot)) problems.push(`${where}: ${stack.itemId} worn in ${slot}`);
    if (inv.quick.includes(id)) problems.push(`${where}: ${id} worn and on the belt`);
  }
  const seenQuick = new Set<number>();
  for (const id of inv.quick) {
    if (id === null) continue;
    if (seenQuick.has(id)) problems.push(`${where}: ${id} on the belt twice`);
    seenQuick.add(id);
    const stack = inv.stacks.find((s) => s.id === id);
    if (!stack) { problems.push(`${where}: belt points at missing ${id}`); continue; }
    const def = ITEMS[stack.itemId];
    if (def && !fitsBelt(def)) problems.push(`${where}: ${stack.itemId} hangs on the belt`);
  }
  const used = containerStacks(inv).length;
  const room = capacity(inv, ITEMS);
  if (used > room) problems.push(`${where}: ${used} stacks in ${room} cells`);
  return problems;
};

const auditRun = (run: Run, where: string): string[] => {
  const problems: string[] = [];
  problems.push(...finite(`${where}:player.x`, run.player.x));
  problems.push(...finite(`${where}:player.y`, run.player.y));
  const s = run.stats;
  const c = run.config.stats;
  const pairs: Array<[string, number, number]> = [
    ['health', s.health, c.maxHealth], ['hunger', s.hunger, c.maxHunger],
    ['thirst', s.thirst, c.maxThirst], ['stamina', s.stamina, c.maxStamina],
    ['sanity', s.sanity, c.maxSanity],
  ];
  for (const [name, value, max] of pairs) {
    problems.push(...finite(`${where}:${name}`, value));
    if (value < -1e-6 || value > max + 1e-6) problems.push(`${where}: ${name} ${value}/${max}`);
  }
  for (const creature of run.creatures.values()) {
    problems.push(...finite(`${where}:creature.x`, creature.x));
    problems.push(...finite(`${where}:creature.y`, creature.y));
  }
  problems.push(...auditInventory(run.inventory, where));
  return problems;
};

const play = (run: Run, ticks: number, seed: number): string[] => {
  const rng = createRandom(seed);
  const problems: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const pressed: string[] = [];
    if (rng.next() < 0.06) pressed.push(ACTIONS[rng.int(0, ACTIONS.length)]);
    const frame: InputFrame = {
      ...EMPTY_INPUT,
      pressed,
      held: rng.next() < 0.5 ? ['sprint'] : [],
      axisX: rng.next() * 2 - 1,
      axisY: rng.next() * 2 - 1,
      pointerX: run.player.x + rng.next() * 200 - 100,
      pointerY: run.player.y + rng.next() * 200 - 100,
    };
    run.step(frame);
    if (i % 60 === 0) problems.push(...auditRun(run, `t${i}`));
    if (problems.length > 0) break;
  }
  problems.push(...auditRun(run, 'end'));
  return problems;
};

const ALL_ITEMS = Object.keys(ITEMS).filter((id) => id !== 'item.hands');

/** Hammers the inventory API directly; the UI can reach every one of these. */
const fuzzInventory = (seed: number, steps: number): string[] => {
  const rng = createRandom(seed);
  const state = createInventory(INVENTORY);
  const problems: string[] = [];
  for (let i = 0; i < steps; i++) {
    const pick = () => {
      const all = state.stacks;
      return all.length === 0 ? null : all[rng.int(0, all.length)];
    };
    switch (rng.int(0, 9)) {
      case 0:
        addItem(state, ITEMS, ALL_ITEMS[rng.int(0, ALL_ITEMS.length)], rng.int(1, 4));
        break;
      case 1: {
        const stack = pick();
        if (stack) equip(state, ITEMS, stack.id, EQUIP_SLOTS[rng.int(0, EQUIP_SLOTS.length)]);
        break;
      }
      case 2: {
        const stack = pick();
        if (stack) unequip(state, ITEMS, stack.id);
        break;
      }
      case 3: {
        const stack = pick();
        if (stack) setQuick(state, ITEMS, stack.id, rng.int(0, state.quick.length));
        break;
      }
      case 4: {
        const stack = pick();
        if (stack) splitStack(state, ITEMS, stack.id, rng.int(1, Math.max(2, stack.count)));
        break;
      }
      case 5: {
        const a = pick();
        const b = pick();
        if (a && b) mergeStacks(state, ITEMS, a.id, b.id);
        break;
      }
      case 6: {
        const stack = pick();
        if (stack) unpack(state, ITEMS, stack.id);
        break;
      }
      case 7: {
        const stack = pick();
        if (stack) removeStack(state, stack.id);
        break;
      }
      default: {
        const stack = pick();
        if (stack) {
          stack.durability = rng.next() < 0.5 ? 0 : stack.durability;
          evictPockets(state, ITEMS);
        }
        break;
      }
    }
    // The run settles the bag every tick; the API is audited under the same rule.
    settle(state, ITEMS);
    problems.push(...auditInventory(state, `step ${i}`));
    if (problems.length > 0) break;
  }
  return problems;
};

describe('audit', () => {
  it('survives the inventory being hammered from every direction', () => {
    const found: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      found.push(...fuzzInventory(seed * 7717, 400).map((p) => `seed ${seed}: ${p}`));
    }
    expect(found.slice(0, 10)).toEqual([]);
  });

  it('keeps every invariant across many seeded runs', () => {
    const found: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const run = new Run(createRunConfig(seed * 7919));
      found.push(...play(run, 1800, seed).map((p) => `seed ${seed}: ${p}`));
    }
    expect(found.slice(0, 12)).toEqual([]);
  });

  it('keeps every invariant in the test level, where everything exists at once', () => {
    const found: string[] = [];
    for (let seed = 1; seed <= 4; seed++) {
      const run = new Run(createSandboxConfig(seed * 104729));
      found.push(...play(run, 1500, seed + 50).map((p) => `sandbox ${seed}: ${p}`));
    }
    expect(found.slice(0, 12)).toEqual([]);
  });

  it('does not repair a worn thing by putting it down and picking it up', () => {
    const run = new Run(createSandboxConfig(4242));
    const frame = (pressed: string[]): InputFrame => ({
      ...EMPTY_INPUT, pressed, pointerX: run.player.x, pointerY: run.player.y,
    });
    const pipe = run.inventory.stacks.find((s) => s.itemId === 'item.pipe');
    expect(pipe).toBeDefined();
    if (!pipe) return;
    pipe.durability = 3;
    run.step(frame(['drop']));
    const onFloor = run
      .groundItemsNear(run.player.x, run.player.y, 20)
      .find((g) => g.itemId === 'item.pipe');
    expect(onFloor?.durability).toBe(3);
    // Take everything else out of the way so the pipe is what gets picked up.
    for (let i = 0; i < 30; i++) {
      const back = run.inventory.stacks.find((s) => s.itemId === 'item.pipe');
      if (back) { expect(back.durability).toBe(3); return; }
      run.step(frame(['interact']));
      run.step(frame([]));
    }
    throw new Error('the pipe never came back');
  });

  it('burns only the lamp that is actually lit', () => {
    const run = new Run(createRunConfig(555));
    addItem(run.inventory, ITEMS, 'item.flashlight', 1);
    addItem(run.inventory, ITEMS, 'item.glowstick', 1);
    const [torch, stick] = run.inventory.stacks;
    const spare = stick.charge;
    run.step({ ...EMPTY_INPUT, pressed: ['flashlight'] });
    for (let i = 0; i < 120; i++) run.step(EMPTY_INPUT);
    expect(run.flashlightOn).toBe(true);
    expect(torch.charge).toBeLessThan(ITEMS['item.flashlight'].charge);
    expect(stick.charge).toBe(spare);
  });

  it('throws a lure straight off the belt, since it has no other use', () => {
    const run = new Run(createRunConfig(556));
    addItem(run.inventory, ITEMS, 'item.noisemaker', 1);
    const lure = run.inventory.stacks[0];
    expect(setQuick(run.inventory, ITEMS, lure.id, 0)).toBe(true);
    run.step({
      ...EMPTY_INPUT,
      pressed: ['quick1'],
      pointerX: run.player.x + 300,
      pointerY: run.player.y,
    });
    expect(run.projectiles.size).toBe(1);
    expect(run.inventory.stacks.some((s) => s.itemId === 'item.noisemaker')).toBe(false);
  });

  it('round-trips a played run through the save with nothing lost', () => {
    const found: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const run = new Run(createSandboxConfig(seed * 31337));
      play(run, 700, seed + 90);
      const save = snapshotRun(run);
      const wire = JSON.parse(JSON.stringify(save)) as typeof save;
      const back = new Run(createSandboxConfig(seed * 31337));
      restoreRun(back, wire);
      const a = JSON.stringify(snapshotRun(run));
      const b = JSON.stringify(snapshotRun(back));
      if (a !== b) found.push(`seed ${seed}: snapshot differs after a round trip`);
      found.push(...auditRun(back, `restored ${seed}`));
    }
    expect(found.slice(0, 8)).toEqual([]);
  });
});
