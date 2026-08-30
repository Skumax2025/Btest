/**
 * L4: the application and its state machine.
 *
 * Owns the browser (canvas, DOM, real time) and decides which of the five states
 * the game is in. The simulation advances in exactly one of them, PLAYING, so a
 * pause or an open guidebook stops the world completely — stats, timers,
 * creatures and the ambient hum alike.
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
import {
  Run,
  SAVE_VERSION,
  dropStack,
  equipStack,
  restoreRun,
  snapshotRun,
  unequipStack,
  useStack,
} from '@game/run';
import type { RunSave } from '@game/run';
import { ITEMS } from '@content/items';
import { DEFAULT_LOCALE, LOCALES } from '@content/locales';
import { GUIDE_SECTIONS } from '@content/guide';
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
import { GuidebookScreen } from './guidebook';
import { Hud } from './hud';
import { InventoryUi } from './inventory-ui';
import { MenuScreen } from './menu';
import { SettingsScreen } from './settings';
import { SummaryScreen } from './summary';
import { clearSettings, loadSettings, saveSettings } from './settings-store';
import type { GameSettings } from './settings-store';

const SAVE_KEY = 'backrooms.run';

export type AppState = 'menu' | 'playing' | 'paused' | 'guide' | 'dead';

export class App {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Canvas2DRenderer;
  private readonly camera = new Camera();
  private readonly input: InputDevice;
  private readonly worldView: WorldView;
  private readonly loop: GameLoop;
  private readonly overlay: HTMLElement;
  private readonly storage: StorageLike = bestEffortStorage();
  private readonly localizer = new Localizer(LOCALES, DEFAULT_LOCALE);
  private readonly ui: UiContext;
  private readonly audio = new WebAudio(AUDIO.masterGain);
  private readonly audioView: AudioView;
  private readonly hud: Hud;
  private readonly worldTooltip: HTMLElement;
  private readonly bag: InventoryUi;
  private readonly summary: SummaryScreen;
  private readonly debug: DebugOverlay;
  private readonly menu: MenuScreen;
  private readonly settingsScreen: SettingsScreen;
  private readonly guide: GuidebookScreen;

  private settings: GameSettings;
  private state: AppState = 'menu';
  private run: Run;
  /** False until a run has actually been entered; the menu reads it. */
  private runActive = false;
  private lastHealth = Number.POSITIVE_INFINITY;

  constructor(private readonly root: HTMLElement) {
    this.settings = loadSettings(this.storage);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    root.appendChild(this.canvas);

    this.renderer = new Canvas2DRenderer(this.canvas, CAMERA.maxPixelRatio);
    this.input = new InputDevice(this.settings.bindings ?? KEY_BINDINGS, AXIS_BINDINGS);
    this.input.attach(this.canvas, window);
    this.worldView = new WorldView(
      this.renderer,
      new PlaceholderSpriteProvider(SPRITES, domCanvasFactory, FALLBACK_SPRITE),
      VIEW.light.cacheLimit,
    );
    this.camera.zoom = CAMERA.zoom;

    const restored = this.loadSave();
    this.run = restored ?? this.freshRun();
    this.runActive = restored !== null;
    this.camera.snapTo(this.run.player.x, this.run.player.y);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.appendChild(this.overlay);

    this.ui = createUiContext(this.localizer, () => this.input.getBindings());
    this.localizer.onChange(() => {
      this.ui.binder.refresh();
      this.menu.refresh();
      this.guide.refresh();
    });

    this.hud = new Hud(this.overlay, this.ui, VIEW.hud);
    this.worldTooltip = document.createElement('div');
    this.worldTooltip.className = 'world-tooltip';
    this.worldTooltip.hidden = true;
    this.overlay.appendChild(this.worldTooltip);
    this.summary = new SummaryScreen(this.overlay, this.ui);
    this.debug = new DebugOverlay(this.overlay);
    this.bag = new InventoryUi(
      this.overlay,
      this.run.inventory,
      ITEMS,
      { cellPixels: INVENTORY.cellPixels, columns: INVENTORY.columns },
      this.ui,
      {
        use: (id) => useStack(this.run, id),
        equip: (id, slot) => equipStack(this.run, id, slot),
        unequip: (id) => unequipStack(this.run, id),
        drop: (id) => dropStack(this.run, id),
      },
    );
    this.menu = new MenuScreen(this.overlay, this.ui, {
      onContinue: () => this.enterRun(),
      onNewRun: () => this.startNewRun(),
      onGuide: () => this.setState('guide'),
      onSettings: () => this.settingsScreen.open(),
      onResume: () => this.enterRun(),
      onToMenu: () => this.setState('menu'),
    });
    this.settingsScreen = new SettingsScreen(
      this.overlay,
      this.ui,
      this.localizer,
      this.input,
      this.settings,
      {
        onChange: (settings) => this.applySettings(settings),
        onWipeRun: () => this.wipeRun(),
        onWipeSettings: () => this.wipeSettings(),
        onClose: () => this.settingsScreen.close(),
      },
    );
    this.guide = new GuidebookScreen(this.overlay, this.ui, GUIDE_SECTIONS, () =>
      this.setState(this.runActive ? 'paused' : 'menu'),
    );
    this.audioView = new AudioView(this.audio, LIGHTING);

    const wake = (): void => this.audio.resume();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('resize', this.resize);
    window.addEventListener('beforeunload', () => this.persist());
    this.resize();

    this.applySettings(this.settings);
    this.setState('menu');

    this.loop = new GameLoop(browserLoopOptions(SIM.stepMs, SIM.maxFrameMs), {
      fixedUpdate: () => this.fixedUpdate(),
      render: (alpha) => this.render(alpha),
    });
  }

  start(): void {
    this.loop.start();
  }

  // ── state ────────────────────────────────────────────────────────────────

  private setState(next: AppState): void {
    this.state = next;
    this.input.releaseAll();
    this.menu.close();
    this.guide.close();
    if (next !== 'menu' && next !== 'paused') this.settingsScreen.close();

    if (next === 'menu') this.menu.open('main', this.runActive || this.hasSave());
    else if (next === 'paused') this.menu.open('pause', true);
    else if (next === 'guide') this.guide.open();
    else if (next === 'playing') this.bag.setOpen(false);
    // The world only makes noise while it is running.
    if (next !== 'playing') this.audio.setDrone(AUDIO.droneFrequency, 0, 0);
  }

  private enterRun(): void {
    this.runActive = true;
    this.setState('playing');
  }

  private startNewRun(): void {
    clearEnvelope(this.storage, SAVE_KEY);
    this.swapRun(this.freshRun());
    this.enterRun();
  }

  private swapRun(run: Run): void {
    this.run = run;
    this.camera.snapTo(run.player.x, run.player.y);
    this.bag.setState(run.inventory);
    this.bag.setOpen(false);
    this.audioView.reset();
    this.lastHealth = Number.POSITIVE_INFINITY;
  }

  private freshRun(): Run {
    return new Run(createRunConfig(createRandom(Date.now()).nextUint32()));
  }

  private hasSave(): boolean {
    return loadEnvelope<RunSave>(this.storage, SAVE_KEY, SAVE_VERSION) !== null;
  }

  private loadSave(): Run | null {
    const saved = loadEnvelope<RunSave>(this.storage, SAVE_KEY, SAVE_VERSION);
    if (!saved || saved.phase !== 'alive') return null;
    const run = new Run(createRunConfig(saved.seed));
    restoreRun(run, saved);
    return run;
  }

  private persist(): void {
    if (!this.runActive || this.run.phase !== 'alive') {
      clearEnvelope(this.storage, SAVE_KEY);
      return;
    }
    saveEnvelope(this.storage, SAVE_KEY, SAVE_VERSION, snapshotRun(this.run));
  }

  private wipeRun(): void {
    clearEnvelope(this.storage, SAVE_KEY);
    this.runActive = false;
    this.swapRun(this.freshRun());
  }

  private wipeSettings(): void {
    clearSettings(this.storage);
    this.settings = loadSettings(this.storage);
    for (const [action, codes] of Object.entries(this.settings.bindings)) {
      this.input.rebind(action, codes);
    }
    this.applySettings(this.settings);
  }

  // ── settings ─────────────────────────────────────────────────────────────

  private applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.localizer.setLocale(settings.locale);
    this.audio.setVolumes(settings.volumeMaster, settings.volumeEffects, settings.volumeAmbient);
    this.canvas.style.filter = `brightness(${settings.brightness})`;
    this.overlay.style.setProperty('--ui-scale', String(settings.uiScale));
    this.debug.setVisible(settings.debugOverlay);
    saveSettings(this.storage, settings);
  }

  private readonly resize = (): void => {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.renderer.resize(width, height);
    this.camera.resize(width, height);
  };

  // ── the tick ─────────────────────────────────────────────────────────────

  private fixedUpdate(): void {
    const pointer = this.input.pointerScreen;
    const world = this.camera.screenToWorld(pointer.x, pointer.y);
    const frame = this.input.sample(world.x, world.y);

    if (this.state !== 'playing') {
      this.routeToScreens(frame.pressed);
      return;
    }

    if (frame.pressed.includes('pause')) {
      this.setState('paused');
      return;
    }
    if (frame.pressed.includes('guide')) {
      this.setState('guide');
      return;
    }
    if (frame.pressed.includes('inventory')) {
      this.bag.toggle();
      this.input.releaseAll();
    }
    if (frame.pressed.includes('debug')) {
      this.applySettings({ ...this.settings, debugOverlay: !this.settings.debugOverlay });
    }

    this.run.step(frame);
    // Getting hit is the one thing that shakes the camera; it reads before the
    // health bar does.
    if (this.run.stats.health < this.lastHealth - 0.5) this.camera.addShake(CAMERA.hitShake);
    this.lastHealth = this.run.stats.health;
    this.camera.follow(this.run.player.x, this.run.player.y, CAMERA.smoothing);
    if (this.run.tick % SIM.autosaveTicks === 0) this.persist();
    if (this.run.phase === 'dead') {
      this.persist();
      this.setState('dead');
    }
  }

  /** Menus are driven by the same actions the player walks with. */
  private routeToScreens(pressed: readonly string[]): void {
    for (const action of pressed) {
      if (this.settingsScreen.visible && this.settingsScreen.handleAction(action)) continue;
      if (this.guide.visible && this.guide.handleAction(action)) continue;
      if (this.menu.visible && this.menu.handleAction(action)) continue;
      if (this.state === 'dead') {
        if (action === 'restart') this.startNewRun();
        else if (action === 'pause') this.setState('menu');
      }
    }
  }

  private render(alpha: number): void {
    this.camera.updateShake(
      CAMERA.shakeDecay,
      Math.sin(this.run.tick * 12.9898),
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
      prompt:
        this.run.hint && this.run.hintTarget
          ? { ...this.run.hintTarget, text: this.hud.promptFor(this.run.hint) }
          : null,
    });
    if (this.settings.debugOverlay) drawDebug(this.renderer, this.run, view, alpha);
    this.renderer.endFrame();

    const playing = this.state === 'playing';
    this.overlay.classList.toggle('overlay--dimmed', !playing && this.state !== 'dead');
    this.hud.setVisible(playing);
    this.hud.update(this.run);
    this.updateWorldTooltip();
    this.bag.update();
    this.summary.setVisible(this.state === 'dead');
    this.summary.update(this.run);
    this.debug.update(this.run, this.loop.stats, window.devicePixelRatio || 1);
    if (playing) this.audioView.update(this.run, derangement);
  }

  private updateWorldTooltip(): void {
    if (this.state !== 'playing' || this.bag.isOpen) {
      this.worldTooltip.hidden = true;
      return;
    }
    const pointer = this.input.pointerScreen;
    const world = this.camera.screenToWorld(pointer.x, pointer.y);
    const nearest = this.run.groundItemsNear(world.x, world.y, 22).sort((a, b) => Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y))[0];
    const def = nearest ? this.run.config.content.items[nearest.itemId] : undefined;
    if (!nearest || !def || Math.hypot(nearest.x - world.x, nearest.y - world.y) > 14) {
      this.worldTooltip.hidden = true;
      return;
    }
    const name = this.localizer.t(def.nameKey);
    const desc = this.localizer.t(def.descriptionKey);
    this.worldTooltip.textContent = `${name}\n${desc}`;
    this.worldTooltip.style.left = `${pointer.x + 18}px`;
    this.worldTooltip.style.top = `${pointer.y + 18}px`;
    this.worldTooltip.hidden = false;
  }

  /** 0 while the player is composed, rising as nerve runs out. */
  private derangement(): number {
    const ratio = this.run.stats.sanity / STATS.maxSanity;
    const threshold = STATS.lowSanityFraction;
    if (ratio >= threshold) return 0;
    return Math.min(1, (threshold - ratio) / threshold);
  }
}
