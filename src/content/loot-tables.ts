/**
 * L3: what is inside things.
 *
 * `emptyWeight` is the weight of drawing nothing, so a table with a high value
 * is mostly disappointment — which is the point in an endless building.
 */

import type { ContainerCatalog, LootTables } from '@game/loot';

export const LOOT_TABLES: LootTables = {
  'loot.level0': {
    id: 'loot.level0',
    rolls: 2,
    emptyWeight: 55,
    entries: [
      { itemId: 'item.soda', weight: 18, min: 1, max: 2 },
      { itemId: 'item.crackers', weight: 16, min: 1, max: 2 },
      { itemId: 'item.water', weight: 12, min: 1, max: 1 },
      { itemId: 'item.bandage', weight: 10, min: 1, max: 2 },
      { itemId: 'item.battery', weight: 9, min: 1, max: 2 },
      { itemId: 'item.canned', weight: 7, min: 1, max: 1 },
      { itemId: 'item.noisemaker', weight: 5, min: 1, max: 1 },
      { itemId: 'item.wrench', weight: 4, min: 1, max: 1 },
      { itemId: 'item.flashlight', weight: 3, min: 1, max: 1 },
      { itemId: 'item.medkit', weight: 2, min: 1, max: 1 },
      { itemId: 'item.pipe', weight: 2, min: 1, max: 1 },
    ],
  },
  'loot.crate': {
    id: 'loot.crate',
    rolls: 2,
    emptyWeight: 40,
    entries: [
      { itemId: 'item.crackers', weight: 20, min: 1, max: 3 },
      { itemId: 'item.canned', weight: 14, min: 1, max: 2 },
      { itemId: 'item.water', weight: 12, min: 1, max: 1 },
      { itemId: 'item.pipe', weight: 6, min: 1, max: 1 },
      { itemId: 'item.battery', weight: 10, min: 1, max: 2 },
    ],
  },
  'loot.locker': {
    id: 'loot.locker',
    rolls: 2,
    emptyWeight: 45,
    entries: [
      { itemId: 'item.bandage', weight: 18, min: 1, max: 2 },
      { itemId: 'item.medkit', weight: 6, min: 1, max: 1 },
      { itemId: 'item.flashlight', weight: 8, min: 1, max: 1 },
      { itemId: 'item.battery', weight: 16, min: 1, max: 3 },
      { itemId: 'item.wrench', weight: 8, min: 1, max: 1 },
    ],
  },
  'loot.bag': {
    id: 'loot.bag',
    rolls: 1,
    emptyWeight: 30,
    entries: [
      { itemId: 'item.soda', weight: 22, min: 1, max: 2 },
      { itemId: 'item.crackers', weight: 20, min: 1, max: 2 },
      { itemId: 'item.noisemaker', weight: 10, min: 1, max: 1 },
      { itemId: 'item.bandage', weight: 12, min: 1, max: 1 },
    ],
  },
};

export const CONTAINERS: ContainerCatalog = {
  'container.crate': {
    id: 'container.crate',
    name: 'Supply crate',
    lootTableId: 'loot.crate',
    searchNoise: 200,
    searchTicks: 48,
  },
  'container.locker': {
    id: 'container.locker',
    name: 'Steel locker',
    lootTableId: 'loot.locker',
    searchNoise: 260,
    searchTicks: 66,
  },
  'container.bag': {
    id: 'container.bag',
    name: 'Left bag',
    lootTableId: 'loot.bag',
    searchNoise: 120,
    searchTicks: 30,
  },
};
