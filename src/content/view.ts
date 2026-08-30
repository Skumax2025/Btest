/**
 * L3: how big things are drawn and how the darkness behaves.
 *
 * Rendering proportions are game numbers too — how large a creature looks and
 * how far into a wall light reaches both change how the game plays — so they
 * live here with everything else rather than as literals inside the view.
 */

export interface ViewConfig {
  readonly light: LightViewConfig;
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
  readonly hud: HudConfig;
}

/**
 * The darkness pass. These are the numbers that decide whether the game reads as
 * a lit place with dark corners or as a torch in a void, so they belong with the
 * balance numbers rather than as literals inside the view.
 */
export interface LightViewConfig {
  /**
   * Share of a blocking tile that light is allowed to enter. At 0.5 a lamp lights
   * the near half of a wall and stops dead in the middle of it, which is the only
   * setting that both makes walls look solid and keeps light out of the next room.
   * Anything at or above 1 leaks through.
   */
  readonly wallPenetration: number;
  /** Points used to turn the falloff curve into a canvas gradient. */
  readonly profileSamples: number;
  /** Lamp shadow polygons held before the oldest is dropped. */
  readonly cacheLimit: number;
  /** Strength of the player's own bubble of sight. */
  readonly playerLightStrength: number;
  /** Share of the sight radius that stays at full brightness before the vignette. */
  readonly sightCore: number;
  /** Warm bloom a lamp adds on top of merely being visible. */
  readonly lampGlow: number;
  /** Exponent tightening the bloom into the middle of a light. Higher is tighter. */
  readonly glowConcentration: number;
  /**
   * The beam is a string of soft pools laid along the aim line, not a wedge.
   * A wedge is a polygon, and a polygon has a hard edge wherever it is not a
   * wall — stacking wedges to fake a soft one only trades that edge for a fan of
   * seams where their clips overlap. Pools have no edge to begin with: they fall
   * off through the same curve a lamp does, and their union is the beam.
   */
  readonly beamSegments: number;
  /**
   * Widest half-angle the pools are clipped to, as a multiple of the beam's own.
   * Only wall shadows should ever reach it; if the pools do, it has a visible
   * edge again.
   */
  readonly beamClip: number;
  /** Pool radius at the torch itself, in world units; it widens with the beam after that. */
  readonly beamNear: number;
  /** How much dimmer the end of the beam is than its root. A torch does not fall
   *  off like a bare bulb, so this stays modest. */
  readonly beamFade: number;
  readonly flashlightGlow: number;
  /** Light bouncing back off the floor at the player's feet, in world units. */
  readonly flashlightSpill: number;
  readonly flashlightSpillStrength: number;
}

/**
 * How loudly the interface talks. It stays out of the way while nothing is
 * happening and comes back the moment a bar moves or something walks into reach.
 */
export interface HudConfig {
  /** Below this share of its maximum, a bar starts asking to be looked at. */
  readonly criticalFraction: number;
  /** Ticks of nothing happening before the interface fades back. */
  readonly calmTicks: number;
  /** Change in a stat, in points, that counts as something happening. */
  readonly changeEpsilon: number;
  /** Opacity of the interface once it has gone quiet. */
  readonly calmOpacity: number;
  /** World units above a target that its key prompt is drawn. */
  readonly promptOffset: number;
  readonly promptFont: string;
  readonly scale: number;
  readonly handSlotSize: number;
  /** Width of one belt slot on the hotbar, in pixels. */
  readonly beltSlotSize: number;
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
  light: {
    wallPenetration: 0.5,
    profileSamples: 12,
    cacheLimit: 512,
    playerLightStrength: 0.88,
    sightCore: 0.5,
    lampGlow: 0.3,
    glowConcentration: 2.1,
    beamSegments: 12,
    beamClip: 2.4,
    beamNear: 30,
    beamFade: 0.3,
    flashlightGlow: 0.26,
    flashlightSpill: 96,
    flashlightSpillStrength: 0.34,
  },
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
  hud: {
    criticalFraction: 0.3,
    calmTicks: 150,
    changeEpsilon: 0.4,
    calmOpacity: 0.3,
    promptOffset: 32,
    promptFont: '14px ui-monospace, "DejaVu Sans Mono", monospace',
    scale: 1.28,
    handSlotSize: 86,
    beltSlotSize: 96,
  },
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
