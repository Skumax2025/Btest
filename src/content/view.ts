/**
 * L3: how big things are drawn and how the darkness behaves.
 *
 * Rendering proportions are game numbers too — how large a creature looks and
 * how far light bleeds past a wall both change how the game plays — so they live
 * here with everything else rather than as literals inside the view.
 */

export interface ViewConfig {
  /** How far past a blocking tile a light ray reaches, in tiles. */
  readonly overshootTiles: number;
  /** Strength of the player's own bubble of sight. */
  readonly playerLightStrength: number;
  /** Cached lamp visibility polygons kept before the cache is dropped. */
  readonly lightCacheLimit: number;
  /** Height of a wall's lit cap and dark skirt, as a share of a tile. */
  readonly wallFaceHeight: number;
  /** One floor tile in this many gets the alternate shade. */
  readonly floorVariationEvery: number;
  readonly markerTiles: number;
  readonly markerAlpha: number;
  readonly groundItemSize: number;
  readonly projectileSize: number;
  readonly playerSpriteSize: number;
  readonly crouchScale: number;
  readonly shadowOffset: number;
  /** Creature sprite size as a multiple of its collision radius. */
  readonly creatureSpriteScale: number;
  readonly telegraphCoreScale: number;
  readonly telegraphFill: string;
  readonly telegraphCore: string;
  readonly phantomRadius: number;
  readonly phantomMinDistance: number;
  readonly phantomSpread: number;
  /** Ticks a false silhouette holds still before it moves elsewhere. */
  readonly phantomPeriodTicks: number;
  readonly phantomBaseAlpha: number;
  readonly phantomAlphaRange: number;
  /** Phantoms per unit of derangement. */
  readonly phantomCount: number;
  readonly combat: CombatViewConfig;
}

/**
 * Melee runs itself, so these numbers are the only way a player can tell what
 * their character is doing. Read them as feedback timing, not balance.
 */
export interface CombatViewConfig {
  /** Extra world units drawn outside the true reach, so the ring is not a lie. */
  readonly ringPadding: number;
  readonly ringWidth: number;
  readonly readyColour: string;
  readonly coolingColour: string;
  readonly windupColour: string;
  /** How far an event ring travels outward over its life, in world units. */
  readonly eventGrowth: number;
  readonly eventWidth: number;
  readonly hitColour: string;
  readonly blockColour: string;
  readonly missColour: string;
  readonly breakColour: string;
  readonly tiredColour: string;
}

export const VIEW: ViewConfig = {
  overshootTiles: 1.4,
  playerLightStrength: 0.92,
  lightCacheLimit: 512,
  wallFaceHeight: 0.22,
  floorVariationEvery: 5,
  markerTiles: 3,
  markerAlpha: 0.85,
  groundItemSize: 18,
  projectileSize: 14,
  playerSpriteSize: 24,
  crouchScale: 0.8,
  shadowOffset: 3,
  creatureSpriteScale: 2.2,
  telegraphCoreScale: 1.6,
  telegraphFill: 'rgba(58,34,30,0.22)',
  telegraphCore: 'rgba(38,26,24,0.85)',
  phantomRadius: 11,
  phantomMinDistance: 130,
  phantomSpread: 160,
  phantomPeriodTicks: 40,
  phantomBaseAlpha: 0.1,
  phantomAlphaRange: 0.22,
  phantomCount: 3,
  combat: {
    ringPadding: 3,
    ringWidth: 1.5,
    readyColour: 'rgba(240, 228, 186, 0.55)',
    coolingColour: 'rgba(150, 140, 110, 0.3)',
    windupColour: 'rgba(255, 236, 170, 0.85)',
    eventGrowth: 26,
    eventWidth: 3,
    hitColour: 'rgba(220, 120, 96, 0.9)',
    blockColour: 'rgba(180, 220, 240, 0.95)',
    missColour: 'rgba(190, 180, 150, 0.5)',
    breakColour: 'rgba(230, 90, 70, 0.95)',
    tiredColour: 'rgba(150, 190, 130, 0.7)',
  },
};
