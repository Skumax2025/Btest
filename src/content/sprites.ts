/**
 * L3: placeholder art. Every sprite is a stack of primitive shapes drawn into an
 * offscreen canvas at load time.
 *
 * To move to real art later, write a `SpriteProvider` that reads an atlas and
 * swap it in at the entry point — no module above L0 mentions how a sprite is
 * produced, only its id.
 */

import type { PlaceholderSpec } from '@core/assets';

const TILE = 32;

const prop = (
  body: string,
  edge: string,
  extra: PlaceholderSpec['shapes'] = [],
): PlaceholderSpec => ({
  width: TILE,
  height: TILE,
  shapes: [
    { kind: 'rect', color: edge, inset: 4 },
    { kind: 'rect', color: body, inset: 6 },
    ...extra,
  ],
});

const decal = (color: string, seed: number, density: number): PlaceholderSpec => ({
  width: TILE,
  height: TILE,
  shapes: [{ kind: 'noise', color, density, seed }],
});

const icon = (
  body: string,
  accent: string,
  width: number,
  height: number,
): PlaceholderSpec => ({
  width: width * 24,
  height: height * 24,
  shapes: [
    { kind: 'rect', color: '#1a170f', inset: 1 },
    { kind: 'rect', color: body, inset: 3 },
    { kind: 'bar', color: accent, x: 0.2, y: 0.2, w: 0.6, h: 0.22 },
  ],
});

export const SPRITES: Readonly<Record<string, PlaceholderSpec>> = {
  'item.water': icon('#5f8fa8', '#cfe9f2', 1, 2),
  'item.soda': icon('#8a5f4a', '#e0c2a0', 1, 1),
  'item.crackers': icon('#a98d54', '#e8d9a6', 1, 1),
  'item.canned': icon('#7b7f6a', '#c9cdb4', 2, 1),
  'item.medkit': icon('#9a4a44', '#ecd9d4', 2, 2),
  'item.bandage': icon('#cbc3ac', '#f2ecdb', 1, 1),
  'item.flashlight': icon('#4f5a63', '#f2e6b4', 1, 2),
  'item.battery': icon('#3f4a54', '#b7c96a', 1, 1),
  'item.pipe': icon('#6f7378', '#aeb3b8', 1, 3),
  'item.wrench': icon('#6a5f52', '#b5a692', 1, 2),
  'item.noisemaker': icon('#8f7a3f', '#e7d38a', 1, 1),
  'item.schoolbag': icon('#4a5b46', '#93a88c', 2, 2),
  'item.boots': icon('#4b3b30', '#8a6f5c', 1, 1),
  'item.hardhat': icon('#b8892f', '#f0d089', 1, 1),
  'item.ground': {
    width: 20,
    height: 20,
    shapes: [
      { kind: 'circle', color: '#0f0d08', inset: 1 },
      { kind: 'circle', color: '#7fd0c8', inset: 5 },
    ],
  },

  unknown: {
    width: TILE,
    height: TILE,
    shapes: [{ kind: 'rect', color: '#ff00ff', inset: 8 }],
  },

  player: {
    width: 24,
    height: 24,
    shapes: [
      { kind: 'circle', color: '#2b2519', inset: 2 },
      { kind: 'circle', color: '#d8cda0', inset: 4 },
      { kind: 'bar', color: '#8d8258', x: 0.35, y: 0.35, w: 0.3, h: 0.3 },
    ],
  },

  'prop.lamp.on': {
    width: TILE,
    height: TILE,
    shapes: [
      { kind: 'bar', color: '#4a441f', x: 0.12, y: 0.36, w: 0.76, h: 0.28 },
      { kind: 'bar', color: '#fff6cf', x: 0.16, y: 0.42, w: 0.68, h: 0.16 },
    ],
  },
  'prop.lamp.flicker': {
    width: TILE,
    height: TILE,
    shapes: [
      { kind: 'bar', color: '#4a441f', x: 0.12, y: 0.36, w: 0.76, h: 0.28 },
      { kind: 'bar', color: '#d8cf9c', x: 0.16, y: 0.42, w: 0.68, h: 0.16 },
    ],
  },
  'prop.lamp.dead': {
    width: TILE,
    height: TILE,
    shapes: [
      { kind: 'bar', color: '#3b3618', x: 0.12, y: 0.36, w: 0.76, h: 0.28 },
      { kind: 'bar', color: '#5d5836', x: 0.16, y: 0.42, w: 0.68, h: 0.16 },
    ],
  },

  'prop.container.crate': prop('#8a7038', '#63512a'),
  'prop.container.locker': prop('#7d7a5e', '#565442'),
  'prop.container.bag': prop('#6b5b3c', '#4c412c'),
  'prop.container.crate.open': prop('#5d4c26', '#3f341b'),
  'prop.container.locker.open': prop('#55543f', '#3b3a2d'),
  'prop.container.bag.open': prop('#493e29', '#332c1d'),

  'prop.exit': {
    width: TILE,
    height: TILE,
    shapes: [
      { kind: 'rect', color: '#101418', inset: 2 },
      { kind: 'ring', color: '#9ad7a0', inset: 3, thickness: 2 },
      { kind: 'circle', color: '#050708', inset: 8 },
    ],
  },

  'decal.pile': decal('#3a3220', 7717, 0.22),
  'decal.scrawl': decal('#2c2415', 3391, 0.14),
  'decal.stain': decal('#2a2415', 9137, 0.3),
  'decal.pool': decal('#3b4436', 5563, 0.26),
  'decal.column': decal('#4a4028', 2287, 0.18),
  'decal.cache': decal('#453a22', 6689, 0.2),

  'creature.drifter': {
    width: 28,
    height: 28,
    shapes: [
      { kind: 'circle', color: '#43423a', inset: 2 },
      { kind: 'circle', color: '#5c5a4c', inset: 6 },
    ],
  },
  'creature.hound': {
    width: 26,
    height: 26,
    shapes: [
      { kind: 'circle', color: '#3a2a26', inset: 2 },
      { kind: 'bar', color: '#8b4a3c', x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
    ],
  },
  'creature.bloom': {
    width: 34,
    height: 34,
    shapes: [
      { kind: 'circle', color: '#2f3a2c', inset: 2 },
      { kind: 'ring', color: '#6d8a5a', inset: 5, thickness: 3 },
    ],
  },
};

export const FALLBACK_SPRITE = 'unknown';
