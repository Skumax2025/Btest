/**
 * L2 module: loot tables.
 *
 * Knows: how to roll a table into a list of stacks, deterministically, from a
 * stream the caller supplies.
 * Does not know: any item, any container, any rarity name — all of that is data
 * in L3. Adding a loot table means adding one entry there.
 */

import type { RandomStream } from '@core/rng';

export interface LootEntry {
  readonly itemId: string;
  readonly weight: number;
  readonly min: number;
  readonly max: number;
}

export interface LootTable {
  readonly id: string;
  /** How many independent draws the table makes. */
  readonly rolls: number;
  /** Weight of drawing nothing at all, relative to the entries. */
  readonly emptyWeight: number;
  readonly entries: readonly LootEntry[];
}

export type LootTables = Readonly<Record<string, LootTable>>;

export interface LootStack {
  readonly itemId: string;
  readonly count: number;
}

/**
 * Rolls one table. Uses a stream supplied by the caller, so a container seeded
 * by its own coordinates always contains the same thing however late it is
 * opened.
 */
export const rollLoot = (table: LootTable, rng: RandomStream): LootStack[] => {
  const result: LootStack[] = [];
  let totalWeight = Math.max(0, table.emptyWeight);
  for (const entry of table.entries) totalWeight += Math.max(0, entry.weight);
  if (totalWeight <= 0) return result;

  for (let roll = 0; roll < table.rolls; roll++) {
    let ticket = rng.next() * totalWeight;
    ticket -= Math.max(0, table.emptyWeight);
    if (ticket < 0) continue;
    for (const entry of table.entries) {
      ticket -= Math.max(0, entry.weight);
      if (ticket >= 0) continue;
      const count = entry.min >= entry.max ? entry.min : rng.int(entry.min, entry.max + 1);
      if (count > 0) result.push({ itemId: entry.itemId, count });
      break;
    }
  }
  return result;
};

/** Average number of stacks a table yields — used by the density tests. */
export const expectedStacks = (table: LootTable): number => {
  let totalWeight = Math.max(0, table.emptyWeight);
  for (const entry of table.entries) totalWeight += Math.max(0, entry.weight);
  if (totalWeight <= 0) return 0;
  return (table.rolls * (totalWeight - Math.max(0, table.emptyWeight))) / totalWeight;
};

export interface ContainerDef {
  readonly id: string;
  readonly nameKey: string;
  readonly lootTableId: string;
  /** Radius of the noise searching it makes, in world units. */
  readonly searchNoise: number;
  /** Ticks the search takes. */
  readonly searchTicks: number;
}

export type ContainerCatalog = Readonly<Record<string, ContainerDef>>;
