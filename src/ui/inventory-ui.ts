/**
 * L4: the bag.
 *
 * A DOM grid over the canvas. Drag with the left button to move a stack, right
 * click to put one in hand. All rules live in `@game/inventory`; this file only
 * turns pointer events into calls.
 */

import { moveStack, setHand, stackAt } from '@game/inventory';
import type { InventoryState, InventoryStack } from '@game/inventory';
import type { ItemCatalog } from '@game/items';
import type { UiContext } from './context';
import { actionLabel } from './keys';
import { el, setStyle, setText } from './dom';

export interface InventoryUiOptions {
  readonly cellPixels: number;
}

interface DragState {
  readonly stackId: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly node: HTMLElement;
}

export class InventoryUi {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly nodes = new Map<number, HTMLElement>();
  private drag: DragState | null = null;
  private signature = '';
  private open = false;

  constructor(
    parent: HTMLElement,
    private state: InventoryState,
    private readonly catalog: ItemCatalog,
    private readonly options: InventoryUiOptions,
    private readonly ui: UiContext,
  ) {
    this.root = el('div', 'bag', parent);
    ui.binder.bind(el('div', 'bag-title', this.root), 'inventory.title');
    this.grid = el('div', 'bag-grid', this.root);
    setStyle(this.grid, 'width', `${state.width * options.cellPixels}px`);
    setStyle(this.grid, 'height', `${state.height * options.cellPixels}px`);
    setStyle(
      this.grid,
      'background-size',
      `${options.cellPixels}px ${options.cellPixels}px`,
    );
    ui.binder.bind(el('div', 'bag-help', this.root), 'inventory.help', () => ({
      drop: actionLabel(ui.t, ui.bindings(), 'drop'),
    }));
    this.setOpen(false);

    this.grid.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.grid.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Points the panel at a different bag — used when a new run starts. */
  setState(state: InventoryState): void {
    this.state = state;
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.signature = '';
    this.update();
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    setStyle(this.root, 'display', open ? 'block' : 'none');
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  update(): void {
    if (!this.open) return;
    const signature = this.state.stacks
      .map((stack) => `${stack.id}:${stack.itemId}:${stack.count}:${stack.x}:${stack.y}`)
      .join('|')
      .concat(`#${this.state.hand ?? 0}`);
    if (signature === this.signature) return;
    this.signature = signature;
    this.render();
  }

  private render(): void {
    const seen = new Set<number>();
    for (const stack of this.state.stacks) {
      seen.add(stack.id);
      const node = this.nodes.get(stack.id) ?? this.createNode(stack);
      this.layout(node, stack);
    }
    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.remove();
      this.nodes.delete(id);
    }
  }

  private createNode(stack: InventoryStack): HTMLElement {
    const node = el('div', 'bag-item', this.grid);
    node.dataset.stackId = String(stack.id);
    el('span', 'bag-item-name', node);
    el('span', 'bag-item-count', node);
    this.nodes.set(stack.id, node);
    return node;
  }

  private layout(node: HTMLElement, stack: InventoryStack): void {
    const def = this.catalog[stack.itemId];
    const cell = this.options.cellPixels;
    const width = (def?.width ?? 1) * cell;
    const height = (def?.height ?? 1) * cell;
    setStyle(node, 'left', `${stack.x * cell}px`);
    setStyle(node, 'top', `${stack.y * cell}px`);
    setStyle(node, 'width', `${width}px`);
    setStyle(node, 'height', `${height}px`);
    node.classList.toggle('bag-item--held', this.state.hand === stack.id);
    const name = node.querySelector('.bag-item-name');
    const count = node.querySelector('.bag-item-count');
    if (name instanceof HTMLElement) setText(name, def ? this.ui.t(def.nameKey) : stack.itemId);
    if (count instanceof HTMLElement) setText(count, stack.count > 1 ? `x${stack.count}` : '');
  }

  private cellFromEvent(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = this.grid.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) / this.options.cellPixels),
      y: Math.floor((event.clientY - rect.top) / this.options.cellPixels),
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const cell = this.cellFromEvent(event);
    const stack = stackAt(this.state, this.catalog, cell.x, cell.y);
    if (!stack) return;
    const node = this.nodes.get(stack.id);
    if (!node) return;
    event.preventDefault();
    this.drag = {
      stackId: stack.id,
      offsetX: cell.x - stack.x,
      offsetY: cell.y - stack.y,
      node,
    };
    node.classList.add('bag-item--dragging');
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    const cell = this.cellFromEvent(event);
    const cellPixels = this.options.cellPixels;
    setStyle(this.drag.node, 'left', `${(cell.x - this.drag.offsetX) * cellPixels}px`);
    setStyle(this.drag.node, 'top', `${(cell.y - this.drag.offsetY) * cellPixels}px`);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    drag.node.classList.remove('bag-item--dragging');
    const cell = this.cellFromEvent(event);
    moveStack(
      this.state,
      this.catalog,
      drag.stackId,
      cell.x - drag.offsetX,
      cell.y - drag.offsetY,
    );
    this.signature = '';
    this.update();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const cell = this.cellFromEvent(event);
    const stack = stackAt(this.state, this.catalog, cell.x, cell.y);
    setHand(this.state, stack ? stack.id : null);
    this.signature = '';
    this.update();
  };
}
