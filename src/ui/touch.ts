/**
 * L4: the on-screen pad.
 *
 * The input layer was always meant to take a second source — the simulation only
 * ever sees an `InputFrame`, and a held button is the same word as a held key.
 * This is that source: two thumbs and a handful of buttons, writing into the
 * same `InputDevice` a keyboard writes into. Nothing below L4 knows it exists.
 *
 * Three decisions shape it. The sticks are **floating**: they appear wherever the
 * thumb lands inside their half of the screen, because a fixed pad is a thing you
 * have to look down and find. Sprinting is the **far end of the movement stick**
 * rather than a button, because there are only two thumbs and both are already
 * holding something. And the two hand buttons carry the **icon of what is in that
 * hand**, which lets the hands panel — a readout that costs a corner — go away
 * entirely while a pad is up.
 *
 * The pad appears when a touch happens and leaves when a mouse or a key is used.
 * A laptop with a touchscreen therefore shows it only once someone actually
 * touches the screen, and hides it again the moment they go back to the keys.
 */

import type { InputDevice } from '@core/input';
import type { Run } from '@game/run';
import { equippedStack } from '@game/inventory';
import type { TouchConfig, TouchMode } from '@content/view';
import type { UiContext } from './context';
import { el, setStyle } from './dom';

/** One button on the pad: what it does, and the mark it wears. */
interface ButtonSpec {
  readonly action: string;
  readonly glyph: string;
  readonly variant?: string;
  /** A toggle stays down when released — crouch is a stance, not a squeeze. */
  readonly toggle?: boolean;
}

/**
 * The mark each action wears on the pad. Every hint that would otherwise name a
 * key reads this instead once the pad is up: "◎ — pick up" is true on a phone in
 * a way that "Space — pick up" is not.
 */
export const TOUCH_GLYPHS: Readonly<Record<string, string>> = {
  interact: '◎',
  flashlight: '☀',
  inventory: '▦',
  crouch: '⌄',
  throwItem: '➤',
  drop: '⤓',
  swapHands: '⇄',
  pause: '❚❚',
  handMain: '✱',
  handOff: '✲',
};

/** Every action the pad can reach, for the test that checks each one is named. */
export const TOUCH_ACTIONS: readonly string[] = [
  'interact',
  'handMain',
  'handOff',
  'flashlight',
  'inventory',
  'crouch',
  'throwItem',
  'drop',
  'swapHands',
  'pause',
  'sprint',
];

/**
 * Order is layout: the pad is a three-wide grid, so the last of these lands
 * nearest the thumb that is holding the aim stick. That is where the button
 * pressed most often — search, pick up, take the way down — belongs.
 */
const BUTTONS: readonly ButtonSpec[] = [
  { action: 'handMain', glyph: '', variant: 'hand' },
  { action: 'handOff', glyph: '', variant: 'hand' },
  { action: 'flashlight', glyph: '☀' },
  { action: 'inventory', glyph: '▦' },
  { action: 'crouch', glyph: '⌄', toggle: true },
  { action: 'interact', glyph: '◎', variant: 'primary' },
  { action: 'throwItem', glyph: '➤', variant: 'small' },
  { action: 'drop', glyph: '⤓', variant: 'small' },
  { action: 'swapHands', glyph: '⇄', variant: 'small' },
  { action: 'pause', glyph: '❚❚', variant: 'small' },
];

/** A finger on a stick: where it landed, and where it has been dragged to. */
interface Stick {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  x: number;
  y: number;
}

interface StickView {
  readonly base: HTMLElement;
  readonly knob: HTMLElement;
}

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly views: { readonly move: StickView; readonly aim: StickView };
  private readonly buttons = new Map<string, HTMLElement>();
  private readonly icons = new Map<string, HTMLElement>();
  private move: Stick | null = null;
  private aim: Stick | null = null;
  /** The last direction the player was pointed in; never resets to nothing. */
  private aimX = 1;
  private aimY = 0;
  private crouched = false;
  private mode: TouchMode = 'auto';
  /** True once a touch has actually happened, in auto mode. */
  private touched = false;
  private context = false;
  private shown = false;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly input: InputDevice,
    private readonly config: TouchConfig,
  ) {
    this.root = el('div', 'touch', parent);
    setStyle(this.root, '--touch-stick', `${config.stickRadius}px`);
    const zones = el('div', 'touch-zones', this.root);
    const moveZone = el('div', 'touch-zone touch-zone--move', zones);
    const aimZone = el('div', 'touch-zone touch-zone--aim', zones);
    this.views = { move: this.buildStick('move'), aim: this.buildStick('aim') };
    this.buildButtons();

    moveZone.addEventListener('pointerdown', (event) => this.grab(event, 'move'));
    aimZone.addEventListener('pointerdown', (event) => this.grab(event, 'aim'));
    for (const type of ['pointermove', 'pointerup', 'pointercancel'] as const) {
      window.addEventListener(type, this.onPointer);
    }
    // A pad that stays up while its owner types is a pad in the way.
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.onAnyPointer, true);
    this.setVisible(false);
  }

  /** `auto` follows what the player last used; the other two are their word. */
  setMode(mode: TouchMode): void {
    this.mode = mode;
    this.refresh();
  }

  /** Whether the world is being played right now, which is when a pad belongs. */
  setContext(playing: boolean): void {
    this.context = playing;
    this.refresh();
  }

  /** True when the pad is up, so the interface can give it the room it needs. */
  get active(): boolean {
    return this.shown;
  }

  /**
   * True while the player is driving with fingers, whether or not the pad is on
   * screen this instant — with the bag open it is not, and the bag still has to
   * explain itself to a finger rather than to a mouse.
   */
  get usingTouch(): boolean {
    return this.mode === 'on' || (this.mode === 'auto' && this.touched);
  }

  /**
   * Where the player is pointed, as a world position. The aim stick wins; with
   * no thumb on it the player faces the way they are walking, and standing still
   * holds the last direction rather than snapping to anything.
   */
  aimAt(playerX: number, playerY: number): { x: number; y: number } {
    return {
      x: playerX + this.aimX * this.config.aimDistance,
      y: playerY + this.aimY * this.config.aimDistance,
    };
  }

  /** Repaints what the buttons carry: the two hands, and whether the torch burns. */
  update(run: Run): void {
    if (!this.shown) return;
    const catalog = run.config.content.items;
    for (const slot of ['hand', 'offhand'] as const) {
      const action = slot === 'hand' ? 'handMain' : 'handOff';
      const icon = this.icons.get(action);
      if (!icon) continue;
      const stack = equippedStack(run.inventory, slot);
      const def = stack ? catalog[stack.itemId] : undefined;
      this.ui.icons.paint(icon, def ? def.sprite : null);
      // The mark is what an empty hand looks like; a full one shows what is in it.
      this.buttons.get(action)?.classList.toggle('touch-button--empty', !stack);
      this.buttons.get(action)?.classList.toggle('touch-button--carrying', !!stack);
    }
    this.buttons.get('flashlight')?.classList.toggle('touch-button--lit', run.flashlightOn);
    this.buttons.get('crouch')?.classList.toggle('touch-button--on', this.crouched);
  }

  // ── construction ──────────────────────────────────────────────────────────

  private buildStick(kind: 'move' | 'aim'): StickView {
    const base = el('div', `touch-stick touch-stick--${kind}`, this.root);
    return { base, knob: el('div', 'touch-knob', base) };
  }

  private buildButtons(): void {
    const pad = el('div', 'touch-pad', this.root);
    const strip = el('div', 'touch-strip', this.root);
    for (const spec of BUTTONS) {
      const small = spec.variant === 'small';
      const button = el('button', `touch-button${spec.variant ? ` touch-button--${spec.variant}` : ''}`, small ? strip : pad);
      button.type = 'button';
      // The glyph is a mark, not a word; the name behind it is translated.
      this.ui.binder.bindAttribute(button, 'aria-label', `action.${spec.action}`);
      const glyph = el('span', 'touch-button-glyph', button);
      glyph.textContent = spec.variant === 'hand' ? TOUCH_GLYPHS[spec.action] : spec.glyph;
      if (spec.variant === 'hand') this.icons.set(spec.action, el('span', 'touch-button-icon', button));
      button.addEventListener('pointerdown', (event) => this.press(event, spec));
      button.addEventListener('pointerup', () => this.release(spec));
      button.addEventListener('pointercancel', () => this.release(spec));
      button.addEventListener('pointerleave', () => this.release(spec));
      // A long press on a button is a button, not a text selection or a menu.
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      this.buttons.set(spec.action, button);
    }
  }

  // ── buttons ───────────────────────────────────────────────────────────────

  private press(event: PointerEvent, spec: ButtonSpec): void {
    event.preventDefault();
    this.noteTouch(event);
    if (spec.toggle) {
      this.crouched = !this.crouched;
      this.input.setVirtualAction(spec.action, this.crouched);
      return;
    }
    this.input.setVirtualAction(spec.action, true);
  }

  private release(spec: ButtonSpec): void {
    if (spec.toggle) return;
    this.input.setVirtualAction(spec.action, false);
  }

  // ── sticks ────────────────────────────────────────────────────────────────

  private grab(event: PointerEvent, kind: 'move' | 'aim'): void {
    event.preventDefault();
    this.noteTouch(event);
    if (!this.shown) return;
    const stick: Stick = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      x: 0,
      y: 0,
    };
    if (kind === 'move') this.move = stick;
    else this.aim = stick;
    this.paintStick(kind, stick);
  }

  private readonly onPointer = (event: PointerEvent): void => {
    const kind = this.move?.pointerId === event.pointerId
      ? 'move'
      : this.aim?.pointerId === event.pointerId
        ? 'aim'
        : null;
    if (!kind) return;
    const stick = kind === 'move' ? this.move : this.aim;
    if (!stick) return;
    if (event.type === 'pointermove') {
      const { x, y } = this.vectorFor(stick, event.clientX, event.clientY);
      stick.x = x;
      stick.y = y;
      this.paintStick(kind, stick);
      this.applyStick(kind, stick);
      return;
    }
    // Released: movement stops dead, aim keeps pointing where it was left.
    if (kind === 'move') {
      this.move = null;
      this.input.setStick(null, null);
      this.input.setVirtualAction('sprint', false);
    } else {
      this.aim = null;
    }
    setStyle(kind === 'move' ? this.views.move.base : this.views.aim.base, 'display', 'none');
  };

  /** The thumb's offset from where it landed, clamped and dead-zoned. */
  private vectorFor(stick: Stick, clientX: number, clientY: number): { x: number; y: number } {
    const radius = Math.max(1, this.config.stickRadius);
    const dx = (clientX - stick.originX) / radius;
    const dy = (clientY - stick.originY) / radius;
    const length = Math.hypot(dx, dy);
    if (length <= this.config.deadZone) return { x: 0, y: 0 };
    const scale = (length > 1 ? 1 / length : 1);
    return { x: dx * scale, y: dy * scale };
  }

  private applyStick(kind: 'move' | 'aim', stick: Stick): void {
    if (kind === 'move') {
      this.input.setStick(stick.x, stick.y);
      const length = Math.hypot(stick.x, stick.y);
      this.input.setVirtualAction('sprint', length >= this.config.sprintAt);
      // Walking is also looking, until a thumb says otherwise.
      if (!this.aim && length > 0) {
        this.aimX = stick.x / length;
        this.aimY = stick.y / length;
      }
      return;
    }
    const length = Math.hypot(stick.x, stick.y);
    if (length > 0) {
      this.aimX = stick.x / length;
      this.aimY = stick.y / length;
    }
  }

  private paintStick(kind: 'move' | 'aim', stick: Stick): void {
    const view = kind === 'move' ? this.views.move : this.views.aim;
    const radius = this.config.stickRadius;
    const rect = this.root.getBoundingClientRect();
    setStyle(view.base, 'display', 'block');
    setStyle(view.base, 'left', `${stick.originX - rect.left}px`);
    setStyle(view.base, 'top', `${stick.originY - rect.top}px`);
    setStyle(view.knob, 'transform', `translate(${stick.x * radius}px, ${stick.y * radius}px)`);
  }

  // ── mode ──────────────────────────────────────────────────────────────────

  private readonly onAnyPointer = (event: PointerEvent): void => {
    this.noteTouch(event);
  };

  private noteTouch(event: PointerEvent): void {
    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (isTouch === this.touched) return;
    this.touched = isTouch;
    this.refresh();
  }

  private readonly onKey = (): void => {
    if (!this.touched) return;
    this.touched = false;
    this.refresh();
  };

  private refresh(): void {
    const wanted =
      this.context && (this.mode === 'on' || (this.mode === 'auto' && this.touched));
    if (wanted !== this.shown) this.setVisible(wanted);
  }

  private setVisible(visible: boolean): void {
    this.shown = visible;
    setStyle(this.root, 'display', visible ? 'block' : 'none');
    document.documentElement.dataset.touch = visible ? 'on' : 'off';
    if (visible) return;
    // Everything it was holding goes with it, or the player walks into a wall
    // for as long as the bag is open.
    this.move = null;
    this.aim = null;
    this.crouched = false;
    this.input.releaseVirtual();
    setStyle(this.views.move.base, 'display', 'none');
    setStyle(this.views.aim.base, 'display', 'none');
  }
}
