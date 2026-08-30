/**
 * L2: the per-tick consequences of player actions — thrown items in flight, a
 * search in progress and a light burning down. Split from `actions.ts` so that
 * file stays about button presses only; melee lives in `melee.ts` because it no
 * longer involves a button at all.
 */

import { castRay } from '@systems/raycast';
import { clamp } from '@core/math';
import { isLightSource } from '@game/items';
import { finishSearch } from './actions';
import type { Beacon, RunWorld } from './world-access';

/** Advances thrown items; a landing makes noise where it lands, not where it was thrown. */
export const stepProjectiles = (world: RunWorld): void => {
  const { tileSize } = world.config.geometry;
  const landed: number[] = [];
  for (const [id, projectile] of world.projectiles.entries()) {
    const nextX = projectile.x + projectile.vx * world.config.stepSeconds;
    const nextY = projectile.y + projectile.vy * world.config.stepSeconds;
    const hit = castRay(
      projectile.x,
      projectile.y,
      nextX,
      nextY,
      tileSize,
      world.level.isSolidTileAt,
      true,
    );
    projectile.ticksLeft--;
    if (hit.blocked || projectile.ticksLeft <= 0) {
      const landX = hit.blocked ? projectile.x : nextX;
      const landY = hit.blocked ? projectile.y : nextY;
      const def = world.config.content.items[projectile.itemId];
      world.level.drop(projectile.itemId, 1, landX, landY);
      if (def) world.emitNoise(landX, landY, def.noise, 'impact');
      if (def?.beacon) {
        const beacon: Beacon = {
          x: landX,
          y: landY,
          radius: def.beacon.radius,
          ticksLeft: Math.round(def.beacon.seconds / world.config.stepSeconds),
          intervalTicks: Math.max(1, Math.round(def.beacon.intervalSeconds / world.config.stepSeconds)),
          sinceLast: 0,
        };
        world.spawn(world.beacons, beacon);
      }
      landed.push(id);
      continue;
    }
    projectile.x = nextX;
    projectile.y = nextY;
  }
  for (const id of landed) world.world.destroyEntity(id);
};

/**
 * Something thrown that keeps shouting. It draws creatures to where it landed
 * for as long as it lasts, which is the only way to move a crowd off a door.
 */
export const stepBeacons = (world: RunWorld): void => {
  const spent: number[] = [];
  for (const [id, beacon] of world.beacons.entries()) {
    beacon.ticksLeft--;
    beacon.sinceLast++;
    if (beacon.sinceLast >= beacon.intervalTicks) {
      beacon.sinceLast = 0;
      world.emitNoise(beacon.x, beacon.y, beacon.radius, 'lure');
    }
    if (beacon.ticksLeft <= 0) spent.push(id);
  }
  for (const id of spent) world.world.destroyEntity(id);
};

/** Effects that arrive late: the price of everything that helped at the time. */
export const stepLasting = (world: RunWorld): void => {
  if (world.lasting.length === 0) return;
  const stats = world.stats;
  const config = world.config.stats;
  const dt = world.config.stepSeconds;
  for (const effect of world.lasting) {
    const share = effect.seconds > 0 ? dt / effect.seconds : 1;
    stats.health = clamp(stats.health + effect.health * share, 0, config.maxHealth);
    stats.hunger = clamp(stats.hunger + effect.hunger * share, 0, config.maxHunger);
    stats.thirst = clamp(stats.thirst + effect.thirst * share, 0, config.maxThirst);
    stats.stamina = clamp(stats.stamina + effect.stamina * share, 0, config.maxStamina);
    stats.sanity = clamp(stats.sanity + effect.sanity * share, 0, config.maxSanity);
    effect.ticksLeft--;
  }
  const alive = world.lasting.filter((effect) => effect.ticksLeft > 0);
  world.lasting.length = 0;
  world.lasting.push(...alive);
};

export const stepSearch = (world: RunWorld): void => {
  const search = world.search;
  if (!search) return;
  const distance = Math.hypot(search.x - world.player.x, search.y - world.player.y);
  if (distance > world.config.interaction.interactRange * world.config.interaction.searchCancelFactor) {
    world.search = null;
    return;
  }
  search.ticksLeft--;
  if (search.ticksLeft > 0) return;
  world.search = null;
  const prop = world
    .propsNear(search.x, search.y, world.config.geometry.tileSize)
    .find((candidate) => candidate.key === search.key);
  if (prop) finishSearch(world, prop);
};

/** Burns the light source down while it is on; returns the charge left. */
export const stepLight = (world: RunWorld): number => {
  let charge = 0;
  for (const stack of world.inventory.stacks) {
    const def = world.config.content.items[stack.itemId];
    if (!def || !isLightSource(def)) continue;
    if (world.flashlightOn) {
      stack.charge = Math.max(0, stack.charge - world.config.stepSeconds);
    }
    charge = Math.max(charge, stack.charge);
  }
  if (charge <= 0) world.flashlightOn = false;
  return charge;
};
