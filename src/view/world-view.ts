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
import type { ViewConfig } from '@content/view';
import { LightingView } from './lighting-view';
import { drawCombat } from './combat-view';
import { drawCreatures, drawGround, drawPlayer, drawProps, drawTelegraphs } from './props';
import { drawTiles } from './tiles';

export interface WorldViewOptions {
  readonly lighting: LightingConfig;
  readonly palette: Palette;
  readonly rays: {
    readonly lightRays: number;
    readonly playerRays: number;
    readonly flashlightRays: number;
  };
  /** How far lit places stay visible down an open line of sight. */
  readonly losRadius: number;
  /** 0 = clear head, 1 = the walls are lying to you. */
  readonly derangement: number;
  readonly view: ViewConfig;
}

export class WorldView {
  private readonly lightingView: LightingView;

  constructor(
    private readonly renderer: Renderer,
    private readonly sprites: SpriteProvider,
    cacheLimit: number,
  ) {
    this.lightingView = new LightingView(cacheLimit);
  }

  draw(run: Run, view: CameraView, alpha: number, options: WorldViewOptions): void {
    const { renderer } = this;
    const bounds = viewBounds(view, run.config.geometry.tileSize * 2);
    const px = run.player.prevX + (run.player.x - run.player.prevX) * alpha;
    const py = run.player.prevY + (run.player.y - run.player.prevY) * alpha;

    renderer.beginFrame(options.palette.background);
    renderer.pushWorld(view);

    drawTiles(renderer, run.level, view, options.palette, options.view);
    drawProps(renderer, this.sprites, run, view, options.lighting, options.view);
    drawGround(renderer, this.sprites, run, bounds, options.view);
    drawCreatures(renderer, this.sprites, run, alpha, options.palette, options);
    drawPlayer(renderer, this.sprites, run.player, alpha, options.palette, options.view);

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
      losRadius: options.losRadius,
      flashlightOn: run.flashlightOn,
      rays: options.rays,
      config: options.view,
    });
    drawTelegraphs(renderer, run, options.palette, options.view);
    drawCombat(renderer, run, px, py, options.view.combat);

    renderer.popWorld();
  }
}
