/**
 * L4: the main menu and the pause menu.
 *
 * One class: a pause is the main menu with two extra rows and a different title,
 * and building it twice would mean maintaining it twice.
 */

import type { UiContext } from './context';
import { MenuList, Screen } from './screen';
import { el, setText } from './dom';

export interface MenuHandlers {
  readonly onContinue: () => void;
  readonly onNewRun: () => void;
  readonly onSandbox: () => void;
  readonly onGuide: () => void;
  readonly onSettings: () => void;
  readonly onResume: () => void;
  readonly onToMenu: () => void;
}

export type MenuMode = 'main' | 'pause';

export class MenuScreen {
  private readonly screen: Screen;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly list: MenuList;
  private readonly continueItem;
  private readonly resumeItem;
  private readonly toMenuItem;
  private readonly sandboxItem;
  private mode: MenuMode = 'main';

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly handlers: MenuHandlers,
  ) {
    this.screen = new Screen(parent, 'menu');
    const panel = el('div', 'screen-panel screen-panel--menu', this.screen.root);
    // Not bound to the binder: these two depend on the mode, so a language
    // change has to go through `refresh()` rather than through a fixed key.
    this.title = el('h1', 'screen-title menu-title', panel);
    this.subtitle = el('p', 'menu-subtitle', panel);

    this.list = new MenuList(el('div', 'menu-list', panel));
    this.resumeItem = this.list.add(ui, 'menu.resume', handlers.onResume);
    this.continueItem = this.list.add(ui, 'menu.continue', handlers.onContinue);
    this.list.add(ui, 'menu.newRun', handlers.onNewRun);
    this.sandboxItem = this.list.add(ui, 'menu.sandbox', handlers.onSandbox);
    this.list.add(ui, 'menu.guide', handlers.onGuide);
    this.list.add(ui, 'menu.settings', handlers.onSettings);
    this.toMenuItem = this.list.add(ui, 'menu.toMenu', handlers.onToMenu);
  }

  get visible(): boolean {
    return this.screen.visible;
  }

  open(mode: MenuMode, canContinue: boolean): void {
    this.mode = mode;
    const paused = mode === 'pause';
    this.refresh();
    this.resumeItem.element.hidden = !paused;
    this.toMenuItem.element.hidden = !paused;
    this.continueItem.element.hidden = paused;
    this.sandboxItem.element.hidden = paused;
    this.list.setEnabled(this.resumeItem, paused);
    this.list.setEnabled(this.toMenuItem, paused);
    this.list.setEnabled(this.continueItem, !paused && canContinue);
    this.screen.setVisible(true);
    this.list.reset();
  }

  close(): void {
    this.screen.setVisible(false);
  }

  /** Re-applies the two strings that depend on which menu this is. */
  refresh(): void {
    const paused = this.mode === 'pause';
    setText(this.title, this.ui.t(paused ? 'menu.paused' : 'menu.title'));
    setText(this.subtitle, this.ui.t(paused ? 'menu.pausedNote' : 'menu.subtitle'));
  }

  /** Navigated with the same keys the player walks with, whatever they rebound. */
  handleAction(action: string): boolean {
    if (action === 'up') this.list.move(-1);
    else if (action === 'down') this.list.move(1);
    else if (action === 'restart' || action === 'interact') this.list.activate();
    else if (action === 'pause' && this.mode === 'pause') this.handlers.onResume();
    else return false;
    return true;
  }
}
