/**
 * L2: the vocabulary of a level. Structure only — every number and every room
 * shape arrives from content (L3) as data.
 */

export const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  PILLAR: 3,
  STAIN: 4,
  WET: 5,
} as const;

export type TileId = (typeof TILE)[keyof typeof TILE];

export const isSolidTile = (tile: number): boolean =>
  tile === TILE.VOID || tile === TILE.WALL || tile === TILE.PILLAR;

/** Floor that slows the player down and squelches under foot. */
export const isWetTile = (tile: number): boolean => tile === TILE.WET;

/**
 * Characters accepted in room templates.
 *   `.` floor      `#` wall        `o` pillar     `,` stained carpet
 *   `~` wet carpet `L` lamp        `c` container  `s` creature spawn
 *   `x` exit anchor
 */
export const TEMPLATE_CHARS = '.#o,~Lcsx';

export const charToTile = (char: string): TileId => {
  switch (char) {
    case '#':
      return TILE.WALL;
    case 'o':
      return TILE.PILLAR;
    case ',':
      return TILE.STAIN;
    case '~':
      return TILE.WET;
    default:
      return TILE.FLOOR;
  }
};

export type PropKind = 'lamp' | 'container' | 'creature' | 'exit' | 'marker';

/** Values of `PropSpawn.variant` for a lamp. */
export const LAMP_LIT = 0;
export const LAMP_FLICKER = 1;
export const LAMP_DEAD = 2;

export interface PropSpawn {
  /** Stable identity across regeneration — the key used by chunk deltas. */
  readonly key: string;
  readonly kind: PropKind;
  /** Content id: lamp variant, container type, creature type, marker art. */
  readonly defId: string;
  readonly tx: number;
  readonly ty: number;
  readonly x: number;
  readonly y: number;
  readonly seed: number;
  /** Kind-specific state chosen at generation time (lamp: 0 lit, 1 flickering, 2 dead). */
  readonly variant: number;
}

export interface RoomTemplate {
  readonly id: string;
  readonly weight: number;
  /** `blockSize - 1` rows of `blockSize - 1` template characters. */
  readonly rows: readonly string[];
}

export interface LandmarkTemplate extends RoomTemplate {
  /** Decal id drawn on the floor so the place is recognisable on a second visit. */
  readonly marker: string;
}

export interface WeightedId {
  readonly id: string;
  readonly weight: number;
}

/** Geometry of the tile lattice. Supplied by content so nothing is hard-coded. */
export interface LevelGeometry {
  readonly tileSize: number;
  /** Tiles per block, counting the block's own north and west wall lines. */
  readonly blockSize: number;
  readonly chunkBlocks: number;
  /** Width of a doorway, in tiles. */
  readonly doorWidth: number;
}

export interface LevelSpec {
  readonly id: string;
  readonly title: string;
  readonly paletteId: string;
  readonly rooms: readonly RoomTemplate[];
  readonly landmarks: readonly LandmarkTemplate[];
  /**
   * Period of the corridor lattice, in blocks. Every `spinePeriod`-th block row
   * is an open east-west run and every `spinePeriod`-th column a north-south
   * one; blocks off the lattice hang off it as a tree. Larger values mean
   * longer detours and more dead ends.
   */
  readonly spinePeriod: number;
  /** Chance of an extra doorway beyond the guaranteed connectivity lattice. */
  readonly extraDoorChance: number;
  readonly lampChance: number;
  readonly lampWorkingChance: number;
  readonly lampFlickerChance: number;
  readonly containerChance: number;
  readonly containers: readonly WeightedId[];
  readonly creatureChance: number;
  readonly creatures: readonly WeightedId[];
  readonly lootTableId: string;
  /** Exactly one landmark chunk per `landmarkStride` squared chunks, guaranteed. */
  readonly landmarkStride: number;
  readonly exitStride: number;
  readonly ambientLight: number;
  /** Room forced into the very first block of the world, or null for none. */
  readonly startRoomId: string | null;
}

export interface Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly tiles: Uint8Array;
  readonly props: readonly PropSpawn[];
  readonly landmarkId: string | null;
  readonly hasExit: boolean;
}

export const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;

/** Everything the player changed in a chunk; survives unload and the save file. */
export interface ChunkDelta {
  /** Prop keys that must never spawn again (taken pickups, dead creatures). */
  consumed: string[];
  /** Prop keys of containers that have already been searched. */
  opened: string[];
  /** Items dropped on the floor by the player, in world units. */
  dropped: Array<{
    itemId: string;
    count: number;
    x: number;
    y: number;
    /** Condition and charge the stack had when it was put down, if any. */
    durability?: number;
    charge?: number;
  }>;
}

export const emptyDelta = (): ChunkDelta => ({ consumed: [], opened: [], dropped: [] });
