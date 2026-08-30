/**
 * L4: the heads-up display.
 *
 * Ordered by how fast the player needs it: body and breath large, the three
 * slower clocks small. It fades back when nothing is happening and returns the
 * instant a bar moves or something walks into weapon reach — melee runs itself,
 * so breath has to be readable without being looked for.
 *
 * Deliberately no map, no compass, no coordinates, and no numbers where a bar
 * already says it.
 */

import type { Run } from '@game/run';
import type { HintKey } from '@game/run';
import { heldStack, totalWeight } from '@game/inventory';
import { isLowSanity } from '@game/stats';
import type { HudConfig } from '@content/view';
import type { UiContext } from './context';
import { actionLabel, movementLabel } from './keys';
import { el, setStyle, setText } from './dom';

interface Bar {
  readonly row: HTMLElement;
  readonly fill: HTMLElement;
}

const PRIMARY = ['health', 'stamina'] as const;
const SECONDARY = ['hunger', 'thirst', 'sanity'] as const;
const BAR_KEYS = [...PRIMARY, ...SECONDARY];
type BarKey = (typeof BAR_KEYS)[number];

/** Which action's key a hint is talking about, if any. */
const HINT_ACTION: Partial<Record<HintKey, string>> = {
  search: 'interact',
  pickup: 'interact',
  descend: 'interact',
  useHand: 'use',
  flashlight: 'flashlight',
};

/** Hints drawn next to the thing they are about, not on the centre line. */
const POSITIONAL: ReadonlySet<HintKey> = new Set(['search', 'pickup', 'descend']);

/**
 * Hints that describe a standing condition rather than an event. They stay on
 * the line but do not keep the interface awake, or it would never go quiet in a
 * building that is dark almost everywhere.
 */
const STEADY: ReadonlySet<HintKey> = new Set(['darkness']);

const MOVE_ACTIONS = ['up', 'left', 'down', 'right'];

export class Hud {
  private visible = true;
  private readonly root: HTMLElement;
  private readonly bars = new Map<BarKey, Bar>();
  private readonly handName: HTMLElement;
  private readonly handMeta: HTMLElement;
  private readonly wearFill: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly combatLine: HTMLElement;
  private readonly levelLabel: HTMLElement;
  private readonly previous = new Map<BarKey, number>();
  private calmCountdown = 0;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly config: HudConfig,
  ) {
    this.root = el('div', 'hud', parent);
    this.levelLabel = el('div', 'hud-level', this.root);

    const stats = el('div', 'hud-stats', this.root);
    for (const key of BAR_KEYS) {
      const tier = PRIMARY.includes(key as (typeof PRIMARY)[number]) ? 'primary' : 'secondary';
      const row = el('div', `hud-bar hud-bar--${key} hud-bar--${tier}`, stats);
      ui.binder.bind(el('span', 'hud-bar-label', row), `hud.${key}`);
      const track = el('div', 'hud-bar-track', row);
      this.bars.set(key, { row, fill: el('div', 'hud-bar-fill', track) });
    }

    const hand = el('div', 'hud-hand', this.root);
    ui.binder.bind(el('span', 'hud-hand-label', hand), 'hud.hand');
    this.handName = el('div', 'hud-hand-name', hand);
    this.handMeta = el('div', 'hud-hand-meta', hand);
    this.wearFill = el('div', 'hud-wear-fill', el('div', 'hud-wear-track', hand));

    this.hint = el('div', 'hud-hint', this.root);
    this.combatLine = el('div', 'hud-combat', this.root);
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

    let moved = false;
    for (const key of BAR_KEYS) {
      const bar = this.bars.get(key);
      if (!bar) continue;
      const value = run.stats[key];
      const ratio = Math.max(0, Math.min(1, value / maxima[key]));
      setStyle(bar.fill, 'width', `${(ratio * 100).toFixed(1)}%`);
      bar.row.classList.toggle('hud-bar--critical', ratio < this.config.criticalFraction);
      const before = this.previous.get(key);
      if (before !== undefined && Math.abs(before - value) >= this.config.changeEpsilon) {
        moved = true;
      }
      this.previous.set(key, value);
    }

    this.updateHand(run);
    setText(this.levelLabel, t('hud.level', { value: run.levelIndex }));
    setText(this.hint, this.hintText(run));
    setText(this.combatLine, this.combatText(run));
    this.root.classList.toggle('hud--strained', isLowSanity(run.stats, config));
    this.updateCalm(run, moved);
  }

  /**
   * The interface is loud while something is happening and quiet otherwise.
   * A body in weapon reach counts as something happening.
   */
  private updateCalm(run: Run, statsMoved: boolean): void {
    const busy =
      statsMoved ||
      run.combat.targets > 0 ||
      run.combat.eventTicks > 0 ||
      (run.hint !== null && !STEADY.has(run.hint));
    if (busy) this.calmCountdown = this.config.calmTicks;
    else if (this.calmCountdown > 0) this.calmCountdown--;
    const calm = this.calmCountdown <= 0;
    this.root.classList.toggle('hud--calm', calm);
    setStyle(this.root, '--hud-opacity', calm ? String(this.config.calmOpacity) : '1');
  }

  private updateHand(run: Run): void {
    const { t } = this.ui;
    const held = heldStack(run.inventory);
    const def = held ? run.config.content.items[held.itemId] : undefined;
    setText(this.handName, def ? t(def.nameKey) : t('hud.empty'));

    const parts: string[] = [];
    if (held && held.count > 1) parts.push(`x${held.count}`);
    if (def && def.charge > 0 && held) {
      parts.push(`${t('hud.charge')} ${t('ui.seconds', { value: Math.ceil(held.charge) })}`);
    }
    if (run.combat.broken) parts.push(t('hud.broken'));
    const weight = totalWeight(run.inventory, run.config.content.items);
    parts.push(`${t('hud.weight')} ${weight.toFixed(1)}/${run.inventory.capacity}`);
    setText(this.handMeta, parts.join('  ·  '));

    // Wear is a bar, not a percentage: it is a state, not a measurement.
    const worn = run.combat.maxDurability > 0;
    const share = worn ? run.combat.durability / run.combat.maxDurability : 0;
    setStyle(this.wearFill, 'width', `${(share * 100).toFixed(1)}%`);
    this.root.classList.toggle('hud--has-wear', worn);
    this.root.classList.toggle('hud--worn', worn && share <= this.config.criticalFraction);
  }

  /** The centre line carries only what has nowhere better to be. */
  private hintText(run: Run): string {
    if (!run.hint || (POSITIONAL.has(run.hint) && run.hintTarget)) return '';
    return this.promptFor(run.hint);
  }

  /** Public so the world view can draw the same words next to their subject. */
  promptFor(hint: HintKey): string {
    const { t, bindings } = this.ui;
    if (hint === 'move') {
      return t('hint.move', { move: movementLabel(t, bindings(), MOVE_ACTIONS) });
    }
    const action = HINT_ACTION[hint];
    return t(`hint.${hint}`, action ? { key: actionLabel(t, bindings(), action) } : undefined);
  }

  /** The last thing melee did, in words, because nobody pressed a key for it. */
  private combatText(run: Run): string {
    const { event, eventTicks, eventCount } = run.combat;
    if (!event || eventTicks <= 0) return '';
    if (event === 'hit') return this.ui.localizer.plural('combat.hit', eventCount);
    return this.ui.t(`combat.${event}`);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    setStyle(this.root, 'display', visible ? 'flex' : 'none');
  }
}
