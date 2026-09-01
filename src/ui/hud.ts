/**
 * L4: the heads-up display.
 *
 * Four corners, each answering one question. Top left: what is happening to the
 * body. Top right: what the clothes are doing about it. Bottom right: what is in
 * each hand. Bottom centre: what is on the belt, and how much breath is left.
 * Bottom left: which key does what, for as long as that is still needed.
 *
 * It fades back when nothing is happening and returns the instant a bar moves or
 * something walks into weapon reach — melee runs itself, so breath has to be
 * readable without being looked for.
 *
 * Deliberately no map, no compass, no coordinates, and no numbers on a body
 * that a bar already describes.
 */

import type { Run } from '@game/run';
import type { HintKey } from '@game/run';
import {
  activeLight,
  armorPieces,
  capacity,
  equippedStack,
  passives,
  quickStack,
  usedCells,
} from '@game/inventory';
import { condition } from '@game/items';
import type { EquipSlot } from '@game/items';
import { isLowSanity } from '@game/stats';
import type { HudConfig } from '@content/view';
import type { UiContext } from './context';
import { actionLabel, movementLabel } from './keys';
import { TOUCH_GLYPHS } from './touch';
import { el, setStyle, setText } from './dom';

interface Bar {
  readonly row: HTMLElement;
  readonly fill: HTMLElement;
}

const BAR_KEYS = ['health', 'hunger', 'thirst', 'sanity'] as const;
type BarKey = (typeof BAR_KEYS)[number];

const BAR_ICONS: Record<BarKey, string> = {
  health: '♥',
  hunger: '◇',
  thirst: '≈',
  sanity: '◉',
};

/** Which action's key a hint is talking about, if any. */
const HINT_ACTION: Partial<Record<HintKey, string>> = {
  search: 'interact',
  pickup: 'interact',
  descend: 'interact',
  useHand: 'handMain',
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
  readonly join: 'clump' | 'range' | 'single';
}

const LEGEND: readonly LegendRow[] = [
  { labelKey: 'hud.action.move', actions: MOVE_ACTIONS, join: 'clump' },
  { labelKey: 'action.interact', actions: ['interact'], join: 'single' },
  { labelKey: 'action.handMain', actions: ['handMain'], join: 'single' },
  { labelKey: 'action.handOff', actions: ['handOff'], join: 'single' },
  { labelKey: 'hud.action.belt', actions: ['quick1', 'quick4'], join: 'range' },
  { labelKey: 'action.inventory', actions: ['inventory'], join: 'single' },
  { labelKey: 'action.swapHands', actions: ['swapHands'], join: 'single' },
  { labelKey: 'action.flashlight', actions: ['flashlight'], join: 'single' },
  { labelKey: 'action.throwItem', actions: ['throwItem'], join: 'single' },
  { labelKey: 'action.drop', actions: ['drop'], join: 'single' },
  { labelKey: 'action.crouch', actions: ['crouch'], join: 'single' },
  { labelKey: 'action.sprint', actions: ['sprint'], join: 'single' },
  { labelKey: 'action.guide', actions: ['guide'], join: 'single' },
  { labelKey: 'action.controls', actions: ['controls'], join: 'single' },
];

interface BeltSlot {
  readonly root: HTMLElement;
  readonly key: HTMLElement;
  readonly icon: HTMLElement;
  readonly name: HTMLElement;
  readonly count: HTMLElement;
  readonly wear: HTMLElement;
  readonly wearFill: HTMLElement;
}

interface HandRow {
  readonly root: HTMLElement;
  readonly key: HTMLElement;
  readonly icon: HTMLElement;
  readonly name: HTMLElement;
  readonly state: HTMLElement;
  readonly wear: HTMLElement;
  readonly wearFill: HTMLElement;
}

/** What the display cannot do itself, because it changes the world. */
export interface HudHost {
  useBelt(index: number): void;
  toggleControls(): void;
}

export class Hud {
  private visible = true;
  private readonly root: HTMLElement;
  private readonly bars = new Map<BarKey, Bar>();
  private readonly levelLabel: HTMLElement;
  private readonly hands = new Map<EquipSlot, HandRow>();
  private readonly beltSlots: HTMLElement;
  private readonly belt: BeltSlot[] = [];
  private readonly carryValue: HTMLElement;
  private readonly lightRow: HTMLElement;
  private readonly lightValue: HTMLElement;
  private readonly breath: HTMLElement;
  private readonly breathFill: HTMLElement;
  private readonly armorValue: HTMLElement;
  private readonly noiseValue: HTMLElement;
  private readonly failing: HTMLElement;
  private readonly keys: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly combatLine: HTMLElement;
  private readonly previous = new Map<BarKey, number>();
  private calmCountdown = 0;
  /** How red the edges of the screen currently are, in [0, 1]. */
  private hurt = 0;
  /** True while the on-screen pad is what the player is using. */
  private touch = false;

  constructor(
    parent: HTMLElement,
    private readonly ui: UiContext,
    private readonly config: HudConfig,
    private readonly host: HudHost,
  ) {
    this.root = el('div', 'hud', parent);
    this.root.style.setProperty('--hud-scale', String(config.scale));
    this.root.style.setProperty('--belt-slot-size', `${config.beltSlotSize}px`);

    // ── the body, top centre ────────────────────────────────────────────────
    this.levelLabel = el('div', 'hud-level', this.root);
    const vitals = el('div', 'hud-panel hud-vitals', this.root);
    for (const key of BAR_KEYS) {
      const row = el('div', `hud-bar hud-bar--${key}`, vitals);
      const head = el('div', 'hud-bar-head', row);
      const icon = el('span', 'hud-bar-icon', head);
      icon.textContent = BAR_ICONS[key];
      icon.setAttribute('aria-hidden', 'true');
      ui.binder.bind(el('span', 'hud-bar-label', head), `hud.${key}`);
      const track = el('div', 'hud-bar-track', row);
      this.bars.set(key, { row, fill: el('div', 'hud-bar-fill', track) });
    }

    // ── what is being worn, top right ───────────────────────────────────────
    const gear = el('div', 'hud-panel hud-gear', this.root);
    const armorRow = el('div', 'hud-gear-row', gear);
    ui.binder.bind(el('span', 'hud-gear-label', armorRow), 'hud.armor');
    this.armorValue = el('span', 'hud-gear-value', armorRow);
    const noiseRow = el('div', 'hud-gear-row', gear);
    ui.binder.bind(el('span', 'hud-gear-label', noiseRow), 'hud.noise');
    this.noiseValue = el('span', 'hud-gear-value', noiseRow);
    this.failing = el('div', 'hud-gear-failing', gear);

    // ── the hands, bottom right ─────────────────────────────────────────────
    const hands = el('div', 'hud-panel hud-hands', this.root);
    ui.binder.bind(el('div', 'hud-panel-title', hands), 'hud.hand');
    for (const slot of ['hand', 'offhand'] as const) {
      const row = el('div', `hud-hand-row hud-hand-row--${slot}`, hands);
      const icon = el('span', 'hud-hand-icon', row);
      const column = el('div', 'hud-hand-body', row);
      const head = el('div', 'hud-hand-head', column);
      const key = el('span', 'hud-chip', head);
      const name = el('span', 'hud-hand-name', head);
      const state = el('span', 'hud-hand-state', head);
      const wear = el('div', 'hud-hand-wear', column);
      this.hands.set(slot, {
        root: row,
        key,
        icon,
        name,
        state,
        wear,
        wearFill: el('div', 'hud-hand-wear-fill', wear),
      });
    }

    // ── the belt and the breath, bottom centre ──────────────────────────────
    const beltPanel = el('div', 'hud-belt', this.root);
    const meta = el('div', 'hud-belt-meta', beltPanel);
    const carry = el('div', 'hud-belt-meta-item', meta);
    ui.binder.bind(el('span', 'hud-belt-meta-label', carry), 'hud.cells');
    this.carryValue = el('span', 'hud-belt-meta-value', carry);
    this.lightRow = el('div', 'hud-belt-meta-item', meta);
    ui.binder.bind(el('span', 'hud-belt-meta-label', this.lightRow), 'hud.charge');
    this.lightValue = el('span', 'hud-belt-meta-value', this.lightRow);
    this.beltSlots = el('div', 'hud-belt-slots', beltPanel);
    this.breath = el('div', 'hud-breath', beltPanel);
    this.breathFill = el('div', 'hud-breath-fill', this.breath);

    this.hint = el('div', 'hud-hint', this.root);
    this.combatLine = el('div', 'hud-combat', this.root);
    this.keys = this.buildLegend();
  }

  /** Built once from the bindings; `binder.refresh()` rewrites it after a rebind. */
  private buildLegend(): HTMLElement {
    const legend = el('div', 'hud-panel hud-keys', this.root);
    const header = el('button', 'hud-keys-title', legend);
    this.ui.binder.bind(header, 'hud.controls');
    header.addEventListener('click', () => this.host.toggleControls());
    const grid = el('div', 'hud-keys-grid', legend);
    for (const row of LEGEND) {
      const line = el('div', 'hud-keys-row', grid);
      this.ui.binder.bind(el('span', 'hud-chip', line), 'hud.key', () => ({
        key: this.legendKeys(row),
      }));
      this.ui.binder.bind(el('span', 'hud-keys-name', line), row.labelKey);
    }
    return legend;
  }

  private legendKeys(row: LegendRow): string {
    const { t, bindings } = this.ui;
    if (row.join === 'clump') return movementLabel(t, bindings(), row.actions);
    const labels = row.actions.map((action) => actionLabel(t, bindings(), action));
    return row.join === 'range' ? labels.join('-') : labels[0];
  }

  /**
   * Something took a bite out of you. The display answers at the edges of the
   * screen rather than on the health bar, because the bar is where you look
   * afterwards and the edges are what you see during.
   */
  registerDamage(amount: number): void {
    this.hurt = Math.min(1, this.hurt + amount / Math.max(1, this.config.hurtFlashDamage));
  }

  /**
   * A hint that names a key is a lie on a device with no keys. While the pad is
   * up, every one of them names the button that does the same thing instead.
   */
  setTouch(touch: boolean): void {
    this.touch = touch;
  }

  /** The legend is the one part of the display a player is meant to outgrow. */
  setControlsVisible(visible: boolean): void {
    this.keys.classList.toggle('hud-keys--collapsed', !visible);
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

    this.updateBreath(run);
    this.updateHands(run);
    this.updateBelt(run);
    this.updateGear(run);
    setText(this.levelLabel, t('hud.level', { value: run.levelIndex }));
    setText(this.hint, this.hintText(run));
    setText(this.combatLine, this.combatText(run));
    this.root.classList.toggle('hud--strained', isLowSanity(run.stats, config));
    this.hurt = Math.max(0, this.hurt - this.config.hurtFade);
    setStyle(this.root, '--hurt', this.hurt.toFixed(3));
    this.updateCalm(run, moved);
  }

  /**
   * Breath is a line, not a panel, and it is only there while it is being spent.
   * At the bottom of it the whole screen tightens instead of a number turning
   * red: running out of air is the one state that should be felt rather than read.
   */
  private updateBreath(run: Run): void {
    const ratio = Math.max(
      0,
      Math.min(1, run.stats.stamina / run.config.stats.maxStamina),
    );
    setStyle(this.breathFill, 'width', `${(ratio * 100).toFixed(1)}%`);
    // Full breath is not information, so it is not drawn.
    setStyle(this.breath, 'opacity', ratio >= 1 ? '0' : '1');
    const spent = ratio < this.config.criticalFraction;
    this.breath.classList.toggle('hud-breath--spent', spent);
    setStyle(
      this.root,
      '--strain',
      spent ? (1 - ratio / this.config.criticalFraction).toFixed(2) : '0',
    );
  }

  /** Both hands, each labelled with the key that uses it. */
  private updateHands(run: Run): void {
    const { t } = this.ui;
    const bindings = this.ui.bindings();
    const catalog = run.config.content.items;
    for (const [slot, row] of this.hands) {
      const action = slot === 'hand' ? 'handMain' : 'handOff';
      setText(row.key, actionLabel(t, bindings, action));
      const stack = equippedStack(run.inventory, slot);
      const def = stack ? catalog[stack.itemId] : undefined;
      this.ui.icons.paint(row.icon, def ? def.sprite : null);
      setText(row.name, def ? t(def.nameKey) : t('hud.empty'));
      row.root.classList.toggle('hud-hand-row--empty', !stack);

      const notes: string[] = [];
      if (stack && stack.count > 1) notes.push(`x${stack.count}`);
      if (def && def.charge > 0 && stack) {
        notes.push(t('ui.seconds', { value: Math.ceil(stack.charge) }));
      }
      if (slot === 'hand' && run.combat.broken) notes.push(t('hud.broken'));
      setText(row.state, notes.join(' · '));

      const max = def?.durability?.max ?? 0;
      row.wear.hidden = max <= 0;
      if (stack && def && max > 0) {
        const share = condition(def, stack.durability);
        setStyle(row.wearFill, 'width', `${(share * 100).toFixed(1)}%`);
        row.root.classList.toggle('hud-hand-row--worn', share <= this.config.criticalFraction);
      }
    }
  }

  /**
   * The belt. It is the only part of the inventory readable without opening the
   * inventory, so it carries everything a number key needs: what is on it, how
   * many, how worn. Clicking a slot is the same as pressing its number.
   */
  private updateBelt(run: Run): void {
    const { t } = this.ui;
    const catalog = run.config.content.items;
    const bindings = this.ui.bindings();
    while (this.belt.length < run.inventory.quick.length) {
      const index = this.belt.length;
      const root = el('button', 'hud-belt-slot', this.beltSlots);
      root.addEventListener('click', () => this.host.useBelt(index));
      const key = el('span', 'hud-belt-key', root);
      const icon = el('span', 'hud-belt-icon', root);
      const name = el('span', 'hud-belt-name', root);
      const count = el('span', 'hud-belt-count', root);
      const wear = el('div', 'hud-belt-wear', root);
      this.belt.push({
        root,
        key,
        icon,
        name,
        count,
        wear,
        wearFill: el('div', 'hud-belt-wear-fill', wear),
      });
    }

    for (let index = 0; index < this.belt.length; index++) {
      const slot = this.belt[index];
      const stack = quickStack(run.inventory, index);
      const def = stack ? catalog[stack.itemId] : undefined;
      setText(slot.key, actionLabel(t, bindings, `quick${index + 1}`));
      this.ui.icons.paint(slot.icon, def ? def.sprite : null);
      setText(slot.name, def ? t(def.nameKey) : '');
      setText(slot.count, stack && stack.count > 1 ? `x${stack.count}` : '');
      slot.root.classList.toggle('hud-belt-slot--empty', !stack);
      const max = def?.durability?.max ?? 0;
      slot.wear.hidden = max <= 0;
      if (stack && def && max > 0) {
        const share = condition(def, stack.durability);
        setStyle(slot.wearFill, 'width', `${(share * 100).toFixed(1)}%`);
        slot.root.classList.toggle('hud-belt-slot--worn', share <= this.config.criticalFraction);
      }
    }

    setText(this.carryValue, `${usedCells(run.inventory)}/${capacity(run.inventory, catalog)}`);

    // The lamp is the one carried thing that runs down whether or not it is held,
    // and only the one actually burning is worth a readout.
    const lamp = activeLight(run.inventory, catalog);
    this.lightRow.hidden = lamp === null;
    if (lamp) {
      const seconds = t('ui.seconds', { value: Math.ceil(lamp.charge) });
      setText(this.lightValue, `${seconds} · ${t(run.flashlightOn ? 'ui.on' : 'ui.off')}`);
      this.lightRow.classList.toggle('hud-belt-meta-item--critical', lamp.charge <= 0);
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
    for (const slot of Object.keys(run.inventory.equipment) as EquipSlot[]) {
      const stack = equippedStack(run.inventory, slot);
      const def = stack ? catalog[stack.itemId] : undefined;
      if (!stack || !def || (def.durability?.max ?? 0) <= 0) continue;
      const value = condition(def, stack.durability);
      if (value > this.config.criticalFraction) continue;
      if (!worst || value < worst.share) worst = { name: t(def.nameKey), share: value };
    }
    setText(this.failing, worst ? t('hud.failing', { name: worst.name }) : '');
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

  /** The centre line carries only what has nowhere better to be. */
  private hintText(run: Run): string {
    if (!run.hint || (POSITIONAL.has(run.hint) && run.hintTarget)) return '';
    return this.promptFor(run.hint);
  }

  /** Public so the world view can draw the same words next to their subject. */
  promptFor(hint: HintKey): string {
    const { t, bindings } = this.ui;
    if (hint === 'move') {
      return this.touch
        ? t('hint.moveTouch')
        : t('hint.move', { move: movementLabel(t, bindings(), MOVE_ACTIONS) });
    }
    const action = HINT_ACTION[hint];
    if (!action) return t(`hint.${hint}`);
    const key = this.touch
      ? (TOUCH_GLYPHS[action] ?? actionLabel(t, bindings(), action))
      : actionLabel(t, bindings(), action);
    return t(`hint.${hint}`, { key });
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
    setStyle(this.root, 'display', visible ? 'block' : 'none');
  }
}
