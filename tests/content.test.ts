/**
 * The content tables, checked against each other.
 *
 * Every table in L3 points at other tables by id, and a typo in one of those ids
 * is invisible until the thing it names fails to appear in a run. These are the
 * cross-references a compiler cannot see.
 */
import { describe, expect, it } from 'vitest';
import { ITEMS } from '@content/items';
import { SPRITES } from '@content/sprites';
import { LOOT_TABLES, CONTAINERS } from '@content/loot-tables';
import { CREATURES } from '@content/entities';
import { LEVELS, SANDBOX_LEVEL } from '@content/levels';
import { RU } from '@content/locales/ru';
import { EN } from '@content/locales/en';
import { EQUIP_SLOTS } from '@game/items';

const KEYS = new Set(Object.keys(RU));

describe('content consistency', () => {
  it('gives every item a sprite, a name and a description', () => {
    const missing: string[] = [];
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.id !== id) missing.push(`${id}: id field says ${def.id}`);
      if (!(def.sprite in SPRITES)) missing.push(`${id}: no sprite ${def.sprite}`);
      if (!KEYS.has(def.nameKey)) missing.push(`${id}: no ${def.nameKey}`);
      if (!KEYS.has(def.descriptionKey)) missing.push(`${id}: no ${def.descriptionKey}`);
    }
    expect(missing).toEqual([]);
  });

  it('only ever refers to items that exist', () => {
    const missing: string[] = [];
    for (const table of Object.values(LOOT_TABLES)) {
      for (const entry of table.entries) {
        if (!(entry.itemId in ITEMS)) missing.push(`${table.id}: ${entry.itemId}`);
        if (entry.min > entry.max) missing.push(`${table.id}: ${entry.itemId} min > max`);
        if (entry.weight <= 0) missing.push(`${table.id}: ${entry.itemId} weightless`);
      }
    }
    for (const container of Object.values(CONTAINERS)) {
      if (!(container.lootTableId in LOOT_TABLES)) {
        missing.push(`${container.id}: ${container.lootTableId}`);
      }
      if (!KEYS.has(container.nameKey)) missing.push(`${container.id}: no ${container.nameKey}`);
    }
    for (const creature of Object.values(CREATURES)) {
      if (creature.lootTableId && !(creature.lootTableId in LOOT_TABLES)) {
        missing.push(`${creature.id}: ${creature.lootTableId}`);
      }
      if (!KEYS.has(creature.nameKey)) missing.push(`${creature.id}: no ${creature.nameKey}`);
    }
    for (const level of [...LEVELS, SANDBOX_LEVEL]) {
      if (!(level.lootTableId in LOOT_TABLES)) missing.push(`${level.id}: ${level.lootTableId}`);
      for (const c of level.containers) if (!(c.id in CONTAINERS)) missing.push(`${level.id}: ${c.id}`);
      for (const c of level.creatures) if (!(c.id in CREATURES)) missing.push(`${level.id}: ${c.id}`);
    }
    expect(missing).toEqual([]);
  });

  it('resolves every key the interface builds at runtime', () => {
    const dynamic: string[] = [];
    for (const slot of EQUIP_SLOTS) {
      dynamic.push(`inventory.slot.${slot}`, `inventory.action.equip.${slot}`);
    }
    for (const stat of ['health', 'hunger', 'thirst', 'stamina', 'sanity']) dynamic.push(`hud.${stat}`);
    for (const hint of ['move', 'flashlight', 'search', 'pickup', 'descend', 'useHand', 'full',
      'heavy', 'nothing', 'spilled', 'stowed', 'burst', 'exhausted', 'darkness', 'listen']) {
      dynamic.push(`hint.${hint}`);
    }
    for (const event of ['hit', 'blockedByYou', 'blockedByThem', 'miss', 'broke', 'tired']) {
      dynamic.push(`combat.${event}`);
    }
    const missing = dynamic.filter((key) => !KEYS.has(key));
    expect(missing).toEqual([]);
    expect(dynamic.filter((key) => !(key in EN))).toEqual([]);
  });

  it('keeps every belt item usable and every worn item wearable', () => {
    const wrong: string[] = [];
    for (const [id, def] of Object.entries(ITEMS)) {
      const beltDoes = def.use !== null || def.charge > 0 || def.throwable;
      if (def.belt && !beltDoes) wrong.push(`${id}: on the belt with nothing to do`);
      if (def.carry && def.carry.wornCells > def.carry.cells) wrong.push(`${id}: gains pockets by wearing out`);
      if (def.armor && !def.durability) wrong.push(`${id}: armour that never wears`);
      if (def.durability && def.durability.max <= 0) wrong.push(`${id}: condition with no maximum`);
      if (def.melee && def.slots.length === 0) wrong.push(`${id}: a weapon that cannot be held`);
      if (def.maxStack < 1) wrong.push(`${id}: stack limit ${def.maxStack}`);
    }
    expect(wrong).toEqual([]);
  });
});
