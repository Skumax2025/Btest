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
    emptyWeight: 95,
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
      { itemId: 'item.schoolbag', weight: 4, min: 1, max: 1 },
      { itemId: 'item.boots', weight: 5, min: 1, max: 1 },
      { itemId: 'item.hardhat', weight: 4, min: 1, max: 1 },
      { itemId: 'item.knife', weight: 6, min: 1, max: 1 },
      { itemId: 'item.glowstick', weight: 6, min: 1, max: 2 },
      { itemId: 'item.jeans', weight: 5, min: 1, max: 1 },
      { itemId: 'item.hood', weight: 5, min: 1, max: 1 },
      { itemId: 'item.sneakers', weight: 4, min: 1, max: 1 },
      { itemId: 'item.tray', weight: 4, min: 1, max: 1 },
      { itemId: 'item.stim', weight: 3, min: 1, max: 1 },
      { itemId: 'item.radio', weight: 2, min: 1, max: 1 },
    ],
  },
  'loot.crate': {
    id: 'loot.crate',
    rolls: 2,
    emptyWeight: 60,
    entries: [
      { itemId: 'item.crackers', weight: 20, min: 1, max: 3 },
      { itemId: 'item.canned', weight: 14, min: 1, max: 2 },
      { itemId: 'item.water', weight: 12, min: 1, max: 1 },
      { itemId: 'item.pipe', weight: 6, min: 1, max: 1 },
      { itemId: 'item.battery', weight: 10, min: 1, max: 2 },
      { itemId: 'item.crowbar', weight: 7, min: 1, max: 1 },
      { itemId: 'item.jumpsuit', weight: 8, min: 1, max: 1 },
      { itemId: 'item.cargopants', weight: 8, min: 1, max: 1 },
      { itemId: 'item.ducttape', weight: 9, min: 1, max: 1 },
      { itemId: 'item.hikingpack', weight: 4, min: 1, max: 1 },
      { itemId: 'item.vest.plate', weight: 2, min: 1, max: 1 },
    ],
  },
  'loot.locker': {
    id: 'loot.locker',
    rolls: 2,
    emptyWeight: 80,
    entries: [
      { itemId: 'item.bandage', weight: 18, min: 1, max: 2 },
      { itemId: 'item.medkit', weight: 6, min: 1, max: 1 },
      { itemId: 'item.flashlight', weight: 8, min: 1, max: 1 },
      { itemId: 'item.battery', weight: 16, min: 1, max: 3 },
      { itemId: 'item.wrench', weight: 8, min: 1, max: 1 },
      { itemId: 'item.hardhat', weight: 10, min: 1, max: 1 },
      { itemId: 'item.boots', weight: 8, min: 1, max: 1 },
      { itemId: 'item.respirator', weight: 9, min: 1, max: 1 },
      { itemId: 'item.goggles', weight: 9, min: 1, max: 1 },
      { itemId: 'item.headlamp', weight: 7, min: 1, max: 1 },
      { itemId: 'item.raincoat', weight: 7, min: 1, max: 1 },
      { itemId: 'item.vest.kevlar', weight: 5, min: 1, max: 1 },
      { itemId: 'item.stim', weight: 5, min: 1, max: 1 },
    ],
  },
  'loot.bag': {
    id: 'loot.bag',
    rolls: 1,
    emptyWeight: 55,
    entries: [
      { itemId: 'item.soda', weight: 22, min: 1, max: 2 },
      { itemId: 'item.crackers', weight: 20, min: 1, max: 2 },
      { itemId: 'item.noisemaker', weight: 10, min: 1, max: 1 },
      { itemId: 'item.bandage', weight: 12, min: 1, max: 1 },
      { itemId: 'item.schoolbag', weight: 8, min: 1, max: 1 },
      { itemId: 'item.satchel', weight: 7, min: 1, max: 1 },
      { itemId: 'item.glowstick', weight: 8, min: 1, max: 1 },
      { itemId: 'item.ducttape', weight: 6, min: 1, max: 1 },
    ],
  },

  /**
   * What a body leaves. A drifter was a person once and still has their
   * pockets; the hound never was; the bloom keeps what it has taken apart.
   */
  'loot.drifter': {
    id: 'loot.drifter',
    rolls: 1,
    emptyWeight: 46,
    entries: [
      { itemId: 'item.crackers', weight: 14, min: 1, max: 2 },
      { itemId: 'item.bandage', weight: 12, min: 1, max: 1 },
      { itemId: 'item.battery', weight: 10, min: 1, max: 1 },
      { itemId: 'item.knife', weight: 8, min: 1, max: 1 },
      { itemId: 'item.hood', weight: 7, min: 1, max: 1 },
      { itemId: 'item.jeans', weight: 6, min: 1, max: 1 },
      { itemId: 'item.sneakers', weight: 6, min: 1, max: 1 },
      { itemId: 'item.satchel', weight: 4, min: 1, max: 1 },
      { itemId: 'item.stim', weight: 3, min: 1, max: 1 },
    ],
  },
  'loot.hound': {
    id: 'loot.hound',
    rolls: 1,
    emptyWeight: 74,
    entries: [
      { itemId: 'item.ducttape', weight: 8, min: 1, max: 1 },
      { itemId: 'item.glowstick', weight: 8, min: 1, max: 2 },
      { itemId: 'item.goggles', weight: 5, min: 1, max: 1 },
    ],
  },
  'loot.bloom': {
    id: 'loot.bloom',
    rolls: 2,
    emptyWeight: 40,
    entries: [
      { itemId: 'item.medkit', weight: 10, min: 1, max: 1 },
      { itemId: 'item.vest.kevlar', weight: 8, min: 1, max: 1 },
      { itemId: 'item.hardhat', weight: 8, min: 1, max: 1 },
      { itemId: 'item.radio', weight: 7, min: 1, max: 1 },
      { itemId: 'item.hikingpack', weight: 5, min: 1, max: 1 },
      { itemId: 'item.vest.plate', weight: 3, min: 1, max: 1 },
    ],
  },
};

export const CONTAINERS: ContainerCatalog = {
  'container.crate': {
    id: 'container.crate',
    nameKey: 'container.container.crate.name',
    lootTableId: 'loot.crate',
    searchNoise: 200,
    searchTicks: 48,
  },
  'container.locker': {
    id: 'container.locker',
    nameKey: 'container.container.locker.name',
    lootTableId: 'loot.locker',
    searchNoise: 260,
    searchTicks: 66,
  },
  'container.bag': {
    id: 'container.bag',
    nameKey: 'container.container.bag.name',
    lootTableId: 'loot.bag',
    searchNoise: 180,
    searchTicks: 30,
  },
};
