/**
 * L2: creatures in the world.
 *
 * Knows: how a chunk's creature spawns become live creatures, how each one
 * perceives, moves and dies, and when it leaves with its chunk.
 * Does not know: what any archetype does — that is `@game/ai`, which stays pure
 * so the behaviour tests never need a level.
 */

import { hasLineOfSight } from '@systems/raycast';
import { findPath } from '@systems/pathfinding';
import { moveCircle } from '@systems/collision';
import { applyDecision, decide, speedFor } from '@game/ai';
import type { CreaturePerception, CreatureState } from '@game/ai';
import { chunkKey } from '@game/level';
import type { RunWorld } from './world-access';

const CREATURE_NOISE = 'creature';

/**
 * Turns freshly loaded chunks into live creatures and drops the ones whose chunk
 * has gone. Returns how many chunks changed, because the caller also has a
 * static prop index to rebuild.
 */
export const syncCreatures = (world: RunWorld): number => {
  const loaded = world.level.drainLoaded();
  const unloaded = world.level.drainUnloaded();
  for (const chunk of loaded) {
    const key = chunkKey(chunk.cx, chunk.cy);
    if (world.spawnedChunks.has(key)) continue;
    world.spawnedChunks.add(key);
    for (const prop of chunk.props) {
      if (prop.kind !== 'creature' || world.level.isConsumed(prop)) continue;
      const def = world.config.content.creatures[prop.defId];
      if (!def) continue;
      world.spawn(world.creatures, {
        defId: prop.defId,
        spawnKey: prop.key,
        homeCx: chunk.cx,
        homeCy: chunk.cy,
        x: prop.x,
        y: prop.y,
        prevX: prop.x,
        prevY: prop.y,
        facing: 0,
        mode: 'idle',
        targetX: prop.x,
        targetY: prop.y,
        modeTicks: 0,
        chaseTicks: 0,
        attackCooldown: 0,
        health: def.health,
        repathIn: 0,
        path: [],
        pathIndex: 0,
        noiseIn: 0,
      });
    }
  }

  for (const { cx, cy } of unloaded) {
    world.spawnedChunks.delete(chunkKey(cx, cy));
    for (const [id, creature] of [...world.creatures.entries()]) {
      if (creature.homeCx === cx && creature.homeCy === cy) world.world.destroyEntity(id);
    }
  }
  return loaded.length + unloaded.length;
};

const perceiveCreature = (world: RunWorld, creature: CreatureState): CreaturePerception => {
  const def = world.config.content.creatures[creature.defId];
  const tileSize = world.config.geometry.tileSize;
  const dx = world.player.x - creature.x;
  const dy = world.player.y - creature.y;
  const playerDistance = Math.hypot(dx, dy);

  let canSeePlayer = false;
  if (def && def.sightRange > 0 && playerDistance <= def.sightRange) {
    const angle = Math.atan2(dy, dx);
    let delta = Math.abs(angle - creature.facing) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    canSeePlayer =
      delta <= def.sightHalfAngle &&
      hasLineOfSight(
        creature.x,
        creature.y,
        world.player.x,
        world.player.y,
        tileSize,
        world.level.isSolidTileAt,
      );
  }

  // A creature never hears itself or its neighbours — only what the player did.
  const heard = world.noise.loudest(
    creature.x,
    creature.y,
    tileSize,
    world.level.isSolidTileAt,
    CREATURE_NOISE,
  );

  return {
    loudness: heard?.loudness ?? 0,
    noiseX: heard?.event.x ?? creature.x,
    noiseY: heard?.event.y ?? creature.y,
    canSeePlayer,
    playerX: world.player.x,
    playerY: world.player.y,
    playerDistance,
  };
};

const advance = (world: RunWorld, creature: CreatureState, speed: number): void => {
  const tileSize = world.config.geometry.tileSize;
  const def = world.config.content.creatures[creature.defId];
  if (!def) return;

  let goalX = creature.targetX;
  let goalY = creature.targetY;
  const direct = hasLineOfSight(
    creature.x,
    creature.y,
    goalX,
    goalY,
    tileSize,
    world.level.isSolidTileAt,
  );

  if (direct) {
    creature.path.length = 0;
    creature.pathIndex = 0;
  } else {
    if (creature.repathIn <= 0 || creature.pathIndex * 2 >= creature.path.length) {
      creature.repathIn = world.config.ai.repathTicks;
      creature.pathIndex = 0;
      creature.path =
        findPath(
          Math.floor(creature.x / tileSize),
          Math.floor(creature.y / tileSize),
          Math.floor(goalX / tileSize),
          Math.floor(goalY / tileSize),
          world.level.isSolidTileAt,
          world.config.ai.pathNodes,
        ) ?? [];
    }
    if (creature.path.length === 0) return;
    goalX = (creature.path[creature.pathIndex * 2] + 0.5) * tileSize;
    goalY = (creature.path[creature.pathIndex * 2 + 1] + 0.5) * tileSize;
    if (Math.hypot(goalX - creature.x, goalY - creature.y) < tileSize * world.config.ai.waypointReachedFactor) {
      creature.pathIndex++;
    }
  }

  const dx = goalX - creature.x;
  const dy = goalY - creature.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const step = speed * world.config.stepSeconds;
  const moved = moveCircle(
    creature.x,
    creature.y,
    def.radius,
    (dx / length) * step,
    (dy / length) * step,
    tileSize,
    world.level.isSolidTileAt,
  );
  creature.x = moved.x;
  creature.y = moved.y;
  creature.facing = Math.atan2(dy, dx);
};

export const stepCreatures = (world: RunWorld): void => {
  const dead: number[] = [];
  for (const [id, creature] of world.creatures.entries()) {
    const def = world.config.content.creatures[creature.defId];
    if (!def) {
      dead.push(id);
      continue;
    }
    if (creature.health <= 0) {
      world.level.consume(creature.x, creature.y, creature.spawnKey);
      dead.push(id);
      continue;
    }

    creature.prevX = creature.x;
    creature.prevY = creature.y;
    if (creature.repathIn > 0) creature.repathIn--;

    const perception = perceiveCreature(world, creature);
    applyDecision(creature, decide(creature, def, perception, world.rng));

    const speed = speedFor(creature.mode, def);
    if (speed > 0) advance(world, creature, speed);

    if (creature.noiseIn > 0) creature.noiseIn--;
    else if (def.noiseRadius > 0 && (speed > 0 || def.archetype === 'sentinel')) {
      creature.noiseIn = world.config.ai.noiseTicks;
      world.emitNoise(creature.x, creature.y, def.noiseRadius, 'creature');
    }
  }
  for (const id of dead) world.world.destroyEntity(id);
};
