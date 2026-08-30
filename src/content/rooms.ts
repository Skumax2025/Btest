/**
 * L3: room templates for the yellow level.
 *
 * One template is `blockSize - 1` rows of `blockSize - 1` characters. The
 * current rooms are intentionally oversized: most cells stay open so the
 * player gets long sightlines and meaningful empty space between encounters:
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
    rows: ['...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '.......L.......', '...............', '...............', '...............'],
  },
  {
    id: 'room.pillars',
    weight: 10,
    rows: ['...............', '..o.........o..', '...............', '...............', '.......L.......', '...............', '...............', '...............', '...............', '.......L.......', '...............', '...............', '..o.........o..', '...............', '...............'],
  },
  {
    id: 'room.alcoves',
    weight: 8,
    rows: ['##...........##', '#.............#', '#.............#', '...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '.......L.......', '#.............#', '#.............#', '##...........##', '##...........##'],
  },
  {
    id: 'room.corridor',
    weight: 10,
    rows: ['##...........##', '##...........##', '...............', '...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '.......L.......', '...............', '##...........##', '##...........##', '##...........##'],
  },
  {
    id: 'room.office',
    weight: 7,
    rows: [
      '...............',
      '...#########...',
      '...#.......#...',
      '...#.......#...',
      '...#...L...#...',
      '...#.......#...',
      '...#.......#...',
      '...#.......#...',
      '...#.......#...',
      '...#...c...#...',
      '...#.......#...',
      '...#########...',
      '...............',
      '...............',
      '...............',
    ],
  },
  {
    id: 'room.wet',
    weight: 6,
    rows: ['...............', '....~~~........', '...~~~~~.......', '...............', '.......L.......', '...............', '.......~~~~....', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '...............'],
  },
  {
    id: 'room.storage',
    weight: 7,
    rows: ['...............', '...............', '...............', '...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '.......L.......', '...............', '...............', '...............', '.............c.'],
  },
  {
    id: 'room.nest',
    weight: 5,
    rows: ['...............', '....s.....,....', '...............', '...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '...............', '...............', '....,...s......', '...............', '...............'],
  },
  {
    id: 'room.crossing',
    weight: 9,
    rows: ['##...........##', '#.............#', '#.............#', '...............', '.......L.......', '...............', '.......s.......', '...............', '.......L.......', '...............', '...............', '#.............#', '#.............#', '##...........##', '##...........##'],
  },
  {
    id: 'room.dim',
    weight: 6,
    rows: [',,,...,,,....,,', ',..........,...', '...............', '...............', '.......L.......', '...............', '...............', '...............', '...............', '...............', '...............', '...............', ',.........s....', ',..............', ',,,..,,,....,,,'],
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
  rows: [
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '.....cL........',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '......L........',
    '...............',
    '...............',
    '...............',
  ],
};

/**
 * Level 1 is what is under Level 0: narrower, wetter, colder, less lit. The
 * shapes are deliberately close enough to be confusing and different enough to
 * notice within a few rooms.
 */
export const LEVEL1_ROOMS: readonly RoomTemplate[] = [
  {
    id: 'l1.pipes',
    weight: 11,
    rows: ['#o...o#', '#.....#', '.......', '...L...', '.......', '#.....#', '#o...o#'],
  },
  {
    id: 'l1.flooded',
    weight: 9,
    rows: ['~~...~~', '~~~.~~~', '.......', '...L...', '.......', '~~~.~~~', '~~...~~'],
  },
  {
    id: 'l1.cells',
    weight: 8,
    rows: ['##...##', '#c...c#', '.......', '.......', '.......', '#c...c#', '##...##'],
  },
  {
    id: 'l1.shaft',
    weight: 10,
    rows: ['###.###', '##...##', '.......', '...L...', '.......', '##...##', '###.###'],
  },
  {
    id: 'l1.rubble',
    weight: 9,
    rows: ['#o.,.o#', '.,...,.', '.......', '.......', '.......', '.,...,.', '#o.,.o#'],
  },
  {
    id: 'l1.den',
    weight: 6,
    rows: ['##...##', '#s...s#', '.......', '.......', '.......', '#.....#', '##...##'],
  },
  {
    id: 'l1.dark',
    weight: 8,
    rows: [',,,.,,,', ',.....,', '.......', '.......', '.......', ',.....,', ',,,.,,,'],
  },
];

export const LEVEL1_LANDMARKS: readonly LandmarkTemplate[] = [
  {
    id: 'l1.mark.pump',
    weight: 10,
    marker: 'decal.pool',
    rows: ['~~~~~~~', '~o...o~', '~.....~', '~..L..~', '~.....~', '~o...o~', '~~~~~~~'],
  },
  {
    id: 'l1.mark.stack',
    weight: 8,
    marker: 'decal.cache',
    rows: ['##...##', '#ccccc#', '#.....#', '...L...', '#.....#', '#ccccc#', '##...##'],
  },
  {
    id: 'l1.mark.silence',
    weight: 9,
    marker: 'decal.stain',
    rows: [',,,,,,,', ',.....,', ',.....,', ',......', ',.....,', ',.....,', ',,,,,,,'],
  },
];
