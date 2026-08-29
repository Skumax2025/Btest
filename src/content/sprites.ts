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

export const SPRITES: Readonly<Record<string, PlaceholderSpec>> = {
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
