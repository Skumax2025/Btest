/**
 * L4: the debug pass — hitboxes, noise radii, creature state and paths.
 *
 * Everything here reads the run and draws; nothing writes. Kept out of the
 * normal world view so it costs nothing while it is switched off.
 */

import type { CameraView } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { Run } from '@game/run';

const NOISE_COLOUR = 'rgba(120, 190, 255, 0.5)';
const HITBOX_COLOUR = 'rgba(255, 120, 90, 0.85)';
const PATH_COLOUR = 'rgba(150, 255, 170, 0.55)';
const TEXT_STYLE = { font: '10px monospace', color: '#9ff0c0' } as const;

export const drawDebug = (renderer: Renderer, run: Run, view: CameraView, alpha: number): void => {
  renderer.pushWorld(view);
  const tileSize = run.config.geometry.tileSize;

  for (const event of run.noise.recent()) {
    const age = (run.tick - event.tick) / run.config.sound.memoryTicks;
    if (age > 1) continue;
    renderer.setAlpha(1 - age);
    renderer.strokeCircle(event.x, event.y, event.radius, NOISE_COLOUR, 1.5);
    renderer.setAlpha(1);
  }

  const px = run.player.prevX + (run.player.x - run.player.prevX) * alpha;
  const py = run.player.prevY + (run.player.y - run.player.prevY) * alpha;
  renderer.strokeCircle(px, py, run.config.player.radius, HITBOX_COLOUR, 1.5);
  renderer.strokeCircle(px, py, run.config.interaction.interactRange, 'rgba(255,220,120,0.4)', 1);

  for (const creature of run.creatures.values()) {
    const def = run.config.content.creatures[creature.defId];
    if (!def) continue;
    renderer.strokeCircle(creature.x, creature.y, def.radius, HITBOX_COLOUR, 1.5);
    if (def.sightRange > 0) {
      renderer.strokeCircle(creature.x, creature.y, def.sightRange, 'rgba(255,120,90,0.15)', 1);
    }
    if (def.sanityRadius > 0) {
      renderer.strokeCircle(creature.x, creature.y, def.sanityRadius, 'rgba(200,120,255,0.15)', 1);
    }
    renderer.drawText(
      `${def.id.replace('creature.', '')} ${creature.mode} ${creature.chaseTicks}`,
      creature.x - 30,
      creature.y - def.radius - 6,
      TEXT_STYLE,
    );
    for (let i = creature.pathIndex; i * 2 + 1 < creature.path.length; i++) {
      const fromX = i === creature.pathIndex ? creature.x : (creature.path[i * 2 - 2] + 0.5) * tileSize;
      const fromY = i === creature.pathIndex ? creature.y : (creature.path[i * 2 - 1] + 0.5) * tileSize;
      renderer.line(
        fromX,
        fromY,
        (creature.path[i * 2] + 0.5) * tileSize,
        (creature.path[i * 2 + 1] + 0.5) * tileSize,
        PATH_COLOUR,
        1.5,
      );
    }
  }

  for (const projectile of run.projectiles.values()) {
    renderer.strokeCircle(projectile.x, projectile.y, 5, HITBOX_COLOUR, 1);
  }
  renderer.popWorld();
};
