/**
 * L2: the per-tick consequences of player actions — thrown items in flight, a
 * search in progress and a light burning down. Split from `actions.ts` so that
 * file stays about button presses only; melee lives in `melee.ts` because it no
 * longer involves a button at all.
 */

import { castRay } from '@systems/raycast';
import { isLightSource } from '@game/items';
import { finishSearch } from './actions';
import type { RunWorld } from './world-access';

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
      landed.push(id);
      continue;
    }
    projectile.x = nextX;
    projectile.y = nextY;
  }
  for (const id of landed) world.world.destroyEntity(id);
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
