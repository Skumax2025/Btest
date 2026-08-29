/**
 * L4: tile drawing. Reads the level through its public API and paints it with a
 * palette; no game state is written here.
 */

import { hashInts } from '@core/rng';
import { viewBounds } from '@core/camera';
import type { CameraView } from '@core/camera';
import type { Renderer } from '@core/renderer';
import { TILE } from '@game/level';
import type { LevelStream } from '@game/level';
import type { Palette } from '@content/palettes';

/** Slight per-tile mottling so an endless carpet does not read as flat colour. */
const floorColour = (tile: number, tx: number, ty: number, palette: Palette): string => {
  switch (tile) {
    case TILE.STAIN:
      return palette.stain;
    case TILE.WET:
      return palette.wet;
    default:
      return hashInts(tx, ty, 31) % 5 === 0 ? palette.floorAlt : palette.floor;
  }
};

export const drawTiles = (
  renderer: Renderer,
  level: LevelStream,
  view: CameraView,
  palette: Palette,
): void => {
  const tileSize = level.geo.tileSize;
  const bounds = viewBounds(view, tileSize * 2);
  const minTx = Math.floor(bounds.minX / tileSize);
  const maxTx = Math.floor(bounds.maxX / tileSize);
  const minTy = Math.floor(bounds.minY / tileSize);
  const maxTy = Math.floor(bounds.maxY / tileSize);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const tile = level.tileAt(tx, ty);
      if (tile === TILE.VOID) continue;
      const x = tx * tileSize;
      const y = ty * tileSize;
      if (tile === TILE.WALL || tile === TILE.PILLAR) {
        renderer.fillRect(x, y, tileSize, tileSize, tile === TILE.WALL ? palette.wall : palette.pillar);
        // Faces only where the wall mass actually ends: a lit cap on the north
        // side and a dark skirt on the south. That is the whole "3d" budget.
        if (!isSolid(level, tx, ty - 1)) {
          renderer.fillRect(x, y, tileSize, tileSize * 0.22, palette.wallEdge);
        }
        if (!isSolid(level, tx, ty + 1)) {
          renderer.fillRect(x, y + tileSize * 0.78, tileSize, tileSize * 0.22, palette.wallShade);
        }
      } else {
        renderer.fillRect(x, y, tileSize, tileSize, floorColour(tile, tx, ty, palette));
      }
    }
  }
};

const isSolid = (level: LevelStream, tx: number, ty: number): boolean => {
  const tile = level.tileAt(tx, ty);
  return tile === TILE.WALL || tile === TILE.PILLAR || tile === TILE.VOID;
};
