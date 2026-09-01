/**
 * L3: how big things are drawn and how the darkness behaves.
 *
 * Rendering proportions are game numbers too — how large a creature looks and
 * how far into a wall light reaches both change how the game plays — so they
 * live here with everything else rather than as literals inside the view.
 */

/**
 * How much work a frame is allowed to be.
 *
 * The demo runs on whatever the browser is running on, and the darkness pass —
 * full-screen fill, one gradient per light — is almost the whole cost of a
 * frame. These are the knobs that make it cheaper, ordered so that the first
 * thing given up is the least visible: the resolution light is *computed* at,
 * then the number of rays its shadows are traced with, then bloom.
 */
export type QualityId = 'low' | 'medium' | 'high';

/** What the player asked for: a fixed tier, or the frame clock's judgement. */
export type QualityPreference = QualityId | 'auto';

export interface QualityTier {
  readonly id: QualityId;
  /** Ceiling on device pixels per CSS pixel. A phone at 3 draws nine times a 1. */
  readonly maxPixelRatio: number;
  /**
   * Ceiling on the whole backing store. The ratio alone is not a bound: a 4K
   * display at 2 is thirty-three million pixels, and there are three buffers of
   * them. Past this the ratio comes down instead — on a screen that large,
   * nobody can see the difference anyway.
   */
  readonly maxPixels: number;
  /** Resolution of the darkness and bloom layers, as a share of the frame. */
  readonly darknessScale: number;
  readonly rays: RayCounts;
  /** Pools along the torch beam. Fewer is a coarser beam, not a shorter one. */
  readonly beamSegments: number;
  /** Multiplier on a lamp's second, tighter pool; 0 drops it. */
  readonly lampCore: number;
  /** Multiplier on every bloom; 0 leaves the bloom layer empty and uncomposited. */
  readonly glow: number;
  /** Multiplier on the false silhouettes low nerve draws. */
  readonly phantoms: number;
}

/**
 * Rays per fan. Every ray is one DDA walk, and the angular gap between two of
 * them is the size of the jagged step a shadow edge shows: at the player's line
 * of sight radius, `playerRays` has to keep that gap under a tile or the world
 * visibly wobbles as you walk. The top tier does; the tiers below trade that
 * for frames, which is the right way round — a coarse shadow edge on a machine
 * that cannot afford a fine one is better than a fine one at nine frames a
 * second. Lamp fans are cached per lamp, so their count is close to free.
 */
export interface RayCounts {
  readonly lightRays: number;
  readonly playerRays: number;
  readonly flashlightRays: number;
}

/**
 * When to give up quality and when to take it back.
 *
 * Two clocks, because one of them lies. The *frame* is what the player feels,
 * but the browser pins it to the refresh rate: a machine drawing comfortably at
 * 60 Hz reports 16.6 ms whether it spent one millisecond of that on us or
 * fifteen, so a rule written on frame time alone can never tell a fast machine
 * it may have more. The *work* — our own simulation plus our own drawing — has
 * no such ceiling, and it is what we can actually spend.
 *
 * So: give quality up only when the frame is long *and* we are the reason it is
 * long; take it back when our own work is small, whatever the display is doing.
 * That way a device the browser has throttled to 30 Hz keeps the tier it can
 * clearly afford, instead of being punished for a frame rate it was given.
 *
 * The gap between the two work thresholds is what stops a machine sitting on the
 * boundary from flickering between tiers, and a step up needs several windows in
 * a row where a step down needs one: a slow frame is felt at once, spare
 * capacity is not.
 */
export interface QualityGovernorConfig {
  /** Frame time above which a frame is a candidate for being too slow. */
  readonly downshiftMs: number;
  /** Our own cost within such a frame, above which we are the reason for it. */
  readonly downshiftWorkMs: number;
  /** Our own cost below which a frame is counted as having room to spare. */
  readonly upshiftWorkMs: number;
  /** Frames in a window, after which a decision is taken. */
  readonly window: number;
  /** Windows in a row that must agree before quality is raised. */
  readonly settleWindows: number;
}

export interface ViewConfig {
  readonly light: LightViewConfig;
  /** Height of a wall's lit cap and dark skirt, as a share of a tile. */
  readonly wallFaceHeight: number;
  /** Width of the dark edge down a wall's flanks, as a share of a tile. */
  readonly wallSideWidth: number;
  readonly markerTiles: number;
  readonly markerAlpha: number;
  readonly groundItemSize: number;
  readonly projectileSize: number;
  /** Radians a thrown item turns per tick left of its flight. */
  readonly throwSpin: number;
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
  /**
   * A second, much tighter pool at a lamp's centre. A tube is a bright *object*
   * as well as a light: without this it is a gradient with a fitting drawn in
   * the middle of it, and the eye reads the fitting as unlit.
   */
  readonly lampCore: number;
  readonly lampCoreRadius: number;
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
  /**
   * A hand-held torch is held by a hand. The beam breathes by this much, in
   * radians, over `swayPeriod` seconds — far too little to aim differently and
   * just enough that the light is not welded to the character.
   */
  readonly beamSway: number;
  readonly beamSwaySeconds: number;
  /** Light bouncing back off the floor at the player's feet, in world units. */
  readonly flashlightSpill: number;
  readonly flashlightSpillStrength: number;
  /**
   * Dark adaptation. Stepping out of the light does not blind you and then let
   * you see: the eye takes a moment. This is the share of the sight bubble's
   * brightness that is withheld the instant the light goes, recovered at
   * `adaptationRate` per frame — a purely visual memory the simulation never
   * reads, so the vision *radius* it agrees with the game about is untouched.
   */
  readonly adaptation: number;
  readonly adaptationRate: number;
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
  /**
   * Damage that fills the hurt flash completely, and how much of it drains per
   * frame. A hit has to be felt at the edges of the screen before it is read on
   * a bar, or a fight that runs itself is a fight that happens to somebody else.
   */
  readonly hurtFlashDamage: number;
  readonly hurtFade: number;
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
  /** The arc a landed swing sweeps, drawn across the facing. */
  readonly arcColour: string;
  readonly arcWidth: number;
  /** Share of a turn the arc covers. */
  readonly arcSpan: number;
  /** Flash over everything the swing caught, so a hit lands on a body. */
  readonly impactColour: string;
  readonly impactScale: number;
}

export const QUALITY: readonly QualityTier[] = [
  {
    id: 'low',
    maxPixelRatio: 1,
    maxPixels: 1_600_000,
    darknessScale: 0.4,
    rays: { lightRays: 40, playerRays: 96, flashlightRays: 28 },
    beamSegments: 6,
    lampCore: 0,
    glow: 0,
    phantoms: 0.5,
  },
  {
    id: 'medium',
    maxPixelRatio: 1.5,
    maxPixels: 3_000_000,
    darknessScale: 0.6,
    rays: { lightRays: 56, playerRays: 160, flashlightRays: 36 },
    beamSegments: 9,
    lampCore: 1,
    glow: 1,
    phantoms: 1,
  },
  {
    id: 'high',
    maxPixelRatio: 2,
    maxPixels: 4_600_000,
    darknessScale: 0.85,
    rays: { lightRays: 72, playerRays: 256, flashlightRays: 48 },
    beamSegments: 12,
    lampCore: 1,
    glow: 1,
    phantoms: 1,
  },
];

/**
 * Quality decides itself from how long frames are taking. A player who wants to
 * overrule it can, but nobody should have to know what their device can draw
 * before they can play on it.
 */
export const DEFAULT_QUALITY: QualityPreference = 'auto';

/** A 60 Hz frame is 16.6 ms; the shelf below it is where the tiers are placed. */
export const QUALITY_GOVERNOR: QualityGovernorConfig = {
  downshiftMs: 20,
  downshiftWorkMs: 9,
  upshiftWorkMs: 5,
  window: 45,
  settleWindows: 3,
};

/**
 * The on-screen pad. A thumb is not a mouse: it covers what it touches, it has
 * no hover, it cannot be precise, and there are only two of them. So the sticks
 * appear wherever the thumb lands rather than in a fixed place it has to find,
 * the dead zone is generous enough that a resting thumb does not walk, and
 * sprinting is the far end of the movement stick rather than one more button
 * competing for a finger that is already busy.
 */
export interface TouchConfig {
  /** How far the knob travels from where the thumb landed, in pixels. */
  readonly stickRadius: number;
  /** Share of that travel ignored entirely. */
  readonly deadZone: number;
  /** Share of it past which the movement stick also sprints. */
  readonly sprintAt: number;
  /** How far ahead of the player the aim stick points, in world units. */
  readonly aimDistance: number;
}

/**
 * `auto` follows what the player last used — a touch puts the pad up, a key or a
 * mouse takes it away — which is the only rule that works on a laptop with a
 * touchscreen, where neither answer is right for the whole session.
 */
export const DEFAULT_TOUCH_MODE: TouchMode = 'auto';

export type TouchMode = 'auto' | 'on' | 'off';

export const TOUCH: TouchConfig = {
  stickRadius: 54,
  deadZone: 0.16,
  sprintAt: 0.82,
  aimDistance: 320,
};

export const VIEW: ViewConfig = {
  light: {
    wallPenetration: 0.5,
    profileSamples: 12,
    cacheLimit: 512,
    playerLightStrength: 0.88,
    sightCore: 0.5,
    lampGlow: 0.3,
    lampCore: 0.55,
    lampCoreRadius: 0.28,
    glowConcentration: 2.1,
    beamSegments: 12,
    beamClip: 2.4,
    beamNear: 30,
    beamFade: 0.3,
    flashlightGlow: 0.26,
    beamSway: 0.035,
    beamSwaySeconds: 3.1,
    flashlightSpill: 96,
    flashlightSpillStrength: 0.34,
    adaptation: 0.4,
    adaptationRate: 0.035,
  },
  wallFaceHeight: 0.22,
  wallSideWidth: 0.09,
  markerTiles: 3,
  markerAlpha: 0.85,
  groundItemSize: 18,
  projectileSize: 20,
  throwSpin: 0.12,
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
    hurtFlashDamage: 24,
    hurtFade: 0.035,
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
    arcColour: 'rgba(255, 240, 200, 0.75)',
    arcWidth: 4,
    arcSpan: 0.42,
    impactColour: 'rgba(255, 226, 180, 0.85)',
    impactScale: 1.35,
  },
};

/**
 * The view configuration a tier asks for. The base numbers are the design; a
 * tier only ever turns them down, and it does it here rather than in the view,
 * so every drawing module keeps reading one `ViewConfig` and knows nothing
 * about quality at all.
 */
export const viewFor = (tier: QualityTier): ViewConfig => ({
  ...VIEW,
  light: {
    ...VIEW.light,
    lampCore: VIEW.light.lampCore * tier.lampCore,
    lampGlow: VIEW.light.lampGlow * tier.glow,
    flashlightGlow: VIEW.light.flashlightGlow * tier.glow,
    beamSegments: tier.beamSegments,
  },
  phantomCount: VIEW.phantomCount * tier.phantoms,
});
