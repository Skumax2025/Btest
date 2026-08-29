/**
 * L4: the whole world pass — floor, decals, props, dropped things, actors, then
 * the darkness layer that turns light into a mechanic rather than a decoration.
 */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
import { facingAt } from '@game/player';
import type { LightingConfig } from '@game/lighting';
import type { Run } from '@game/run';
import type { Palette } from '@content/palettes';
import { LightingView } from './lighting-view';
import { drawCreatures, drawGround, drawPlayer, drawProps } from './props';
import { drawTiles } from './tiles';

export interface WorldViewOptions {
  readonly lighting: LightingConfig;
  readonly palette: Palette;
  readonly rays: {
    readonly lightRays: number;
    readonly playerRays: number;
    readonly flashlightRays: number;
  };
  /** 0 = clear head, 1 = the walls are lying to you. */
  readonly derangement: number;
}

const LIGHT_CACHE_LIMIT = 512;

export class WorldView {
  private readonly lightingView = new LightingView(LIGHT_CACHE_LIMIT);

  constructor(
    private readonly renderer: Renderer,
    private readonly sprites: SpriteProvider,
  ) {}

  draw(run: Run, view: CameraView, alpha: number, options: WorldViewOptions): void {
    const { renderer } = this;
    const bounds = viewBounds(view, run.config.geometry.tileSize * 2);
    const px = run.player.prevX + (run.player.x - run.player.prevX) * alpha;
    const py = run.player.prevY + (run.player.y - run.player.prevY) * alpha;

    renderer.beginFrame(options.palette.background);
    renderer.pushWorld(view);

    drawTiles(renderer, run.level, view, options.palette);
    drawProps(renderer, this.sprites, run, view, options.lighting);
    drawGround(renderer, this.sprites, run, bounds);
    drawCreatures(renderer, this.sprites, run, alpha, options.palette, options.derangement);
    drawPlayer(renderer, this.sprites, run.player, alpha, options.palette);

    this.lightingView.draw(renderer, {
      view,
      palette: options.palette,
      lighting: options.lighting,
      isSolid: run.isSolid,
      tileSize: run.config.geometry.tileSize,
      lights: run.perception.lights,
      playerX: px,
      playerY: py,
      playerFacing: facingAt(run.player, alpha),
      sightRadius: run.perception.sightRadius,
      flashlightOn: run.flashlightOn,
      rays: options.rays,
    });

    renderer.popWorld();
  }
}
