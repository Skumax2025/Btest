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
import { addItem, heldStack, removeStack, takeFrom } from '@game/inventory';
import { isLightSource } from '@game/items';
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
  const ticks = def?.searchTicks ?? world.config.interaction.searchFallbackTicks;
  world.search = { key: prop.key, x: prop.x, y: prop.y, ticksLeft: ticks, total: ticks };
  world.emitNoise(
    prop.x,
    prop.y,
    (def?.searchNoise ?? world.config.noise.searchFallback) *
      world.config.interaction.searchStartNoiseFactor,
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
    containerDef?.searchNoise ?? world.config.noise.searchFallback,
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
  const leftover = addItem(world.inventory, world.config.content.items, ground.itemId, ground.count);
  const taken = ground.count - leftover;
  if (taken <= 0) {
    world.setHint('full');
    return;
  }
  world.collected += taken;
  world.level.undrop(ground.x, ground.y, ground.index);
  if (leftover > 0) world.level.drop(ground.itemId, leftover, ground.x, ground.y);
};

const useHeld = (world: RunWorld): void => {
  const held = heldStack(world.inventory);
  if (!held) return;
  const def = world.config.content.items[held.itemId];
  if (!def) return;

  if (isLightSource(def)) {
    world.flashlightOn = !world.flashlightOn;
    return;
  }
  const effect = def.use;
  if (!effect) return;

  const stats = world.stats;
  const config = world.config.stats;
  if (effect.health) stats.health = clamp(stats.health + effect.health, 0, config.maxHealth);
  if (effect.hunger) stats.hunger = clamp(stats.hunger + effect.hunger, 0, config.maxHunger);
  if (effect.thirst) stats.thirst = clamp(stats.thirst + effect.thirst, 0, config.maxThirst);
  if (effect.stamina) stats.stamina = clamp(stats.stamina + effect.stamina, 0, config.maxStamina);
  if (effect.sanity) stats.sanity = clamp(stats.sanity + effect.sanity, 0, config.maxSanity);
  if (effect.charge) rechargeLight(world, effect.charge);
  if (effect.consumed) takeFrom(world.inventory, held.id, 1);
};

const rechargeLight = (world: RunWorld, amount: number): void => {
  for (const stack of world.inventory.stacks) {
    const def = world.config.content.items[stack.itemId];
    if (def && isLightSource(def)) {
      stack.charge = Math.min(def.charge, stack.charge + amount);
      return;
    }
  }
};

const throwHeld = (world: RunWorld, input: InputFrame): void => {
  const held = heldStack(world.inventory);
  if (!held) return;
  const def = world.config.content.items[held.itemId];
  if (!def || !def.throwable) return;
  const dx = input.pointerX - world.player.x;
  const dy = input.pointerY - world.player.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = world.config.interaction.throwSpeed;
  world.spawn(world.projectiles, {
    itemId: held.itemId,
    x: world.player.x,
    y: world.player.y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    ticksLeft: Math.round(
      world.config.interaction.throwRange / (speed * world.config.stepSeconds),
    ),
  });
  takeFrom(world.inventory, held.id, 1);
};

const dropHeld = (world: RunWorld): void => {
  const held = heldStack(world.inventory);
  if (!held) return;
  world.level.drop(held.itemId, held.count, world.player.x, world.player.y);
  removeStack(world.inventory, held.id);
};

const swing = (world: RunWorld): void => {
  if (world.meleeCooldown > 0) return;
  const { interaction } = world.config;
  const held = heldStack(world.inventory);
  const def = held ? world.config.content.items[held.itemId] : undefined;
  const damage = def?.damage ?? interaction.meleeFallbackDamage;
  world.meleeCooldown = interaction.meleeCooldownTicks;
  world.stats.stamina = Math.max(0, world.stats.stamina - interaction.meleeStaminaCost);
  world.emitNoise(world.player.x, world.player.y, world.config.noise.melee, 'melee');

  for (const creature of world.creatures.values()) {
    const dx = creature.x - world.player.x;
    const dy = creature.y - world.player.y;
    const distance = Math.hypot(dx, dy);
    const creatureDef = world.config.content.creatures[creature.defId];
    if (!creatureDef || distance > interaction.meleeRange + creatureDef.radius) continue;
    const angle = Math.atan2(dy, dx);
    let delta = Math.abs(angle - world.player.facing) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    if (delta > interaction.meleeHalfArc) continue;
    creature.health -= damage;
    const push = interaction.shoveImpulse * world.config.stepSeconds;
    creature.x += (dx / (distance || 1)) * push;
    creature.y += (dy / (distance || 1)) * push;
  }
};

/** R works whether or not the light is the item in hand. */
const toggleLight = (world: RunWorld): void => {
  for (const stack of world.inventory.stacks) {
    const def = world.config.content.items[stack.itemId];
    if (!def || !isLightSource(def)) continue;
    if (stack.charge <= 0) {
      world.flashlightOn = false;
      return;
    }
    world.flashlightOn = !world.flashlightOn;
    if (world.inventory.hand === null) world.inventory.hand = stack.id;
    return;
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
  if (wasPressed(input, actions.use)) useHeld(world);
  if (wasPressed(input, actions.flashlight)) toggleLight(world);
  if (wasPressed(input, actions.throwItem)) throwHeld(world, input);
  if (wasPressed(input, actions.drop)) dropHeld(world);
  if (wasPressed(input, actions.attack)) swing(world);
};
