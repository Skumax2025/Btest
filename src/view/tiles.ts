/**
 * L4: tile drawing. Reads the level through its public API and paints it with a
 * palette; no game state is written here.
 *
 * Walls are drawn as things that stand up. The camera looks straight down at the
 * middle of the screen and increasingly across everything else, so the top of a
 * wall is pushed away from the middle by an amount that grows with how far
 * off-centre it stands. The strip that opens between the footprint's near edge
 * and the same edge of the lifted top is the side of the wall the camera has
 * come round to see. The footprint itself never moves, which is what keeps the
 * drawing honest about where the player may walk — the wall leans over the floor
 * behind it, never over the floor in front.
 *
 * That projection is also what makes the darkness pass read as depth rather than
 * as a stencil: light stops on the footprint grid, so a lit wall gets its near
 * side lit and its top falls away into shadow, which is what a wall lit from the
 * floor actually does.
 */

import { hashInts } from '@core/rng';
import { viewBounds } from '@core/camera';
import type { CameraView } from '@core/camera';
import type { Renderer } from '@core/renderer';
import { TILE } from '@game/level';
import type { LevelStream } from '@game/level';
import type { Palette } from '@content/palettes';
import type { ViewConfig, WallViewConfig } from '@content/view';

/** Slight per-tile mottling so an endless carpet does not read as flat colour. */
const floorColour = (
  tile: number,
  tx: number,
  ty: number,
  palette: Palette,
  view: ViewConfig,
): string => {
  switch (tile) {
    case TILE.STAIN:
      return palette.stain;
    case TILE.WET:
      return palette.wet;
    default:
      return hashInts(tx, ty, 31) % view.floorVariationEvery === 0
        ? palette.floorAlt
        : palette.floor;
  }
};

/**
 * How far every tile is drawn past its own edge, in world units.
 *
 * Two rects that share an edge do not share a pixel: the world transform puts
 * that edge at a fraction of a device pixel and the two fills each cover part of
 * it, leaving a seam of whatever is underneath. Over a floor that is the
 * background colour, so the carpet came out ruled into squares. Half a unit of
 * bleed is a sixtieth of a tile and closes every one of them.
 */
const BLEED = 0.5;

interface TileRange {
  readonly minTx: number;
  readonly maxTx: number;
  readonly minTy: number;
  readonly maxTy: number;
}

const rangeOf = (view: CameraView, tileSize: number, pad: number): TileRange => {
  const bounds = viewBounds(view, tileSize * pad);
  return {
    minTx: Math.floor(bounds.minX / tileSize),
    maxTx: Math.floor(bounds.maxX / tileSize),
    minTy: Math.floor(bounds.minY / tileSize),
    maxTy: Math.floor(bounds.maxY / tileSize),
  };
};

export const drawTiles = (
  renderer: Renderer,
  level: LevelStream,
  view: CameraView,
  palette: Palette,
  config: ViewConfig,
): void => {
  // Three tiles of margin: a wall just off screen still leans its top and its
  // shadow back into it.
  const range = rangeOf(view, level.geo.tileSize, 3);
  drawFloor(renderer, level, range, palette, config);
  drawContactShadows(renderer, level, range, config.wall);
  drawWalls(renderer, level, view, range, palette, config.wall);
};

const drawFloor = (
  renderer: Renderer,
  level: LevelStream,
  range: TileRange,
  palette: Palette,
  config: ViewConfig,
): void => {
  const tileSize = level.geo.tileSize;
  for (let ty = range.minTy; ty <= range.maxTy; ty++) {
    for (let tx = range.minTx; tx <= range.maxTx; tx++) {
      const tile = level.tileAt(tx, ty);
      if (tile === TILE.VOID || isSolid(level, tx, ty)) continue;
      const colour = floorColour(tile, tx, ty, palette, config);
      renderer.fillRect(
        tx * tileSize - BLEED,
        ty * tileSize - BLEED,
        tileSize + BLEED * 2,
        tileSize + BLEED * 2,
        colour,
      );
    }
  }
};

/**
 * The dark line where a wall meets the floor. It is the cheapest depth cue there
 * is and the only one that survives being unlit: without it a wall and the floor
 * beside it are two flat colours meeting at a seam, and the eye reads that as a
 * change of paint rather than as a corner.
 */
const drawContactShadows = (
  renderer: Renderer,
  level: LevelStream,
  range: TileRange,
  config: WallViewConfig,
): void => {
  const tileSize = level.geo.tileSize;
  const depth = tileSize * config.contactShadow;
  if (depth <= 0) return;
  const dark = config.contactShadowColour;
  const clear = 'rgba(0,0,0,0)';
  for (let ty = range.minTy; ty <= range.maxTy; ty++) {
    for (let tx = range.minTx; tx <= range.maxTx; tx++) {
      if (!isSolid(level, tx, ty)) continue;
      const x = tx * tileSize;
      const y = ty * tileSize;
      if (!isSolid(level, tx, ty - 1)) {
        renderer.fillGradientRect(x, y - depth, tileSize, depth, 0, depth, clear, dark);
      }
      if (!isSolid(level, tx, ty + 1)) {
        renderer.fillGradientRect(x, y + tileSize, tileSize, depth, 0, depth, dark, clear);
      }
      if (!isSolid(level, tx - 1, ty)) {
        renderer.fillGradientRect(x - depth, y, depth, tileSize, depth, 0, clear, dark);
      }
      if (!isSolid(level, tx + 1, ty)) {
        renderer.fillGradientRect(x + tileSize, y, depth, tileSize, depth, 0, dark, clear);
      }
    }
  }
};

/** Scratch quad, reused for every face and top — a wall pass allocates nothing. */
const quad = new Float64Array(8);

/**
 * Where a point on the floor appears once it is lifted to the top of a wall.
 * Corners are projected one at a time rather than whole tiles being offset by
 * their centre: neighbouring tiles then share the projected corner between them,
 * and a block of wall has no seams down it.
 */
const lifted = (value: number, focus: number, lift: number): number =>
  value + (value - focus) * lift;

const drawWalls = (
  renderer: Renderer,
  level: LevelStream,
  view: CameraView,
  range: TileRange,
  palette: Palette,
  config: WallViewConfig,
): void => {
  const tileSize = level.geo.tileSize;
  // Height over camera height: how far off straight down the camera is looking
  // at a point one unit off-centre.
  const lift = config.height / Math.max(1e-3, config.cameraHeight);
  const crest = tileSize * Math.min(config.crest, 1);
  const split = Math.min(Math.max(config.faceSplit, 0), 1);

  for (let ty = range.minTy; ty <= range.maxTy; ty++) {
    for (let tx = range.minTx; tx <= range.maxTx; tx++) {
      const tile = level.tileAt(tx, ty);
      if (tile !== TILE.WALL && tile !== TILE.PILLAR) continue;
      const west = tx * tileSize - BLEED;
      const east = west + tileSize + BLEED * 2;
      const north = ty * tileSize - BLEED;
      const south = north + tileSize + BLEED * 2;
      const topWest = lifted(west, view.x, lift);
      const topEast = lifted(east, view.x, lift);
      const topNorth = lifted(north, view.y, lift);
      const topSouth = lifted(south, view.y, lift);

      // The side of a raised wall the camera can see is the one turned towards
      // it, and it stands between that edge of the footprint and the same edge of
      // the lifted top. A side with more wall behind it is not a side at all.
      const facesNorth = topNorth > north && !isSolid(level, tx, ty - 1);
      const facesSouth = !facesNorth && topSouth < south && !isSolid(level, tx, ty + 1);
      if (facesNorth) {
        shade(renderer, west, north, east, north, topEast, topNorth, topWest, topNorth, palette, split);
      } else if (facesSouth) {
        // The one side the light never reaches down: south faces stay flat dark.
        fill(renderer, west, south, east, south, topEast, topSouth, topWest, topSouth, palette.wallFaceDark);
      }
      if (topWest > west && !isSolid(level, tx - 1, ty)) {
        shade(renderer, west, north, west, south, topWest, topSouth, topWest, topNorth, palette, split);
      } else if (topEast < east && !isSolid(level, tx + 1, ty)) {
        shade(renderer, east, north, east, south, topEast, topSouth, topEast, topNorth, palette, split);
      }

      const top = tile === TILE.WALL ? palette.wall : palette.pillar;
      fill(renderer, topWest, topNorth, topEast, topNorth, topEast, topSouth, topWest, topSouth, top);
      // The one bright line on a wall sits where its top folds over into the side
      // the camera can see. Anywhere else it reads as a stripe painted on the
      // floor; there it reads as an edge.
      if (crest > 0 && (facesNorth || facesSouth)) {
        const edge = facesNorth ? topNorth : topSouth;
        const inner = lifted(facesNorth ? north + crest : south - crest, view.y, lift);
        fill(renderer, topWest, edge, topEast, edge, topEast, inner, topWest, inner, palette.wallEdge);
      }
    }
  }
};

/**
 * A wall's side in two tones: dark where it meets the floor, lighter towards the
 * crest. One flat colour reads as a stripe painted beside the wall; the moment
 * the bottom of it is darker than the top, it reads as a surface going away
 * under the light.
 */
const shade = (
  renderer: Renderer,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  palette: Palette,
  split: number,
): void => {
  const midAx = ax + (dx - ax) * split;
  const midAy = ay + (dy - ay) * split;
  const midBx = bx + (cx - bx) * split;
  const midBy = by + (cy - by) * split;
  fill(renderer, ax, ay, bx, by, midBx, midBy, midAx, midAy, palette.wallFaceDark);
  fill(renderer, midAx, midAy, midBx, midBy, cx, cy, dx, dy, palette.wallShade);
};

const fill = (
  renderer: Renderer,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  colour: string,
): void => {
  quad[0] = ax;
  quad[1] = ay;
  quad[2] = bx;
  quad[3] = by;
  quad[4] = cx;
  quad[5] = cy;
  quad[6] = dx;
  quad[7] = dy;
  renderer.fillPolygon(quad, colour);
};

const isSolid = (level: LevelStream, tx: number, ty: number): boolean => {
  const tile = level.tileAt(tx, ty);
  return tile === TILE.WALL || tile === TILE.PILLAR || tile === TILE.VOID;
};
