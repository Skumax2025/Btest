/**
 * L4: the application. Owns the browser (canvas, DOM, real time), builds a run
 * from content and feeds it input frames. Everything below this file is
 * headless and testable.
 */

import { PlaceholderSpriteProvider, domCanvasFactory } from '@core/assets';
import { WebAudio } from '@core/audio';
import { Camera } from '@core/camera';
import { InputDevice } from '@core/input';
import { GameLoop, browserLoopOptions } from '@core/loop';
import { Canvas2DRenderer } from '@core/canvas-renderer';
import { Localizer } from '@core/i18n';
import { createRandom } from '@core/rng';
import { bestEffortStorage, clearEnvelope, loadEnvelope, saveEnvelope } from '@core/serialize';
import type { StorageLike } from '@core/serialize';
import { Run, SAVE_VERSION, restoreRun, snapshotRun } from '@game/run';
import type { RunSave } from '@game/run';
import { ITEMS } from '@content/items';
import { DEFAULT_LOCALE, LOCALES } from '@content/locales';
import { createRunConfig } from '@content/run-config';
import { AUDIO } from '@content/audio';
import { paletteOf } from '@content/palettes';
import { VIEW } from '@content/view';
import { FALLBACK_SPRITE, SPRITES } from '@content/sprites';
import {
  AXIS_BINDINGS,
  CAMERA,
  INVENTORY,
  KEY_BINDINGS,
  LIGHTING,
  SIM,
  STATS,
  VISION,
} from '@content/tuning';
import { WorldView } from '@view/world-view';
import { drawDebug } from '@view/debug-view';
import { AudioView } from './audio-view';
import { createUiContext } from './context';
import type { UiContext } from './context';
import { DebugOverlay } from './debug-overlay';
import { Hud } from './hud';
import { InventoryUi } from './inventory-ui';
import { SummaryScreen } from './summary';

const SAVE_KEY = 'backrooms.run';

export class App {
  private readonly renderer: Canvas2DRenderer;
  private readonly camera = new Camera();
  private readonly input: InputDevice;
  private readonly worldView: WorldView;
  private readonly loop: GameLoop;
  private readonly overlay: HTMLElement;
  private readonly hud: Hud;
  private readonly bag: InventoryUi;
  private readonly storage: StorageLike = bestEffortStorage();
  private readonly localizer = new Localizer(LOCALES, DEFAULT_LOCALE);
  private readonly ui: UiContext;
  private readonly audio = new WebAudio(AUDIO.masterGain);
  private readonly audioView: AudioView;
  private readonly summary: SummaryScreen;
  private readonly debug: DebugOverlay;
  private lastHealth = Number.POSITIVE_INFINITY;
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
      VIEW.lightCacheLimit,
    );
    this.camera.zoom = CAMERA.zoom;

    this.run = this.resumeOrStart();
    this.camera.snapTo(this.run.player.x, this.run.player.y);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.appendChild(this.overlay);
    this.ui = createUiContext(this.localizer, () => this.input.getBindings());
    this.localizer.onChange(() => this.ui.binder.refresh());
    this.hud = new Hud(this.overlay, this.ui);
    this.summary = new SummaryScreen(this.overlay, this.ui);
    this.debug = new DebugOverlay(this.overlay);
    this.audioView = new AudioView(this.audio, LIGHTING);
    const wake = (): void => this.audio.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    this.bag = new InventoryUi(
      this.overlay,
      this.run.inventory,
      ITEMS,
      { cellPixels: INVENTORY.cellPixels },
      this.ui,
    );

    window.addEventListener('resize', this.resize);
    this.resize();

    this.loop = new GameLoop(browserLoopOptions(SIM.stepMs, SIM.maxFrameMs), {
      fixedUpdate: () => this.fixedUpdate(),
      render: (alpha) => this.render(alpha),
    });
    window.addEventListener('beforeunload', () => this.persist());
  }

  /** A reload drops the player back exactly where they were, mid-run. */
  private resumeOrStart(): Run {
    const saved = loadEnvelope<RunSave>(this.storage, SAVE_KEY, SAVE_VERSION);
    if (saved && saved.phase === 'alive') {
      const resumed = new Run(createRunConfig(saved.seed));
      restoreRun(resumed, saved);
      return resumed;
    }
    return new Run(createRunConfig(createRandom(Date.now()).nextUint32()));
  }

  private persist(): void {
    if (this.run.phase !== 'alive') {
      clearEnvelope(this.storage, SAVE_KEY);
      return;
    }
    saveEnvelope(this.storage, SAVE_KEY, SAVE_VERSION, snapshotRun(this.run));
  }

  /** Death is permanent: a new run means a new seed and an empty save slot. */
  restart(): void {
    clearEnvelope(this.storage, SAVE_KEY);
    this.run = new Run(createRunConfig(createRandom(Date.now()).nextUint32()));
    this.camera.snapTo(this.run.player.x, this.run.player.y);
    this.bag.setState(this.run.inventory);
    this.bag.setOpen(false);
    this.summary.update(this.run);
    this.audioView.reset();
    this.lastHealth = Number.POSITIVE_INFINITY;
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
    if (frame.pressed.includes('inventory')) {
      this.bag.toggle();
      // Keys held while the panel opens must not stay held behind it.
      this.input.releaseAll();
    }
    if (frame.pressed.includes('debug')) this.debug.toggle();
    if (frame.pressed.includes('language')) this.cycleLanguage();
    if (this.run.phase === 'dead' && frame.pressed.includes('restart')) {
      this.restart();
      return;
    }
    this.run.step(frame);
    // Getting hit is the one thing that shakes the camera; it reads before the
    // health bar does.
    if (this.run.stats.health < this.lastHealth - 0.5) this.camera.addShake(CAMERA.hitShake);
    this.lastHealth = this.run.stats.health;
    this.camera.follow(this.run.player.x, this.run.player.y, CAMERA.smoothing);
    if (this.run.tick % SIM.autosaveTicks === 0) this.persist();
  }

  private render(alpha: number): void {
    this.camera.updateShake(
      CAMERA.shakeDecay,
      Math.sin(this.run.tick * 12.9898) ,
      Math.cos(this.run.tick * 78.233),
    );
    const view = this.camera.view(alpha);
    const derangement = this.derangement();
    this.worldView.draw(this.run, view, alpha, {
      lighting: LIGHTING,
      palette: paletteOf(this.run.spec.paletteId),
      rays: VISION,
      losRadius: LIGHTING.losRadius,
      derangement,
      view: VIEW,
    });
    if (this.debug.isVisible) drawDebug(this.renderer, this.run, view, alpha);
    this.renderer.endFrame();
    // The run summary replaces the HUD rather than sitting on top of it.
    this.hud.setVisible(this.run.phase === 'alive');
    this.hud.update(this.run);
    this.bag.update();
    this.summary.update(this.run);
    this.debug.update(this.run, this.loop.stats, window.devicePixelRatio || 1);
    this.audioView.update(this.run, derangement);
  }

  /** Temporary until the settings screen exists: step through the locales. */
  private cycleLanguage(): void {
    const ids = this.localizer.available().map((locale) => locale.id);
    const next = ids[(ids.indexOf(this.localizer.localeId) + 1) % ids.length];
    this.localizer.setLocale(next);
  }

  /** 0 while the player is composed, rising as nerve runs out. */
  private derangement(): number {
    const ratio = this.run.stats.sanity / STATS.maxSanity;
    const threshold = STATS.lowSanityFraction;
    if (ratio >= threshold) return 0;
    return Math.min(1, (threshold - ratio) / threshold);
  }
}
