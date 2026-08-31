/**
 * L4: the shared shell every full-screen panel sits in, plus the three widgets
 * they are built from. One implementation, used by the menu, the settings and
 * the guidebook — the settings screen in particular has to be the same code
 * whether it was opened from the main menu or from a pause.
 */

import type { UiContext } from './context';
import { el, setStyle, setText } from './dom';

export class Screen {
  readonly root: HTMLElement;
  private shown = false;

  constructor(parent: HTMLElement, className: string) {
    this.root = el('div', `screen ${className}`, parent);
    this.setVisible(false);
  }

  get visible(): boolean {
    return this.shown;
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    setStyle(this.root, 'display', visible ? 'flex' : 'none');
  }
}

export interface MenuItem {
  readonly element: HTMLButtonElement;
  readonly activate: () => void;
  enabled: boolean;
}

/** A keyboard- and mouse-navigable column of choices. */
export class MenuList {
  private readonly items: MenuItem[] = [];
  private index = 0;

  constructor(readonly root: HTMLElement) {}

  add(ui: UiContext, key: string, activate: () => void): MenuItem {
    const element = el('button', 'menu-item', this.root);
    element.type = 'button';
    ui.binder.bind(element, key);
    const item: MenuItem = { element, activate, enabled: true };
    element.addEventListener('click', () => {
      if (item.enabled) activate();
    });
    element.addEventListener('pointerenter', () => {
      this.index = this.items.indexOf(item);
      this.paint();
    });
    this.items.push(item);
    this.paint();
    return item;
  }

  setEnabled(item: MenuItem, enabled: boolean): void {
    item.enabled = enabled;
    item.element.classList.toggle('menu-item--disabled', !enabled);
    if (!enabled && this.items[this.index] === item) this.move(1);
    this.paint();
  }

  move(delta: number): void {
    if (this.items.length === 0) return;
    for (let step = 0; step < this.items.length; step++) {
      this.index = (this.index + delta + this.items.length) % this.items.length;
      if (this.items[this.index].enabled) break;
    }
    this.paint();
  }

  activate(): void {
    const item = this.items[this.index];
    if (item?.enabled) item.activate();
  }

  /** Called when the screen opens, so the cursor never starts on a dead row. */
  reset(): void {
    this.index = this.items.findIndex((item) => item.enabled);
    if (this.index < 0) this.index = 0;
    this.paint();
  }

  private paint(): void {
    this.items.forEach((item, i) => {
      item.element.classList.toggle('menu-item--active', i === this.index);
    });
  }
}

export interface SliderOptions {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** A labelled slider that reports its value as a percentage of the range. */
export const slider = (
  parent: HTMLElement,
  ui: UiContext,
  labelKey: string,
  options: SliderOptions,
  value: number,
  onChange: (value: number) => void,
): HTMLInputElement => {
  const row = el('div', 'setting-row', parent);
  ui.binder.bind(el('span', 'setting-label', row), labelKey);
  const input = el('input', 'setting-slider', row);
  input.type = 'range';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(value);
  const readout = el('span', 'setting-value', row);
  const paint = (): void => {
    setText(readout, ui.t('ui.percent', { value: Math.round(Number(input.value) * 100) }));
  };
  input.addEventListener('input', () => {
    onChange(Number(input.value));
    paint();
  });
  paint();
  return input;
};

/**
 * A row of mutually exclusive buttons. The language row had one of these built
 * into it; this is the same thing with its labels taken from the dictionary, so
 * the second setting that needs one does not grow a second implementation.
 */
export const choice = <T extends string>(
  parent: HTMLElement,
  ui: UiContext,
  labelKey: string,
  options: ReadonlyArray<{ readonly value: T; readonly labelKey: string }>,
  value: T,
  onChange: (value: T) => void,
): void => {
  const row = el('div', 'setting-row', parent);
  ui.binder.bind(el('span', 'setting-label', row), labelKey);
  const choices = el('div', 'setting-choices', row);
  let current = value;
  const buttons = options.map((option) => {
    const button = el('button', 'setting-choice', choices);
    button.type = 'button';
    ui.binder.bind(button, option.labelKey);
    button.addEventListener('click', () => {
      current = option.value;
      onChange(current);
      paint();
    });
    return button;
  });
  const paint = (): void => {
    buttons.forEach((button, index) => {
      button.classList.toggle('setting-choice--active', options[index].value === current);
    });
  };
  paint();
};

export const toggle = (
  parent: HTMLElement,
  ui: UiContext,
  labelKey: string,
  value: boolean,
  onChange: (value: boolean) => void,
): HTMLButtonElement => {
  const row = el('div', 'setting-row', parent);
  ui.binder.bind(el('span', 'setting-label', row), labelKey);
  const button = el('button', 'setting-toggle', row);
  button.type = 'button';
  let current = value;
  const paint = (): void => setText(button, ui.t(current ? 'ui.on' : 'ui.off'));
  button.addEventListener('click', () => {
    current = !current;
    onChange(current);
    paint();
  });
  paint();
  return button;
};
