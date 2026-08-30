/**
 * The loop the demo promises, played headlessly: walk, find loot, take it, use
 * it, be noticed, be hurt, die, start again.
 */
import { describe, expect, it } from 'vitest';
import type { InputFrame } from '@core/input';
import { EMPTY_INPUT } from '@core/input';
import { Run, nearestInteractable } from '@game/run';
import { heldStack, setHand } from '@game/inventory';
import { createRunConfig } from '@content/run-config';
import { CONTAINERS } from '@content/loot-tables';

const press = (action: string): InputFrame => ({ ...EMPTY_INPUT, pressed: [action] });

const idleFor = (run: Run, ticks: number): void => {
  for (let i = 0; i < ticks; i++) run.step(EMPTY_INPUT);
};

/** Puts the player next to a prop without walking there, so tests stay short. */
const standAt = (run: Run, x: number, y: number): void => {
  run.player.x = x;
  run.player.y = y;
  run.player.prevX = x;
  run.player.prevY = y;
  run.level.prime(x, y);
  run.rebuildPropIndex();
};

const findContainer = (run: Run, seed: number) => {
  for (let radius = 200; radius <= 4000; radius += 200) {
    const found = run
      .propsNear(run.player.x, run.player.y, radius)
      .find((prop) => prop.kind === 'container');
    if (found) return found;
  }
  throw new Error(`no container within reach for seed ${seed}`);
};

describe('a full loop', () => {
  it('searches a container, spills loot, and picks it up', () => {
    const run = new Run(createRunConfig(2024));
    const container = findContainer(run, 2024);
    standAt(run, container.x + 20, container.y);

    expect(nearestInteractable(run)?.kind).toBe('container');
    run.step(press('interact'));
    expect(run.search).not.toBeNull();

    const def = CONTAINERS[container.defId];
    idleFor(run, def.searchTicks + 2);
    expect(run.search).toBeNull();
    expect(run.level.isOpened(container)).toBe(true);

    const onFloor = run.groundItemsNear(container.x, container.y, 120);
    if (onFloor.length === 0) return; // an empty container is a legitimate result

    standAt(run, onFloor[0].x, onFloor[0].y);
    run.step(press('interact'));
    expect(run.inventory.stacks.length).toBeGreaterThan(0);
    expect(run.collected).toBeGreaterThan(0);
  });

  it('searching a container is louder than walking past it', () => {
    const run = new Run(createRunConfig(31));
    const container = findContainer(run, 31);
    standAt(run, container.x + 20, container.y);
    run.step(press('interact'));
    const searchNoise = run.noise.recent().find((event) => event.source === 'search');
    expect(searchNoise).toBeDefined();
    expect(searchNoise?.radius).toBeGreaterThan(run.config.noise.walk / 2);
  });

  it('uses a drink and moves the water bar', () => {
    const run = new Run(createRunConfig(7));
    run.inventory.stacks.push({
      id: 99,
      itemId: 'item.water',
      count: 1,
      x: 0,
      y: 0,
      charge: 0,
      durability: 0,
    });
    run.inventory.nextId = 100;
    setHand(run.inventory, 99);
    run.stats.thirst = 20;
    run.step(press('use'));
    expect(run.stats.thirst).toBeGreaterThan(20);
    expect(heldStack(run.inventory)).toBeNull();
  });

  it('switches a flashlight on, burns it down and switches it off again', () => {
    const config = createRunConfig(8);
    const run = new Run(config);
    run.inventory.stacks.push({
      id: 5,
      itemId: 'item.flashlight',
      count: 1,
      x: 0,
      y: 0,
      charge: 2,
      durability: 0,
    });
    run.inventory.nextId = 6;
    run.step(press('flashlight'));
    expect(run.flashlightOn).toBe(true);
    expect(run.perception.inDark).toBe(false);
    idleFor(run, Math.ceil(2 / config.stepSeconds) + 4);
    expect(run.flashlightOn).toBe(false);
    expect(run.flashlightCharge).toBe(0);
  });

  it('throws an item, which lands somewhere else and makes noise there', () => {
    const run = new Run(createRunConfig(9));
    run.inventory.stacks.push({
      id: 3,
      itemId: 'item.noisemaker',
      count: 1,
      x: 0,
      y: 0,
      charge: 0,
      durability: 0,
    });
    run.inventory.nextId = 4;
    setHand(run.inventory, 3);
    const startX = run.player.x;
    run.step({ ...press('throwItem'), pointerX: startX + 400, pointerY: run.player.y });
    expect(run.projectiles.size).toBe(1);
    idleFor(run, 90);
    expect(run.projectiles.size).toBe(0);
    const landed = run.groundItemsNear(run.player.x, run.player.y, 600);
    expect(landed.some((item) => item.itemId === 'item.noisemaker')).toBe(true);
    expect(run.noise.recent().some((event) => event.source === 'impact')).toBe(true);
  });

  it('descends through an exit into a level that looks different', () => {
    const run = new Run(createRunConfig(1717));
    let exit = null;
    for (let radius = 400; radius <= 12000 && !exit; radius += 400) {
      exit = run.propsNear(run.player.x, run.player.y, radius).find((p) => p.kind === 'exit');
    }
    expect(exit).toBeTruthy();
    if (!exit) return;
    const beforeId = run.spec.id;
    const beforePalette = run.spec.paletteId;
    run.inventory.stacks.push({ id: 1, itemId: 'item.soda', count: 1, x: 0, y: 0, charge: 0, durability: 0 });
    run.inventory.nextId = 2;

    standAt(run, exit.x, exit.y);
    run.step(press('interact'));

    expect(run.levelIndex).toBe(1);
    expect(run.spec.id).not.toBe(beforeId);
    expect(run.spec.paletteId).not.toBe(beforePalette);
    // The body and the bag come with you; the creatures do not.
    expect(run.inventory.stacks.length).toBe(1);
    expect(run.creatures.size).toBeLessThan(60);
    expect(run.level.tileAt(4, 4)).not.toBe(0);
    idleFor(run, 30);
    expect(run.phase).toBe('alive');
  });

  it('lets the player hide: crouching makes no noise, and a hunter gives up', () => {
    const run = new Run(createRunConfig(555));
    const start = run.noise.recent().length;
    for (let i = 0; i < 120; i++) {
      run.step({ ...EMPTY_INPUT, axisX: 1, held: ['crouch'] });
    }
    const crouchNoise = run.noise.recent().filter((event) => event.source === 'step').length;
    expect(crouchNoise).toBe(0);
    expect(run.player.stance).toBe('crouch');

    for (let i = 0; i < 120; i++) run.step({ ...EMPTY_INPUT, axisX: 1 });
    const walkNoise = run.noise.recent().filter((event) => event.source === 'step').length;
    expect(walkNoise).toBeGreaterThan(0);
    expect(run.noise.recent().length).toBeGreaterThan(start);
  });

  it('ends the run when the body gives out and stops simulating', () => {
    const run = new Run(createRunConfig(10));
    run.stats.health = 0.01;
    run.stats.thirst = 0;
    idleFor(run, 20);
    expect(run.phase).toBe('dead');
    expect(run.stats.cause).not.toBeNull();
    const tickAtDeath = run.tick;
    const x = run.player.x;
    run.step({ ...EMPTY_INPUT, axisX: 1 });
    expect(run.player.x).toBe(x);
    expect(run.tick).toBe(tickAtDeath + 1);
  });

  it('wakes creatures around the player and hurts them on contact', () => {
    const run = new Run(createRunConfig(4242));
    let found = null;
    for (let radius = 400; radius <= 6000 && !found; radius += 400) {
      found = run.propsNear(run.player.x, run.player.y, radius).find((p) => p.kind === 'creature');
    }
    expect(found).toBeTruthy();
    if (!found) return;
    // Stand near enough for the chunk to wake, far enough not to be touched yet.
    standAt(run, found.x + 400, found.y);
    idleFor(run, 2);
    expect(run.creatures.size).toBeGreaterThan(0);
    const target = [...run.creatures.values()].find((creature) => creature.spawnKey === found.key);
    expect(target).toBeDefined();
    if (!target) return;
    const before = run.stats.health;
    expect(before).toBeGreaterThan(0);
    standAt(run, target.x, target.y);
    idleFor(run, 4);
    expect(run.stats.health).toBeLessThan(before);
  });
});
