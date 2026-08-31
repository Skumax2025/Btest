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
  useQuickSlot,
  useStack,
} from '@game/run';
import type { RunSave } from '@game/run';
import { ITEMS } from '@content/items';
import { DEFAULT_LOCALE, LOCALES } from '@content/locales';
import { GUIDE_SECTIONS } from '@content/guide';
import { createRunConfig, createSandboxConfig } from '@content/run-config';
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
import { IconSource } from './icons';
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
  private readonly sprites: PlaceholderSpriteProvider;
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
  private readonly worldTooltipIcon: HTMLElement;
  private readonly worldTooltipText: HTMLElement;
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
  /** Combat events are counted, so each one kicks the camera exactly once. */
  private lastCombatSerial = 0;

  constructor(private readonly root: HTMLElement) {
    this.settings = loadSettings(this.storage);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    root.appendChild(this.canvas);

    this.renderer = new Canvas2DRenderer(this.canvas, CAMERA.maxPixelRatio);
    this.input = new InputDevice(this.settings.bindings ?? KEY_BINDINGS, AXIS_BINDINGS);
    this.input.attach(this.canvas, window);
    // One store of art for the whole application: the world draws its canvases
    // and the interface hangs the same ones on DOM nodes as icons.
    this.sprites = new PlaceholderSpriteProvider(SPRITES, domCanvasFactory, FALLBACK_SPRITE);
    this.worldView = new WorldView(this.renderer, this.sprites, VIEW.light.cacheLimit);
    this.camera.zoom = CAMERA.zoom;

    const restored = this.loadSave();
    this.run = restored ?? this.freshRun();
    this.runActive = restored !== null;
    this.camera.snapTo(this.run.player.x, this.run.player.y);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.appendChild(this.overlay);

    this.ui = createUiContext(
      this.localizer,
      () => this.input.getBindings(),
      new IconSource(this.sprites),
    );
    this.localizer.onChange(() => {
      this.ui.binder.refresh();
      this.menu.refresh();
      this.guide.refresh();
    });

    this.hud = new Hud(this.overlay, this.ui, VIEW.hud, {
      useBelt: (index) => useQuickSlot(this.run, index, this.pointerWorld()),
      toggleControls: () =>
        this.applySettings({ ...this.settings, showControls: !this.settings.showControls }),
    });
    this.worldTooltip = document.createElement('div');
    this.worldTooltip.className = 'world-tooltip';
    this.worldTooltip.hidden = true;
    this.worldTooltipIcon = document.createElement('span');
    this.worldTooltipIcon.className = 'world-tooltip-icon';
    this.worldTooltipText = document.createElement('span');
    this.worldTooltipText.className = 'world-tooltip-text';
    this.worldTooltip.append(this.worldTooltipIcon, this.worldTooltipText);
    this.overlay.appendChild(this.worldTooltip);
    this.summary = new SummaryScreen(this.overlay, this.ui);
    this.debug = new DebugOverlay(this.overlay);
    this.bag = new InventoryUi(
      this.overlay,
      this.run.inventory,
      ITEMS,
      {
        cellPixels: INVENTORY.cellPixels,
        columns: INVENTORY.columns,
        wornFraction: INVENTORY.wornFraction,
        failingFraction: INVENTORY.failingFraction,
      },
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
      onSandbox: () => this.startSandbox(),
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

  /**
   * The test level. It is never written to storage and never touches the saved
   * run: a workshop you can walk out of and find your own game where you left it.
   */
  private startSandbox(): void {
    this.swapRun(new Run(createSandboxConfig(createRandom(Date.now()).nextUint32())));
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

  /** True while the test level is the run; it is deliberately not persisted. */
  private get inSandbox(): boolean {
    return this.run.config.sandbox !== null;
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
    // The test level is never written down: walking out of it has to leave the
    // player's own run exactly where they left it.
    if (this.inSandbox) return;
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
    this.hud.setControlsVisible(settings.showControls);
    // Rebinding a key rewrites every label that names one, here and in the bag.
    this.ui.binder.refresh();
    saveSettings(this.storage, settings);
  }

  /** Where the cursor is pointing, in world units — what a thrown thing aims at. */
  private pointerWorld(): { x: number; y: number } {
    const pointer = this.input.pointerScreen;
    return this.camera.screenToWorld(pointer.x, pointer.y);
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
    if (frame.pressed.includes('controls')) {
      this.applySettings({ ...this.settings, showControls: !this.settings.showControls });
    }
    if (frame.pressed.includes('debug')) {
      this.applySettings({ ...this.settings, debugOverlay: !this.settings.debugOverlay });
    }

    this.run.step(frame);
    // Getting hit is the loudest thing that shakes the camera; it reads before
    // the health bar does, and the screen reddens with it.
    const lost = this.lastHealth - this.run.stats.health;
    if (lost > 0.5) {
      this.camera.addShake(CAMERA.hitShake);
      this.hud.registerDamage(lost);
    }
    this.lastHealth = this.run.stats.health;
    this.shakeForCombat();
    const target = this.cameraTarget(world.x, world.y);
    this.camera.follow(target.x, target.y, CAMERA.smoothing);
    this.camera.zoomTowards(this.zoomTarget(), CAMERA.zoomSmoothing);
    if (this.run.tick % SIM.autosaveTicks === 0) this.persist();
    if (this.run.phase === 'dead') {
      this.persist();
      this.setState('dead');
    }
  }

  /**
   * The camera sits between the player and what they are aiming at, which is
   * how a top-down view shows the corridor you are about to walk into rather
   * than the one behind you. The lean is capped, so a cursor at the edge of the
   * screen never leaves the character out of it.
   */
  private cameraTarget(aimX: number, aimY: number): { x: number; y: number } {
    const { player } = this.run;
    const dx = (aimX - player.x) * CAMERA.lead;
    const dy = (aimY - player.y) * CAMERA.lead;
    const distance = Math.hypot(dx, dy);
    const scale = distance > CAMERA.maxLead ? CAMERA.maxLead / distance : 1;
    return { x: player.x + dx * scale, y: player.y + dy * scale };
  }

  /** Speed widens the view and care narrows it. Nothing else touches the zoom. */
  private zoomTarget(): number {
    const stance = this.run.player.stance;
    if (stance === 'sprint') return CAMERA.zoom * CAMERA.sprintZoom;
    if (stance === 'crouch') return CAMERA.zoom * CAMERA.crouchZoom;
    return CAMERA.zoom;
  }

  /**
   * Melee runs itself, so the swing has to be felt rather than pressed. A kick
   * per landed swing, more of one for every extra body caught, and a hard one
   * when the weapon comes apart in your hands.
   */
  private shakeForCombat(): void {
    const combat = this.run.combat;
    if (combat.eventSerial === this.lastCombatSerial) return;
    this.lastCombatSerial = combat.eventSerial;
    if (combat.event === 'hit') {
      this.camera.addShake(CAMERA.swingShake + CAMERA.swingShakePerTarget * (combat.eventCount - 1));
    } else if (combat.event === 'broke') {
      this.camera.addShake(CAMERA.breakShake);
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
    this.ui.icons.paint(this.worldTooltipIcon, def.sprite);
    this.worldTooltipText.textContent = `${name}\n${desc}`;
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
