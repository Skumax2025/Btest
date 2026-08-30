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
import {
  armorPieces,
  capacity,
  equippedStack,
  heldStack,
  passives,
  quickStack,
  usedCells,
} from '@game/inventory';
import { condition, isLightSource } from '@game/items';
import { isLowSanity } from '@game/stats';
import type { HudConfig } from '@content/view';
import type { UiContext } from './context';
import { actionLabel, movementLabel } from './keys';
import { el, setStyle, setText } from './dom';

interface Bar {
  readonly row: HTMLElement;
  readonly fill: HTMLElement;
}

const PRIMARY = ['health'] as const;
const SECONDARY = ['hunger', 'thirst', 'sanity'] as const;
const BAR_KEYS = [...PRIMARY, ...SECONDARY];
const BAR_ICONS: Record<BarKey, string> = {
  health: '♥',
  hunger: '◇',
  thirst: '≈',
  sanity: '◉',
};
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

/**
 * The legend. Movement and the belt are ranges rather than single keys, so each
 * row says how to read its own binding; everything else is one action's key.
 * Written from the live bindings, which is why rebinding rewrites it.
 */
interface LegendRow {
  readonly labelKey: string;
  readonly actions: readonly string[];
  /** How the keys are joined: a clump for movement, a range for the belt. */
  readonly join: 'clump' | 'range' | 'single';
}

const LEGEND: readonly LegendRow[] = [
  { labelKey: 'hud.action.move', actions: MOVE_ACTIONS, join: 'clump' },
  { labelKey: 'action.interact', actions: ['interact'], join: 'single' },
  { labelKey: 'action.use', actions: ['use'], join: 'single' },
  { labelKey: 'action.inventory', actions: ['inventory'], join: 'single' },
  { labelKey: 'hud.action.belt', actions: ['quick1', 'quick4'], join: 'range' },
  { labelKey: 'action.swapHands', actions: ['swapHands'], join: 'single' },
  { labelKey: 'action.flashlight', actions: ['flashlight'], join: 'single' },
  { labelKey: 'action.throwItem', actions: ['throwItem'], join: 'single' },
  { labelKey: 'action.drop', actions: ['drop'], join: 'single' },
  { labelKey: 'action.crouch', actions: ['crouch'], join: 'single' },
  { labelKey: 'action.sprint', actions: ['sprint'], join: 'single' },
  { labelKey: 'action.guide', actions: ['guide'], join: 'single' },
];

interface BeltSlot {
  readonly root: HTMLElement;
  readonly name: HTMLElement;
  readonly count: HTMLElement;
  readonly wear: HTMLElement;
  readonly wearFill: HTMLElement;
}

export class Hud {
  private visible = true;
  private readonly root: HTMLElement;
  private readonly bars = new Map<BarKey, Bar>();
  private readonly handName: HTMLElement;
  private readonly handGlyph: HTMLElement;
  private readonly handState: HTMLElement;
  private readonly handDescription: HTMLElement;
  private readonly handMeta: HTMLElement;
  private readonly offhandName: HTMLElement;
  private readonly wearFill: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly staminaValue: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly combatLine: HTMLElement;
  private readonly levelLabel: HTMLElement;
  private readonly beltSlots: HTMLElement;
  private readonly belt: BeltSlot[] = [];
  private readonly carryValue: HTMLElement;
  private readonly lightRow: HTMLElement;
  private readonly lightValue: HTMLElement;
  private readonly armorValue: HTMLElement;
  private readonly noiseValue: HTMLElement;
  private readonly failing: HTMLElement;
  private readonly previous = new Map<BarKey, number>();
  private calmCountdown = 0;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly config: HudConfig,
  ) {
    this.root = el('div', 'hud', parent);
    this.root.style.setProperty('--hud-scale', String(config.scale));
    this.root.style.setProperty('--hand-slot-size', `${config.handSlotSize}px`);
    this.levelLabel = el('div', 'hud-level', this.root);

    const stats = el('div', 'hud-stats', this.root);
    for (const key of BAR_KEYS) {
      const tier = PRIMARY.includes(key as (typeof PRIMARY)[number]) ? 'primary' : 'secondary';
      const row = el('div', `hud-bar hud-bar--${key} hud-bar--${tier}`, stats);
      const icon = el('span', 'hud-bar-icon', row);
      icon.textContent = BAR_ICONS[key];
      icon.setAttribute('aria-hidden', 'true');
      ui.binder.bind(el('span', 'hud-bar-label', row), `hud.${key}`);
      const track = el('div', 'hud-bar-track', row);
      this.bars.set(key, { row, fill: el('div', 'hud-bar-fill', track) });
    }

    const hand = el('div', 'hud-hand', this.root);
    ui.binder.bind(el('span', 'hud-hand-label', hand), 'hud.hand');
    const handBody = el('div', 'hud-hand-body', hand);
    this.handGlyph = el('div', 'hud-hand-glyph', handBody);
    const handCopy = el('div', 'hud-hand-copy', handBody);
    this.handName = el('div', 'hud-hand-name', handCopy);
    this.handState = el('div', 'hud-hand-state', handCopy);
    this.handDescription = el('div', 'hud-hand-description', handCopy);
    this.handMeta = el('div', 'hud-hand-meta', handCopy);
    const offhand = el('div', 'hud-hand-offhand', hand);
    ui.binder.bind(el('span', 'hud-hand-offhand-label', offhand), 'inventory.slot.offhand');
    this.offhandName = el('span', 'hud-hand-offhand-name', offhand);

    const wear = el('div', 'hud-hand-wear', hand);
    ui.binder.bind(el('span', 'hud-hand-wear-label', wear), 'hud.wear');
    this.wearFill = el('div', 'hud-wear-fill', el('div', 'hud-wear-track', wear));

    const stamina = el('div', 'hud-stamina', this.root);
    const staminaIcon = el('span', 'hud-stamina-icon', stamina);
    staminaIcon.textContent = '↯';
    staminaIcon.setAttribute('aria-hidden', 'true');
    const staminaInfo = el('div', 'hud-stamina-info', stamina);
    ui.binder.bind(el('span', 'hud-stamina-label', staminaInfo), 'hud.stamina');
    this.staminaValue = el('span', 'hud-stamina-value', staminaInfo);
    this.staminaFill = el('div', 'hud-stamina-fill', el('div', 'hud-stamina-track', stamina));

    const gear = el('div', 'hud-gear', this.root);
    const armorRow = el('div', 'hud-gear-row', gear);
    ui.binder.bind(el('span', 'hud-gear-label', armorRow), 'hud.armor');
    this.armorValue = el('span', 'hud-gear-value', armorRow);
    const noiseRow = el('div', 'hud-gear-row', gear);
    ui.binder.bind(el('span', 'hud-gear-label', noiseRow), 'hud.noise');
    this.noiseValue = el('span', 'hud-gear-value', noiseRow);
    this.failing = el('div', 'hud-gear-failing', gear);

    const beltPanel = el('div', 'hud-belt', this.root);
    const meta = el('div', 'hud-belt-meta', beltPanel);
    const carry = el('div', 'hud-belt-meta-item', meta);
    ui.binder.bind(el('span', 'hud-belt-meta-label', carry), 'hud.cells');
    this.carryValue = el('span', 'hud-belt-meta-value', carry);
    this.lightRow = el('div', 'hud-belt-meta-item', meta);
    ui.binder.bind(el('span', 'hud-belt-meta-label', this.lightRow), 'hud.charge');
    this.lightValue = el('span', 'hud-belt-meta-value', this.lightRow);
    this.beltSlots = el('div', 'hud-belt-slots', beltPanel);
    this.root.style.setProperty('--belt-slot-size', `${config.beltSlotSize}px`);

    this.hint = el('div', 'hud-hint', this.root);
    this.combatLine = el('div', 'hud-combat', this.root);
    this.buildLegend();
  }

  /** Built once from the bindings; `binder.refresh()` rewrites it after a rebind. */
  private buildLegend(): void {
    const legend = el('div', 'hud-keys', this.root);
    this.ui.binder.bind(el('div', 'hud-keys-title', legend), 'hud.controls');
    const grid = el('div', 'hud-keys-grid', legend);
    for (const row of LEGEND) {
      const line = el('div', 'hud-keys-row', grid);
      this.ui.binder.bind(el('span', 'hud-keys-chip', line), 'hud.key', () => ({
        key: this.legendKeys(row),
      }));
      this.ui.binder.bind(el('span', 'hud-keys-name', line), row.labelKey);
    }
  }

  private legendKeys(row: LegendRow): string {
    const { t, bindings } = this.ui;
    if (row.join === 'clump') return movementLabel(t, bindings(), row.actions);
    const labels = row.actions.map((action) => actionLabel(t, bindings(), action));
    return row.join === 'range' ? labels.join('-') : labels[0];
  }

  update(run: Run): void {
    if (!this.visible) return;
    const { t } = this.ui;
    const config = run.config.stats;
    const maxima: Record<BarKey, number> = {
      health: config.maxHealth,
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

    const staminaRatio = Math.max(0, Math.min(1, run.stats.stamina / config.maxStamina));
    setStyle(this.staminaFill, 'width', `${(staminaRatio * 100).toFixed(1)}%`);
    setText(this.staminaValue, `${Math.ceil(run.stats.stamina)}/${config.maxStamina}`);
    this.staminaFill.parentElement?.parentElement?.classList.toggle('hud-stamina--critical', staminaRatio < this.config.criticalFraction);
    this.updateHand(run);
    this.updateBelt(run);
    this.updateGear(run);
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
      (run.combat.canFight && run.combat.targets > 0) ||
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
    const displayName = def ? t(def.nameKey) : t('hud.empty');
    setText(this.handName, displayName);
    setText(this.handGlyph, held ? displayName.slice(0, 1).toUpperCase() : '—');
    setText(this.handState, run.combat.broken ? t('hud.broken') : held ? t('hud.ready') : t('hud.empty'));
    setText(this.handDescription, def ? t(def.descriptionKey) : t('hud.handEmptyDescription'));

    const parts: string[] = [];
    if (held && held.count > 1) parts.push(`x${held.count}`);
    if (def && def.charge > 0 && held) {
      parts.push(`${t('hud.charge')} ${t('ui.seconds', { value: Math.ceil(held.charge) })}`);
    }
    if (run.combat.broken) parts.push(t('hud.broken'));
    setText(this.handMeta, parts.join('  ·  '));

    // The off hand is a real decision now — a guard, or a light that frees the
    // other hand — so it cannot be something only the bag knows about.
    const second = equippedStack(run.inventory, 'offhand');
    const secondDef = second ? run.config.content.items[second.itemId] : undefined;
    setText(this.offhandName, secondDef ? t(secondDef.nameKey) : '—');

    // Wear is a bar, not a percentage: it is a state, not a measurement.
    const worn = run.combat.maxDurability > 0;
    const share = worn ? run.combat.durability / run.combat.maxDurability : 0;
    setStyle(this.wearFill, 'width', `${(share * 100).toFixed(1)}%`);
    this.root.classList.toggle('hud--has-wear', worn);
    this.root.classList.toggle('hud--worn', worn && share <= this.config.criticalFraction);
  }

  /**
   * The belt. It is the only part of the inventory that is readable without
   * opening the inventory, so it carries everything a number key needs: what is
   * on it, how many, how worn, and whether it is the thing in your hand.
   */
  private updateBelt(run: Run): void {
    const { t } = this.ui;
    const catalog = run.config.content.items;
    const bindings = this.ui.bindings();
    while (this.belt.length < run.inventory.quick.length) {
      const index = this.belt.length;
      const root = el('div', 'hud-belt-slot', this.beltSlots);
      setText(el('span', 'hud-belt-key', root), actionLabel(t, bindings, `quick${index + 1}`));
      const name = el('span', 'hud-belt-name', root);
      const count = el('span', 'hud-belt-count', root);
      const wear = el('div', 'hud-belt-wear', root);
      this.belt.push({ root, name, count, wear, wearFill: el('div', 'hud-belt-wear-fill', wear) });
    }

    const held = heldStack(run.inventory);
    for (let index = 0; index < this.belt.length; index++) {
      const slot = this.belt[index];
      const stack = quickStack(run.inventory, index);
      const def = stack ? catalog[stack.itemId] : undefined;
      setText(slot.name, def ? t(def.nameKey) : '—');
      setText(slot.count, stack && stack.count > 1 ? `x${stack.count}` : '');
      slot.root.classList.toggle('hud-belt-slot--empty', !stack);
      slot.root.classList.toggle('hud-belt-slot--held', !!stack && held?.id === stack.id);
      const max = def?.durability?.max ?? 0;
      slot.wear.hidden = max <= 0;
      if (stack && def && max > 0) {
        const share = condition(def, stack.durability);
        setStyle(slot.wearFill, 'width', `${(share * 100).toFixed(1)}%`);
        slot.root.classList.toggle('hud-belt-slot--worn', share <= this.config.criticalFraction);
      }
    }

    const cells = capacity(run.inventory, catalog);
    setText(this.carryValue, `${usedCells(run.inventory)}/${cells}`);

    // The lamp is the one carried thing that runs down whether or not it is held.
    let charge = 0;
    let hasLight = false;
    for (const stack of run.inventory.stacks) {
      const def = catalog[stack.itemId];
      if (!def || !isLightSource(def)) continue;
      hasLight = true;
      charge = Math.max(charge, stack.charge);
    }
    this.lightRow.hidden = !hasLight;
    if (hasLight) {
      const seconds = t('ui.seconds', { value: Math.ceil(charge) });
      setText(this.lightValue, `${seconds} · ${t(run.flashlightOn ? 'ui.on' : 'ui.off')}`);
      this.lightRow.classList.toggle('hud-belt-meta-item--critical', charge <= 0);
    }
  }

  /**
   * What is being worn, as the two things it actually does: damage it takes off
   * a hit, and how much louder or quieter it makes a footstep. Both are
   * invisible otherwise, and both change as the gear wears down.
   */
  private updateGear(run: Run): void {
    const { t } = this.ui;
    const catalog = run.config.content.items;
    let flat = 0;
    let share = 0;
    for (const piece of armorPieces(run.inventory, catalog)) {
      flat += piece.flat;
      share += piece.share;
    }
    const capped = Math.min(share, run.config.combat.armor.maxShare);
    setText(
      this.armorValue,
      flat <= 0 && capped <= 0
        ? '—'
        : `${flat.toFixed(1)} + ${t('ui.percent', { value: Math.round(capped * 100) })}`,
    );

    const noise = passives(run.inventory, catalog).noiseFactor;
    setText(this.noiseValue, `x${noise.toFixed(2)}`);
    this.noiseValue.classList.toggle('hud-gear-value--loud', noise > 1);
    this.noiseValue.classList.toggle('hud-gear-value--quiet', noise < 1);

    // One warning at a time: the worst thing being worn, and only once it matters.
    let worst: { name: string; share: number } | null = null;
    for (const slot of Object.keys(run.inventory.equipment) as Array<
      keyof typeof run.inventory.equipment
    >) {
      const id = run.inventory.equipment[slot];
      const stack = id === null ? null : run.inventory.stacks.find((s) => s.id === id);
      const def = stack ? catalog[stack.itemId] : undefined;
      if (!stack || !def || (def.durability?.max ?? 0) <= 0) continue;
      const value = condition(def, stack.durability);
      if (value > this.config.criticalFraction) continue;
      if (!worst || value < worst.share) worst = { name: t(def.nameKey), share: value };
    }
    setText(this.failing, worst ? t('hud.failing', { name: worst.name }) : '');
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
