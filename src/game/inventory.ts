/**
 * L2 module: what you are wearing and what you are carrying.
 *
 * Knows: nine equipment slots, a bag measured in cells rather than kilograms,
 * a row of quick slots, stacking, and the one condition value every item wears
 * down. Every operation is a pure function of the state plus a catalogue, which
 * is why it is fully unit-tested without a browser.
 *
 * Does not know: mouse dragging, rendering, or what any item does — the UI calls
 * `equip` and `moveToContainer`, and the run calls `useStack`.
 */

import type { EquipSlot, ItemCatalog, ItemDef, PassiveDef, WearOutcome } from './items';
import { EQUIP_SLOTS, NEUTRAL_PASSIVE, armorOf, carryCells, condition, fitsSlot, maxDurability, passiveOf } from './items';

export interface InventoryStack {
  readonly id: number;
  itemId: string;
  count: number;
  /** Remaining charge for light sources, in seconds. Zero for everything else. */
  charge: number;
  /**
   * The one condition value. What it means is the item's business: swing damage,
   * damage soaked, footstep noise, pocket count or how long ago the tin was
   * sealed. Zero has a different consequence per category, and that consequence
   * is data too.
   */
  durability: number;
}

export interface InventoryLayout {
  /** Cells you have with nothing on your back. This is what replaced weight. */
  readonly baseCells: number;
  readonly quickSlots: number;
  /** Ceiling on cells, so no pack can outgrow the panel that draws it. */
  readonly maxCells: number;
}

export type Equipment = Record<EquipSlot, number | null>;

export interface InventoryState {
  readonly layout: InventoryLayout;
  /** Every stack that exists, wherever it currently sits. */
  stacks: InventoryStack[];
  /** Stack id worn in each slot, or null. */
  equipment: Equipment;
  /** Stack ids on the belt, by index. Quick slots do not cost bag cells. */
  quick: (number | null)[];
  nextId: number;
}

const emptyEquipment = (): Equipment => ({
  head: null,
  face: null,
  body: null,
  vest: null,
  legs: null,
  feet: null,
  back: null,
  hand: null,
  offhand: null,
});

export const createInventory = (layout: InventoryLayout): InventoryState => ({
  layout,
  stacks: [],
  equipment: emptyEquipment(),
  quick: Array.from({ length: layout.quickSlots }, () => null),
  nextId: 1,
});

export const findStack = (state: InventoryState, id: number): InventoryStack | undefined =>
  state.stacks.find((stack) => stack.id === id);

export const slotOf = (state: InventoryState, id: number): EquipSlot | null => {
  for (const slot of EQUIP_SLOTS) if (state.equipment[slot] === id) return slot;
  return null;
};

export const quickIndexOf = (state: InventoryState, id: number): number =>
  state.quick.indexOf(id);

export const isEquipped = (state: InventoryState, id: number): boolean =>
  slotOf(state, id) !== null;

/** Everything that is neither worn nor on the belt — the bag proper. */
export const containerStacks = (state: InventoryState): InventoryStack[] =>
  state.stacks.filter(
    (stack) => slotOf(state, stack.id) === null && quickIndexOf(state, stack.id) < 0,
  );

export const equippedStack = (state: InventoryState, slot: EquipSlot): InventoryStack | null => {
  const id = state.equipment[slot];
  return id === null ? null : (findStack(state, id) ?? null);
};

export const quickStack = (state: InventoryState, index: number): InventoryStack | null => {
  const id = state.quick[index] ?? null;
  return id === null ? null : (findStack(state, id) ?? null);
};

/** Base cells plus whatever a pack and a pair of pockets are still worth. */
export const capacity = (state: InventoryState, catalog: ItemCatalog): number => {
  let cells = state.layout.baseCells;
  for (const slot of EQUIP_SLOTS) {
    const stack = equippedStack(state, slot);
    const def = stack ? catalog[stack.itemId] : undefined;
    if (stack && def) cells += carryCells(def, stack.durability);
  }
  return Math.min(state.layout.maxCells, Math.max(0, cells));
};

export const usedCells = (state: InventoryState): number => containerStacks(state).length;

export const freeCells = (state: InventoryState, catalog: ItemCatalog): number =>
  capacity(state, catalog) - usedCells(state);

/** One stack of one item, born at whatever condition the catalogue says. */
const newStack = (state: InventoryState, def: ItemDef, count: number): InventoryStack => ({
  id: state.nextId++,
  itemId: def.id,
  count,
  charge: def.charge,
  durability: maxDurability(def),
});

/**
 * Adds units, topping up existing stacks first. Returns how many did not fit —
 * cells are the only limit there is.
 *
 * Merged stacks keep the worse of the two conditions: a fresh tin dropped on an
 * old one does not rescue the old one.
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
    if (isEquipped(state, stack.id)) continue;
    const taken = Math.min(def.maxStack - stack.count, remaining);
    stack.count += taken;
    stack.durability = Math.min(stack.durability, maxDurability(def));
    remaining -= taken;
  }

  while (remaining > 0 && freeCells(state, catalog) > 0) {
    const taken = Math.min(def.maxStack, remaining);
    state.stacks.push(newStack(state, def, taken));
    remaining -= taken;
  }
  return remaining;
};

/** Puts a specific stack into the bag as it is — used by loading and by tests. */
export const insertStack = (state: InventoryState, stack: InventoryStack): void => {
  state.stacks.push(stack);
  if (stack.id >= state.nextId) state.nextId = stack.id + 1;
};

export const removeStack = (state: InventoryState, id: number): void => {
  state.stacks = state.stacks.filter((stack) => stack.id !== id);
  for (const slot of EQUIP_SLOTS) if (state.equipment[slot] === id) state.equipment[slot] = null;
  for (let i = 0; i < state.quick.length; i++) if (state.quick[i] === id) state.quick[i] = null;
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

/** Detaches a stack from wherever it is worn or hung; it lands in the bag. */
export const moveToContainer = (state: InventoryState, id: number): void => {
  for (const slot of EQUIP_SLOTS) if (state.equipment[slot] === id) state.equipment[slot] = null;
  for (let i = 0; i < state.quick.length; i++) if (state.quick[i] === id) state.quick[i] = null;
};

export const canEquip = (catalog: ItemCatalog, itemId: string, slot: EquipSlot): boolean => {
  const def = catalog[itemId];
  return def ? fitsSlot(def, slot) : false;
};

export interface EquipResult {
  readonly ok: boolean;
  /** Stacks pushed out of the bag by the change. The caller drops them. */
  readonly spilled: InventoryStack[];
}

/**
 * Wears an item. Whatever was in the slot falls back into the bag, and anything
 * the bag can no longer hold — a smaller pack is the usual reason — is handed
 * back for the caller to drop on the floor.
 */
export const equip = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
  slot: EquipSlot,
): EquipResult => {
  const stack = findStack(state, id);
  if (!stack || !canEquip(catalog, stack.itemId, slot)) return { ok: false, spilled: [] };
  if (state.equipment[slot] === id) return { ok: true, spilled: [] };

  moveToContainer(state, id);
  state.equipment[slot] = id;
  return { ok: true, spilled: trimOverflow(state, catalog) };
};

/** Takes a piece off. Fails when the bag it was holding open cannot hold it. */
export const unequip = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
): boolean => {
  const slot = slotOf(state, id);
  if (slot === null) return false;
  state.equipment[slot] = null;
  if (usedCells(state) > capacity(state, catalog)) {
    state.equipment[slot] = id;
    return false;
  }
  return true;
};

/**
 * Drops bag stacks, newest first, until the bag fits inside its cells again.
 * Newest first is deliberate: the thing you just picked up is the thing you are
 * least attached to.
 */
const trimOverflow = (state: InventoryState, catalog: ItemCatalog): InventoryStack[] => {
  const spilled: InventoryStack[] = [];
  const limit = capacity(state, catalog);
  let inBag = containerStacks(state);
  while (inBag.length > limit) {
    const victim = inBag[inBag.length - 1];
    removeStack(state, victim.id);
    spilled.push(victim);
    inBag = containerStacks(state);
  }
  return spilled;
};

const cloneState = (state: InventoryState): InventoryState =>
  JSON.parse(JSON.stringify(state)) as InventoryState;

/**
 * What equipping this would cost, without doing it. The UI asks before swapping
 * a big pack for a small one, so the warning arrives before the loss.
 */
export const overflowFor = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
  slot: EquipSlot,
): InventoryStack[] => equip(cloneState(state), catalog, id, slot).spilled;

/** Hangs a stack on the belt. Whatever was there goes back into the bag. */
export const setQuick = (
  state: InventoryState,
  id: number | null,
  index: number,
): boolean => {
  if (index < 0 || index >= state.quick.length) return false;
  if (id === null) {
    state.quick[index] = null;
    return true;
  }
  const stack = findStack(state, id);
  if (!stack || isEquipped(state, id)) return false;
  const previous = quickIndexOf(state, id);
  if (previous >= 0) state.quick[previous] = state.quick[index];
  state.quick[index] = id;
  return true;
};

/** Splits units off a stack into a new one. Needs a free cell to put it in. */
export const splitStack = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
  count: number,
): InventoryStack | null => {
  const stack = findStack(state, id);
  if (!stack || count <= 0 || count >= stack.count) return null;
  if (freeCells(state, catalog) <= 0) return null;
  const half: InventoryStack = {
    id: state.nextId++,
    itemId: stack.itemId,
    count,
    charge: stack.charge,
    durability: stack.durability,
  };
  stack.count -= count;
  state.stacks.push(half);
  return half;
};

/** Pours one stack into another of the same item, up to the stack limit. */
export const mergeStacks = (
  state: InventoryState,
  catalog: ItemCatalog,
  fromId: number,
  intoId: number,
): boolean => {
  const from = findStack(state, fromId);
  const into = findStack(state, intoId);
  if (!from || !into || from === into || from.itemId !== into.itemId) return false;
  const def = catalog[from.itemId];
  if (!def || into.count >= def.maxStack) return false;
  const moved = Math.min(def.maxStack - into.count, from.count);
  into.count += moved;
  into.durability = Math.min(into.durability, from.durability);
  from.count -= moved;
  if (from.count <= 0) removeStack(state, fromId);
  return true;
};

export const heldStack = (state: InventoryState): InventoryStack | null =>
  equippedStack(state, 'hand');

/** Puts a stack in the main hand, or empties the hand when given null. */
export const setHand = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number | null,
): boolean => {
  if (id === null) {
    state.equipment.hand = null;
    return true;
  }
  return equip(state, catalog, id, 'hand').ok;
};

/** Swaps primary and secondary. Neither has to be there for it to make sense. */
export const swapHands = (state: InventoryState): void => {
  const hand = state.equipment.hand;
  state.equipment.hand = state.equipment.offhand;
  state.equipment.offhand = hand;
};

/** Multipliers from everything worn, worn-down values included. */
export const passives = (state: InventoryState, catalog: ItemCatalog): PassiveDef => {
  let result = NEUTRAL_PASSIVE;
  for (const slot of EQUIP_SLOTS) {
    const stack = equippedStack(state, slot);
    const def = stack ? catalog[stack.itemId] : undefined;
    if (!stack || !def || !def.passive) continue;
    const passive = passiveOf(def, stack.durability);
    result = {
      noiseFactor: result.noiseFactor * passive.noiseFactor,
      wetNoiseFactor: result.wetNoiseFactor * passive.wetNoiseFactor,
      staminaRegenFactor: result.staminaRegenFactor * passive.staminaRegenFactor,
      nerveFactor: result.nerveFactor * passive.nerveFactor,
      speedFactor: result.speedFactor * passive.speedFactor,
      searchFactor: result.searchFactor * passive.searchFactor,
    };
  }
  return result;
};

export interface ArmorPiece {
  readonly id: number;
  readonly slot: EquipSlot;
  readonly flat: number;
  readonly share: number;
}

/** Every worn piece that takes something out of a hit, in slot order. */
export const armorPieces = (state: InventoryState, catalog: ItemCatalog): ArmorPiece[] => {
  const pieces: ArmorPiece[] = [];
  for (const slot of EQUIP_SLOTS) {
    const stack = equippedStack(state, slot);
    const def = stack ? catalog[stack.itemId] : undefined;
    if (!stack || !def || !def.armor) continue;
    const { flat, share } = armorOf(def, stack.durability);
    if (flat <= 0 && share <= 0) continue;
    pieces.push({ id: stack.id, slot, flat, share });
  }
  return pieces;
};

/** What running out of condition did to a stack, once it actually happened. */
export interface WearEvent {
  readonly id: number;
  readonly itemId: string;
  readonly outcome: WearOutcome;
}

/**
 * Takes condition off one stack. Reports only the crossing of zero, and destroys
 * the stack when the item says that is what zero means.
 */
export const wearStack = (
  state: InventoryState,
  catalog: ItemCatalog,
  id: number,
  amount: number,
): WearEvent | null => {
  const stack = findStack(state, id);
  const def = stack ? catalog[stack.itemId] : undefined;
  if (!stack || !def || !def.durability || amount <= 0) return null;
  if (stack.durability <= 0) return null;
  stack.durability = Math.max(0, stack.durability - amount);
  if (stack.durability > 0) return null;
  const event: WearEvent = { id, itemId: stack.itemId, outcome: def.durability.atZero };
  if (def.durability.atZero === 'destroy') removeStack(state, id);
  return event;
};

/** Time passing. Food goes off in the bag whether or not it is ever eaten. */
export const tickWear = (
  state: InventoryState,
  catalog: ItemCatalog,
  seconds: number,
): WearEvent[] => {
  const events: WearEvent[] = [];
  for (const stack of [...state.stacks]) {
    const def = catalog[stack.itemId];
    if (!def?.durability?.perSecond) continue;
    const event = wearStack(state, catalog, stack.id, def.durability.perSecond * seconds);
    if (event) events.push(event);
  }
  return events;
};

/** One footstep's worth of scuffing, on the things that are actually worn. */
export const stepWear = (state: InventoryState, catalog: ItemCatalog): WearEvent[] => {
  const events: WearEvent[] = [];
  for (const slot of EQUIP_SLOTS) {
    const stack = equippedStack(state, slot);
    const def = stack ? catalog[stack.itemId] : undefined;
    if (!stack || !def?.durability?.perStep) continue;
    const event = wearStack(state, catalog, stack.id, def.durability.perStep);
    if (event) events.push(event);
  }
  return events;
};

/** How much life is left in a stack, as a fraction, for a bar on an icon. */
export const conditionOf = (
  catalog: ItemCatalog,
  stack: InventoryStack,
): number => {
  const def = catalog[stack.itemId];
  return def ? condition(def, stack.durability) : 1;
};
