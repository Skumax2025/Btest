/**
 * L4: the end of a run.
 *
 * Death is permanent, so this is the only place the game looks back: how long,
 * how deep, how much, and what stopped you.
 */

import type { Run } from '@game/run';
import type { UiContext } from './context';
import { actionLabel } from './keys';
import { el, setText } from './dom';

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

interface Row {
  readonly label: HTMLElement;
  readonly value: HTMLElement;
}

export class SummaryScreen {
  private readonly root: HTMLElement;
  private readonly cause: HTMLElement;
  private readonly rows = new Map<string, Row>();
  private visible = true;

  private readonly restart: HTMLElement;
  private readonly toMenu: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
  ) {
    this.root = el('div', 'summary', parent);
    ui.binder.bind(el('div', 'summary-title', this.root), 'summary.title');
    this.cause = el('div', 'summary-cause', this.root);
    const table = el('div', 'summary-table', this.root);
    for (const key of ['time', 'levels', 'collected', 'distance', 'seed'] as const) {
      const row = el('div', 'summary-row', table);
      const label = ui.binder.bind(el('span', 'summary-label', row), `summary.${key}`);
      this.rows.set(key, { label, value: el('span', 'summary-value', row) });
    }
    this.restart = el('div', 'summary-restart', this.root);
    this.toMenu = el('div', 'summary-restart', this.root);
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.root.style.display = visible ? 'flex' : 'none';
  }

  update(run: Run): void {
    if (!this.visible) return;
    const { t } = this.ui;
    setText(this.cause, t(`cause.${run.stats.cause ?? 'unknown'}`));
    setText(
      this.restart,
      t('summary.restart', { key: actionLabel(t, this.ui.bindings(), 'restart') }),
    );
    setText(this.toMenu, t('summary.toMenu', { key: actionLabel(t, this.ui.bindings(), 'pause') }));
    this.set('time', formatTime(run.elapsedSeconds));
    this.set('levels', String(run.levelIndex));
    this.set('collected', String(run.collected));
    this.set(
      'distance',
      this.ui.localizer.plural(
        'summary.tiles',
        Math.round(run.distance / run.config.geometry.tileSize),
      ),
    );
    this.set('seed', run.config.seed.toString(16));
  }

  private set(key: string, value: string): void {
    const row = this.rows.get(key);
    if (row) setText(row.value, value);
  }
}
