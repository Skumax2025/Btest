/**
 * L4: the heads-up display.
 *
 * Bars, the hand slot and one contextual line. Deliberately no map, no compass
 * and no coordinates — being lost is the game. Every string comes from the
 * localizer, and every key named in a hint comes from the live bindings.
 */

import type { Run } from '@game/run';
import type { HintKey } from '@game/run';
import { heldStack, totalWeight } from '@game/inventory';
import { isLowSanity } from '@game/stats';
import type { UiContext } from './context';
import { actionLabel, movementLabel } from './keys';
import { el, setStyle, setText } from './dom';

interface Bar {
  readonly fill: HTMLElement;
  readonly value: HTMLElement;
}

const BAR_KEYS = ['health', 'stamina', 'hunger', 'thirst', 'sanity'] as const;
type BarKey = (typeof BAR_KEYS)[number];

/** Which action's key a hint is talking about, if any. */
const HINT_ACTION: Partial<Record<HintKey, string>> = {
  search: 'interact',
  pickup: 'interact',
  descend: 'interact',
  useHand: 'use',
  flashlight: 'flashlight',
};

const MOVE_ACTIONS = ['up', 'left', 'down', 'right'];

export class Hud {
  private visible = true;
  private readonly root: HTMLElement;
  private readonly bars = new Map<BarKey, Bar>();
  private readonly handName: HTMLElement;
  private readonly handMeta: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly levelLabel: HTMLElement;

  constructor(parent: HTMLElement, private readonly ui: UiContext) {
    this.root = el('div', 'hud', parent);
    this.levelLabel = el('div', 'hud-level', this.root);

    const stats = el('div', 'hud-stats', this.root);
    for (const key of BAR_KEYS) {
      const row = el('div', `hud-bar hud-bar--${key}`, stats);
      ui.binder.bind(el('span', 'hud-bar-label', row), `hud.${key}`);
      const track = el('div', 'hud-bar-track', row);
      const fill = el('div', 'hud-bar-fill', track);
      const value = el('span', 'hud-bar-value', row);
      this.bars.set(key, { fill, value });
    }

    const hand = el('div', 'hud-hand', this.root);
    ui.binder.bind(el('span', 'hud-hand-label', hand), 'hud.hand');
    this.handName = el('div', 'hud-hand-name', hand);
    this.handMeta = el('div', 'hud-hand-meta', hand);

    this.hint = el('div', 'hud-hint', this.root);
  }

  update(run: Run): void {
    if (!this.visible) return;
    const { t } = this.ui;
    const config = run.config.stats;
    const maxima: Record<BarKey, number> = {
      health: config.maxHealth,
      stamina: config.maxStamina,
      hunger: config.maxHunger,
      thirst: config.maxThirst,
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
    setText(this.handName, def ? t(def.nameKey) : t('hud.empty'));
    const weight = totalWeight(run.inventory, run.config.content.items);
    const parts = [`${t('hud.weight')} ${weight.toFixed(1)}/${run.inventory.capacity}`];
    if (def && def.charge > 0 && held) {
      parts.unshift(`${t('hud.charge')} ${t('ui.seconds', { value: Math.ceil(held.charge) })}`);
    }
    if (held && held.count > 1) parts.unshift(`x${held.count}`);
    setText(this.handMeta, parts.join('  ·  '));

    setText(this.levelLabel, t('hud.level', { value: run.levelIndex }));
    setText(this.hint, this.hintText(run));
    this.root.classList.toggle('hud--strained', isLowSanity(run.stats, config));
  }

  private hintText(run: Run): string {
    if (!run.hint) return '';
    const { t, bindings } = this.ui;
    if (run.hint === 'move') {
      return t('hint.move', { move: movementLabel(t, bindings(), MOVE_ACTIONS) });
    }
    const action = HINT_ACTION[run.hint];
    return t(`hint.${run.hint}`, action ? { key: actionLabel(t, bindings(), action) } : undefined);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    setStyle(this.root, 'display', visible ? 'flex' : 'none');
  }
}
