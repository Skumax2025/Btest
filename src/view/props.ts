/** L4: props, decals, dropped items, creatures and the player body. */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
import { hashInts } from '@core/rng';
import type { PropSpawn } from '@game/level';
import { LAMP_DEAD, LAMP_FLICKER, lampIsLit } from '@game/lighting';
import type { LightingConfig } from '@game/lighting';
import { facingAt } from '@game/player';
import type { PlayerState } from '@game/player';
import type { Run } from '@game/run';
import type { Palette } from '@content/palettes';

const lampSprite = (prop: PropSpawn, lit: boolean): string => {
  if (prop.variant === LAMP_DEAD || !lit) return 'prop.lamp.dead';
  return prop.variant === LAMP_FLICKER ? 'prop.lamp.flicker' : 'prop.lamp.on';
};

const spriteIdFor = (prop: PropSpawn, run: Run, lighting: LightingConfig): string => {
  switch (prop.kind) {
    case 'lamp':
      return lampSprite(prop, lampIsLit(prop, run.tick, lighting));
    case 'container':
      return run.level.isOpened(prop) ? `prop.${prop.defId}.open` : `prop.${prop.defId}`;
    case 'marker':
      return prop.defId;
    case 'exit':
      return 'prop.exit';
    default:
      return 'unknown';
  }
};

/** Decals first so props sit on top of them. */
export const drawProps = (
  renderer: Renderer,
  sprites: SpriteProvider,
  run: Run,
  view: CameraView,
  lighting: LightingConfig,
): void => {
  const tileSize = run.config.geometry.tileSize;
  const bounds = viewBounds(view, tileSize * 2);
  const visible = run.propsInRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  for (const prop of visible) {
    if (prop.kind !== 'marker') continue;
    renderer.drawSprite(sprites.sprite(prop.defId), prop.x, prop.y, {
      width: tileSize * 3,
      height: tileSize * 3,
      alpha: 0.85,
    });
  }
  for (const prop of visible) {
    if (prop.kind === 'marker' || prop.kind === 'creature') continue;
    renderer.drawSprite(sprites.sprite(spriteIdFor(prop, run, lighting)), prop.x, prop.y);
  }
};

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const drawGround = (
  renderer: Renderer,
  sprites: SpriteProvider,
  run: Run,
  bounds: Bounds,
): void => {
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  const radius = Math.hypot(bounds.maxX - centreX, bounds.maxY - centreY);
  for (const item of run.groundItemsNear(centreX, centreY, radius)) {
    const def = run.config.content.items[item.itemId];
    renderer.drawSprite(sprites.sprite(def ? def.sprite : 'item.ground'), item.x, item.y, {
      width: 18,
      height: 18,
    });
  }
  for (const projectile of run.projectiles.values()) {
    const def = run.config.content.items[projectile.itemId];
    renderer.drawSprite(sprites.sprite(def ? def.sprite : 'item.ground'), projectile.x, projectile.y, {
      width: 14,
      height: 14,
    });
  }
};

export const drawCreatures = (
  renderer: Renderer,
  sprites: SpriteProvider,
  run: Run,
  alpha: number,
  palette: Palette,
  derangement: number,
): void => {
  for (const creature of run.creatures.values()) {
    const def = run.config.content.creatures[creature.defId];
    if (!def) continue;
    const x = creature.prevX + (creature.x - creature.prevX) * alpha;
    const y = creature.prevY + (creature.y - creature.prevY) * alpha;
    if (def.telegraphRadius > 0) {
      // A stationary threat is meant to be readable before it is lethal.
      renderer.strokeCircle(x, y, def.telegraphRadius, 'rgba(150,60,50,0.16)', 3);
      renderer.fillCircle(x, y, def.radius * 2.4, 'rgba(60,40,36,0.25)');
    }
    renderer.fillCircle(x, y + 3, def.radius, 'rgba(0,0,0,0.4)');
    renderer.drawSprite(sprites.sprite(def.sprite), x, y, {
      width: def.radius * 2.2,
      height: def.radius * 2.2,
      rotation: creature.facing,
    });
    if (creature.mode === 'chase') {
      renderer.strokeCircle(x, y, def.radius + 4, palette.danger, 2);
    }
  }
  drawPhantoms(renderer, run, derangement, palette);
};

/**
 * Low nerve puts shapes at the edge of sight that are not there. They are drawn
 * from the tick, so they flicker rather than persist, and they never collide.
 */
const drawPhantoms = (
  renderer: Renderer,
  run: Run,
  derangement: number,
  palette: Palette,
): void => {
  if (derangement <= 0) return;
  const count = Math.floor(derangement * 3);
  for (let i = 0; i < count; i++) {
    const phase = Math.floor(run.tick / 40) + i * 977;
    const noise = hashInts(phase, i);
    const angle = ((noise % 1000) / 1000) * Math.PI * 2;
    const distance = 130 + ((noise >>> 10) % 160);
    const x = run.player.x + Math.cos(angle) * distance;
    const y = run.player.y + Math.sin(angle) * distance;
    if (run.isSolid(Math.floor(x / run.config.geometry.tileSize), Math.floor(y / run.config.geometry.tileSize))) {
      continue;
    }
    renderer.setAlpha(0.1 + derangement * 0.22);
    renderer.fillCircle(x, y, 11, palette.textDim);
    renderer.setAlpha(1);
  }
};

export const drawPlayer = (
  renderer: Renderer,
  sprites: SpriteProvider,
  player: PlayerState,
  alpha: number,
  palette: Palette,
): void => {
  const x = player.prevX + (player.x - player.prevX) * alpha;
  const y = player.prevY + (player.y - player.prevY) * alpha;
  const facing = facingAt(player, alpha);
  const scale = player.stance === 'crouch' ? 0.8 : 1;
  renderer.fillCircle(x, y + 3, 11 * scale, 'rgba(0,0,0,0.35)');
  renderer.drawSprite(sprites.sprite('player'), x, y, {
    width: 24 * scale,
    height: 24 * scale,
    rotation: facing,
  });
  renderer.line(
    x + Math.cos(facing) * 8,
    y + Math.sin(facing) * 8,
    x + Math.cos(facing) * 15,
    y + Math.sin(facing) * 15,
    palette.text,
    2,
  );
};
