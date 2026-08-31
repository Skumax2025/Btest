/**
 * L4: tile drawing. Reads the level through its public API and paints it with a
 * palette; no game state is written here.
 *
 * Every surface is a texture rather than a fill. The point is not decoration: an
 * endless corridor of flat colour gives the eye nothing to measure movement
 * against, so walking down one feels like standing still. A seam every tile and
 * a grain that changes every few of them is what turns motion back into motion.
 *
 * The variant a cell gets comes from its own coordinates, so the building looks
 * the same every time it is streamed in and no two neighbours repeat.
 */

import { hashInts } from '@core/rng';
import { viewBounds } from '@core/camera';
import type { CameraView } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SpriteProvider } from '@core/assets';
import { TILE } from '@game/level';
import type { LevelStream } from '@game/level';
import type { Palette } from '@content/palettes';
import type { ViewConfig } from '@content/view';

const surfaceFor = (tile: number, tx: number, ty: number, palette: Palette): string => {
  const { textures } = palette;
  switch (tile) {
    case TILE.STAIN:
      return textures.stain;
    case TILE.WET:
      return textures.wet;
    case TILE.PILLAR:
      return textures.pillar;
    case TILE.WALL:
      return textures.wall[hashInts(tx, ty, 17) % textures.wall.length];
    default:
      return textures.floor[hashInts(tx, ty, 31) % textures.floor.length];
  }
};

export const drawTiles = (
  renderer: Renderer,
  sprites: SpriteProvider,
  level: LevelStream,
  view: CameraView,
  palette: Palette,
  config: ViewConfig,
): void => {
  const tileSize = level.geo.tileSize;
  const bounds = viewBounds(view, tileSize * 2);
  const minTx = Math.floor(bounds.minX / tileSize);
  const maxTx = Math.floor(bounds.maxX / tileSize);
  const minTy = Math.floor(bounds.minY / tileSize);
  const maxTy = Math.floor(bounds.maxY / tileSize);
  const face = tileSize * config.wallFaceHeight;
  const side = tileSize * config.wallSideWidth;
  // Half a pixel of overlap: a texture drawn on an exact boundary can leave a
  // seam of background between two tiles once the camera is on a fraction.
  const bleed = 0.5;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const tile = level.tileAt(tx, ty);
      if (tile === TILE.VOID) continue;
      const x = tx * tileSize;
      const y = ty * tileSize;
      renderer.drawSprite(sprites.sprite(surfaceFor(tile, tx, ty, palette)), x + tileSize / 2, y + tileSize / 2, {
        width: tileSize + bleed,
        height: tileSize + bleed,
      });
      if (tile !== TILE.WALL && tile !== TILE.PILLAR) continue;

      // Faces only where the wall mass actually ends: a lit cap on the north
      // side, a dark skirt on the south, and a thin edge down the flanks. That
      // is the whole "3d" budget, and it is what stops a wall reading as a hole.
      if (!isSolid(level, tx, ty - 1)) {
        renderer.setAlpha(0.9);
        renderer.fillRect(x, y, tileSize, face, palette.wallEdge);
        renderer.setAlpha(0.35);
        renderer.fillRect(x, y + face, tileSize, face * 0.5, palette.wallEdge);
        renderer.setAlpha(1);
      }
      if (!isSolid(level, tx, ty + 1)) {
        renderer.setAlpha(0.85);
        renderer.fillRect(x, y + tileSize - face, tileSize, face, palette.wallShade);
        renderer.setAlpha(0.4);
        renderer.fillRect(x, y + tileSize - face * 1.6, tileSize, face * 0.6, palette.wallShade);
        renderer.setAlpha(1);
      }
      if (!isSolid(level, tx - 1, ty)) {
        renderer.setAlpha(0.4);
        renderer.fillRect(x, y, side, tileSize, palette.wallShade);
        renderer.setAlpha(1);
      }
      if (!isSolid(level, tx + 1, ty)) {
        renderer.setAlpha(0.4);
        renderer.fillRect(x + tileSize - side, y, side, tileSize, palette.wallShade);
        renderer.setAlpha(1);
      }
    }
  }
};

const isSolid = (level: LevelStream, tx: number, ty: number): boolean => {
  const tile = level.tileAt(tx, ty);
  return tile === TILE.WALL || tile === TILE.PILLAR || tile === TILE.VOID;
};
