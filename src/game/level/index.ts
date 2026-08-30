/**
 * L2 module: level.
 *
 * Knows: the tile lattice, deterministic chunk generation from a seed, which
 * chunks are live around a point, and what the player has changed in each of
 * them.
 *
 * Does not know: colours, sprites, item definitions, creature behaviour, or
 * anything about the player beyond a position. All shapes and probabilities
 * arrive as a `LevelSpec` from content (L3).
 */

export { generateChunk, doorOpenNorth, doorOpenWest } from './generate';
export type { DoorRules, GenerateParams } from './generate';
export { LevelStream } from './stream';
export type { StreamOptions, StreamSave } from './stream';
export {
  LAMP_DEAD,
  LAMP_FLICKER,
  LAMP_LIT,
  TILE,
  TEMPLATE_CHARS,
  charToTile,
  chunkKey,
  emptyDelta,
  isSolidTile,
  isWetTile,
} from './types';
export type {
  Chunk,
  ChunkDelta,
  LandmarkTemplate,
  LevelGeometry,
  LevelSpec,
  PropKind,
  PropSpawn,
  RoomTemplate,
  TileId,
  WeightedId,
} from './types';
