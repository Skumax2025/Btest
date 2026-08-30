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
};
