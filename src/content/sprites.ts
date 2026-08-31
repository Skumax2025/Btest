/**
 * L3: the art. Every sprite is a stack of primitive shapes drawn into an
 * offscreen canvas at load time — no image files, no atlas, no build step.
 *
 * Three families live here.
 *
 * **Icons** are the catalogue: one recognisable silhouette per item, authored in
 * fractions of its own box so the same spec is the thing lying on the carpet,
 * the thing in the bag and the thing on the belt. An item is read by its shape
 * first and its colour second, which is why no two of them share an outline.
 *
 * **Surfaces** are the building. A palette declares the ids of the tiles painted
 * with it (see `palettes.ts`) and this file builds them out of that palette's
 * own colours, so a new level is a palette entry rather than thirty sprites.
 *
 * **Bodies** are props, decals and the things that live here.
 *
 * To move to real art later, write a `SpriteProvider` that reads an atlas and
 * swap it in at the entry point — no module above L0 mentions how a sprite is
 * produced, only its id.
 */

import type { PlaceholderSpec, ShapeSpec } from '@core/assets';
import { PALETTES } from './palettes';
import type { Palette } from './palettes';

// ── colour arithmetic ───────────────────────────────────────────────────────

const channels = (color: string): readonly [number, number, number] => {
  const value = parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`;

/** Towards white for a positive amount, towards black for a negative one. */
const shade = (color: string, amount: number): string => {
  const [r, g, b] = channels(color);
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  return toHex(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
};

const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

const fade = (color: string, alpha: number): string => {
  const [r, g, b] = channels(color);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ── icons ───────────────────────────────────────────────────────────────────

/** One icon cell in pixels. Icons are authored large and drawn small. */
const CELL = 48;

/** Outline colour. Every icon is backed by it, so nothing dissolves into a dark floor. */
const INK = '#15120c';

const icon = (w: number, h: number, ...shapes: ShapeSpec[]): PlaceholderSpec => ({
  width: Math.round(w * CELL),
  height: Math.round(h * CELL),
  shapes,
});

/** The dark shape under a body, drawn a little larger than it. */
const back = (x: number, y: number, w: number, h: number, radius = 0.08): ShapeSpec => ({
  kind: 'rect',
  color: INK,
  x,
  y,
  w,
  h,
  radius,
});

/** A lengthways highlight: what tells a cylinder from a box. */
const sheen = (x: number, y1: number, y2: number, color: string, width = 0.05): ShapeSpec => ({
  kind: 'line',
  color,
  x1: x,
  y1,
  x2: x,
  y2,
  width,
  round: true,
  alpha: 0.55,
});

const ITEM_ICONS: Readonly<Record<string, PlaceholderSpec>> = {
  'item.water': icon(
    1,
    2,
    back(0.19, 0.24, 0.62, 0.72, 0.14),
    { kind: 'rect', color: INK, x: 0.36, y: 0.1, w: 0.28, h: 0.2 },
    { kind: 'rect', color: '#5f8fa8', x: 0.22, y: 0.27, w: 0.56, h: 0.66, radius: 0.12 },
    { kind: 'rect', color: '#48788e', x: 0.4, y: 0.13, w: 0.2, h: 0.16 },
    { kind: 'rect', color: '#cfe9f2', x: 0.25, y: 0.48, w: 0.5, h: 0.42, radius: 0.1, alpha: 0.7 },
    { kind: 'rect', color: '#e8f4f8', x: 0.22, y: 0.56, w: 0.56, h: 0.15, alpha: 0.35 },
    { kind: 'rect', color: '#dfe9ec', x: 0.36, y: 0.04, w: 0.28, h: 0.1, radius: 0.03 },
    sheen(0.31, 0.34, 0.86, '#ffffff'),
  ),
  'item.soda': icon(
    1,
    1,
    back(0.22, 0.06, 0.56, 0.88, 0.12),
    { kind: 'rect', color: '#8a5f4a', x: 0.25, y: 0.09, w: 0.5, h: 0.82, radius: 0.1 },
    { kind: 'ellipse', color: '#c3b7a6', cx: 0.5, cy: 0.12, rx: 0.25, ry: 0.055 },
    { kind: 'ellipse', color: '#6b5442', cx: 0.5, cy: 0.12, rx: 0.16, ry: 0.03 },
    { kind: 'rect', color: '#e0c2a0', x: 0.25, y: 0.4, w: 0.5, h: 0.2 },
    { kind: 'rect', color: '#a8412f', x: 0.25, y: 0.46, w: 0.5, h: 0.07 },
    sheen(0.32, 0.18, 0.86, '#ffffff', 0.045),
  ),
  'item.crackers': icon(
    1,
    1,
    back(0.14, 0.12, 0.72, 0.78, 0.06),
    { kind: 'rect', color: '#a98d54', x: 0.17, y: 0.15, w: 0.66, h: 0.72, radius: 0.04 },
    { kind: 'poly', color: '#7d6739', points: [0.17, 0.15, 0.83, 0.15, 0.83, 0.24, 0.17, 0.24] },
    { kind: 'rect', color: '#e8d9a6', x: 0.28, y: 0.34, w: 0.44, h: 0.4, radius: 0.04 },
    { kind: 'noise', color: '#8a7233', density: 0.12, seed: 91, cell: 3, x: 0.3, y: 0.36, w: 0.4, h: 0.36 },
    { kind: 'line', color: '#7d6739', x1: 0.5, y1: 0.34, x2: 0.5, y2: 0.74, width: 0.03 },
  ),
  'item.canned': icon(
    1,
    1,
    back(0.2, 0.14, 0.6, 0.72, 0.08),
    { kind: 'rect', color: '#7b7f6a', x: 0.23, y: 0.17, w: 0.54, h: 0.66, radius: 0.05 },
    { kind: 'rect', color: '#9aa088', x: 0.23, y: 0.17, w: 0.54, h: 0.07 },
    { kind: 'rect', color: '#5f6352', x: 0.23, y: 0.76, w: 0.54, h: 0.07 },
    { kind: 'rect', color: '#c9cdb4', x: 0.23, y: 0.34, w: 0.54, h: 0.3 },
    { kind: 'rect', color: '#8b5a3c', x: 0.23, y: 0.44, w: 0.54, h: 0.1 },
    sheen(0.31, 0.22, 0.78, '#ffffff', 0.04),
  ),
  'item.medkit': icon(
    2,
    2,
    back(0.12, 0.2, 0.76, 0.62, 0.06),
    { kind: 'rect', color: '#5a2a26', x: 0.36, y: 0.12, w: 0.28, h: 0.12, radius: 0.05 },
    { kind: 'rect', color: '#9a4a44', x: 0.15, y: 0.23, w: 0.7, h: 0.56, radius: 0.05 },
    { kind: 'rect', color: '#7d3a35', x: 0.15, y: 0.44, w: 0.7, h: 0.05 },
    { kind: 'rect', color: '#ecd9d4', x: 0.45, y: 0.3, w: 0.1, h: 0.42 },
    { kind: 'rect', color: '#ecd9d4', x: 0.34, y: 0.43, w: 0.32, h: 0.14 },
    { kind: 'rect', color: '#d9c07a', x: 0.47, y: 0.75, w: 0.06, h: 0.09 },
  ),
  'item.bandage': icon(
    1,
    1,
    { kind: 'ellipse', color: INK, cx: 0.48, cy: 0.52, rx: 0.38, ry: 0.38 },
    { kind: 'ellipse', color: '#cbc3ac', cx: 0.48, cy: 0.52, rx: 0.34, ry: 0.34 },
    { kind: 'ellipse', color: '#8d876f', cx: 0.48, cy: 0.52, rx: 0.12, ry: 0.12 },
    { kind: 'ring', color: '#f2ecdb', cx: 0.48, cy: 0.52, r: 0.24, width: 0.05, alpha: 0.7 },
    { kind: 'poly', color: '#e6dfc9', points: [0.72, 0.36, 0.94, 0.2, 0.99, 0.32, 0.8, 0.5] },
    { kind: 'line', color: '#a49c82', x1: 0.28, y1: 0.34, x2: 0.66, y2: 0.72, width: 0.03, alpha: 0.6 },
  ),
  'item.flashlight': icon(
    1,
    2,
    back(0.24, 0.05, 0.52, 0.9, 0.1),
    { kind: 'rect', color: '#4f5a63', x: 0.26, y: 0.07, w: 0.48, h: 0.16, radius: 0.06 },
    { kind: 'ellipse', color: '#f2e6b4', cx: 0.5, cy: 0.1, rx: 0.19, ry: 0.045 },
    { kind: 'glow', color: '#ffe9a8', cx: 0.5, cy: 0.09, r: 0.55, alpha: 0.45 },
    { kind: 'rect', color: '#3f4a54', x: 0.33, y: 0.22, w: 0.34, h: 0.72, radius: 0.07 },
    { kind: 'rect', color: '#2c343b', x: 0.33, y: 0.4, w: 0.34, h: 0.04 },
    { kind: 'rect', color: '#2c343b', x: 0.33, y: 0.47, w: 0.34, h: 0.04 },
    { kind: 'rect', color: '#b7c96a', x: 0.44, y: 0.28, w: 0.12, h: 0.07, radius: 0.02 },
    sheen(0.39, 0.26, 0.9, '#9fb3c4', 0.04),
  ),
  'item.battery': icon(
    1,
    1,
    back(0.28, 0.1, 0.44, 0.8, 0.06),
    { kind: 'rect', color: '#b9bcc0', x: 0.42, y: 0.07, w: 0.16, h: 0.08, radius: 0.02 },
    { kind: 'rect', color: '#3f4a54', x: 0.31, y: 0.13, w: 0.38, h: 0.74, radius: 0.04 },
    { kind: 'rect', color: '#b7c96a', x: 0.31, y: 0.32, w: 0.38, h: 0.16 },
    { kind: 'rect', color: '#26303a', x: 0.31, y: 0.62, w: 0.38, h: 0.1 },
    { kind: 'line', color: '#26303a', x1: 0.42, y1: 0.4, x2: 0.58, y2: 0.4, width: 0.045 },
    { kind: 'line', color: '#26303a', x1: 0.5, y1: 0.34, x2: 0.5, y2: 0.46, width: 0.045 },
    sheen(0.37, 0.18, 0.82, '#8f9aa4', 0.035),
  ),
  'item.pipe': icon(
    1,
    3,
    back(0.32, 0.02, 0.36, 0.96, 0.06),
    { kind: 'rect', color: '#6f7378', x: 0.35, y: 0.04, w: 0.3, h: 0.92, radius: 0.05 },
    { kind: 'rect', color: '#8b9095', x: 0.31, y: 0.04, w: 0.38, h: 0.05, radius: 0.02 },
    { kind: 'rect', color: '#8b9095', x: 0.31, y: 0.91, w: 0.38, h: 0.05, radius: 0.02 },
    sheen(0.42, 0.08, 0.9, '#c3c8cc', 0.035),
    { kind: 'noise', color: '#5a4230', density: 0.1, seed: 4471, cell: 2, x: 0.35, y: 0.2, w: 0.3, h: 0.6 },
  ),
  'item.wrench': icon(
    1,
    2,
    back(0.3, 0.03, 0.4, 0.94, 0.12),
    { kind: 'rect', color: '#6a5f52', x: 0.41, y: 0.22, w: 0.18, h: 0.62 },
    { kind: 'poly', color: '#8b8074', points: [0.31, 0.2, 0.31, 0.06, 0.42, 0.06, 0.42, 0.13, 0.58, 0.13, 0.58, 0.06, 0.69, 0.06, 0.69, 0.2, 0.59, 0.24, 0.41, 0.24] },
    { kind: 'ring', color: '#8b8074', cx: 0.5, cy: 0.86, r: 0.24, width: 0.13 },
    { kind: 'line', color: '#b5a692', x1: 0.45, y1: 0.26, x2: 0.45, y2: 0.76, width: 0.035, alpha: 0.6 },
  ),
  'item.noisemaker': icon(
    1,
    1,
    back(0.16, 0.22, 0.68, 0.66, 0.1),
    { kind: 'ellipse', color: '#6d5b2c', cx: 0.31, cy: 0.24, rx: 0.13, ry: 0.13 },
    { kind: 'ellipse', color: '#6d5b2c', cx: 0.69, cy: 0.24, rx: 0.13, ry: 0.13 },
    { kind: 'rect', color: '#8f7a3f', x: 0.19, y: 0.25, w: 0.62, h: 0.6, radius: 0.09 },
    { kind: 'ellipse', color: '#e7d38a', cx: 0.5, cy: 0.55, rx: 0.22, ry: 0.22 },
    { kind: 'line', color: '#3d3218', x1: 0.5, y1: 0.55, x2: 0.5, y2: 0.4, width: 0.04, round: true },
    { kind: 'line', color: '#3d3218', x1: 0.5, y1: 0.55, x2: 0.62, y2: 0.6, width: 0.04, round: true },
    { kind: 'line', color: '#6d5b2c', x1: 0.5, y1: 0.85, x2: 0.5, y2: 0.93, width: 0.06 },
  ),
  'item.knife': icon(
    1,
    1,
    { kind: 'poly', color: INK, points: [0.06, 0.94, 0.3, 0.66, 0.94, 0.04, 0.99, 0.16, 0.42, 0.8, 0.16, 0.99] },
    { kind: 'poly', color: '#d9dde2', points: [0.36, 0.68, 0.92, 0.1, 0.95, 0.2, 0.44, 0.76] },
    { kind: 'poly', color: '#8f959b', points: [0.36, 0.68, 0.44, 0.76, 0.92, 0.24, 0.95, 0.2] },
    { kind: 'line', color: '#3a3226', x1: 0.34, y1: 0.63, x2: 0.12, y2: 0.9, width: 0.16, round: true },
    { kind: 'line', color: '#6b5b45', x1: 0.32, y1: 0.66, x2: 0.14, y2: 0.87, width: 0.1, round: true },
  ),
  'item.crowbar': icon(
    1,
    2,
    { kind: 'poly', color: INK, points: [0.2, 0.02, 0.66, 0.02, 0.74, 0.14, 0.62, 0.98, 0.36, 0.98, 0.5, 0.16, 0.2, 0.14] },
    { kind: 'line', color: '#7a4a3a', x1: 0.55, y1: 0.14, x2: 0.47, y2: 0.94, width: 0.13, round: true },
    { kind: 'poly', color: '#8f5a44', points: [0.24, 0.05, 0.62, 0.05, 0.62, 0.14, 0.36, 0.14, 0.32, 0.2, 0.24, 0.16] },
    { kind: 'line', color: '#c08a6a', x1: 0.53, y1: 0.22, x2: 0.48, y2: 0.86, width: 0.035, alpha: 0.55 },
  ),
  'item.tray': icon(
    2,
    1,
    back(0.06, 0.16, 0.88, 0.68, 0.08),
    { kind: 'rect', color: '#8a8f7c', x: 0.08, y: 0.19, w: 0.84, h: 0.62, radius: 0.07 },
    { kind: 'rect', color: '#6d715f', x: 0.14, y: 0.27, w: 0.72, h: 0.46, radius: 0.05 },
    { kind: 'rect', color: '#d3d8c4', x: 0.18, y: 0.31, w: 0.3, h: 0.38, radius: 0.04, alpha: 0.5 },
    { kind: 'rect', color: '#d3d8c4', x: 0.54, y: 0.31, w: 0.28, h: 0.16, radius: 0.03, alpha: 0.35 },
    { kind: 'rect', color: '#d3d8c4', x: 0.54, y: 0.53, w: 0.28, h: 0.16, radius: 0.03, alpha: 0.35 },
  ),
  'item.hood': icon(
    1,
    1,
    { kind: 'poly', color: INK, points: [0.5, 0.06, 0.86, 0.36, 0.9, 0.9, 0.68, 0.94, 0.5, 0.72, 0.32, 0.94, 0.1, 0.9, 0.14, 0.36] },
    { kind: 'poly', color: '#4a4a52', points: [0.5, 0.1, 0.82, 0.38, 0.85, 0.86, 0.66, 0.89, 0.5, 0.68, 0.34, 0.89, 0.15, 0.86, 0.18, 0.38] },
    { kind: 'ellipse', color: '#1b1b20', cx: 0.5, cy: 0.44, rx: 0.22, ry: 0.26 },
    { kind: 'ellipse', color: '#8d8d99', cx: 0.5, cy: 0.42, rx: 0.22, ry: 0.26, alpha: 0.25 },
    { kind: 'line', color: '#8d8d99', x1: 0.34, y1: 0.66, x2: 0.66, y2: 0.66, width: 0.035, alpha: 0.7 },
  ),
  'item.headlamp': icon(
    1,
    1,
    { kind: 'ring', color: INK, cx: 0.5, cy: 0.55, r: 0.36, width: 0.16 },
    { kind: 'ring', color: '#3f4a54', cx: 0.5, cy: 0.55, r: 0.36, width: 0.1 },
    back(0.3, 0.16, 0.4, 0.34, 0.07),
    { kind: 'rect', color: '#4f5a63', x: 0.32, y: 0.18, w: 0.36, h: 0.3, radius: 0.06 },
    { kind: 'ellipse', color: '#f2e6b4', cx: 0.5, cy: 0.33, rx: 0.11, ry: 0.11 },
    { kind: 'glow', color: '#ffe9a8', cx: 0.5, cy: 0.33, r: 0.45, alpha: 0.4 },
  ),
  'item.respirator': icon(
    1,
    1,
    { kind: 'poly', color: INK, points: [0.16, 0.28, 0.84, 0.28, 0.8, 0.7, 0.5, 0.9, 0.2, 0.7] },
    { kind: 'poly', color: '#5a5f56', points: [0.19, 0.31, 0.81, 0.31, 0.77, 0.68, 0.5, 0.86, 0.23, 0.68] },
    { kind: 'ellipse', color: '#b6bcae', cx: 0.27, cy: 0.48, rx: 0.12, ry: 0.12 },
    { kind: 'ellipse', color: '#b6bcae', cx: 0.73, cy: 0.48, rx: 0.12, ry: 0.12 },
    { kind: 'ellipse', color: '#3c4038', cx: 0.27, cy: 0.48, rx: 0.05, ry: 0.05 },
    { kind: 'ellipse', color: '#3c4038', cx: 0.73, cy: 0.48, rx: 0.05, ry: 0.05 },
    { kind: 'line', color: '#8b9184', x1: 0.16, y1: 0.3, x2: 0.02, y2: 0.16, width: 0.05 },
    { kind: 'line', color: '#8b9184', x1: 0.84, y1: 0.3, x2: 0.98, y2: 0.16, width: 0.05 },
    { kind: 'rect', color: '#3c4038', x: 0.44, y: 0.62, w: 0.12, h: 0.14, radius: 0.03 },
  ),
  'item.goggles': icon(
    1,
    1,
    { kind: 'rect', color: INK, x: 0.04, y: 0.34, w: 0.92, h: 0.32, radius: 0.12 },
    { kind: 'rect', color: '#3a4650', x: 0.06, y: 0.37, w: 0.88, h: 0.26, radius: 0.1 },
    { kind: 'ellipse', color: '#212a31', cx: 0.31, cy: 0.5, rx: 0.17, ry: 0.15 },
    { kind: 'ellipse', color: '#212a31', cx: 0.69, cy: 0.5, rx: 0.17, ry: 0.15 },
    { kind: 'ellipse', color: '#9fd4e4', cx: 0.31, cy: 0.5, rx: 0.13, ry: 0.11 },
    { kind: 'ellipse', color: '#9fd4e4', cx: 0.69, cy: 0.5, rx: 0.13, ry: 0.11 },
    { kind: 'line', color: '#ffffff', x1: 0.25, y1: 0.44, x2: 0.35, y2: 0.44, width: 0.03, alpha: 0.6 },
    { kind: 'line', color: '#ffffff', x1: 0.63, y1: 0.44, x2: 0.73, y2: 0.44, width: 0.03, alpha: 0.6 },
    { kind: 'rect', color: '#26313a', x: 0.0, y: 0.42, w: 0.08, h: 0.16 },
    { kind: 'rect', color: '#26313a', x: 0.92, y: 0.42, w: 0.08, h: 0.16 },
  ),
  'item.jumpsuit': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.5, 0.06, 0.72, 0.12, 0.9, 0.24, 0.84, 0.46, 0.74, 0.42, 0.76, 0.94, 0.54, 0.94, 0.5, 0.62, 0.46, 0.94, 0.24, 0.94, 0.26, 0.42, 0.16, 0.46, 0.1, 0.24, 0.28, 0.12] },
    { kind: 'poly', color: '#8a7a3a', points: [0.5, 0.1, 0.7, 0.15, 0.86, 0.26, 0.81, 0.42, 0.72, 0.38, 0.73, 0.91, 0.56, 0.91, 0.5, 0.6, 0.44, 0.91, 0.27, 0.91, 0.28, 0.38, 0.19, 0.42, 0.14, 0.26, 0.3, 0.15] },
    { kind: 'line', color: '#d6c47c', x1: 0.5, y1: 0.16, x2: 0.5, y2: 0.58, width: 0.025 },
    { kind: 'poly', color: '#6d6029', points: [0.5, 0.1, 0.62, 0.14, 0.5, 0.24, 0.38, 0.14] },
    { kind: 'rect', color: '#6d6029', x: 0.3, y: 0.5, w: 0.12, h: 0.09, radius: 0.02 },
    { kind: 'rect', color: '#6d6029', x: 0.58, y: 0.5, w: 0.12, h: 0.09, radius: 0.02 },
  ),
  'item.raincoat': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.5, 0.04, 0.74, 0.14, 0.92, 0.3, 0.84, 0.5, 0.8, 0.92, 0.2, 0.92, 0.16, 0.5, 0.08, 0.3, 0.26, 0.14] },
    { kind: 'poly', color: '#3f6a70', points: [0.5, 0.08, 0.72, 0.17, 0.88, 0.31, 0.8, 0.48, 0.77, 0.89, 0.23, 0.89, 0.2, 0.48, 0.12, 0.31, 0.28, 0.17] },
    { kind: 'ellipse', color: '#2f5257', cx: 0.5, cy: 0.15, rx: 0.16, ry: 0.11 },
    { kind: 'line', color: '#8fc4c8', x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.88, width: 0.02 },
    { kind: 'ellipse', color: '#8fc4c8', cx: 0.44, cy: 0.36, rx: 0.025, ry: 0.025 },
    { kind: 'ellipse', color: '#8fc4c8', cx: 0.44, cy: 0.52, rx: 0.025, ry: 0.025 },
    { kind: 'ellipse', color: '#8fc4c8', cx: 0.44, cy: 0.68, rx: 0.025, ry: 0.025 },
    { kind: 'rect', color: '#2f5257', x: 0.24, y: 0.56, w: 0.14, h: 0.1, radius: 0.02 },
    { kind: 'rect', color: '#2f5257', x: 0.62, y: 0.56, w: 0.14, h: 0.1, radius: 0.02 },
  ),
  'item.cargopants': icon(
    1,
    2,
    { kind: 'poly', color: INK, points: [0.14, 0.08, 0.86, 0.08, 0.84, 0.96, 0.56, 0.96, 0.5, 0.5, 0.44, 0.96, 0.16, 0.96] },
    { kind: 'poly', color: '#5d5a3f', points: [0.17, 0.11, 0.83, 0.11, 0.81, 0.93, 0.58, 0.93, 0.5, 0.48, 0.42, 0.93, 0.19, 0.93] },
    { kind: 'rect', color: '#42402c', x: 0.17, y: 0.11, w: 0.66, h: 0.08 },
    { kind: 'rect', color: '#a49f78', x: 0.19, y: 0.38, w: 0.16, h: 0.18, radius: 0.03 },
    { kind: 'rect', color: '#a49f78', x: 0.65, y: 0.38, w: 0.16, h: 0.18, radius: 0.03 },
    { kind: 'line', color: '#42402c', x1: 0.5, y1: 0.19, x2: 0.5, y2: 0.46, width: 0.03 },
  ),
  'item.jeans': icon(
    1,
    2,
    { kind: 'poly', color: INK, points: [0.14, 0.08, 0.86, 0.08, 0.84, 0.96, 0.56, 0.96, 0.5, 0.5, 0.44, 0.96, 0.16, 0.96] },
    { kind: 'poly', color: '#3f4a68', points: [0.17, 0.11, 0.83, 0.11, 0.81, 0.93, 0.58, 0.93, 0.5, 0.48, 0.42, 0.93, 0.19, 0.93] },
    { kind: 'rect', color: '#2c3450', x: 0.17, y: 0.11, w: 0.66, h: 0.08 },
    { kind: 'line', color: '#8896b8', x1: 0.32, y1: 0.2, x2: 0.3, y2: 0.9, width: 0.02, alpha: 0.7 },
    { kind: 'line', color: '#8896b8', x1: 0.68, y1: 0.2, x2: 0.7, y2: 0.9, width: 0.02, alpha: 0.7 },
    { kind: 'ellipse', color: '#c9b06a', cx: 0.24, cy: 0.24, rx: 0.025, ry: 0.025 },
    { kind: 'ellipse', color: '#c9b06a', cx: 0.76, cy: 0.24, rx: 0.025, ry: 0.025 },
  ),
  'item.sneakers': icon(
    1,
    1,
    { kind: 'poly', color: INK, points: [0.04, 0.78, 0.16, 0.4, 0.44, 0.34, 0.68, 0.52, 0.94, 0.6, 0.96, 0.82] },
    { kind: 'poly', color: '#7a7a7a', points: [0.07, 0.72, 0.18, 0.42, 0.44, 0.37, 0.66, 0.54, 0.92, 0.62, 0.93, 0.72] },
    { kind: 'rect', color: '#dcdcdc', x: 0.05, y: 0.7, w: 0.9, h: 0.1, radius: 0.04 },
    { kind: 'line', color: '#dcdcdc', x1: 0.26, y1: 0.46, x2: 0.4, y2: 0.52, width: 0.03 },
    { kind: 'line', color: '#dcdcdc', x1: 0.3, y1: 0.42, x2: 0.44, y2: 0.48, width: 0.03 },
    { kind: 'line', color: '#4d4d4d', x1: 0.62, y1: 0.54, x2: 0.86, y2: 0.62, width: 0.04, alpha: 0.7 },
  ),
  'item.vest.kevlar': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.24, 0.12, 0.4, 0.16, 0.5, 0.28, 0.6, 0.16, 0.76, 0.12, 0.86, 0.3, 0.86, 0.86, 0.14, 0.86, 0.14, 0.3] },
    { kind: 'poly', color: '#4a4f3a', points: [0.26, 0.16, 0.4, 0.2, 0.5, 0.31, 0.6, 0.2, 0.74, 0.16, 0.83, 0.32, 0.83, 0.83, 0.17, 0.83, 0.17, 0.32] },
    { kind: 'rect', color: '#3a3e2d', x: 0.46, y: 0.3, w: 0.08, h: 0.53 },
    { kind: 'rect', color: '#8d9478', x: 0.22, y: 0.44, w: 0.2, h: 0.12, radius: 0.02 },
    { kind: 'rect', color: '#8d9478', x: 0.58, y: 0.44, w: 0.2, h: 0.12, radius: 0.02 },
    { kind: 'line', color: '#3a3e2d', x1: 0.2, y1: 0.66, x2: 0.8, y2: 0.66, width: 0.025 },
  ),
  'item.vest.plate': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.24, 0.12, 0.4, 0.16, 0.5, 0.28, 0.6, 0.16, 0.76, 0.12, 0.86, 0.3, 0.86, 0.88, 0.14, 0.88, 0.14, 0.3] },
    { kind: 'poly', color: '#3a3d42', points: [0.26, 0.16, 0.4, 0.2, 0.5, 0.31, 0.6, 0.2, 0.74, 0.16, 0.83, 0.32, 0.83, 0.85, 0.17, 0.85, 0.17, 0.32] },
    { kind: 'rect', color: '#2a2d31', x: 0.28, y: 0.36, w: 0.44, h: 0.4, radius: 0.03 },
    { kind: 'rect', color: '#7c8189', x: 0.3, y: 0.38, w: 0.4, h: 0.36, radius: 0.02, alpha: 0.55 },
    { kind: 'line', color: '#2a2d31', x1: 0.18, y1: 0.5, x2: 0.82, y2: 0.5, width: 0.02 },
    { kind: 'line', color: '#2a2d31', x1: 0.18, y1: 0.62, x2: 0.82, y2: 0.62, width: 0.02 },
    { kind: 'line', color: '#2a2d31', x1: 0.18, y1: 0.74, x2: 0.82, y2: 0.74, width: 0.02 },
  ),
  'item.satchel': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.1, 0.36, 0.9, 0.36, 0.9, 0.86, 0.1, 0.86] },
    { kind: 'ring', color: '#4c412c', cx: 0.5, cy: 0.42, r: 0.32, width: 0.06 },
    { kind: 'rect', color: '#6a5a42', x: 0.12, y: 0.38, w: 0.76, h: 0.46, radius: 0.05 },
    { kind: 'poly', color: '#8a7551', points: [0.12, 0.38, 0.88, 0.38, 0.88, 0.58, 0.5, 0.66, 0.12, 0.58] },
    { kind: 'rect', color: '#3c3222', x: 0.44, y: 0.56, w: 0.12, h: 0.12, radius: 0.02 },
    { kind: 'rect', color: '#b39c78', x: 0.2, y: 0.7, w: 0.18, h: 0.09, radius: 0.02, alpha: 0.6 },
  ),
  'item.hikingpack': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.16, 0.14, 0.84, 0.14, 0.9, 0.4, 0.9, 0.92, 0.1, 0.92, 0.1, 0.4] },
    { kind: 'rect', color: '#3f5a44', x: 0.13, y: 0.18, w: 0.74, h: 0.72, radius: 0.09 },
    { kind: 'poly', color: '#2f4635', points: [0.18, 0.16, 0.82, 0.16, 0.86, 0.34, 0.14, 0.34] },
    { kind: 'rect', color: '#86ab8c', x: 0.26, y: 0.46, w: 0.48, h: 0.28, radius: 0.05 },
    { kind: 'line', color: '#2f4635', x1: 0.26, y1: 0.6, x2: 0.74, y2: 0.6, width: 0.025 },
    { kind: 'rect', color: '#2f4635', x: 0.05, y: 0.36, w: 0.08, h: 0.4, radius: 0.03 },
    { kind: 'rect', color: '#2f4635', x: 0.87, y: 0.36, w: 0.08, h: 0.4, radius: 0.03 },
    { kind: 'rect', color: '#c2a35a', x: 0.44, y: 0.28, w: 0.12, h: 0.08, radius: 0.02 },
  ),
  'item.stim': icon(
    1,
    2,
    back(0.28, 0.06, 0.44, 0.78, 0.06),
    { kind: 'rect', color: '#c9c4bb', x: 0.32, y: 0.14, w: 0.36, h: 0.6, radius: 0.03 },
    { kind: 'rect', color: '#8a3f52', x: 0.34, y: 0.34, w: 0.32, h: 0.38 },
    { kind: 'rect', color: '#e79cb0', x: 0.34, y: 0.34, w: 0.32, h: 0.1, alpha: 0.8 },
    { kind: 'rect', color: '#7e7a72', x: 0.42, y: 0.04, w: 0.16, h: 0.12, radius: 0.02 },
    { kind: 'rect', color: '#7e7a72', x: 0.24, y: 0.16, w: 0.52, h: 0.05, radius: 0.02 },
    { kind: 'poly', color: '#b9bcc0', points: [0.46, 0.74, 0.54, 0.74, 0.51, 0.98, 0.49, 0.98] },
    sheen(0.38, 0.2, 0.7, '#ffffff', 0.03),
  ),
  'item.ducttape': icon(
    1,
    1,
    { kind: 'ellipse', color: INK, cx: 0.5, cy: 0.52, rx: 0.42, ry: 0.42 },
    { kind: 'ellipse', color: '#54544f', cx: 0.5, cy: 0.52, rx: 0.38, ry: 0.38 },
    { kind: 'ellipse', color: '#3a3a36', cx: 0.5, cy: 0.52, rx: 0.16, ry: 0.16 },
    { kind: 'ring', color: '#a0a09a', cx: 0.5, cy: 0.52, r: 0.28, width: 0.05, alpha: 0.6 },
    { kind: 'poly', color: '#a0a09a', points: [0.76, 0.34, 0.99, 0.24, 0.99, 0.4, 0.82, 0.48] },
  ),
  'item.glowstick': icon(
    1,
    2,
    { kind: 'glow', color: '#9cf2b4', cx: 0.5, cy: 0.52, r: 1.1, alpha: 0.4 },
    back(0.34, 0.08, 0.32, 0.84, 0.14),
    { kind: 'rect', color: '#2f5a3a', x: 0.37, y: 0.1, w: 0.26, h: 0.8, radius: 0.12 },
    { kind: 'rect', color: '#9cf2b4', x: 0.4, y: 0.16, w: 0.2, h: 0.68, radius: 0.1 },
    { kind: 'rect', color: '#e8fff0', x: 0.44, y: 0.22, w: 0.06, h: 0.56, radius: 0.03, alpha: 0.8 },
    { kind: 'rect', color: '#1e3a26', x: 0.37, y: 0.1, w: 0.26, h: 0.06, radius: 0.02 },
  ),
  'item.radio': icon(
    1,
    2,
    { kind: 'line', color: INK, x1: 0.72, y1: 0.3, x2: 0.86, y2: 0.02, width: 0.09 },
    { kind: 'line', color: '#2b2b28', x1: 0.72, y1: 0.3, x2: 0.85, y2: 0.04, width: 0.05, round: true },
    back(0.22, 0.24, 0.56, 0.72, 0.08),
    { kind: 'rect', color: '#4f4438', x: 0.25, y: 0.27, w: 0.5, h: 0.66, radius: 0.06 },
    { kind: 'rect', color: '#2b2b28', x: 0.3, y: 0.32, w: 0.4, h: 0.14, radius: 0.02 },
    { kind: 'rect', color: '#7fd0a0', x: 0.32, y: 0.34, w: 0.36, h: 0.1, alpha: 0.7 },
    { kind: 'line', color: '#2b2b28', x1: 0.31, y1: 0.56, x2: 0.69, y2: 0.56, width: 0.025 },
    { kind: 'line', color: '#2b2b28', x1: 0.31, y1: 0.63, x2: 0.69, y2: 0.63, width: 0.025 },
    { kind: 'line', color: '#2b2b28', x1: 0.31, y1: 0.7, x2: 0.69, y2: 0.7, width: 0.025 },
    { kind: 'ellipse', color: '#c4a97e', cx: 0.5, cy: 0.84, rx: 0.08, ry: 0.04 },
  ),
  'item.schoolbag': icon(
    2,
    2,
    { kind: 'poly', color: INK, points: [0.2, 0.16, 0.8, 0.16, 0.88, 0.4, 0.88, 0.9, 0.12, 0.9, 0.12, 0.4] },
    { kind: 'rect', color: '#4a5b46', x: 0.15, y: 0.2, w: 0.7, h: 0.68, radius: 0.12 },
    { kind: 'poly', color: '#3a4938', points: [0.22, 0.18, 0.78, 0.18, 0.84, 0.36, 0.16, 0.36] },
    { kind: 'rect', color: '#93a88c', x: 0.28, y: 0.5, w: 0.44, h: 0.26, radius: 0.05 },
    { kind: 'line', color: '#3a4938', x1: 0.28, y1: 0.46, x2: 0.72, y2: 0.46, width: 0.02 },
    { kind: 'ellipse', color: '#c2a35a', cx: 0.5, cy: 0.63, rx: 0.04, ry: 0.04 },
  ),
  'item.boots': icon(
    1,
    1,
    { kind: 'poly', color: INK, points: [0.14, 0.1, 0.52, 0.1, 0.56, 0.62, 0.92, 0.72, 0.94, 0.9, 0.1, 0.9] },
    { kind: 'poly', color: '#4b3b30', points: [0.17, 0.13, 0.49, 0.13, 0.53, 0.62, 0.88, 0.71, 0.9, 0.82, 0.13, 0.82] },
    { kind: 'rect', color: '#2a2119', x: 0.11, y: 0.8, w: 0.82, h: 0.09, radius: 0.03 },
    { kind: 'line', color: '#8a6f5c', x1: 0.2, y1: 0.26, x2: 0.46, y2: 0.26, width: 0.035 },
    { kind: 'line', color: '#8a6f5c', x1: 0.2, y1: 0.4, x2: 0.48, y2: 0.4, width: 0.035 },
    { kind: 'line', color: '#8a6f5c', x1: 0.56, y1: 0.7, x2: 0.86, y2: 0.76, width: 0.03, alpha: 0.7 },
  ),
  'item.hardhat': icon(
    1,
    1,
    { kind: 'ellipse', color: INK, cx: 0.5, cy: 0.66, rx: 0.46, ry: 0.14 },
    { kind: 'ellipse', color: '#8a6522', cx: 0.5, cy: 0.66, rx: 0.44, ry: 0.11 },
    { kind: 'ellipse', color: INK, cx: 0.5, cy: 0.56, rx: 0.34, ry: 0.34 },
    { kind: 'ellipse', color: '#b8892f', cx: 0.5, cy: 0.58, rx: 0.31, ry: 0.31 },
    { kind: 'rect', color: '#f0d089', x: 0.46, y: 0.28, w: 0.08, h: 0.34, alpha: 0.75 },
    { kind: 'ellipse', color: '#f0d089', cx: 0.38, cy: 0.44, rx: 0.07, ry: 0.05, alpha: 0.4 },
  ),
  /** The marker under anything the catalogue has no icon for, and bare hands. */
  'item.ground': icon(
    0.5,
    0.5,
    { kind: 'ellipse', color: INK, cx: 0.5, cy: 0.5, rx: 0.46, ry: 0.46 },
    { kind: 'ellipse', color: '#7fd0c8', cx: 0.5, cy: 0.5, rx: 0.34, ry: 0.34 },
    { kind: 'ellipse', color: '#0f0d08', cx: 0.5, cy: 0.5, rx: 0.16, ry: 0.16 },
  ),
};

// ── surfaces ────────────────────────────────────────────────────────────────

/**
 * Tile texture resolution. A tile is 32 world units and the camera sits at about
 * 1.65, so 64 pixels of source lands a touch above one screen pixel each: the
 * one ratio at which a texture is never upscaled and never has to be sharpened.
 */
const TILE_PX = 64;

const surface = (...shapes: ShapeSpec[]): PlaceholderSpec => ({
  width: TILE_PX,
  height: TILE_PX,
  shapes,
});

/**
 * Carpet. Every floor tile is the same weave under a different grain, and the
 * seam along two of its edges is what makes an endless floor read as laid rather
 * than poured — without it the eye has nothing to measure movement against.
 */
const floorTile = (palette: Palette, variant: number): PlaceholderSpec => {
  const base = mix(palette.floor, palette.floorAlt, variant / 3);
  const seed = 1471 + variant * 977;
  return surface(
    { kind: 'rect', color: base },
    // Weave: two passes of coarse grain at right angles, neither strong enough
    // to be seen as dots at playing distance.
    { kind: 'noise', color: shade(base, 0.16), density: 0.3, seed, cell: 2, alpha: 0.5 },
    { kind: 'noise', color: shade(base, -0.28), density: 0.26, seed: seed + 13, cell: 2, alpha: 0.45 },
    { kind: 'noise', color: shade(base, -0.4), density: 0.05, seed: seed + 77, cell: 3, alpha: 0.4 },
    // A worn patch, in a different corner on each variant.
    {
      kind: 'ellipse',
      color: shade(base, 0.1),
      cx: 0.25 + 0.2 * variant,
      cy: 0.7 - 0.15 * variant,
      rx: 0.3,
      ry: 0.26,
      alpha: 0.18,
    },
    { kind: 'rect', color: fade(shade(base, -0.5), 0.5), x: 0, y: 0.97, w: 1, h: 0.03 },
    { kind: 'rect', color: fade(shade(base, -0.5), 0.5), x: 0.97, y: 0, w: 0.03, h: 1 },
    { kind: 'rect', color: fade(shade(base, 0.25), 0.28), x: 0, y: 0, w: 1, h: 0.02 },
  );
};

/** Damp: the carpet has drunk something and the sheen sits on top of it. */
const wetTile = (palette: Palette): PlaceholderSpec =>
  surface(
    { kind: 'rect', color: palette.wet },
    { kind: 'noise', color: shade(palette.wet, -0.35), density: 0.3, seed: 8821, cell: 2, alpha: 0.5 },
    { kind: 'ellipse', color: shade(palette.wet, -0.4), cx: 0.45, cy: 0.55, rx: 0.44, ry: 0.4, alpha: 0.5 },
    { kind: 'ellipse', color: shade(palette.wet, 0.35), cx: 0.36, cy: 0.4, rx: 0.18, ry: 0.1, alpha: 0.3 },
    { kind: 'ellipse', color: shade(palette.wet, 0.5), cx: 0.68, cy: 0.68, rx: 0.09, ry: 0.05, alpha: 0.25 },
    { kind: 'rect', color: fade(shade(palette.wet, -0.5), 0.45), x: 0, y: 0.97, w: 1, h: 0.03 },
  );

/** Old spill, dried in. Darker at the rim than in the middle, as they are. */
const stainTile = (palette: Palette): PlaceholderSpec =>
  surface(
    { kind: 'rect', color: palette.floor },
    { kind: 'noise', color: shade(palette.floor, -0.2), density: 0.3, seed: 5507, cell: 2, alpha: 0.4 },
    { kind: 'ellipse', color: shade(palette.stain, -0.15), cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.48, alpha: 0.85 },
    { kind: 'ellipse', color: palette.stain, cx: 0.48, cy: 0.5, rx: 0.38, ry: 0.36 },
    { kind: 'ellipse', color: shade(palette.stain, 0.12), cx: 0.44, cy: 0.46, rx: 0.2, ry: 0.18, alpha: 0.6 },
    { kind: 'noise', color: shade(palette.stain, -0.4), density: 0.14, seed: 3323, cell: 2, alpha: 0.5 },
  );

/**
 * Wallpaper: vertical drops, a seam every so often, grime gathering at the
 * bottom where the carpet meets it. Three variants so a long wall does not
 * repeat within one screen.
 */
const wallTile = (palette: Palette, variant: number): PlaceholderSpec => {
  const base = shade(palette.wall, variant === 1 ? -0.05 : variant === 2 ? 0.04 : 0);
  const stripe = shade(base, -0.09);
  const shapes: ShapeSpec[] = [{ kind: 'rect', color: base }];
  for (let i = 0; i < 4; i++) {
    shapes.push({ kind: 'rect', color: stripe, x: i * 0.25, y: 0, w: 0.11, h: 1, alpha: 0.55 });
  }
  shapes.push(
    { kind: 'rect', color: shade(base, -0.22), x: variant * 0.3, y: 0, w: 0.015, h: 1, alpha: 0.7 },
    { kind: 'noise', color: shade(base, -0.3), density: 0.1, seed: 2207 + variant * 313, cell: 2, alpha: 0.35 },
    { kind: 'noise', color: shade(base, 0.3), density: 0.06, seed: 6607 + variant * 131, cell: 2, alpha: 0.3 },
    {
      kind: 'gradient',
      angle: Math.PI / 2,
      y: 0.6,
      h: 0.4,
      stops: [
        { at: 0, color: fade(palette.wallShade, 0) },
        { at: 1, color: fade(palette.wallShade, 0.55) },
      ],
    },
    {
      kind: 'gradient',
      angle: Math.PI / 2,
      h: 0.25,
      stops: [
        { at: 0, color: fade(palette.wallEdge, 0.35) },
        { at: 1, color: fade(palette.wallEdge, 0) },
      ],
    },
  );
  return surface(...shapes);
};

/** A pillar is a cylinder, so it is lit down one side and dark down the other. */
const pillarTile = (palette: Palette): PlaceholderSpec =>
  surface(
    { kind: 'rect', color: shade(palette.pillar, -0.55) },
    { kind: 'rect', color: palette.pillar, x: 0.06, y: 0, w: 0.88, h: 1 },
    {
      kind: 'gradient',
      x: 0.06,
      w: 0.88,
      stops: [
        { at: 0, color: fade(shade(palette.pillar, -0.5), 0.7) },
        { at: 0.35, color: fade(palette.wallEdge, 0.3) },
        { at: 0.6, color: fade(shade(palette.pillar, -0.2), 0.2) },
        { at: 1, color: fade(shade(palette.pillar, -0.6), 0.75) },
      ],
    },
    { kind: 'noise', color: shade(palette.pillar, -0.3), density: 0.08, seed: 9127, cell: 2, alpha: 0.35 },
  );

const surfacesFor = (palette: Palette): Record<string, PlaceholderSpec> => {
  const out: Record<string, PlaceholderSpec> = {};
  palette.textures.floor.forEach((id, index) => {
    out[id] = floorTile(palette, index);
  });
  palette.textures.wall.forEach((id, index) => {
    out[id] = wallTile(palette, index);
  });
  out[palette.textures.stain] = stainTile(palette);
  out[palette.textures.wet] = wetTile(palette);
  out[palette.textures.pillar] = pillarTile(palette);
  return out;
};

const SURFACES: Readonly<Record<string, PlaceholderSpec>> = Object.values(PALETTES).reduce(
  (all, palette) => Object.assign(all, surfacesFor(palette)),
  {} as Record<string, PlaceholderSpec>,
);

// ── props, decals and bodies ────────────────────────────────────────────────

/** Props are drawn at one tile; the extra resolution is for the camera zoom. */
const PROP_PX = 64;
const DECAL_PX = 96;

const prop = (...shapes: ShapeSpec[]): PlaceholderSpec => ({
  width: PROP_PX,
  height: PROP_PX,
  shapes,
});

/**
 * A ceiling tube seen from below: housing, diffuser, end caps. The lit version
 * carries its own bloom so a lamp is a bright object as well as a light source —
 * the darkness pass paints the pool, this paints the fitting.
 */
const lamp = (tube: string, glow: number): PlaceholderSpec =>
  prop(
    { kind: 'glow', color: tube, cx: 0.5, cy: 0.5, r: 0.95, alpha: glow },
    { kind: 'rect', color: '#26210f', x: 0.08, y: 0.33, w: 0.84, h: 0.34, radius: 0.05 },
    { kind: 'rect', color: '#4a441f', x: 0.1, y: 0.35, w: 0.8, h: 0.3, radius: 0.04 },
    { kind: 'rect', color: '#635b2c', x: 0.1, y: 0.35, w: 0.8, h: 0.05 },
    { kind: 'rect', color: tube, x: 0.16, y: 0.42, w: 0.68, h: 0.16, radius: 0.03 },
    { kind: 'rect', color: shade(tube, 0.4), x: 0.2, y: 0.45, w: 0.6, h: 0.05, radius: 0.02, alpha: 0.8 },
    { kind: 'rect', color: '#332d14', x: 0.14, y: 0.4, w: 0.03, h: 0.2 },
    { kind: 'rect', color: '#332d14', x: 0.83, y: 0.4, w: 0.03, h: 0.2 },
  );

/** A crate: slats, a banded lid, corner irons. Open, the lid is off and it is dark inside. */
const crate = (open: boolean): PlaceholderSpec => {
  const body = open ? '#5d4c26' : '#8a7038';
  const edge = open ? '#3f341b' : '#63512a';
  return prop(
    { kind: 'rect', color: '#241d0e', x: 0.06, y: 0.06, w: 0.88, h: 0.88, radius: 0.04 },
    { kind: 'rect', color: body, x: 0.09, y: 0.09, w: 0.82, h: 0.82, radius: 0.03 },
    { kind: 'rect', color: edge, x: 0.09, y: 0.3, w: 0.82, h: 0.04 },
    { kind: 'rect', color: edge, x: 0.09, y: 0.62, w: 0.82, h: 0.04 },
    { kind: 'noise', color: shade(body, -0.3), density: 0.07, seed: 3701, cell: 2, x: 0.1, y: 0.1, w: 0.8, h: 0.8, alpha: 0.5 },
    ...(open
      ? ([
          { kind: 'rect', color: '#161206', x: 0.2, y: 0.2, w: 0.6, h: 0.6, radius: 0.03 },
          { kind: 'rect', color: '#2c2412', x: 0.24, y: 0.24, w: 0.52, h: 0.52, radius: 0.02 },
        ] as ShapeSpec[])
      : ([
          { kind: 'rect', color: shade(body, 0.18), x: 0.12, y: 0.12, w: 0.76, h: 0.12, radius: 0.02, alpha: 0.5 },
        ] as ShapeSpec[])),
    { kind: 'rect', color: '#3e3418', x: 0.06, y: 0.06, w: 0.14, h: 0.14 },
    { kind: 'rect', color: '#3e3418', x: 0.8, y: 0.8, w: 0.14, h: 0.14 },
  );
};

/** A steel locker: a door, vents, a handle. Open, the door is swung aside. */
const locker = (open: boolean): PlaceholderSpec => {
  const body = open ? '#55543f' : '#7d7a5e';
  return prop(
    { kind: 'rect', color: '#22221a', x: 0.1, y: 0.04, w: 0.8, h: 0.92, radius: 0.03 },
    { kind: 'rect', color: body, x: 0.13, y: 0.07, w: 0.74, h: 0.86, radius: 0.02 },
    {
      kind: 'gradient',
      x: 0.13,
      y: 0.07,
      w: 0.74,
      h: 0.86,
      stops: [
        { at: 0, color: fade(shade(body, 0.35), 0.5) },
        { at: 0.5, color: fade(body, 0) },
        { at: 1, color: fade(shade(body, -0.5), 0.45) },
      ],
    },
    ...(open
      ? ([
          { kind: 'rect', color: '#141410', x: 0.2, y: 0.12, w: 0.5, h: 0.76, radius: 0.02 },
          { kind: 'rect', color: '#2b2b22', x: 0.7, y: 0.1, w: 0.16, h: 0.8, radius: 0.02 },
        ] as ShapeSpec[])
      : ([
          { kind: 'rect', color: shade(body, -0.35), x: 0.24, y: 0.16, w: 0.42, h: 0.03 },
          { kind: 'rect', color: shade(body, -0.35), x: 0.24, y: 0.22, w: 0.42, h: 0.03 },
          { kind: 'rect', color: shade(body, -0.35), x: 0.24, y: 0.28, w: 0.42, h: 0.03 },
          { kind: 'rect', color: '#c9c6a8', x: 0.74, y: 0.44, w: 0.06, h: 0.16, radius: 0.02 },
        ] as ShapeSpec[])),
    { kind: 'noise', color: '#3a3a2c', density: 0.06, seed: 5119, cell: 2, x: 0.13, y: 0.07, w: 0.74, h: 0.86, alpha: 0.4 },
  );
};

/** A duffel: a soft body, a zip along the top, a strap over it. */
const duffel = (open: boolean): PlaceholderSpec => {
  const body = open ? '#493e29' : '#6b5b3c';
  return prop(
    { kind: 'ellipse', color: '#1d1810', cx: 0.5, cy: 0.52, rx: 0.46, ry: 0.34 },
    { kind: 'ellipse', color: body, cx: 0.5, cy: 0.52, rx: 0.43, ry: 0.31 },
    open
      ? { kind: 'ellipse', color: '#15110a', cx: 0.5, cy: 0.46, rx: 0.3, ry: 0.14 }
      : { kind: 'line', color: shade(body, -0.4), x1: 0.14, y1: 0.44, x2: 0.86, y2: 0.44, width: 0.045 },
    { kind: 'line', color: shade(body, 0.25), x1: 0.32, y1: 0.24, x2: 0.32, y2: 0.8, width: 0.05, alpha: 0.5 },
    { kind: 'line', color: shade(body, 0.25), x1: 0.68, y1: 0.24, x2: 0.68, y2: 0.8, width: 0.05, alpha: 0.5 },
    { kind: 'noise', color: shade(body, -0.35), density: 0.08, seed: 6229, cell: 2, x: 0.1, y: 0.24, w: 0.8, h: 0.56, alpha: 0.45 },
  );
};

/** The way down: a shaft with steps falling into it, ringed so it reads at distance. */
const exitProp = (): PlaceholderSpec =>
  prop(
    { kind: 'rect', color: '#0b0e11', x: 0.05, y: 0.05, w: 0.9, h: 0.9, radius: 0.06 },
    { kind: 'rect', color: '#151b20', x: 0.12, y: 0.12, w: 0.76, h: 0.76, radius: 0.04 },
    { kind: 'rect', color: '#2a343c', x: 0.2, y: 0.2, w: 0.6, h: 0.13 },
    { kind: 'rect', color: '#232c33', x: 0.24, y: 0.35, w: 0.52, h: 0.13 },
    { kind: 'rect', color: '#1b2229', x: 0.28, y: 0.5, w: 0.44, h: 0.13 },
    { kind: 'rect', color: '#12181d', x: 0.32, y: 0.65, w: 0.36, h: 0.13 },
    { kind: 'ring', color: '#9ad7a0', cx: 0.5, cy: 0.5, r: 0.44, width: 0.045 },
    { kind: 'glow', color: '#9ad7a0', cx: 0.5, cy: 0.5, r: 0.7, alpha: 0.22 },
  );

const decal = (...shapes: ShapeSpec[]): PlaceholderSpec => ({
  width: DECAL_PX,
  height: DECAL_PX,
  shapes,
});

// ── the catalogue ───────────────────────────────────────────────────────────

export const SPRITES: Readonly<Record<string, PlaceholderSpec>> = {
  ...ITEM_ICONS,
  ...SURFACES,

  unknown: {
    width: PROP_PX,
    height: PROP_PX,
    shapes: [
      { kind: 'rect', color: '#ff00ff', x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      { kind: 'rect', color: '#000000', x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
    ],
  },

  /** Seen from above: shoulders, a head, and the arm that carries the light. */
  player: {
    width: 48,
    height: 48,
    shapes: [
      { kind: 'ellipse', color: '#1a170f', cx: 0.5, cy: 0.5, rx: 0.44, ry: 0.4 },
      { kind: 'ellipse', color: '#6d6448', cx: 0.48, cy: 0.5, rx: 0.4, ry: 0.36 },
      { kind: 'ellipse', color: '#8d8258', cx: 0.44, cy: 0.5, rx: 0.3, ry: 0.32 },
      { kind: 'ellipse', color: '#d8cda0', cx: 0.54, cy: 0.5, rx: 0.24, ry: 0.24 },
      { kind: 'ellipse', color: '#f0e6bd', cx: 0.6, cy: 0.5, rx: 0.12, ry: 0.12, alpha: 0.8 },
      { kind: 'ellipse', color: '#4a4430', cx: 0.42, cy: 0.22, rx: 0.14, ry: 0.1 },
      { kind: 'ellipse', color: '#4a4430', cx: 0.42, cy: 0.78, rx: 0.14, ry: 0.1 },
    ],
  },

  'prop.lamp.on': lamp('#fff6cf', 0.35),
  'prop.lamp.flicker': lamp('#d8cf9c', 0.18),
  'prop.lamp.dead': prop(
    { kind: 'rect', color: '#1c1809', x: 0.08, y: 0.33, w: 0.84, h: 0.34, radius: 0.05 },
    { kind: 'rect', color: '#3b3618', x: 0.1, y: 0.35, w: 0.8, h: 0.3, radius: 0.04 },
    { kind: 'rect', color: '#5d5836', x: 0.16, y: 0.42, w: 0.68, h: 0.16, radius: 0.03 },
    { kind: 'noise', color: '#241f0d', density: 0.2, seed: 7717, cell: 2, x: 0.16, y: 0.42, w: 0.68, h: 0.16 },
    { kind: 'rect', color: '#241f0d', x: 0.14, y: 0.4, w: 0.03, h: 0.2 },
    { kind: 'rect', color: '#241f0d', x: 0.83, y: 0.4, w: 0.03, h: 0.2 },
  ),

  'prop.container.crate': crate(false),
  'prop.container.crate.open': crate(true),
  'prop.container.locker': locker(false),
  'prop.container.locker.open': locker(true),
  'prop.container.bag': duffel(false),
  'prop.container.bag.open': duffel(true),

  'prop.exit': exitProp(),

  /** Landmarks. Each is a shape a player can describe to themselves and steer by. */
  'decal.pile': decal(
    { kind: 'ellipse', color: '#221c10', cx: 0.5, cy: 0.56, rx: 0.42, ry: 0.34, alpha: 0.75 },
    { kind: 'ellipse', color: '#3a3220', cx: 0.44, cy: 0.54, rx: 0.34, ry: 0.26 },
    { kind: 'poly', color: '#4a4028', points: [0.24, 0.62, 0.42, 0.3, 0.58, 0.62] },
    { kind: 'poly', color: '#2e2717', points: [0.46, 0.64, 0.62, 0.38, 0.78, 0.66] },
    { kind: 'rect', color: '#54492c', x: 0.28, y: 0.6, w: 0.36, h: 0.06, radius: 0.02, alpha: 0.8 },
    { kind: 'noise', color: '#161206', density: 0.12, seed: 7717, cell: 2, x: 0.2, y: 0.3, w: 0.6, h: 0.4 },
  ),
  'decal.scrawl': decal(
    { kind: 'line', color: '#2c2415', x1: 0.16, y1: 0.3, x2: 0.44, y2: 0.72, width: 0.035, round: true },
    { kind: 'line', color: '#2c2415', x1: 0.44, y1: 0.72, x2: 0.5, y2: 0.24, width: 0.035, round: true },
    { kind: 'line', color: '#2c2415', x1: 0.56, y1: 0.28, x2: 0.84, y2: 0.66, width: 0.03, round: true },
    { kind: 'line', color: '#2c2415', x1: 0.6, y1: 0.5, x2: 0.82, y2: 0.44, width: 0.028, round: true },
    { kind: 'line', color: '#453a22', x1: 0.2, y1: 0.8, x2: 0.78, y2: 0.82, width: 0.02, round: true, alpha: 0.7 },
    { kind: 'noise', color: '#231c10', density: 0.05, seed: 3391, cell: 2, x: 0.14, y: 0.2, w: 0.72, h: 0.66 },
  ),
  'decal.stain': decal(
    { kind: 'ellipse', color: '#2a2415', cx: 0.5, cy: 0.5, rx: 0.46, ry: 0.42, alpha: 0.8 },
    { kind: 'ellipse', color: '#1e1a0f', cx: 0.44, cy: 0.46, rx: 0.3, ry: 0.28 },
    { kind: 'ellipse', color: '#3a3220', cx: 0.66, cy: 0.62, rx: 0.16, ry: 0.13, alpha: 0.8 },
    { kind: 'ellipse', color: '#3a3220', cx: 0.3, cy: 0.7, rx: 0.1, ry: 0.08, alpha: 0.7 },
    { kind: 'noise', color: '#15110a', density: 0.14, seed: 9137, cell: 2, x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  ),
  'decal.pool': decal(
    { kind: 'ellipse', color: '#232b1f', cx: 0.5, cy: 0.52, rx: 0.46, ry: 0.4 },
    { kind: 'ellipse', color: '#3b4436', cx: 0.5, cy: 0.52, rx: 0.4, ry: 0.34 },
    { kind: 'ellipse', color: '#5d6b55', cx: 0.4, cy: 0.42, rx: 0.16, ry: 0.08, alpha: 0.5 },
    { kind: 'ellipse', color: '#7f8f76', cx: 0.62, cy: 0.62, rx: 0.07, ry: 0.04, alpha: 0.35 },
    { kind: 'ring', color: '#5d6b55', cx: 0.5, cy: 0.52, r: 0.3, width: 0.015, alpha: 0.5 },
  ),
  'decal.column': decal(
    { kind: 'ellipse', color: '#1c1810', cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.42 },
    { kind: 'ellipse', color: '#4a4028', cx: 0.5, cy: 0.5, rx: 0.36, ry: 0.36 },
    { kind: 'ring', color: '#6b5c38', cx: 0.5, cy: 0.5, r: 0.28, width: 0.03, alpha: 0.7 },
    { kind: 'ellipse', color: '#2a2415', cx: 0.5, cy: 0.5, rx: 0.16, ry: 0.16 },
    { kind: 'line', color: '#2a2415', x1: 0.5, y1: 0.14, x2: 0.5, y2: 0.86, width: 0.015, alpha: 0.5 },
    { kind: 'noise', color: '#221c10', density: 0.08, seed: 2287, cell: 2, x: 0.16, y: 0.16, w: 0.68, h: 0.68 },
  ),
  'decal.cache': decal(
    { kind: 'ring', color: '#453a22', cx: 0.5, cy: 0.5, r: 0.38, width: 0.035 },
    { kind: 'line', color: '#453a22', x1: 0.3, y1: 0.3, x2: 0.7, y2: 0.7, width: 0.035, round: true },
    { kind: 'line', color: '#453a22', x1: 0.7, y1: 0.3, x2: 0.3, y2: 0.7, width: 0.035, round: true },
    { kind: 'ellipse', color: '#5c4e28', cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.1, alpha: 0.6 },
    { kind: 'noise', color: '#2c2415', density: 0.05, seed: 6689, cell: 2, x: 0.12, y: 0.12, w: 0.76, h: 0.76 },
  ),

  /** Facing +x, because that is the direction a rotation of zero points. */
  'creature.drifter': {
    width: 56,
    height: 56,
    shapes: [
      { kind: 'ellipse', color: '#1b1a16', cx: 0.48, cy: 0.5, rx: 0.44, ry: 0.36 },
      { kind: 'ellipse', color: '#43423a', cx: 0.46, cy: 0.5, rx: 0.4, ry: 0.32 },
      { kind: 'ellipse', color: '#5c5a4c', cx: 0.42, cy: 0.5, rx: 0.28, ry: 0.26 },
      { kind: 'ellipse', color: '#7a7767', cx: 0.66, cy: 0.5, rx: 0.2, ry: 0.18 },
      { kind: 'ellipse', color: '#100f0c', cx: 0.74, cy: 0.42, rx: 0.05, ry: 0.04 },
      { kind: 'ellipse', color: '#100f0c', cx: 0.74, cy: 0.58, rx: 0.05, ry: 0.04 },
      { kind: 'poly', color: '#38372f', points: [0.34, 0.18, 0.6, 0.32, 0.5, 0.36] },
      { kind: 'poly', color: '#38372f', points: [0.34, 0.82, 0.6, 0.68, 0.5, 0.64] },
    ],
  },
  'creature.hound': {
    width: 52,
    height: 52,
    shapes: [
      { kind: 'ellipse', color: '#17110f', cx: 0.46, cy: 0.5, rx: 0.46, ry: 0.3 },
      { kind: 'ellipse', color: '#3a2a26', cx: 0.44, cy: 0.5, rx: 0.42, ry: 0.26 },
      { kind: 'poly', color: '#2b1f1c', points: [0.2, 0.24, 0.42, 0.34, 0.42, 0.66, 0.2, 0.76] },
      { kind: 'ellipse', color: '#5a3c33', cx: 0.72, cy: 0.5, rx: 0.22, ry: 0.19 },
      { kind: 'poly', color: '#8b4a3c', points: [0.82, 0.38, 0.99, 0.5, 0.82, 0.62] },
      { kind: 'ellipse', color: '#e0c07a', cx: 0.8, cy: 0.42, rx: 0.045, ry: 0.035 },
      { kind: 'ellipse', color: '#e0c07a', cx: 0.8, cy: 0.58, rx: 0.045, ry: 0.035 },
      { kind: 'line', color: '#2b1f1c', x1: 0.24, y1: 0.5, x2: 0.02, y2: 0.5, width: 0.05, round: true },
    ],
  },
  'creature.bloom': {
    width: 68,
    height: 68,
    shapes: [
      { kind: 'glow', color: '#6d8a5a', cx: 0.5, cy: 0.5, r: 0.6, alpha: 0.28 },
      { kind: 'ellipse', color: '#1c231a', cx: 0.5, cy: 0.5, rx: 0.46, ry: 0.46 },
      { kind: 'ellipse', color: '#2f3a2c', cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.42 },
      { kind: 'ellipse', color: '#42513c', cx: 0.38, cy: 0.4, rx: 0.18, ry: 0.18 },
      { kind: 'ellipse', color: '#42513c', cx: 0.62, cy: 0.58, rx: 0.15, ry: 0.15 },
      { kind: 'ellipse', color: '#42513c', cx: 0.58, cy: 0.34, rx: 0.12, ry: 0.12 },
      { kind: 'ring', color: '#6d8a5a', cx: 0.5, cy: 0.5, r: 0.34, width: 0.05 },
      { kind: 'ellipse', color: '#9cc47f', cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.1, alpha: 0.8 },
      { kind: 'noise', color: '#8fb374', density: 0.06, seed: 1223, cell: 2, x: 0.2, y: 0.2, w: 0.6, h: 0.6, alpha: 0.6 },
    ],
  },
};

export const FALLBACK_SPRITE = 'unknown';
