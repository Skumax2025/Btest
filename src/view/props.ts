/** L4: props, decals and the player body. */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
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
): PropSpawn[] => {
  const bounds = viewBounds(view, run.config.geometry.tileSize * 2);
  const visible = run.propsInRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  for (const prop of visible) {
    if (prop.kind !== 'marker') continue;
    const size = run.config.geometry.tileSize * 3;
    renderer.drawSprite(sprites.sprite(prop.defId), prop.x, prop.y, {
      width: size,
      height: size,
      alpha: 0.85,
    });
  }
  for (const prop of visible) {
    if (prop.kind === 'marker' || prop.kind === 'creature') continue;
    if (prop.kind === 'container' && run.level.isConsumed(prop)) continue;
    renderer.drawSprite(sprites.sprite(spriteIdFor(prop, run, lighting)), prop.x, prop.y);
  }
  return visible;
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
