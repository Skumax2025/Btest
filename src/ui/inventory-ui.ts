/**
 * L4: the bag and the body.
 *
 * Equipment down the left as a silhouette, the bag as cells on the right, the
 * belt along the bottom. Drag anything anywhere: a slot that will not take what
 * is over it says so before the button comes up. All rules live in
 * `@game/inventory`; this file turns pointer events into calls and draws the
 * result.
 */

import {
  canBelt,
  canEquip,
  capacity,
  containerStacks,
  equippedStack,
  findStack,
  freeCells,
  isEquipped,
  mergeStacks,
  moveToContainer,
  overflowFor,
  pocketRoom,
  quickIndexOf,
  quickStack,
  setQuick,
  splitStack,
  unpack,
} from '@game/inventory';
import type { InventoryStack, InventoryState } from '@game/inventory';
import { EQUIP_SLOTS, condition, effectsOf, isSpoiled } from '@game/items';
import type { EquipSlot, ItemCatalog, ItemDef } from '@game/items';
import type { UiContext } from './context';
import { actionLabel } from './keys';
import { el, setStyle, setText } from './dom';

export interface InventoryUiOptions {
  readonly cellPixels: number;
  readonly columns: number;
  /** Condition below which an icon reads as worn, then as failing. */
  readonly wornFraction: number;
  readonly failingFraction: number;
}

/** What the panel cannot do itself, because it changes the world. */
export interface InventoryHost {
  use(id: number): void;
  equip(id: number, slot: EquipSlot): void;
  unequip(id: number): void;
  drop(id: number): void;
}

/** Where a dragged stack can be let go. */
type DropTarget =
  | { readonly kind: 'container' }
  | { readonly kind: 'slot'; readonly slot: EquipSlot }
  | { readonly kind: 'quick'; readonly index: number }
  | { readonly kind: 'stack'; readonly id: number };

interface DragState {
  readonly stackId: number;
  readonly node: HTMLElement;
}

/**
 * A finger held still on a stack. There is no second mouse button on a phone,
 * and the list this opens is the only way to equip a thing to a slot it does not
 * fit by default, split a stack, or drop one from the bag.
 */
interface LongPress {
  readonly stackId: number;
  readonly x: number;
  readonly y: number;
  readonly timer: number;
}

/** Milliseconds a finger must stay put, and how far it may drift while it does. */
const LONG_PRESS_MS = 420;
const LONG_PRESS_SLOP = 12;

interface SlotView {
  readonly root: HTMLElement;
  readonly target: DropTarget;
}

export class InventoryUi {
  private readonly root: HTMLElement;
  private readonly slotArea: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly belt: HTMLElement;
  private readonly cellsLabel: HTMLElement;
  private readonly help: HTMLElement;
  private readonly tooltip: HTMLElement;
  private readonly tooltipIcon: HTMLElement;
  private readonly tooltipText: HTMLElement;
  private readonly confirmBar: HTMLElement;
  private readonly confirmText: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly slotViews = new Map<string, SlotView>();
  private readonly nodes = new Map<number, HTMLElement>();
  private drag: DragState | null = null;
  private longPress: LongPress | null = null;
  private pending: { id: number; slot: EquipSlot } | null = null;
  private open = false;
  /** True while the on-screen pad is up, which changes how the panel explains itself. */
  private touch = false;

  constructor(
    parent: HTMLElement,
    private state: InventoryState,
    private readonly catalog: ItemCatalog,
    private readonly options: InventoryUiOptions,
    private readonly ui: UiContext,
    private readonly host: InventoryHost,
  ) {
    this.root = el('div', 'bag', parent);
    ui.binder.bind(el('div', 'bag-title', this.root), 'inventory.title');

    const columns = el('div', 'bag-columns', this.root);
    const left = el('div', 'bag-figure', columns);
    ui.binder.bind(el('div', 'bag-section', left), 'inventory.equipment');
    this.slotArea = el('div', 'bag-slots', left);

    const right = el('div', 'bag-side', columns);
    const heading = el('div', 'bag-section-row', right);
    ui.binder.bind(el('span', 'bag-section', heading), 'inventory.container');
    this.cellsLabel = el('span', 'bag-cells', heading);
    this.grid = el('div', 'bag-grid', right);
    setStyle(this.grid, 'grid-template-columns', `repeat(${options.columns}, ${options.cellPixels}px)`);
    ui.binder.bind(el('div', 'bag-section', right), 'inventory.belt');
    this.belt = el('div', 'bag-belt', right);

    this.confirmBar = el('div', 'bag-confirm', this.root);
    this.confirmText = el('span', 'bag-confirm-text', this.confirmBar);
    const yes = el('button', 'bag-confirm-button', this.confirmBar);
    const no = el('button', 'bag-confirm-button', this.confirmBar);
    ui.binder.bind(yes, 'ui.yes');
    ui.binder.bind(no, 'ui.no');
    yes.addEventListener('click', () => this.resolveConfirm(true));
    no.addEventListener('click', () => this.resolveConfirm(false));
    this.confirmBar.hidden = true;

    // Written every frame rather than bound once: what the panel has to explain
    // depends on what the player is holding it with.
    this.help = el('div', 'bag-help', this.root);

    this.tooltip = el('div', 'bag-tooltip', this.root);
    this.tooltipIcon = el('span', 'bag-tooltip-icon', this.tooltip);
    this.tooltipText = el('span', 'bag-tooltip-text', this.tooltip);
    this.tooltip.hidden = true;
    this.menu = el('div', 'bag-menu', this.root);
    this.menu.hidden = true;

    this.buildSlots();
    this.setOpen(false);

    this.root.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.root.addEventListener('contextmenu', this.onContextMenu);
    this.root.addEventListener('dblclick', this.onDoubleClick);
    this.root.addEventListener('pointerover', this.onHover);
    this.root.addEventListener('pointerleave', () => this.hideTooltip());
  }

  /** Points the panel at a different bag — used when a new run starts. */
  setState(state: InventoryState): void {
    this.state = state;
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.pending = null;
    this.confirmBar.hidden = true;
    this.closeMenu();
    this.buildBelt();
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Whether a pad is up, so the help line describes fingers rather than a mouse. */
  setTouch(touch: boolean): void {
    this.touch = touch;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.cancelLongPress();
    setStyle(this.root, 'display', open ? 'block' : 'none');
    if (!open) {
      this.closeMenu();
      this.hideTooltip();
    } else {
      this.render();
    }
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  /** The world keeps moving while this is open, so it redraws every frame. */
  update(): void {
    if (!this.open) return;
    this.render();
  }

  // ── construction ──────────────────────────────────────────────────────────

  private buildSlots(): void {
    for (const slot of EQUIP_SLOTS) {
      const node = el('div', `bag-slot bag-slot--${slot}`, this.slotArea);
      node.dataset.slot = slot;
      this.ui.binder.bind(el('span', 'bag-slot-label', node), `inventory.slot.${slot}`);
      el('div', 'bag-slot-body', node);
      this.slotViews.set(`slot:${slot}`, { root: node, target: { kind: 'slot', slot } });
    }
    this.buildBelt();
  }

  private buildBelt(): void {
    this.belt.replaceChildren();
    for (let index = 0; index < this.state.quick.length; index++) {
      const node = el('div', 'bag-quick', this.belt);
      node.dataset.quick = String(index);
      setText(el('span', 'bag-quick-key', node), String(index + 1));
      el('div', 'bag-quick-body', node);
      this.slotViews.set(`quick:${index}`, { root: node, target: { kind: 'quick', index } });
    }
  }

  // ── drawing ───────────────────────────────────────────────────────────────

  /**
   * Nodes are reused, never rebuilt: the world keeps running while this panel is
   * open, so it redraws constantly, and a node replaced under the pointer would
   * swallow the second half of a double click and drop whatever is being dragged.
   */
  private render(): void {
    if (this.drag) return;
    const { t, bindings } = this.ui;
    setText(
      this.help,
      this.touch
        ? t('inventory.helpTouch')
        : t('inventory.help', {
            drop: actionLabel(t, bindings(), 'drop'),
            swap: actionLabel(t, bindings(), 'swapHands'),
          }),
    );
    const cells = capacity(this.state, this.catalog);
    const stacks = containerStacks(this.state);
    setText(
      this.cellsLabel,
      this.ui.t('inventory.cellsUsed', { used: stacks.length, total: cells }),
    );

    while (this.grid.childElementCount < cells) el('div', 'bag-cell', this.grid);
    while (this.grid.childElementCount > cells) this.grid.lastElementChild?.remove();
    for (let index = 0; index < cells; index++) {
      const cell = this.grid.children[index];
      if (cell instanceof HTMLElement) this.place(cell, stacks[index] ?? null);
    }

    for (const slot of EQUIP_SLOTS) {
      const body = this.slotViews.get(`slot:${slot}`)?.root.querySelector('.bag-slot-body');
      if (body instanceof HTMLElement) this.place(body, equippedStack(this.state, slot));
    }
    for (let index = 0; index < this.state.quick.length; index++) {
      const body = this.slotViews.get(`quick:${index}`)?.root.querySelector('.bag-quick-body');
      if (body instanceof HTMLElement) this.place(body, quickStack(this.state, index));
    }

    for (const [id, node] of this.nodes) {
      if (findStack(this.state, id)) continue;
      node.remove();
      this.nodes.delete(id);
    }
  }

  /** Puts the right node in a holder, or empties it, without touching the rest. */
  private place(host: HTMLElement, stack: InventoryStack | null): void {
    if (!stack) {
      if (host.firstElementChild) host.replaceChildren();
      return;
    }
    const node = this.nodeFor(stack);
    if (host.firstElementChild !== node) host.replaceChildren(node);
    this.paint(node, stack);
  }

  private nodeFor(stack: InventoryStack): HTMLElement {
    const existing = this.nodes.get(stack.id);
    if (existing) return existing;
    const node = el('div', 'bag-item');
    node.dataset.stackId = String(stack.id);
    el('span', 'bag-item-icon', node);
    el('span', 'bag-item-name', node);
    el('span', 'bag-item-count', node);
    el('span', 'bag-item-pocket', node);
    const track = el('div', 'bag-item-wear', node);
    el('div', 'bag-item-wear-fill', track);
    this.nodes.set(stack.id, node);
    return node;
  }

  /** Wear is always on the icon: a bar, not a number hidden in a panel. */
  private paint(node: HTMLElement, stack: InventoryStack): void {
    const def = this.catalog[stack.itemId];
    const icon = node.querySelector('.bag-item-icon');
    if (icon instanceof HTMLElement) this.ui.icons.paint(icon, def ? def.sprite : null);
    const name = node.querySelector('.bag-item-name');
    const count = node.querySelector('.bag-item-count');
    const track = node.querySelector('.bag-item-wear');
    const fill = node.querySelector('.bag-item-wear-fill');
    if (name instanceof HTMLElement) {
      setText(name, def ? this.ui.t(def.nameKey) : stack.itemId);
    }
    if (count instanceof HTMLElement) setText(count, stack.count > 1 ? `x${stack.count}` : '');
    const pocket = node.querySelector('.bag-item-pocket');
    if (pocket instanceof HTMLElement) {
      setText(pocket, stack.contents.length > 0 ? `+${stack.contents.length}` : '');
    }
    const max = def ? (def.durability?.max ?? 0) : 0;
    if (track instanceof HTMLElement) track.hidden = max <= 0;
    if (max > 0 && def && fill instanceof HTMLElement) {
      const share = condition(def, stack.durability);
      setStyle(fill, 'width', `${Math.round(share * 100)}%`);
      node.classList.toggle('bag-item--worn', share <= this.options.wornFraction);
      node.classList.toggle('bag-item--failing', share <= this.options.failingFraction);
    }
  }

  // ── hit testing ───────────────────────────────────────────────────────────

  private stackIdAt(node: EventTarget | null): number | null {
    if (!(node instanceof HTMLElement)) return null;
    const item = node.closest('.bag-item');
    if (!(item instanceof HTMLElement) || !item.dataset.stackId) return null;
    return Number(item.dataset.stackId);
  }

  private targetAt(x: number, y: number): DropTarget | null {
    for (const view of this.slotViews.values()) {
      const rect = view.root.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return view.target;
      }
    }
    const gridRect = this.grid.getBoundingClientRect();
    if (x >= gridRect.left && x <= gridRect.right && y >= gridRect.top && y <= gridRect.bottom) {
      const under = document.elementFromPoint(x, y);
      const id = this.stackIdAt(under);
      if (id !== null && id !== this.drag?.stackId) return { kind: 'stack', id };
      return { kind: 'container' };
    }
    return null;
  }

  private accepts(stack: InventoryStack, target: DropTarget): boolean {
    switch (target.kind) {
      case 'container':
        return true;
      case 'slot':
        return canEquip(this.catalog, stack.itemId, target.slot);
      case 'quick':
        return canBelt(this.catalog, stack.itemId);
      case 'stack': {
        const other = findStack(this.state, target.id);
        const def = this.catalog[stack.itemId];
        return (
          !!other && !!def && other.itemId === stack.itemId && def.maxStack > 1
        );
      }
    }
  }

  // ── pointer ───────────────────────────────────────────────────────────────

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    // A press inside the menu is the player choosing from it. Closing the menu
    // here would take the button out from under the click that follows, which is
    // exactly how every entry in it stopped working.
    if (event.target instanceof HTMLElement && event.target.closest('.bag-menu')) return;
    this.closeMenu();
    const id = this.stackIdAt(event.target);
    if (id === null) return;
    const node = event.target instanceof HTMLElement ? event.target.closest('.bag-item') : null;
    if (!(node instanceof HTMLElement)) return;
    event.preventDefault();
    this.drag = { stackId: id, node };
    node.classList.add('bag-item--dragging');
    // No right button on a touchscreen: holding still opens the same list.
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      this.longPress = {
        stackId: id,
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => this.fireLongPress(), LONG_PRESS_MS),
      };
    }
  };

  /** The hold survived: drop the drag it started as and open the list instead. */
  private fireLongPress(): void {
    const press = this.longPress;
    this.longPress = null;
    if (!press) return;
    if (this.drag) {
      this.drag.node.classList.remove('bag-item--dragging');
      this.drag = null;
    }
    this.openMenu(press.stackId, press.x, press.y);
  }

  private cancelLongPress(): void {
    if (!this.longPress) return;
    window.clearTimeout(this.longPress.timer);
    this.longPress = null;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const press = this.longPress;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP) {
      this.cancelLongPress();
    }
    if (!this.drag) return;
    const stack = findStack(this.state, this.drag.stackId);
    if (!stack) return;
    const target = this.targetAt(event.clientX, event.clientY);
    for (const view of this.slotViews.values()) {
      view.root.classList.remove('bag-slot--allowed', 'bag-slot--blocked');
    }
    if (!target || target.kind === 'container' || target.kind === 'stack') return;
    const key = target.kind === 'slot' ? `slot:${target.slot}` : `quick:${target.index}`;
    const view = this.slotViews.get(key);
    if (view) {
      view.root.classList.add(
        this.accepts(stack, target) ? 'bag-slot--allowed' : 'bag-slot--blocked',
      );
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.cancelLongPress();
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    drag.node.classList.remove('bag-item--dragging');
    for (const view of this.slotViews.values()) {
      view.root.classList.remove('bag-slot--allowed', 'bag-slot--blocked');
    }
    const stack = findStack(this.state, drag.stackId);
    const target = this.targetAt(event.clientX, event.clientY);
    if (!stack || !target || !this.accepts(stack, target)) {
      this.render();
      return;
    }
    switch (target.kind) {
      case 'container':
        this.intoBag(stack.id);
        break;
      case 'slot':
        this.requestEquip(stack.id, target.slot);
        break;
      case 'quick':
        moveToContainer(this.state, stack.id);
        setQuick(this.state, this.catalog, stack.id, target.index);
        break;
      case 'stack':
        mergeStacks(this.state, this.catalog, stack.id, target.id);
        break;
    }
    this.render();
  };

  /**
   * Into the bag from wherever it was. Taking a worn piece off goes through the
   * run, which refuses when there is no cell for it; coming off the belt is
   * refused here for the same reason. Neither may quietly push something else
   * out of the bag and onto the floor.
   */
  private intoBag(id: number): void {
    if (isEquipped(this.state, id)) {
      this.host.unequip(id);
      return;
    }
    if (quickIndexOf(this.state, id) >= 0 && freeCells(this.state, this.catalog) <= 0) return;
    moveToContainer(this.state, id);
  }

  /**
   * A smaller pack costs whatever no longer fits. What another pocket will take
   * is not a loss and needs no warning; what hits the floor is, and does.
   */
  private requestEquip(id: number, slot: EquipSlot): void {
    const preview = overflowFor(this.state, this.catalog, id, slot);
    if (preview.spilled.length === 0) {
      this.host.equip(id, slot);
      return;
    }
    this.pending = { id, slot };
    setText(this.confirmText, this.ui.t('inventory.spill', { count: preview.spilled.length }));
    this.confirmBar.hidden = false;
  }

  private resolveConfirm(accepted: boolean): void {
    const pending = this.pending;
    this.pending = null;
    this.confirmBar.hidden = true;
    if (accepted && pending) this.host.equip(pending.id, pending.slot);
    this.render();
  }

  // ── actions ───────────────────────────────────────────────────────────────

  private readonly onDoubleClick = (event: MouseEvent): void => {
    const id = this.stackIdAt(event.target);
    if (id === null) return;
    event.preventDefault();
    this.primaryAction(id);
    this.render();
  };

  /** Double click does the obvious thing: eat it, wear it, or put it down. */
  private primaryAction(id: number): void {
    const stack = findStack(this.state, id);
    const def = stack ? this.catalog[stack.itemId] : undefined;
    if (!stack || !def) return;
    if (def.use) {
      this.host.use(id);
      return;
    }
    if (def.slots.length > 0) {
      const slot = def.slots.find((candidate) => this.state.equipment[candidate] === null);
      this.requestEquip(id, slot ?? def.slots[0]);
    }
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const id = this.stackIdAt(event.target);
    if (id === null) {
      this.closeMenu();
      return;
    }
    this.openMenu(id, event.clientX, event.clientY);
  };

  private openMenu(id: number, clientX: number, clientY: number): void {
    const stack = findStack(this.state, id);
    const def = stack ? this.catalog[stack.itemId] : undefined;
    if (!stack || !def) return;
    this.menu.replaceChildren();
    const add = (key: string, run: () => void): void => {
      const entry = el('button', 'bag-menu-item', this.menu);
      setText(entry, this.ui.t(key));
      entry.addEventListener('click', () => {
        run();
        this.closeMenu();
        this.render();
      });
    };

    if (def.use) add(this.useLabel(def), () => this.host.use(id));
    for (const slot of def.slots) {
      if (this.state.equipment[slot] === id) continue;
      add(`inventory.action.equip.${slot}`, () => this.requestEquip(id, slot));
    }
    if (this.state.quick.includes(id)) {
      add('inventory.action.fromBelt', () => moveToContainer(this.state, id));
    } else if (canBelt(this.catalog, stack.itemId)) {
      const free = this.state.quick.findIndex((entry) => entry === null);
      const index = free >= 0 ? free : 0;
      add('inventory.action.toBelt', () => {
        moveToContainer(this.state, id);
        setQuick(this.state, this.catalog, id, index);
      });
    }
    if (stack.contents.length > 0) {
      add('inventory.action.unpack', () => unpack(this.state, this.catalog, id));
    }
    for (const slot of EQUIP_SLOTS) {
      if (this.state.equipment[slot] !== id) continue;
      add('inventory.action.takeOff', () => this.host.unequip(id));
    }
    if (stack.count > 1) {
      add('inventory.action.split', () => {
        splitStack(this.state, this.catalog, id, Math.floor(stack.count / 2));
      });
    }
    add('inventory.action.drop', () => this.host.drop(id));

    const rect = this.root.getBoundingClientRect();
    setStyle(this.menu, 'left', `${clientX - rect.left}px`);
    setStyle(this.menu, 'top', `${clientY - rect.top}px`);
    this.menu.hidden = false;
  }

  private useLabel(def: ItemDef): string {
    if (def.tags.includes('drink')) return 'inventory.action.drink';
    if (def.tags.includes('food')) return 'inventory.action.eat';
    return 'inventory.action.use';
  }

  private closeMenu(): void {
    this.menu.hidden = true;
  }

  // ── hover ─────────────────────────────────────────────────────────────────

  private readonly onHover = (event: PointerEvent): void => {
    const id = this.stackIdAt(event.target);
    if (id === null) {
      this.hideTooltip();
      return;
    }
    const stack = findStack(this.state, id);
    const def = stack ? this.catalog[stack.itemId] : undefined;
    if (!stack || !def) {
      this.hideTooltip();
      return;
    }
    this.ui.icons.paint(this.tooltipIcon, def.sprite);
    setText(this.tooltipText, this.describe(def, stack));
    const rect = this.root.getBoundingClientRect();
    setStyle(this.tooltip, 'left', `${event.clientX - rect.left + 16}px`);
    setStyle(this.tooltip, 'top', `${event.clientY - rect.top + 16}px`);
    this.tooltip.hidden = false;
  };

  private hideTooltip(): void {
    this.tooltip.hidden = true;
  }

  /** Everything the panel knows about one thing, in the player's language. */
  private describe(def: ItemDef, stack: InventoryStack): string {
    const { t } = this.ui;
    const lines = [t(def.nameKey), t(def.descriptionKey)];
    if ((def.durability?.max ?? 0) > 0) {
      const share = Math.round(condition(def, stack.durability) * 100);
      const label = def.use && def.use.spoiled ? 'inventory.freshness' : 'inventory.condition';
      lines.push(`${t(label)}: ${t('ui.percent', { value: share })}`);
      if (isSpoiled(def, stack.durability)) lines.push(t('inventory.spoiled'));
    }
    if (def.charge > 0) {
      lines.push(`${t('hud.charge')}: ${t('ui.seconds', { value: Math.ceil(stack.charge) })}`);
    }
    if (def.slots.length > 0) {
      const slots = def.slots.map((slot) => t(`inventory.slot.${slot}`)).join(', ');
      lines.push(`${t('inventory.requires')}: ${slots}`);
    }
    if (def.carry) {
      const room = pocketRoom(this.catalog, stack);
      lines.push(`${t('inventory.pockets')}: ${stack.contents.length}/${stack.contents.length + room}`);
      for (const held of stack.contents) {
        const heldDef = this.catalog[held.itemId];
        lines.push(`  · ${heldDef ? t(heldDef.nameKey) : held.itemId}`);
      }
    }
    const effects = this.effectLines(def, stack);
    if (effects.length > 0) lines.push(effects.join(' · '));
    return lines.join('\n');
  }

  private effectLines(def: ItemDef, stack: InventoryStack): string[] {
    const { t } = this.ui;
    const out: string[] = [];
    for (const effect of effectsOf(def, stack.durability)) {
      switch (effect.kind) {
        case 'stat':
        case 'lasting': {
          const parts: string[] = [];
          for (const key of ['health', 'hunger', 'thirst', 'stamina', 'sanity'] as const) {
            const value = effect[key];
            if (value) parts.push(`${t(`hud.${key}`)} ${value > 0 ? '+' : ''}${value}`);
          }
          if (parts.length === 0) break;
          out.push(
            effect.kind === 'lasting'
              ? `${parts.join(' ')} (${t('ui.seconds', { value: effect.seconds })})`
              : parts.join(' '),
          );
          break;
        }
        case 'charge':
          out.push(`${t('hud.charge')} +${effect.seconds}`);
          break;
        case 'noise':
          out.push(t('inventory.loud'));
          break;
        case 'repair':
          out.push(`${t('inventory.repairs')} +${effect.amount}`);
          break;
      }
    }
    if (def.melee) out.push(`${t('inventory.damage')} ${def.melee.damage}`);
    if (def.armor) out.push(`${t('inventory.armor')} ${def.armor.flat}`);
    return out;
  }
}
