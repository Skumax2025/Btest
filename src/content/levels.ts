/**
 * L3: the levels themselves. A new level type is a new entry in this array —
 * no module above needs to change.
 */

import type { LevelSpec } from '@game/level';
import {
  LEVEL0_LANDMARKS,
  LEVEL0_ROOMS,
  LEVEL0_START_ROOM,
  LEVEL1_LANDMARKS,
  LEVEL1_ROOMS,
} from './rooms';

export const LEVELS: readonly LevelSpec[] = [
  {
    id: 'level0',
    title: 'Level 0',
    paletteId: 'level0.yellow',
    rooms: [...LEVEL0_ROOMS, LEVEL0_START_ROOM],
    landmarks: LEVEL0_LANDMARKS,
    spinePeriod: 3,
    extraDoorChance: 0.16,
    lampChance: 0.85,
    lampWorkingChance: 0.5,
    lampFlickerChance: 0.28,
    containerChance: 0.28,
    containers: [
      { id: 'container.crate', weight: 10 },
      { id: 'container.locker', weight: 6 },
      { id: 'container.bag', weight: 8 },
    ],
    creatureChance: 0.34,
    creatures: [
      { id: 'creature.drifter', weight: 10 },
      { id: 'creature.hound', weight: 5 },
      { id: 'creature.bloom', weight: 6 },
    ],
    lootTableId: 'loot.level0',
    landmarkStride: 2,
    exitStride: 3,
    ambientLight: 0.1,
    startRoomId: 'room.start',
  },
  {
    id: 'level1',
    title: 'Level 1',
    paletteId: 'level1.grey',
    rooms: LEVEL1_ROOMS,
    landmarks: LEVEL1_LANDMARKS,
    // A longer spine period means longer detours and more dead ends.
    spinePeriod: 4,
    extraDoorChance: 0.1,
    lampChance: 0.62,
    lampWorkingChance: 0.3,
    lampFlickerChance: 0.32,
    containerChance: 0.22,
    containers: [
      { id: 'container.crate', weight: 8 },
      { id: 'container.locker', weight: 10 },
      { id: 'container.bag', weight: 5 },
    ],
    creatureChance: 0.46,
    creatures: [
      { id: 'creature.hound', weight: 10 },
      { id: 'creature.bloom', weight: 9 },
      { id: 'creature.drifter', weight: 5 },
    ],
    lootTableId: 'loot.level0',
    landmarkStride: 2,
    exitStride: 3,
    ambientLight: 0.05,
    startRoomId: null,
  },
];
