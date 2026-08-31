/**
 * L3: how big things are drawn and how the darkness behaves.
 *
 * Rendering proportions are game numbers too — how large a creature looks and
 * how far into a wall light reaches both change how the game plays — so they
 * live here with everything else rather than as literals inside the view.
 */

export interface ViewConfig {
  readonly light: LightViewConfig;
  readonly wall: WallViewConfig;
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
   * Blur on the light mask, in screen pixels. A shadow edge is only ever as
   * exact as the ray budget that found it; a couple of pixels of penumbra is
   * both what a real edge looks like and what hides the steps between rays.
   */
  readonly softness: number;
  /** Blur on the bloom layer, in screen pixels. This is the halo itself. */
  readonly bloom: number;
  /** How much of that halo is added over its own crisp core. */
  readonly bloomStrength: number;
  /** How hard the corners of the frame are pulled down. 0 turns it off. */
  readonly vignette: number;
  /** Share of the frame left untouched in the middle. */
  readonly vignetteInner: number;
  readonly vignetteColour: string;
  /**
   * Widest half-angle the beam is clipped to, as a multiple of its own. Only
   * wall shadows should ever reach that clip; if the beam itself does, the one
   * hard edge in the whole pass becomes the thing the player looks at.
   */
  readonly beamClip: number;
  /** Share of the beam's half-angle held at full brightness across the beam. */
  readonly beamCore: number;
  /** Share of the radius over which the beam opens out of the torch itself, so
   *  the light has a body at the player's hand rather than starting at a point. */
  readonly beamBulb: number;
  /** Share of the beam's length held near full brightness before it fades out. */
  readonly beamReach: number;
  readonly flashlightGlow: number;
  /** Light bouncing back off the floor at the player's feet, in world units. */
  readonly flashlightSpill: number;
  readonly flashlightSpillStrength: number;
  /** How far the torch wanders off the aim line. A hand is not a tripod. */
  readonly torchSway: number;
  /** Depth of the torch's own unsteadiness in brightness, 0 for a dead-steady beam. */
  readonly torchFlutter: number;
  /** Ticks per cycle of both. */
  readonly torchSwayPeriod: number;
}

/**
 * How much of a wall the camera can see round the side of.
 *
 * The projection is one number in two parts: a wall's apparent height over the
 * height the camera is looking down from. Everything else here is the shading
 * that makes the raised part read as a side rather than as a wider wall.
 */
export interface WallViewConfig {
  /** Apparent height of a wall, in tiles. */
  readonly height: number;
  /** How far above the floor the camera sits, in tiles. Larger is flatter. */
  readonly cameraHeight: number;
  /** The bright line along a wall's north crest, as a share of a tile. */
  readonly crest: number;
  /** How far a wall's shadow reaches onto the floor beside it, in tiles. */
  readonly contactShadow: number;
  readonly contactShadowColour: string;
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
    profileSamples: 24,
    cacheLimit: 512,
    playerLightStrength: 0.84,
    sightCore: 0.42,
    lampGlow: 0.2,
    glowConcentration: 2.1,
    softness: 7,
    bloom: 20,
    bloomStrength: 0.42,
    vignette: 0.42,
    vignetteInner: 0.26,
    vignetteColour: 'rgba(3,2,7,0.92)',
    beamClip: 1.9,
    beamCore: 0.16,
    beamBulb: 0.22,
    beamReach: 0.14,
    flashlightGlow: 0.14,
    flashlightSpill: 92,
    flashlightSpillStrength: 0.3,
    torchSway: 0.02,
    torchFlutter: 0.05,
    torchSwayPeriod: 53,
  },
  wall: {
    height: 0.62,
    cameraHeight: 16,
    crest: 0.1,
    contactShadow: 0.42,
    contactShadowColour: 'rgba(9,7,4,0.55)',
  },
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
