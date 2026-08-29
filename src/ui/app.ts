/**
 * L4: the application. Owns the browser (canvas, DOM, real time), builds a run
 * from content and feeds it input frames. Everything below this file is
 * headless and testable.
 */

import { PlaceholderSpriteProvider, domCanvasFactory } from '@core/assets';
import { Camera } from '@core/camera';
import { InputDevice } from '@core/input';
import { GameLoop, browserLoopOptions } from '@core/loop';
import { Canvas2DRenderer } from '@core/canvas-renderer';
import { createRandom } from '@core/rng';
import { Run } from '@game/run';
import type { RunConfig } from '@game/run';
import { LEVELS } from '@content/levels';
import { CREATURES } from '@content/entities';
import { ITEMS } from '@content/items';
import { CONTAINERS, LOOT_TABLES } from '@content/loot-tables';
import { paletteOf } from '@content/palettes';
import { FALLBACK_SPRITE, SPRITES } from '@content/sprites';
import {
  AXIS_BINDINGS,
  CAMERA,
  GEOMETRY,
  INTERACTION,
  INVENTORY,
  KEY_BINDINGS,
  LIGHTING,
  NOISE,
  PLAYER,
  SIM,
  SOUND,
  STATS,
  STREAM,
  VISION,
} from '@content/tuning';
import { WorldView } from '@view/world-view';
import { Hud } from './hud';
import { InventoryUi } from './inventory-ui';

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

export const runConfigFor = (seed: number): RunConfig => ({
  seed,
  content: {
    levels: LEVELS,
    items: ITEMS,
    containers: CONTAINERS,
    loot: LOOT_TABLES,
    creatures: CREATURES,
  },
  geometry: GEOMETRY,
  stream: STREAM,
  player: PLAYER,
  stats: STATS,
  inventory: INVENTORY,
  lighting: LIGHTING,
  sound: SOUND,
  noise: NOISE,
  interaction: INTERACTION,
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
  private readonly overlay: HTMLElement;
  private readonly hud: Hud;
  private readonly bag: InventoryUi;
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

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.appendChild(this.overlay);
    this.hud = new Hud(this.overlay);
    this.bag = new InventoryUi(this.overlay, this.run.inventory, ITEMS, {
      cellPixels: INVENTORY.cellPixels,
    });

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
    const frame = this.input.sample(world.x, world.y);
    if (frame.pressed.includes('inventory')) this.bag.toggle();
    this.run.step(frame);
    this.camera.follow(this.run.player.x, this.run.player.y, CAMERA.smoothing);
  }

  private render(alpha: number): void {
    const view = this.camera.view(alpha);
    this.worldView.draw(this.run, view, alpha, {
      lighting: LIGHTING,
      palette: paletteOf(this.run.spec.paletteId),
      rays: VISION,
      derangement: this.derangement(),
    });
    this.renderer.endFrame();
    this.hud.update(this.run);
    this.bag.update();
  }

  /** 0 while the player is composed, rising as nerve runs out. */
  private derangement(): number {
    const ratio = this.run.stats.sanity / STATS.maxSanity;
    const threshold = STATS.lowSanityFraction;
    if (ratio >= threshold) return 0;
    return Math.min(1, (threshold - ratio) / threshold);
  }
}
