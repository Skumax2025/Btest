/**
 * L2: what the player can do with a button.
 *
 * Knows: searching, picking up, using, throwing, dropping and swinging, and how
 * loud each of those is. Every one of them goes through the same interface, so
 * the rules stay in one place instead of leaking into input handling.
 */

import type { InputFrame } from '@core/input';
import { wasPressed } from '@core/input';
import { streamFor } from '@core/rng';
import {
  activeLight,
  addItem,
  equip,
  equippedStack,
  findStack,
  heldStack,
  isEquipped,
  passives,
  quickStack,
  removeStack,
  swapHands,
  takeFrom,
  unequip,
  wearStack,
  withContents,
} from '@game/inventory';
import type { InventoryStack } from '@game/inventory';
import { EQUIP_SLOTS, effectsOf, fitsSlot, isLightSource } from '@game/items';
import type { EquipSlot, ItemEffect } from '@game/items';
import { rollLoot } from '@game/loot';
import { clamp } from '@core/math';
import type { PropSpawn } from '@game/level';
import type { GroundItem, RunWorld } from './world-access';

const LOOT_TOPIC = 4211;

export interface Interactable {
  readonly kind: 'container' | 'exit' | 'ground';
  readonly prop?: PropSpawn;
  readonly ground?: GroundItem;
  readonly distance: number;
  /** Localization key; the simulation never holds a string a player reads. */
  readonly labelKey: string;
}

/** The single thing E would act on right now, or null. */
export const nearestInteractable = (world: RunWorld): Interactable | null => {
  const { interaction } = world.config;
  const { x, y } = world.player;
  let best: Interactable | null = null;
  const consider = (candidate: Interactable): void => {
    if (best === null || candidate.distance < best.distance) best = candidate;
  };

  for (const ground of world.groundItemsNear(x, y, interaction.pickupRange)) {
    consider({
      kind: 'ground',
      ground,
      distance: Math.hypot(ground.x - x, ground.y - y),
      labelKey: world.config.content.items[ground.itemId]?.nameKey ?? ground.itemId,
    });
  }
  for (const prop of world.propsNear(x, y, interaction.interactRange)) {
    const distance = Math.hypot(prop.x - x, prop.y - y);
    if (prop.kind === 'container' && !world.level.isOpened(prop)) {
      consider({
        kind: 'container',
        prop,
        distance,
        labelKey: world.config.content.containers[prop.defId]?.nameKey ?? prop.defId,
      });
    }
    if (prop.kind === 'exit') {
      consider({ kind: 'exit', prop, distance, labelKey: 'container.exit.name' });
    }
  }
  return best;
};

const beginSearch = (world: RunWorld, prop: PropSpawn): void => {
  const def = world.config.content.containers[prop.defId];
  const factor = passives(world.inventory, world.config.content.items).searchFactor;
  const ticks = Math.max(
    1,
    Math.round((def?.searchTicks ?? world.config.interaction.searchFallbackTicks) * factor),
  );
  world.search = { key: prop.key, x: prop.x, y: prop.y, ticksLeft: ticks, total: ticks };
  // A tool that opens a crate faster opens it more quietly too: the factor is
  // about how much prying the lid takes, and prying is the noise.
  world.emitNoise(
    prop.x,
    prop.y,
    (def?.searchNoise ?? world.config.noise.searchFallback) *
      world.config.interaction.searchStartNoiseFactor *
      factor,
    'search',
  );
};

/** Spills a container's contents onto the floor around it. */
export const finishSearch = (world: RunWorld, prop: PropSpawn): void => {
  const containerDef = world.config.content.containers[prop.defId];
  const table =
    world.config.content.loot[containerDef?.lootTableId ?? world.level.spec.lootTableId] ??
    world.config.content.loot[world.level.spec.lootTableId];
  world.level.open(prop.x, prop.y, prop.key);
  world.emitNoise(
    prop.x,
    prop.y,
    (containerDef?.searchNoise ?? world.config.noise.searchFallback) *
      passives(world.inventory, world.config.content.items).searchFactor,
    'search',
  );
  if (!table) return;
  const stacks = rollLoot(table, streamFor(prop.seed, LOOT_TOPIC));
  if (stacks.length === 0) {
    world.setHint('nothing');
    return;
  }
  const spread = world.config.geometry.tileSize * world.config.interaction.lootSpread;
  stacks.forEach((stack, index) => {
    const angle = (index / stacks.length) * Math.PI * 2;
    world.level.drop(
      stack.itemId,
      stack.count,
      prop.x + Math.cos(angle) * spread,
      prop.y + Math.sin(angle) * spread,
    );
  });
};

const pickUp = (world: RunWorld, ground: GroundItem): void => {
  const condition =
    ground.durability === undefined && ground.charge === undefined
      ? undefined
      : { durability: ground.durability, charge: ground.charge };
  const leftover = addItem(
    world.inventory,
    world.config.content.items,
    ground.itemId,
    ground.count,
    condition,
  );
  const taken = ground.count - leftover;
  if (taken <= 0) {
    world.setHint('full');
    return;
  }
  world.collected += taken;
  world.level.undrop(ground.x, ground.y, ground.index);
  if (leftover > 0) {
    world.level.drop(ground.itemId, leftover, ground.x, ground.y, {
      durability: ground.durability ?? 0,
      charge: ground.charge ?? 0,
    });
  }
};

/**
 * Executes one item's effect list. This is the whole of "what an item does":
 * every entry in the catalogue is a combination of these kinds, so a new item
 * never adds a branch here.
 */
const applyEffects = (world: RunWorld, effects: readonly ItemEffect[]): void => {
  const stats = world.stats;
  const config = world.config.stats;
  for (const effect of effects) {
    switch (effect.kind) {
      case 'stat':
        if (effect.health) stats.health = clamp(stats.health + effect.health, 0, config.maxHealth);
        if (effect.hunger) stats.hunger = clamp(stats.hunger + effect.hunger, 0, config.maxHunger);
        if (effect.thirst) stats.thirst = clamp(stats.thirst + effect.thirst, 0, config.maxThirst);
        if (effect.stamina) {
          stats.stamina = clamp(stats.stamina + effect.stamina, 0, config.maxStamina);
        }
        if (effect.sanity) stats.sanity = clamp(stats.sanity + effect.sanity, 0, config.maxSanity);
        break;
      case 'lasting':
        world.lasting.push({
          ticksLeft: Math.max(1, Math.round(effect.seconds / world.config.stepSeconds)),
          health: effect.health ?? 0,
          hunger: effect.hunger ?? 0,
          thirst: effect.thirst ?? 0,
          stamina: effect.stamina ?? 0,
          sanity: effect.sanity ?? 0,
          seconds: effect.seconds,
        });
        break;
      case 'charge':
        rechargeLight(world, effect.seconds);
        break;
      case 'noise':
        world.emitNoise(world.player.x, world.player.y, effect.radius, 'use');
        break;
      case 'repair':
        repairWorst(world, effect.amount);
        break;
    }
  }
};

/** Whatever being worn is closest to falling apart, or nothing if all is well. */
const worstWorn = (world: RunWorld): number | null => {
  let worst: { id: number; share: number } | null = null;
  for (const slot of EQUIP_SLOTS) {
    const stack = equippedStack(world.inventory, slot);
    const def = stack ? world.config.content.items[stack.itemId] : undefined;
    const max = def?.durability?.max ?? 0;
    if (!stack || !def || max <= 0) continue;
    const share = stack.durability / max;
    if (share >= 1) continue;
    if (!worst || share < worst.share) worst = { id: stack.id, share };
  }
  return worst ? worst.id : null;
};

/** The tape goes on whatever is closest to falling apart. */
const repairWorst = (world: RunWorld, amount: number): void => {
  const id = worstWorn(world);
  if (id === null) return;
  const stack = findStack(world.inventory, id);
  const def = stack ? world.config.content.items[stack.itemId] : undefined;
  if (stack && def?.durability) {
    stack.durability = Math.min(def.durability.max, stack.durability + amount);
  }
};

/**
 * Uses one stack, wherever it sits — food and drink never need to be held. A
 * light source has no effects, so switching it on is what using it means.
 */
export const useStack = (world: RunWorld, id: number): boolean => {
  const stack = findStack(world.inventory, id);
  if (!stack) return false;
  const def = world.config.content.items[stack.itemId];
  if (!def) return false;

  if (isLightSource(def)) {
    world.flashlightOn = !world.flashlightOn;
    return true;
  }
  const use = def.use;
  if (!use) return false;

  // Tape spent on a set of gear that is all still good would be a use thrown
  // away for nothing; it refuses instead.
  const effects = effectsOf(def, stack.durability);
  if (effects.some((effect) => effect.kind === 'repair') && worstWorn(world) === null) {
    world.setHint('nothing');
    return false;
  }
  applyEffects(world, effects);
  if (def.durability?.perUse) {
    wearStack(world.inventory, world.config.content.items, id, def.durability.perUse);
  }
  if (use.consumed) takeFrom(world.inventory, id, 1);
  return true;
};

/**
 * Each hand answers to its own key. Two keys instead of one is the whole point:
 * a torch in the off hand stays a torch you can switch on without putting the
 * weapon away.
 */
const useHand = (world: RunWorld, slot: EquipSlot): void => {
  const stack = equippedStack(world.inventory, slot);
  if (stack) useStack(world, stack.id);
};

/** Wears a stack, dropping whatever the bag can no longer hold. */
export const equipStack = (world: RunWorld, id: number, slot: EquipSlot): boolean => {
  const result = equip(world.inventory, world.config.content.items, id, slot);
  if (!result.ok) return false;
  for (const spilled of result.spilled) {
    for (const piece of withContents(spilled)) dropStackOnFloor(world, piece);
  }
  if (result.spilled.length > 0) world.setHint('spilled');
  else if (result.stowed.length > 0) world.setHint('stowed');
  return true;
};

/** Takes a piece off. Fails loudly rather than quietly eating the item. */
export const unequipStack = (world: RunWorld, id: number): boolean => {
  if (unequip(world.inventory, world.config.content.items, id)) return true;
  world.setHint('full');
  return false;
};

/** The slot an item goes to when the player just asks for it to be worn. */
export const defaultSlotFor = (world: RunWorld, id: number): EquipSlot | null => {
  const stack = findStack(world.inventory, id);
  const def = stack ? world.config.content.items[stack.itemId] : undefined;
  if (!def) return null;
  for (const slot of EQUIP_SLOTS) {
    if (fitsSlot(def, slot) && world.inventory.equipment[slot] === null) return slot;
  }
  return def.slots[0] ?? null;
};

const dropStackOnFloor = (world: RunWorld, stack: InventoryStack): void => {
  world.level.drop(stack.itemId, stack.count, world.player.x, world.player.y, {
    durability: stack.durability,
    charge: stack.charge,
  });
};

/**
 * Puts a whole stack on the floor, from anywhere it might be sitting. A thing
 * with pockets takes what is in them with it: the floor is a worse place to lose
 * something than a bag, but silently deleting it would be worse than both.
 */
export const dropStack = (world: RunWorld, id: number): boolean => {
  const stack = findStack(world.inventory, id);
  if (!stack) return false;
  for (const piece of withContents(stack)) dropStackOnFloor(world, piece);
  removeStack(world.inventory, id);
  return true;
};

/** A battery goes into the lamp being used, not into whichever was found first. */
const rechargeLight = (world: RunWorld, amount: number): void => {
  const stack = activeLight(world.inventory, world.config.content.items);
  const def = stack ? world.config.content.items[stack.itemId] : undefined;
  if (stack && def) stack.charge = Math.min(def.charge, stack.charge + amount);
};

/**
 * A belt slot does the obvious thing with what hangs on it: you eat the food,
 * you switch the light on, and a lure — which has no other use — you throw.
 */
export const useQuickSlot = (world: RunWorld, index: number, aim: Aim): void => {
  const stack = quickStack(world.inventory, index);
  const def = stack ? world.config.content.items[stack.itemId] : undefined;
  if (!stack || !def) return;
  if (!def.use && !isLightSource(def) && def.throwable) {
    throwStack(world, stack, aim);
    return;
  }
  useStack(world, stack.id);
};

/** Where a throw is aimed. The pointer while playing; the cursor from a click. */
export interface Aim {
  readonly x: number;
  readonly y: number;
}

/** Sends one unit of a stack flying, from wherever that stack is sitting. */
const throwStack = (world: RunWorld, stack: InventoryStack, aim: Aim): boolean => {
  const def = world.config.content.items[stack.itemId];
  if (!def || !def.throwable) return false;
  const dx = aim.x - world.player.x;
  const dy = aim.y - world.player.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = world.config.interaction.throwSpeed;
  world.spawn(world.projectiles, {
    itemId: stack.itemId,
    durability: stack.durability,
    charge: stack.charge,
    x: world.player.x,
    y: world.player.y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    ticksLeft: Math.round(
      world.config.interaction.throwRange / (speed * world.config.stepSeconds),
    ),
  });
  takeFrom(world.inventory, stack.id, 1);
  return true;
};

const throwHeld = (world: RunWorld, input: InputFrame): void => {
  const held = heldStack(world.inventory);
  if (held) throwStack(world, held, { x: input.pointerX, y: input.pointerY });
};

const dropHeld = (world: RunWorld): void => {
  const held = heldStack(world.inventory);
  if (held) dropStack(world, held.id);
};

/** R works whether or not the lamp is the item in hand. */
const toggleLight = (world: RunWorld): void => {
  const stack = activeLight(world.inventory, world.config.content.items);
  if (!stack) return;
  if (stack.charge <= 0) {
    world.flashlightOn = false;
    return;
  }
  world.flashlightOn = !world.flashlightOn;
  // A lamp switched on out of the bag goes into a free hand, so it is obvious
  // which one is burning.
  if (!isEquipped(world.inventory, stack.id) && world.inventory.equipment.hand === null) {
    equipStack(world, stack.id, 'hand');
  }
};

export const handleActions = (world: RunWorld, input: InputFrame): void => {
  const { actions } = world.config;
  if (wasPressed(input, actions.interact)) {
    const target = nearestInteractable(world);
    if (target?.kind === 'ground' && target.ground) pickUp(world, target.ground);
    else if (target?.kind === 'container' && target.prop) beginSearch(world, target.prop);
    else if (target?.kind === 'exit') world.descendRequested = true;
  }
  if (wasPressed(input, actions.handMain)) useHand(world, 'hand');
  if (wasPressed(input, actions.handOff)) useHand(world, 'offhand');
  if (wasPressed(input, actions.flashlight)) toggleLight(world);
  if (wasPressed(input, actions.throwItem)) throwHeld(world, input);
  if (wasPressed(input, actions.drop)) dropHeld(world);
  if (wasPressed(input, actions.swapHands)) {
    swapHands(world.inventory, world.config.content.items);
  }
  actions.quick.forEach((name, index) => {
    if (wasPressed(input, name)) {
      useQuickSlot(world, index, { x: input.pointerX, y: input.pointerY });
    }
  });
};
