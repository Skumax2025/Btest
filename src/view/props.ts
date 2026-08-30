/** L4: props, decals, dropped items, creatures and the player body. */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
import { hashInts } from '@core/rng';
import type { PropSpawn } from '@game/level';
import { LAMP_DEAD, LAMP_FLICKER } from '@game/level';
import { lampIsLit } from '@game/lighting';
import type { LightingConfig } from '@game/lighting';
import { facingAt } from '@game/player';
import type { PlayerState } from '@game/player';
import type { Run } from '@game/run';
import type { Palette } from '@content/palettes';
import type { ViewConfig } from '@content/view';

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
  config: ViewConfig,
): void => {
  const tileSize = run.config.geometry.tileSize;
  const bounds = viewBounds(view, tileSize * 2);
  const visible = run.propsInRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  for (const prop of visible) {
    if (prop.kind !== 'marker') continue;
    renderer.drawSprite(sprites.sprite(prop.defId), prop.x, prop.y, {
      width: tileSize * config.markerTiles,
      height: tileSize * config.markerTiles,
      alpha: config.markerAlpha,
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
  config: ViewConfig,
): void => {
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  const radius = Math.hypot(bounds.maxX - centreX, bounds.maxY - centreY);
  for (const item of run.groundItemsNear(centreX, centreY, radius)) {
    const def = run.config.content.items[item.itemId];
    renderer.drawSprite(sprites.sprite(def ? def.sprite : 'item.ground'), item.x, item.y, {
      width: config.groundItemSize,
      height: config.groundItemSize,
    });
  }
  for (const projectile of run.projectiles.values()) {
    const def = run.config.content.items[projectile.itemId];
    renderer.drawSprite(
      sprites.sprite(def ? def.sprite : 'item.ground'),
      projectile.x,
      projectile.y,
      { width: config.projectileSize, height: config.projectileSize },
    );
  }
};

export const drawCreatures = (
  renderer: Renderer,
  sprites: SpriteProvider,
  run: Run,
  alpha: number,
  palette: Palette,
  options: { readonly derangement: number; readonly view: ViewConfig },
): void => {
  const config = options.view;
  for (const creature of run.creatures.values()) {
    const def = run.config.content.creatures[creature.defId];
    if (!def) continue;
    const x = creature.prevX + (creature.x - creature.prevX) * alpha;
    const y = creature.prevY + (creature.y - creature.prevY) * alpha;
    renderer.fillCircle(x, y + config.shadowOffset, def.radius, 'rgba(0,0,0,0.4)');
    renderer.drawSprite(sprites.sprite(def.sprite), x, y, {
      width: def.radius * config.creatureSpriteScale,
      height: def.radius * config.creatureSpriteScale,
      rotation: creature.facing,
    });
    if (creature.mode === 'chase') {
      renderer.strokeCircle(x, y, def.radius + 4, palette.danger, 2);
    }
  }
  drawPhantoms(renderer, run, options.derangement, palette, config);
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
  config: ViewConfig,
): void => {
  if (derangement <= 0) return;
  const count = Math.floor(derangement * config.phantomCount);
  for (let i = 0; i < count; i++) {
    const phase = Math.floor(run.tick / config.phantomPeriodTicks) + i * 977;
    const noise = hashInts(phase, i);
    const angle = ((noise % 1000) / 1000) * Math.PI * 2;
    const distance = config.phantomMinDistance + ((noise >>> 10) % config.phantomSpread);
    const x = run.player.x + Math.cos(angle) * distance;
    const y = run.player.y + Math.sin(angle) * distance;
    if (run.isSolid(Math.floor(x / run.config.geometry.tileSize), Math.floor(y / run.config.geometry.tileSize))) {
      continue;
    }
    renderer.setAlpha(config.phantomBaseAlpha + derangement * config.phantomAlphaRange);
    renderer.fillCircle(x, y, config.phantomRadius, palette.textDim);
    renderer.setAlpha(1);
  }
};

/**
 * Stationary threats are drawn after the darkness pass on purpose: a thing that
 * kills on contact has to be recognisable before you touch it, and light is not
 * something the player can count on. The stain reads as sensed, not seen.
 */
export const drawTelegraphs = (
  renderer: Renderer,
  run: Run,
  palette: Palette,
  config: ViewConfig,
): void => {
  for (const creature of run.creatures.values()) {
    const def = run.config.content.creatures[creature.defId];
    if (!def || def.telegraphRadius <= 0) continue;
    const distance = Math.hypot(creature.x - run.player.x, creature.y - run.player.y);
    if (distance > def.telegraphRadius + run.perception.sightRadius) continue;
    renderer.setAlpha(0.5);
    renderer.fillCircle(creature.x, creature.y, def.telegraphRadius, config.telegraphFill);
    renderer.strokeCircle(creature.x, creature.y, def.telegraphRadius, palette.danger, 1.5);
    renderer.setAlpha(0.75);
    renderer.fillCircle(
      creature.x,
      creature.y,
      def.radius * config.telegraphCoreScale,
      config.telegraphCore,
    );
    renderer.strokeCircle(creature.x, creature.y, def.attackRange, palette.danger, 2);
    renderer.setAlpha(1);
  }
};

export const drawPlayer = (
  renderer: Renderer,
  sprites: SpriteProvider,
  player: PlayerState,
  alpha: number,
  palette: Palette,
  config: ViewConfig,
): void => {
  const x = player.prevX + (player.x - player.prevX) * alpha;
  const y = player.prevY + (player.y - player.prevY) * alpha;
  const facing = facingAt(player, alpha);
  const scale = player.stance === 'crouch' ? config.crouchScale : 1;
  const size = config.playerSpriteSize * scale;
  renderer.fillCircle(x, y + config.shadowOffset, size / 2, 'rgba(0,0,0,0.35)');
  renderer.drawSprite(sprites.sprite('player'), x, y, {
    width: size,
    height: size,
    rotation: facing,
  });
  renderer.line(
    x + Math.cos(facing) * size * 0.35,
    y + Math.sin(facing) * size * 0.35,
    x + Math.cos(facing) * size * 0.62,
    y + Math.sin(facing) * size * 0.62,
    palette.text,
    2,
  );
};
