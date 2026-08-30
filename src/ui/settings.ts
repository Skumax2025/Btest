/**
 * L4: the settings screen.
 *
 * One instance, opened from the main menu and from a pause alike — there is no
 * second copy of this panel. Every change applies the moment it is made and is
 * written to its own storage key, which is why erasing a run never costs the
 * player their language or their keys.
 */

import type { Localizer } from '@core/i18n';
import type { InputDevice } from '@core/input';
import { REBINDABLE_ACTIONS, SETTINGS_RANGES } from '@content/tuning';
import type { UiContext } from './context';
import { MenuList, Screen, slider, toggle } from './screen';
import { defaultBindings } from './settings-store';
import type { GameSettings } from './settings-store';
import { keyLabel } from './keys';
import { el, setText } from './dom';

export interface SettingsHandlers {
  readonly onChange: (settings: GameSettings) => void;
  readonly onWipeRun: () => void;
  readonly onWipeSettings: () => void;
  readonly onClose: () => void;
}

export class SettingsScreen {
  private readonly screen: Screen;
  private readonly rows = new Map<string, HTMLElement>();
  private readonly notice: HTMLElement;
  private readonly footer: MenuList;
  private listening: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly localizer: Localizer,
    private readonly input: InputDevice,
    private settings: GameSettings,
    private readonly handlers: SettingsHandlers,
  ) {
    this.screen = new Screen(parent, 'settings');
    const panel = el('div', 'screen-panel', this.screen.root);
    ui.binder.bind(el('h1', 'screen-title', panel), 'settings.title');

    this.buildLanguage(panel);
    this.buildAudio(panel);
    this.buildVideo(panel);
    this.buildControls(panel);
    this.notice = el('div', 'settings-notice', panel);
    this.buildDanger(panel);

    this.footer = new MenuList(el('div', 'menu-list', panel));
    this.footer.add(ui, 'ui.back', () => handlers.onClose());
    window.addEventListener('keydown', this.onRebindKey, true);
  }

  get visible(): boolean {
    return this.screen.visible;
  }

  open(): void {
    this.screen.setVisible(true);
    this.footer.reset();
    this.repaintBindings();
  }

  close(): void {
    this.listening = null;
    this.screen.setVisible(false);
  }

  /** Menu keys are ignored while the screen is waiting for a key to bind. */
  handleAction(action: string): boolean {
    if (this.listening) return true;
    if (action === 'up') this.footer.move(-1);
    else if (action === 'down') this.footer.move(1);
    else if (action === 'restart') this.footer.activate();
    else if (action === 'pause') this.handlers.onClose();
    else return false;
    return true;
  }

  private commit(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.handlers.onChange(this.settings);
  }

  private buildLanguage(panel: HTMLElement): void {
    const section = this.section(panel, 'settings.language');
    const row = el('div', 'setting-row', section);
    this.ui.binder.bind(el('span', 'setting-label', row), 'settings.language');
    const choices = el('div', 'setting-choices', row);
    for (const locale of this.localizer.available()) {
      const button = el('button', 'setting-choice', choices);
      button.type = 'button';
      setText(button, locale.label);
      button.addEventListener('click', () => {
        this.localizer.setLocale(locale.id);
        this.commit({ locale: locale.id });
        this.paintLanguage(choices);
        this.repaintBindings();
      });
    }
    this.paintLanguage(choices);
  }

  private paintLanguage(choices: HTMLElement): void {
    const ids = this.localizer.available().map((locale) => locale.id);
    [...choices.children].forEach((child, index) => {
      child.classList.toggle('setting-choice--active', ids[index] === this.localizer.localeId);
    });
  }

  private buildAudio(panel: HTMLElement): void {
    const section = this.section(panel, 'settings.audio');
    const range = SETTINGS_RANGES.volume;
    slider(section, this.ui, 'settings.volumeMaster', range, this.settings.volumeMaster, (v) =>
      this.commit({ volumeMaster: v }),
    );
    slider(section, this.ui, 'settings.volumeEffects', range, this.settings.volumeEffects, (v) =>
      this.commit({ volumeEffects: v }),
    );
    slider(section, this.ui, 'settings.volumeAmbient', range, this.settings.volumeAmbient, (v) =>
      this.commit({ volumeAmbient: v }),
    );
  }

  private buildVideo(panel: HTMLElement): void {
    const section = this.section(panel, 'settings.video');
    slider(
      section,
      this.ui,
      'settings.brightness',
      SETTINGS_RANGES.brightness,
      this.settings.brightness,
      (v) => this.commit({ brightness: v }),
    );
    slider(section, this.ui, 'settings.uiScale', SETTINGS_RANGES.uiScale, this.settings.uiScale, (v) =>
      this.commit({ uiScale: v }),
    );
    toggle(section, this.ui, 'settings.debugOverlay', this.settings.debugOverlay, (v) =>
      this.commit({ debugOverlay: v }),
    );
  }

  private buildControls(panel: HTMLElement): void {
    const section = this.section(panel, 'settings.controls');
    this.ui.binder.bind(el('p', 'settings-hint', section), 'settings.controlsHint');
    const list = el('div', 'binding-list', section);
    for (const action of REBINDABLE_ACTIONS) {
      const row = el('div', 'binding-row', list);
      this.ui.binder.bind(el('span', 'binding-label', row), `action.${action}`);
      const button = el('button', 'binding-key', row);
      button.type = 'button';
      button.addEventListener('click', () => {
        this.listening = action;
        this.repaintBindings();
      });
      this.rows.set(action, button);
    }
    const reset = el('button', 'setting-wide', section);
    reset.type = 'button';
    this.ui.binder.bind(reset, 'settings.resetBindings');
    reset.addEventListener('click', () => {
      const bindings = defaultBindings();
      for (const [act, codes] of Object.entries(bindings)) this.input.rebind(act, codes);
      this.commit({ bindings });
      this.repaintBindings();
    });
  }

  private buildDanger(panel: HTMLElement): void {
    const section = this.section(panel, 'settings.danger');
    const wipeRun = el('button', 'setting-wide setting-wide--danger', section);
    wipeRun.type = 'button';
    this.ui.binder.bind(wipeRun, 'settings.wipeRun');
    wipeRun.addEventListener('click', () => {
      if (!this.confirm(wipeRun)) return;
      this.handlers.onWipeRun();
      setText(this.notice, this.ui.t('settings.wipeRunDone'));
    });

    const wipeSettings = el('button', 'setting-wide setting-wide--danger', section);
    wipeSettings.type = 'button';
    this.ui.binder.bind(wipeSettings, 'settings.wipeSettings');
    wipeSettings.addEventListener('click', () => {
      if (!this.confirm(wipeSettings)) return;
      this.handlers.onWipeSettings();
      setText(this.notice, this.ui.t('settings.wipeSettingsDone'));
    });
  }

  /** Two clicks: the second one, on a button that now says "Sure?", does it. */
  private confirm(button: HTMLElement): boolean {
    if (button.dataset.armed === '1') {
      delete button.dataset.armed;
      this.ui.binder.refresh();
      return true;
    }
    button.dataset.armed = '1';
    setText(button, this.ui.t('ui.confirm'));
    return false;
  }

  private section(panel: HTMLElement, titleKey: string): HTMLElement {
    const section = el('section', 'settings-section', panel);
    this.ui.binder.bind(el('h2', 'settings-heading', section), titleKey);
    return section;
  }

  private readonly onRebindKey = (event: KeyboardEvent): void => {
    if (!this.listening || !this.screen.visible) return;
    event.preventDefault();
    event.stopPropagation();
    const action = this.listening;
    this.listening = null;
    if (event.code === 'Escape') {
      this.repaintBindings();
      return;
    }
    // A key can only mean one thing: taking it removes it from whoever had it.
    const displaced = this.input
      .actionsFor(event.code)
      .filter((other) => other !== action && REBINDABLE_ACTIONS.includes(other));
    const bindings = { ...this.settings.bindings };
    for (const other of displaced) {
      bindings[other] = (bindings[other] ?? []).filter((code) => code !== event.code);
      this.input.rebind(other, bindings[other]);
    }
    bindings[action] = [event.code];
    this.input.rebind(action, bindings[action]);
    this.commit({ bindings });
    setText(
      this.notice,
      displaced.length > 0
        ? this.ui.t('settings.conflict', { action: this.ui.t(`action.${displaced[0]}`) })
        : '',
    );
    this.repaintBindings();
  };

  private repaintBindings(): void {
    for (const [action, button] of this.rows) {
      const codes = this.settings.bindings[action] ?? [];
      const label =
        this.listening === action
          ? this.ui.t('ui.pressKey')
          : codes.length === 0
            ? this.ui.t('ui.none')
            : codes.map((code) => keyLabel(this.ui.t, code)).join(' / ');
      setText(button, label);
      button.classList.toggle('binding-key--listening', this.listening === action);
    }
  }
}
