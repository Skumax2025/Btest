/**
 * L4: the application. Owns the browser (canvas, DOM, real time), builds a run
 * from content and feeds it input frames. Everything below this file is
 * headless and testable.
 */

import { PlaceholderSpriteProvider, domCanvasFactory } from '@core/assets';
import { Camera } from '@core/camera';
import { InputDevice } from '@core/input';
import { GameLoop, browserLoopOptions } from '@core/loop';
import { Canvas2DRenderer } from '@core/renderer';
import { createRandom } from '@core/rng';
import { Run } from '@game/run';
import type { RunConfig } from '@game/run';
import { LEVELS } from '@content/levels';
import { paletteOf } from '@content/palettes';
import { FALLBACK_SPRITE, SPRITES } from '@content/sprites';
import {
  AXIS_BINDINGS,
  CAMERA,
  GEOMETRY,
  KEY_BINDINGS,
  LIGHTING,
  PLAYER,
  SIM,
  STREAM,
} from '@content/tuning';
import { WorldView } from '@view/world-view';

const ACTIONS = {
  sprint: 'sprint',
  crouch: 'crouch',
  interact: 'interact',
  use: 'use',
  attack: 'attack',
  throwItem: 'throwItem',
  drop: 'drop',
  flashlight: 'flashlight',
} as const;

const runConfigFor = (seed: number): RunConfig => ({
  seed,
  levels: LEVELS,
  geometry: GEOMETRY,
  stream: STREAM,
  player: PLAYER,
  actions: ACTIONS,
  stepSeconds: SIM.stepMs / 1000,
  propCellSize: GEOMETRY.tileSize * 4,
});

export class App {
  private readonly renderer: Canvas2DRenderer;
  private readonly camera = new Camera();
  private readonly input: InputDevice;
  private readonly worldView: WorldView;
  private readonly loop: GameLoop;
  private run: Run;

  constructor(private readonly root: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    root.appendChild(canvas);

    this.renderer = new Canvas2DRenderer(canvas, CAMERA.maxPixelRatio);
    this.input = new InputDevice(KEY_BINDINGS, AXIS_BINDINGS);
    this.input.attach(canvas, window);
    this.worldView = new WorldView(
      this.renderer,
      new PlaceholderSpriteProvider(SPRITES, domCanvasFactory, FALLBACK_SPRITE),
    );
    this.camera.zoom = CAMERA.zoom;

    this.run = new Run(runConfigFor(createRandom(Date.now()).nextUint32()));
    this.camera.snapTo(this.run.player.x, this.run.player.y);

    window.addEventListener('resize', this.resize);
    this.resize();

    this.loop = new GameLoop(browserLoopOptions(SIM.stepMs, SIM.maxFrameMs), {
      fixedUpdate: () => this.fixedUpdate(),
      render: (alpha) => this.render(alpha),
    });
  }

  start(): void {
    this.loop.start();
  }

  private readonly resize = (): void => {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.renderer.resize(width, height);
    this.camera.resize(width, height);
  };

  private fixedUpdate(): void {
    const pointer = this.input.pointerScreen;
    const world = this.camera.screenToWorld(pointer.x, pointer.y);
    this.run.step(this.input.sample(world.x, world.y));
    this.camera.follow(this.run.player.x, this.run.player.y, CAMERA.smoothing);
  }

  private render(alpha: number): void {
    const view = this.camera.view(alpha);
    this.worldView.draw(this.run, view, alpha, {
      lighting: LIGHTING,
      palette: paletteOf(this.run.spec.paletteId),
    });
    this.renderer.endFrame();
  }
}
