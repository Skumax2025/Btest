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
import { drawPrompt } from './prompt-view';
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
  /**
   * A key prompt drawn next to the thing it is about. The text arrives already
   * localized: the view never holds a string of its own.
   */
  readonly prompt: { readonly x: number; readonly y: number; readonly text: string } | null;
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
    drawCreatures(renderer, this.sprites, run, alpha, options.palette, view, options);
    drawPlayer(renderer, this.sprites, run.player, alpha, options.palette, options.view);

    // The lamp in hand decides the cone, so a head torch and a glow stick are
    // not the hand torch with a different battery.
    const shape = run.lightShape;
    this.lightingView.draw(renderer, {
      view,
      palette: options.palette,
      lighting: shape
        ? {
            ...options.lighting,
            flashlightRadius: shape.radius,
            flashlightHalfAngle: shape.halfAngle,
            flashlightStrength: shape.strength,
          }
        : options.lighting,
      isSolid: run.isSolid,
      tileSize: run.config.geometry.tileSize,
      geometryKey: run.level.geometryKey,
      lights: run.perception.lights,
      playerX: px,
      playerY: py,
      playerFacing: facingAt(run.player, alpha),
      sightRadius: run.perception.sightRadius,
      losRadius: options.losRadius,
      flashlightOn: run.flashlightOn,
      tick: run.tick + alpha,
      rays: options.rays,
      config: options.view,
    });
    drawTelegraphs(renderer, run, options.palette, options.view);
    drawCombat(renderer, run, px, py, options.view.combat);
    if (options.prompt) {
      drawPrompt(renderer, options.prompt, options.palette, options.view.hud);
    }

    renderer.popWorld();
  }
}
