/**
 * L3: the assembled run configuration.
 *
 * This is where every data table and every tuning number meets the modules that
 * use them. The game entry point and the headless tests both build a run from
 * here, so they are guaranteed to be playing the same game.
 */

import type { RunConfig } from '@game/run';
import { CREATURES } from './entities';
import { ITEMS } from './items';
import { LEVELS, SANDBOX_LEVEL } from './levels';
import { CONTAINERS, LOOT_TABLES } from './loot-tables';
import {
  ACTIONS,
  AI,
  ARMOR,
  COMBAT,
  GEOMETRY,
  INTERACTION,
  INVENTORY,
  LIGHTING,
  NOISE,
  PLAYER,
  SANDBOX,
  SIM,
  SOUND,
  STATS,
  STREAM,
} from './tuning';

export const HANDS_ITEM_ID = 'item.hands';

export const createRunConfig = (seed: number): RunConfig => ({
  seed,
  handsItemId: HANDS_ITEM_ID,
  content: {
    levels: LEVELS,
    items: ITEMS,
    containers: CONTAINERS,
    loot: LOOT_TABLES,
    creatures: CREATURES,
  },
  geometry: GEOMETRY,
  stream: STREAM,
  player: PLAYER,
  stats: STATS,
  inventory: INVENTORY,
  sandbox: null,
  lighting: LIGHTING,
  sound: SOUND,
  noise: NOISE,
  interaction: INTERACTION,
  combat: { ...COMBAT, armor: ARMOR },
  ai: AI,
  actions: ACTIONS,
  stepSeconds: SIM.stepMs / 1000,
  propCellSize: GEOMETRY.tileSize * 4,
  openingHintTicks: INTERACTION.openingHintTicks,
});

/**
 * The test level, as a run configuration. It is the same game with one extra
 * level in front and a `sandbox` block: everything else — items, creatures,
 * tuning — is shared with a real run, so what it demonstrates is the real thing.
 */
export const createSandboxConfig = (seed: number): RunConfig => {
  const base = createRunConfig(seed);
  return {
    ...base,
    content: { ...base.content, levels: [SANDBOX_LEVEL, ...LEVELS] },
    sandbox: SANDBOX,
  };
};
