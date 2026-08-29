/**
 * L4: the end of a run.
 *
 * Death is permanent, so this is the only place the game looks back: how long,
 * how deep, how much, and what stopped you.
 */

import type { Run } from '@game/run';
import { TEXTS } from '@content/texts';
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

  constructor(parent: HTMLElement) {
    this.root = el('div', 'summary', parent);
    el('div', 'summary-title', this.root).textContent = TEXTS.summary.title;
    this.cause = el('div', 'summary-cause', this.root);
    const table = el('div', 'summary-table', this.root);
    for (const key of ['time', 'levels', 'collected', 'distance', 'seed'] as const) {
      const row = el('div', 'summary-row', table);
      const label = el('span', 'summary-label', row);
      label.textContent = TEXTS.summary[key === 'seed' ? 'seed' : key];
      this.rows.set(key, { label, value: el('span', 'summary-value', row) });
    }
    el('div', 'summary-restart', this.root).textContent = TEXTS.summary.restart;
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.root.style.display = visible ? 'flex' : 'none';
  }

  update(run: Run): void {
    this.setVisible(run.phase === 'dead');
    if (run.phase !== 'dead') return;
    setText(this.cause, TEXTS.causes[run.stats.cause ?? 'unknown']);
    this.set('time', formatTime(run.elapsedSeconds));
    this.set('levels', String(run.levelIndex));
    this.set('collected', String(run.collected));
    this.set(
      'distance',
      `${Math.round(run.distance / run.config.geometry.tileSize)} tiles`,
    );
    this.set('seed', run.config.seed.toString(16));
  }

  private set(key: string, value: string): void {
    const row = this.rows.get(key);
    if (row) setText(row.value, value);
  }
}
