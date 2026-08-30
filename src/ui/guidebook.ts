/**
 * L4: the guidebook.
 *
 * A screen the player stops on rather than a tooltip: a list of sections on the
 * left, one section's text on the right, navigable with the keyboard and the
 * mouse. It renders whatever sections it is handed; the writing lives in the
 * locale files and the numbers in it come from L3, so the text can never drift
 * away from the balance.
 */

import type { UiContext } from './context';
import type { GuideSection } from '@content/guide';
import { MenuList, Screen } from './screen';
import { actionLabel, keyLabel } from './keys';
import { el, setText } from './dom';

export class GuidebookScreen {
  private readonly screen: Screen;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private readonly footer: MenuList;
  private readonly tabButtons: HTMLElement[] = [];
  private current = 0;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly sections: readonly GuideSection[],
    onClose: () => void,
  ) {
    this.screen = new Screen(parent, 'guide');
    const panel = el('div', 'screen-panel screen-panel--guide', this.screen.root);
    ui.binder.bind(el('h1', 'screen-title', panel), 'guide.title');

    const columns = el('div', 'guide-columns', panel);
    this.tabs = el('nav', 'guide-tabs', columns);
    this.body = el('article', 'guide-body', columns);

    this.sections.forEach((section, index) => {
      const button = el('button', 'guide-tab', this.tabs);
      button.type = 'button';
      ui.binder.bind(button, section.titleKey);
      button.addEventListener('click', () => this.show(index));
      this.tabButtons.push(button);
    });

    this.footer = new MenuList(el('div', 'menu-list', panel));
    this.footer.add(ui, 'ui.back', onClose);
  }

  get visible(): boolean {
    return this.screen.visible;
  }

  open(): void {
    this.screen.setVisible(true);
    this.footer.reset();
    this.show(this.current);
  }

  close(): void {
    this.screen.setVisible(false);
  }

  /** Re-renders the open section: the numbers and key names in it are live. */
  refresh(): void {
    if (this.screen.visible) this.show(this.current);
  }

  handleAction(action: string): boolean {
    if (action === 'up') this.show(this.current - 1);
    else if (action === 'down') this.show(this.current + 1);
    else if (action === 'pause' || action === 'restart') this.footer.activate();
    else return false;
    return true;
  }

  private show(index: number): void {
    if (this.sections.length === 0) return;
    this.current = (index + this.sections.length) % this.sections.length;
    this.tabButtons.forEach((button, i) => {
      button.classList.toggle('guide-tab--active', i === this.current);
    });
    this.body.replaceChildren();
    const section = this.sections[this.current];
    setText(el('h2', 'guide-heading', this.body), this.ui.t(section.titleKey));
    for (const key of section.bodyKeys) {
      setText(el('p', 'guide-paragraph', this.body), this.ui.t(key, section.params?.()));
    }
    if (section.controls) this.renderControls();
  }

  /** Section 8 is generated, never written: it must match the current keys. */
  private renderControls(): void {
    const { t, bindings } = this.ui;
    const table = el('div', 'guide-controls', this.body);
    for (const action of this.sections[this.current].controls ?? []) {
      const row = el('div', 'guide-control-row', table);
      setText(el('span', 'guide-control-key', row), actionLabel(t, bindings(), action));
      setText(el('span', 'guide-control-name', row), t(`action.${action}`));
    }
    const mouse = el('div', 'guide-control-row', table);
    setText(el('span', 'guide-control-key', mouse), keyLabel(t, 'Mouse'));
    setText(el('span', 'guide-control-name', mouse), t('guide.controls.mouse'));
  }
}
