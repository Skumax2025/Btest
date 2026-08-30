/**
 * L4: the heads-up display.
 *
 * Bars, the hand slot and one contextual line. Deliberately no map, no compass
 * and no coordinates — being lost is the game.
 */

import type { Run } from '@game/run';
import { heldStack } from '@game/inventory';
import { totalWeight } from '@game/inventory';
import { isLowSanity } from '@game/stats';
import { TEXTS } from '@content/texts';
import { el, setStyle, setText } from './dom';

interface Bar {
  readonly fill: HTMLElement;
  readonly value: HTMLElement;
}

const BAR_KEYS = ['health', 'hunger', 'thirst', 'stamina', 'sanity'] as const;
type BarKey = (typeof BAR_KEYS)[number];

const BAR_LABELS: Record<BarKey, string> = {
  health: TEXTS.hud.health,
  hunger: TEXTS.hud.hunger,
  thirst: TEXTS.hud.thirst,
  stamina: TEXTS.hud.stamina,
  sanity: TEXTS.hud.sanity,
};

export class Hud {
  private visible = true;
  private readonly root: HTMLElement;
  private readonly bars = new Map<BarKey, Bar>();
  private readonly handName: HTMLElement;
  private readonly handMeta: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly levelLabel: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent);

    this.levelLabel = el('div', 'hud-level', this.root);

    const stats = el('div', 'hud-stats', this.root);
    for (const key of BAR_KEYS) {
      const row = el('div', `hud-bar hud-bar--${key}`, stats);
      el('span', 'hud-bar-label', row).textContent = BAR_LABELS[key];
      const track = el('div', 'hud-bar-track', row);
      const fill = el('div', 'hud-bar-fill', track);
      const value = el('span', 'hud-bar-value', row);
      this.bars.set(key, { fill, value });
    }

    const hand = el('div', 'hud-hand', this.root);
    el('span', 'hud-hand-label', hand).textContent = TEXTS.hud.hand;
    this.handName = el('div', 'hud-hand-name', hand);
    this.handMeta = el('div', 'hud-hand-meta', hand);

    this.hint = el('div', 'hud-hint', this.root);
  }

  update(run: Run): void {
    if (!this.visible) return;
    const config = run.config.stats;
    const maxima: Record<BarKey, number> = {
      health: config.maxHealth,
      hunger: config.maxHunger,
      thirst: config.maxThirst,
      stamina: config.maxStamina,
      sanity: config.maxSanity,
    };
    for (const key of BAR_KEYS) {
      const bar = this.bars.get(key);
      if (!bar) continue;
      const ratio = Math.max(0, Math.min(1, run.stats[key] / maxima[key]));
      setStyle(bar.fill, 'width', `${(ratio * 100).toFixed(1)}%`);
      setText(bar.value, String(Math.ceil(run.stats[key])));
    }

    const held = heldStack(run.inventory);
    const def = held ? run.config.content.items[held.itemId] : undefined;
    setText(this.handName, def ? def.name : TEXTS.hud.empty);
    const weight = totalWeight(run.inventory, run.config.content.items);
    const parts = [`${TEXTS.hud.weight} ${weight.toFixed(1)}/${run.inventory.capacity}`];
    if (def && def.charge > 0 && held) {
      parts.unshift(`${TEXTS.hud.charge} ${Math.ceil(held.charge)}s`);
    }
    if (held && held.count > 1) parts.unshift(`x${held.count}`);
    setText(this.handMeta, parts.join('  ·  '));

    setText(this.levelLabel, `${TEXTS.hud.level} ${run.levelIndex}`);
    setText(this.hint, run.hint ? TEXTS.hints[run.hint] : '');
    this.root.classList.toggle('hud--strained', isLowSanity(run.stats, config));
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    setStyle(this.root, 'display', visible ? 'flex' : 'none');
  }
}
