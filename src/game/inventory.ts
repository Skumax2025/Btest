/**
 * L2 module: grid inventory.
 *
 * Knows: an N×M grid, multi-cell footprints, stacking, a weight budget and one
 * slot held in hand. Every operation is a pure function of the state plus a
 * catalogue, which is why it is fully unit-tested without a browser.
 *
 * Does not know: mouse dragging, rendering, or what any item does — the UI
 * calls `moveStack`, and the run calls `useHeld`.
 */

import type { ItemCatalog, ItemDef } from './items';

export interface InventoryStack {
  readonly id: number;
  itemId: string;
  count: number;
  /** Top-left cell of the footprint. */
  x: number;
  y: number;
  /** Remaining charge for light sources, in seconds. Zero for everything else. */
  charge: number;
}

export interface InventoryState {
  readonly width: number;
  readonly height: number;
  readonly capacity: number;
  stacks: InventoryStack[];
  nextId: number;
  /** Id of the stack held in hand, or null. */
  hand: number | null;
}

export const createInventory = (
  width: number,
  height: number,
  capacity: number,
): InventoryState => ({
  width,
  height,
  capacity,
  stacks: [],
  nextId: 1,
  hand: null,
});

export const findStack = (state: InventoryState, id: number): InventoryStack | undefined =>
  state.stacks.find((stack) => stack.id === id);

const footprint = (def: ItemDef): { w: number; h: number } => ({
  w: Math.max(1, def.width),
  h: Math.max(1, def.height),
});

const overlaps = (
  stack: InventoryStack,
  def: ItemDef,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean => {
  const size = footprint(def);
  return (
    x < stack.x + size.w && x + w > stack.x && y < stack.y + size.h && y + h > stack.y
  );
};

export const canPlace = (
  state: InventoryState,
  catalog: ItemCatalog,
  itemId: string,
  x: number,
  y: number,
  ignoreId = -1,
): boolean => {
  const def = catalog[itemId];
  if (!def) return false;
  const { w, h } = footprint(def);
  if (x < 0 || y < 0 || x + w > state.width || y + h > state.height) return false;
  for (const stack of state.stacks) {
    if (stack.id === ignoreId) continue;
    const otherDef = catalog[stack.itemId];
    if (!otherDef) continue;
    if (overlaps(stack, otherDef, x, y, w, h)) return false;
  }
  return true;
};

export const stackAt = (
  state: InventoryState,
  catalog: ItemCatalog,
  x: number,
  y: number,
): InventoryStack | null => {
  for (const stack of state.stacks) {
    const def = catalog[stack.itemId];
    if (!def) continue;
    const { w, h } = footprint(def);
    if (x >= stack.x && x < stack.x + w && y >= stack.y && y < stack.y + h) return stack;
  }
  return null;
};

export const totalWeight = (state: InventoryState, catalog: ItemCatalog): number => {
  let total = 0;
  for (const stack of state.stacks) {
    const def = catalog[stack.itemId];
    if (def) total += def.weight * stack.count;
  }
  return total;
};

const firstFreeCell = (
  state: InventoryState,
  catalog: ItemCatalog,
  itemId: string,
): { x: number; y: number } | null => {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (canPlace(state, catalog, itemId, x, y)) return { x, y };
    }
  }
  return null;
};

/**
 * Adds units, filling existing stacks first. Returns how many did not fit —
 * either because the grid is full or because the weight budget is spent.
 */
export const addItem = (
  state: InventoryState,
  catalog: ItemCatalog,
  itemId: string,
  count: number,
): number => {
  const def = catalog[itemId];
  if (!def || count <= 0) return count;
  let remaining = count;

  for (const stack of state.stacks) {
    if (remaining <= 0) break;
    if (stack.itemId !== itemId || stack.count >= def.maxStack) continue;
    const room = def.maxStack - stack.count;
    const taken = Math.min(room, remaining);
    if (def.weight > 0 && totalWeight(state, catalog) + def.weight * taken > state.capacity) break;
    stack.count += taken;
    remaining -= taken;
  }

  while (remaining > 0) {
    if (totalWeight(state, catalog) + def.weight > state.capacity) break;
    const cell = firstFreeCell(state, catalog, itemId);
    if (!cell) break;
    const taken = Math.min(def.maxStack, remaining);
    const affordable =
      def.weight > 0
        ? Math.min(taken, Math.floor((state.capacity - totalWeight(state, catalog)) / def.weight))
        : taken;
    if (affordable <= 0) break;
    state.stacks.push({
      id: state.nextId++,
      itemId,
      count: affordable,
      x: cell.x,
      y: cell.y,
      charge: def.charge,
    });
    remaining -= affordable;
  }
  return remaining;
};

/** Moves a stack to a new cell, merging into a compatible stack when possible. */
export const moveStack = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
  x: number,
  y: number,
): boolean => {
  const stack = findStack(state, id);
  if (!stack) return false;
  const target = stackAt(state, catalog, x, y);
  if (target && target.id !== id) {
    const def = catalog[stack.itemId];
    if (!def || target.itemId !== stack.itemId || target.count >= def.maxStack) return false;
    const moved = Math.min(def.maxStack - target.count, stack.count);
    target.count += moved;
    stack.count -= moved;
    if (stack.count <= 0) removeStack(state, id);
    return true;
  }
  if (!canPlace(state, catalog, stack.itemId, x, y, id)) return false;
  stack.x = x;
  stack.y = y;
  return true;
};

export const removeStack = (state: InventoryState, id: number): void => {
  state.stacks = state.stacks.filter((stack) => stack.id !== id);
  if (state.hand === id) state.hand = null;
};

/** Spends units from a stack; removes it when it empties. */
export const takeFrom = (state: InventoryState, id: number, count: number): number => {
  const stack = findStack(state, id);
  if (!stack) return 0;
  const taken = Math.min(stack.count, count);
  stack.count -= taken;
  if (stack.count <= 0) removeStack(state, id);
  return taken;
};

export const heldStack = (state: InventoryState): InventoryStack | null =>
  state.hand === null ? null : (findStack(state, state.hand) ?? null);

export const setHand = (state: InventoryState, id: number | null): void => {
  state.hand = id !== null && findStack(state, id) ? id : null;
};

export const countOf = (state: InventoryState, itemId: string): number =>
  state.stacks.reduce((sum, stack) => sum + (stack.itemId === itemId ? stack.count : 0), 0);
