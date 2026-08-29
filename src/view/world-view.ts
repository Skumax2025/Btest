/**
 * L4: the whole world pass — floor, props, actors, then the darkness layer that
 * turns light into a mechanic rather than a decoration.
 */

import type { CameraView } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
import { collectLights, lightLevelAt, visionRadius } from '@game/lighting';
import type { LightingConfig } from '@game/lighting';
import { facingAt } from '@game/player';
import type { Run } from '@game/run';
import type { Palette } from '@content/palettes';
import { drawPlayer, drawProps } from './props';
import { drawTiles } from './tiles';

export interface WorldViewOptions {
  readonly lighting: LightingConfig;
  readonly palette: Palette;
}

export class WorldView {
  constructor(
    private readonly renderer: Renderer,
    private readonly sprites: SpriteProvider,
  ) {}

  draw(run: Run, view: CameraView, alpha: number, options: WorldViewOptions): void {
    const { renderer } = this;
    renderer.beginFrame(options.palette.background);
    renderer.pushWorld(view);

    drawTiles(renderer, run.level, view, options.palette);
    const visibleProps = drawProps(renderer, this.sprites, run, view, options.lighting);
    drawPlayer(renderer, this.sprites, run.player, alpha, options.palette);

    this.drawDarkness(run, view, alpha, options, visibleProps);
    renderer.popWorld();
  }

  private drawDarkness(
    run: Run,
    view: CameraView,
    alpha: number,
    options: WorldViewOptions,
    visibleProps: ReturnType<typeof drawProps>,
  ): void {
    const { renderer } = this;
    const px = run.player.prevX + (run.player.x - run.player.prevX) * alpha;
    const py = run.player.prevY + (run.player.y - run.player.prevY) * alpha;
    const lights = collectLights(visibleProps, run.tick, options.lighting);

    renderer.beginDarkness(options.palette.darkness, view);
    for (const light of lights) {
      renderer.punchLight(light.x, light.y, light.radius, light.strength);
    }
    for (const prop of visibleProps) {
      if (prop.kind === 'exit') renderer.punchLight(prop.x, prop.y, 90, 0.7);
    }
    const level = lightLevelAt(px, py, lights, run.spec.ambientLight);
    renderer.punchLight(px, py, visionRadius(level, options.lighting), 0.9);
    if (run.flashlightOn) {
      renderer.punchCone(
        px,
        py,
        facingAt(run.player, alpha),
        options.lighting.flashlightHalfAngle,
        options.lighting.flashlightRadius,
        options.lighting.flashlightStrength,
      );
    }
    renderer.endDarkness();
  }
}
