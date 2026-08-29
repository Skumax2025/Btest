/**
 * L3: room templates for the yellow level.
 *
 * One template is `blockSize - 1` rows of `blockSize - 1` characters:
 *   `.` floor   `#` wall     `o` pillar   `,` stained carpet
 *   `~` wet     `L` lamp     `c` container  `s` creature spawn
 *
 * The generator carves a doorway lane through the middle two rows/columns of
 * every block that has a doorway on that axis, so keep structure off the middle
 * band unless you want it cut through. Adding a room type = adding an entry.
 */

import type { LandmarkTemplate, RoomTemplate } from '@game/level';

export const LEVEL0_ROOMS: readonly RoomTemplate[] = [
  {
    id: 'room.hall',
    weight: 12,
    rows: ['...,...', '.L...L.', '.......', '.......', '.......', '.,...,.', '.......'],
  },
  {
    id: 'room.pillars',
    weight: 10,
    rows: ['.......', '.o...o.', '.......', '...L...', '.......', '.o...o.', '.......'],
  },
  {
    id: 'room.alcoves',
    weight: 8,
    rows: ['##...##', '#c...c#', '.......', '...L...', '.......', '#.....#', '##...##'],
  },
  {
    id: 'room.corridor',
    weight: 10,
    rows: ['##...##', '##...##', '.......', '...L...', '.......', '##...##', '##...##'],
  },
  {
    id: 'room.office',
    weight: 7,
    rows: ['.......', '.#####.', '.#c..#.', '.#.L.#.', '.#...#.', '.#####.', '.......'],
  },
  {
    id: 'room.wet',
    weight: 6,
    rows: ['.......', '.~~~...', '..~~~..', '...L...', '..~~~..', '...~~..', '.......'],
  },
  {
    id: 'room.storage',
    weight: 7,
    rows: ['.c...c.', '.......', '.......', '...L...', '.......', '.c...c.', '.......'],
  },
  {
    id: 'room.nest',
    weight: 5,
    rows: ['.......', '.s...,.', '.......', '....L..', '.......', '.,...s.', '.......'],
  },
  {
    id: 'room.crossing',
    weight: 9,
    rows: ['##...##', '#.....#', '.......', '..L.L..', '.......', '#.....#', '##...##'],
  },
  {
    id: 'room.dim',
    weight: 6,
    rows: [',,...,,', ',.....,', '.......', '.......', '.......', ',.....,', ',,...,,'],
  },
];

/**
 * Landmarks are the anchors that make an endless identical space navigable.
 * The generator guarantees one landmark chunk per `landmarkStride` squared
 * chunks, and drops a floor decal in the middle of the room.
 */
export const LEVEL0_LANDMARKS: readonly LandmarkTemplate[] = [
  {
    id: 'mark.pile',
    weight: 10,
    marker: 'decal.pile',
    rows: ['.......', '.cc.cc.', '.......', '...L...', '.......', '.c...c.', '.......'],
  },
  {
    id: 'mark.scrawl',
    weight: 10,
    marker: 'decal.scrawl',
    rows: ['#.....#', '.......', '.......', '...L...', '.......', '.......', '#.....#'],
  },
  {
    id: 'mark.blackout',
    weight: 9,
    marker: 'decal.stain',
    rows: [',,...,,', ',.....,', '.......', '.......', '.......', ',.....,', ',,...,,'],
  },
  {
    id: 'mark.pool',
    weight: 8,
    marker: 'decal.pool',
    rows: ['.~~~~~.', '~~~~~~~', '~~~~~~~', '~~~L~~~', '~~~~~~~', '~~~~~~~', '.~~~~~.'],
  },
  {
    id: 'mark.columns',
    weight: 8,
    marker: 'decal.column',
    rows: ['.......', '.ooooo.', '.o...o.', '...L...', '.o...o.', '.ooooo.', '.......'],
  },
  {
    id: 'mark.cache',
    weight: 6,
    marker: 'decal.cache',
    rows: ['##...##', '#ccccc#', '#.....#', '...L...', '#.....#', '#c...s#', '##...##'],
  },
];

/**
 * The opening room. It is deliberately readable: a lit lamp overhead, two
 * containers within a few steps, and exactly one way out — so movement, search
 * and doorways all teach themselves without a text screen.
 */
export const LEVEL0_START_ROOM: RoomTemplate = {
  id: 'room.start',
  weight: 0,
  rows: ['#######', '#c...c#', '#.....#', '...L...', '#.....#', '#c...,#', '#######'],
};
