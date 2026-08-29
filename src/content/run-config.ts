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
import { LEVELS } from './levels';
import { CONTAINERS, LOOT_TABLES } from './loot-tables';
import {
  ACTIONS,
  GEOMETRY,
  INTERACTION,
  INVENTORY,
  LIGHTING,
  NOISE,
  PLAYER,
  SIM,
  SOUND,
  STATS,
  STREAM,
} from './tuning';

export const createRunConfig = (seed: number): RunConfig => ({
  seed,
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
  lighting: LIGHTING,
  sound: SOUND,
  noise: NOISE,
  interaction: INTERACTION,
  actions: ACTIONS,
  stepSeconds: SIM.stepMs / 1000,
  propCellSize: GEOMETRY.tileSize * 4,
  openingHintTicks: INTERACTION.openingHintTicks,
});
