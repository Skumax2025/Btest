/**
 * L2: melee, driven every tick instead of by a button.
 *
 * Knows: when a swing commits, what it costs, who it catches and what the player
 * learns from it. All the rules it applies come from `@game/combat`, which is
 * pure; this file is the wiring that spends stamina, makes noise and moves
 * bodies.
 *
 * Does not know: how any of it looks or sounds. It writes `CombatState` and the
 * view and the audio read it.
 */

import { heldStack } from '@game/inventory';
import type { InventoryStack } from '@game/inventory';
import type { ItemDef } from '@game/items';
import {
  attackVeto,
  resolveWeapon,
  rollBlock,
  swingCost,
  targetsInReach,
  wearAfterSwing,
} from '@game/combat';
import type { Combatant, WeaponStats } from '@game/combat';
import { applyDamage } from '@game/stats';
import type { CombatEvent, RunWorld } from './world-access';

/** Ticks a combat mark stays on screen. Presentation timing, not balance. */
const EVENT_TICKS = 40;

const note = (world: RunWorld, event: CombatEvent, count = 1): void => {
  const combat = world.combat;
  combat.event = event;
  combat.eventCount = count;
  combat.eventSerial++;
  combat.eventTicks = EVENT_TICKS;
};

const handsStats = (world: RunWorld): WeaponStats | null =>
  world.config.content.items[world.config.handsItemId]?.melee ?? null;

const creatureCombatants = (world: RunWorld): Combatant[] => {
  const out: Combatant[] = [];
  for (const [id, creature] of world.creatures.entries()) {
    const def = world.config.content.creatures[creature.defId];
    if (!def) continue;
    out.push({ id, x: creature.x, y: creature.y, radius: def.radius });
  }
  return out;
};

interface HeldWeapon {
  readonly stack: InventoryStack | null;
  readonly def: ItemDef | undefined;
  readonly stats: WeaponStats;
  readonly damage: number;
  readonly broken: boolean;
}

const heldWeapon = (world: RunWorld, hands: WeaponStats): HeldWeapon => {
  const stack = heldStack(world.inventory);
  const def = stack ? world.config.content.items[stack.itemId] : undefined;
  const resolved = resolveWeapon(def?.melee, stack?.durability ?? 0, hands);
  return { stack, def, stats: resolved.stats, damage: resolved.damage, broken: resolved.broken };
};

/**
 * One tick of melee. Nothing here is triggered by a key: the only decisions the
 * player makes are what to hold, whether to crouch, and whether to stay inside
 * the ring.
 */
export const stepMelee = (world: RunWorld): void => {
  const combat = world.combat;
  const hands = handsStats(world);
  if (combat.eventTicks > 0) combat.eventTicks--;
  if (combat.blockCooldown > 0) combat.blockCooldown--;
  if (!hands) return;

  const weapon = heldWeapon(world, hands);
  combat.reach = weapon.stats.reach;
  combat.interval = Math.max(1, weapon.stats.intervalTicks);
  combat.broken = weapon.broken;
  combat.durability = weapon.stack?.durability ?? 0;
  combat.maxDurability = weapon.def?.melee?.maxDurability ?? 0;

  const targets = targetsInReach(
    world.player.x,
    world.player.y,
    weapon.stats.reach,
    creatureCombatants(world),
  );
  combat.targets = targets.length;

  if (combat.windup > 0) {
    combat.windup--;
    if (combat.windup === 0) land(world, weapon);
    return;
  }
  if (combat.cooldown > 0) {
    combat.cooldown--;
    return;
  }

  const veto = attackVeto({
    cooldown: combat.cooldown,
    stamina: world.stats.stamina,
    crouching: world.player.stance === 'crouch',
    hasItemInHand: weapon.stack !== null,
    targetCount: targets.length,
    stats: weapon.stats,
  });
  if (veto === 'ready') {
    combat.windup = Math.max(1, weapon.stats.windupTicks);
    combat.committedTargets = targets.length;
    return;
  }
  // Out of breath with something in reach is the one refusal worth reporting.
  if (veto === 'spent' && combat.eventTicks === 0) note(world, 'tired');
};

/** The swing arrives. Targets are counted again, so backing off still works. */
const land = (world: RunWorld, weapon: HeldWeapon): void => {
  const combat = world.combat;
  const targets = targetsInReach(
    world.player.x,
    world.player.y,
    weapon.stats.reach,
    creatureCombatants(world),
  );
  const billed = Math.max(combat.committedTargets, targets.length);
  const cost = swingCost(weapon.stats, billed);

  combat.cooldown = weapon.stats.intervalTicks;
  world.stats.stamina = Math.max(0, world.stats.stamina - cost.stamina);
  world.emitNoise(world.player.x, world.player.y, cost.noise, 'melee');

  if (weapon.stack && weapon.stats.maxDurability > 0) {
    const before = weapon.stack.durability;
    weapon.stack.durability = wearAfterSwing(weapon.stats, before);
    if (before > 0 && weapon.stack.durability <= 0) {
      note(world, 'broke');
      return;
    }
  }

  if (targets.length === 0) {
    note(world, 'miss');
    return;
  }

  let hits = 0;
  const push = world.config.interaction.shoveImpulse * world.config.stepSeconds;
  for (const target of targets) {
    const creature = world.creatures.get(target.id);
    const def = creature ? world.config.content.creatures[creature.defId] : undefined;
    if (!creature || !def) continue;
    const blocked = rollBlock(
      { cooldown: creature.blockCooldown, stamina: 0, chance: def.blockChance, staminaCost: 0 },
      world.rng,
    );
    if (blocked) {
      creature.blockCooldown = def.blockCooldownTicks;
      continue;
    }
    creature.health -= weapon.damage;
    hits++;
    const dx = creature.x - world.player.x;
    const dy = creature.y - world.player.y;
    const length = Math.hypot(dx, dy) || 1;
    creature.x += (dx / length) * push;
    creature.y += (dy / length) * push;
  }
  note(world, hits > 0 ? 'hit' : 'blockedByThem', hits > 0 ? hits : targets.length);
};

/**
 * Creatures reaching the player. A block swallows one incoming hit whole; every
 * other hit landing on the same tick goes through, which is what makes being
 * surrounded lethal rather than merely slow.
 */
export const applyContactDamage = (world: RunWorld): void => {
  const hands = handsStats(world);
  if (!hands) return;
  const weapon = heldWeapon(world, hands);
  let blockedThisTick = false;

  for (const creature of world.creatures.values()) {
    const def = world.config.content.creatures[creature.defId];
    if (!def) continue;
    const distance = Math.hypot(creature.x - world.player.x, creature.y - world.player.y);
    if (distance > def.attackRange + def.radius) continue;
    if (creature.attackCooldown > 0) continue;
    creature.attackCooldown = def.attackCooldownTicks;

    if (
      !blockedThisTick &&
      rollBlock(
        {
          cooldown: world.combat.blockCooldown,
          stamina: world.stats.stamina,
          chance: weapon.stats.blockChance,
          staminaCost: weapon.stats.blockStaminaCost,
        },
        world.rng,
      )
    ) {
      blockedThisTick = true;
      world.combat.blockCooldown = weapon.stats.blockCooldownTicks;
      world.stats.stamina = Math.max(0, world.stats.stamina - weapon.stats.blockStaminaCost);
      note(world, 'blockedByYou');
      continue;
    }

    applyDamage(
      world.stats,
      def.killsOnContact ? world.config.stats.maxHealth : def.damage,
      'injury',
      world.config.stats,
    );
  }
};
