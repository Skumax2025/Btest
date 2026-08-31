/**
 * L4: the darkness pass.
 *
 * Three rules hold the whole thing together.
 *
 * Light stops in walls, never at them and never through them. Every light is
 * clipped to its own visibility fan, and a fan ray that meets a wall carries on
 * to the middle of that tile and stops. The near face is lit, the far face is
 * not, and the room behind never hears about it.
 *
 * The player casts one fan per frame, not three. Line of sight, the bubble of
 * vision inside it and the flashlight's floor spill are all read off the same
 * cast at different radii, so they cannot disagree about where a wall is — and
 * the ray budget that used to be split between them buys a much smoother edge.
 *
 * Lamp fans are cached, because the building does not move. What the building
 * does do is stream: a lamp beside a chunk that has not loaded yet reads the
 * unloaded side as solid, so the cache is keyed on the level's geometry and
 * dropped whenever that changes. Without it a lamp keeps a shadow of a wall that
 * was never there.
 */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { LightProfile, Renderer } from '@core/renderer';
import type { SolidSampler } from '@systems/collision';
import { createFan, fanPolygon, traceFan, visibilityPolygon } from '@systems/vision';
import type { Fan, FanOptions } from '@systems/vision';
import { lightFalloff } from '@game/lighting';
import type { LightSource, LightingConfig } from '@game/lighting';
import type { Palette } from '@content/palettes';
import type { LightViewConfig, ViewConfig } from '@content/view';

export interface DarknessParams {
  readonly view: CameraView;
  readonly palette: Palette;
  readonly lighting: LightingConfig;
  readonly isSolid: SolidSampler;
  readonly tileSize: number;
  readonly lights: readonly LightSource[];
  readonly playerX: number;
  readonly playerY: number;
  readonly playerFacing: number;
  readonly sightRadius: number;
  /** How far the player can see lit places down an open corridor. */
  readonly losRadius: number;
  readonly flashlightOn: boolean;
  /** Colour of the light in hand, when it has one of its own. */
  readonly beamTint: string | null;
  /** How lit the player is standing, straight from the simulation. Drives adaptation. */
  readonly lightLevel: number;
  /** Seconds of run time, interpolated. The only thing the sway is a function of. */
  readonly time: number;
  /**
   * Changes whenever the tile grid does — a chunk streamed in, or a new level.
   * Cached lamp shadows are only valid for the geometry they were traced against.
   */
  readonly geometryKey: string;
  readonly rays: {
    readonly lightRays: number;
    readonly playerRays: number;
    readonly flashlightRays: number;
  };
  readonly config: ViewConfig;
}

/** Smoothstep, the same curve the lighting model eases its falloff with. */
const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * A light's brightness sampled from its centre to its rim. Sampling the model's
 * own curve rather than hand-picking gradient stops is what keeps the pool the
 * player sees the same size as the pool the simulation counts as lit.
 */
const falloffProfile = (samples: number, lighting: LightingConfig, tighten = 1): number[] => {
  const last = Math.max(1, samples - 1);
  const profile: number[] = [];
  for (let i = 0; i <= last; i++) {
    const value = lightFalloff(1 - i / last, lighting);
    profile.push(tighten === 1 ? value : Math.pow(value, tighten));
  }
  return profile;
};

/**
 * Full brightness out to `core` of the radius, then a smooth fade to nothing.
 * Eyes and torch beams both behave like this; a bare bulb does not.
 */
const flatProfile = (samples: number, core: number, tighten = 1): number[] => {
  const last = Math.max(1, samples - 1);
  const shoulder = Math.max(1e-3, 1 - Math.min(Math.max(core, 0), 0.99));
  const profile: number[] = [];
  for (let i = 0; i <= last; i++) {
    const value = ease((1 - i / last) / shoulder);
    profile.push(tighten === 1 ? value : Math.pow(value, tighten));
  }
  return profile;
};

interface Profiles {
  readonly lamp: LightProfile;
  readonly lampGlow: LightProfile;
  readonly lampCore: LightProfile;
  readonly sight: LightProfile;
}

export class LightingView {
  private readonly cache = new Map<string, Float32Array>();
  private geometryKey = '';
  private profiles?: Profiles;
  private profileKey?: LightingConfig;
  private viewKey?: LightViewConfig;
  private readonly sightFan: Fan = createFan();
  /** How far the eye has come towards the dark it is standing in, in [0, 1]. */
  private adapted = 0;
  private scratchLos?: Float32Array;
  private scratchSight?: Float32Array;
  private scratchSpill?: Float32Array;

  constructor(private readonly cacheLimit: number) {}

  draw(renderer: Renderer, params: DarknessParams): void {
    const light = params.config.light;
    const profiles = this.profilesFor(params.lighting, light);
    this.invalidate(params.geometryKey);
    renderer.beginDarkness(params.palette.darkness, params.view);

    // One cast, at the furthest radius anything the player owns can reach.
    const fan = this.playerFan(params);
    traceFan(params.playerX, params.playerY, params.losRadius, params.isSolid, fan, this.sightFan);

    // Lamps are only seen where the player could actually be looking. A lit room
    // behind a wall stays dark; the same room down an open corridor does not.
    this.scratchLos = this.polygonAt(params, params.losRadius, this.scratchLos);
    renderer.beginVisibility(this.scratchLos);
    this.drawLamps(renderer, params, profiles);
    renderer.endVisibility();

    // The player's own sight is not a light source: it reveals, but adds no glow.
    this.scratchSight = this.polygonAt(params, params.sightRadius, this.scratchSight);
    renderer.punchPolygon(this.scratchSight, {
      x: params.playerX,
      y: params.playerY,
      radius: params.sightRadius,
      strength: light.playerLightStrength * this.adapt(params.lightLevel, light),
      profile: profiles.sight,
    });

    if (params.flashlightOn) this.drawFlashlight(renderer, params, profiles);
    renderer.endDarkness();
  }

  /**
   * Dark adaptation, as a multiplier on how much the eye is currently getting
   * out of the dark. Stepping out of a lit room is briefly worse than standing
   * in the dark already was — which is exactly the moment the game wants the
   * player to hesitate. It never touches the sight *radius*: that number is the
   * simulation's, and the view is not allowed to disagree with it.
   */
  private adapt(lightLevel: number, config: LightViewConfig): number {
    const needed = 1 - Math.max(0, Math.min(1, lightLevel));
    const rate = Math.max(0, Math.min(1, config.adaptationRate));
    this.adapted += (needed - this.adapted) * rate;
    return 1 - config.adaptation * Math.max(0, needed - this.adapted);
  }

  private drawLamps(renderer: Renderer, params: DarknessParams, profiles: Profiles): void {
    const bounds = viewBounds(params.view, params.tileSize * 2);
    const light = params.config.light;
    const glow = light.lampGlow;
    for (const source of params.lights) {
      if (
        source.x + source.radius < bounds.minX ||
        source.x - source.radius > bounds.maxX ||
        source.y + source.radius < bounds.minY ||
        source.y - source.radius > bounds.maxY
      ) {
        continue;
      }
      const polygon = this.cachedPolygon(source, params);
      const colour = source.tint ?? params.palette.lampGlow;
      renderer.punchPolygon(polygon, {
        x: source.x,
        y: source.y,
        radius: source.radius,
        strength: source.strength,
        profile: profiles.lamp,
        glow: { colour, strength: source.strength * glow, profile: profiles.lampGlow },
      });
      // The fitting itself. Without a second, much tighter pool the brightest
      // thing on screen is a patch of floor rather than the tube over it.
      renderer.punchPolygon(polygon, {
        x: source.x,
        y: source.y,
        radius: source.radius * light.lampCoreRadius,
        strength: source.strength * light.lampCore,
        profile: profiles.lampCore,
        glow: {
          colour,
          strength: source.strength * light.lampCore * glow,
          profile: profiles.lampCore,
        },
      });
    }
  }

  /**
   * The beam is a chain of soft pools down the aim line, all clipped to one
   * visibility cone cast from the player. The cone is what keeps the light out
   * of the next room; the pools are what give the beam an edge that fades,
   * because a pool's own falloff reaches zero before the cone does. The floor at
   * the player's feet gets a little of it back, which is what stops the torch
   * looking like it floats in front of them.
   */
  private drawFlashlight(renderer: Renderer, params: DarknessParams, profiles: Profiles): void {
    const light = params.config.light;
    const { lighting } = params;
    // A torch is held in a hand, and a hand is never quite still. One phase for
    // the beam and its clip, or the pools would drift out of the cone.
    const facing =
      params.playerFacing +
      Math.sin((params.time / Math.max(0.1, light.beamSwaySeconds)) * Math.PI * 2) * light.beamSway;
    const tint = params.beamTint ?? params.palette.lampGlow;
    const facingX = Math.cos(facing);
    const facingY = Math.sin(facing);
    const clip = this.beamCone(params, facing);
    const segments = Math.max(1, Math.round(light.beamSegments));
    // A pool this wide at this distance subtends exactly the beam's half-angle,
    // so the chain's envelope is the cone the config asked for.
    const spread = Math.sin(Math.min(lighting.flashlightHalfAngle, Math.PI / 2));
    // The clip is the one hard edge in the beam. Keeping every pool inside it
    // with room to spare is what stops that edge from ever being the thing the
    // player sees, which matters most at the torch itself, where the pools are
    // close enough to the origin to be wider than the cone that holds them.
    const inside =
      0.85 * Math.sin(Math.min(lighting.flashlightHalfAngle * light.beamClip, Math.PI / 2));

    for (let i = 0; i < segments; i++) {
      const along = (i + 0.5) / segments;
      const distance = along * lighting.flashlightRadius;
      const radius = Math.min(light.beamNear + spread * distance, inside * distance);
      const strength = lighting.flashlightStrength * (1 - ease(along) * light.beamFade);
      renderer.punchPolygon(clip, {
        x: params.playerX + facingX * distance,
        y: params.playerY + facingY * distance,
        radius,
        strength,
        profile: profiles.lamp,
      });
    }

    // Bloom is additive and low-frequency, so the chain's is paid once for the
    // whole beam rather than a share of it per pool: one pool the length of the
    // beam sums to what the chain summed to, at a twelfth of the fill. It is
    // clipped to the same cone, so it still stops at the same wall.
    if (light.flashlightGlow > 0) {
      const mid = lighting.flashlightRadius * 0.5;
      renderer.punchPolygon(clip, {
        x: params.playerX + facingX * mid,
        y: params.playerY + facingY * mid,
        radius: Math.max(light.beamNear, mid),
        strength: 0,
        profile: profiles.lamp,
        glow: {
          colour: tint,
          strength: lighting.flashlightStrength * light.flashlightGlow,
          profile: profiles.lampGlow,
        },
      });
    }

    const spill = Math.min(light.flashlightSpill, params.losRadius);
    this.scratchSpill = this.polygonAt(params, spill, this.scratchSpill);
    renderer.punchPolygon(this.scratchSpill, {
      x: params.playerX,
      y: params.playerY,
      radius: spill,
      strength: light.flashlightSpillStrength,
      profile: profiles.lamp,
      glow: {
        colour: tint,
        strength: light.flashlightSpillStrength * light.flashlightGlow,
        profile: profiles.lampGlow,
      },
    });
  }

  /** The player's fan, reshaped to a smaller radius. Exact, and free. */
  private polygonAt(params: DarknessParams, radius: number, out?: Float32Array): Float32Array {
    return fanPolygon(params.playerX, params.playerY, this.sightFan, radius, out);
  }

  /** What the beam is allowed to reach at all: one cast, shared by every pool. */
  private beamCone(params: DarknessParams, facing: number): Float32Array {
    const options: FanOptions = {
      rayCount: params.rays.flashlightRays,
      tileSize: params.tileSize,
      // Clamped below a half-turn: at or above it the fan wraps into a circle.
      halfAngle: Math.min(
        params.lighting.flashlightHalfAngle * params.config.light.beamClip,
        Math.PI * 0.49,
      ),
      facing,
      wallPenetration: params.config.light.wallPenetration,
    };
    const arc = visibilityPolygon(
      params.playerX,
      params.playerY,
      params.lighting.flashlightRadius,
      params.isSolid,
      options,
    );
    return withApex(arc, params.playerX, params.playerY);
  }

  private playerFan(params: DarknessParams): FanOptions {
    return {
      rayCount: params.rays.playerRays,
      tileSize: params.tileSize,
      halfAngle: Math.PI,
      facing: 0,
      wallPenetration: params.config.light.wallPenetration,
    };
  }

  /** Curves depend only on configuration, so they are built once and kept. */
  private profilesFor(lighting: LightingConfig, config: LightViewConfig): Profiles {
    if (this.profiles && this.profileKey === lighting && this.viewKey === config) return this.profiles;
    const samples = Math.max(2, config.profileSamples);
    this.profiles = {
      lamp: falloffProfile(samples, lighting),
      lampGlow: falloffProfile(samples, lighting, config.glowConcentration),
      lampCore: falloffProfile(samples, lighting, config.glowConcentration * 0.5),
      sight: flatProfile(samples, config.sightCore),
    };
    this.profileKey = lighting;
    this.viewKey = config;
    return this.profiles;
  }

  /** Shadows traced against geometry that has since changed are simply wrong. */
  private invalidate(geometryKey: string): void {
    if (geometryKey === this.geometryKey) return;
    this.geometryKey = geometryKey;
    this.cache.clear();
  }

  private cachedPolygon(light: LightSource, params: DarknessParams): Float32Array {
    const key = `${light.x}:${light.y}:${light.radius}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const polygon = visibilityPolygon(light.x, light.y, light.radius, params.isSolid, {
      rayCount: params.rays.lightRays,
      tileSize: params.tileSize,
      halfAngle: Math.PI,
      facing: 0,
      wallPenetration: params.config.light.wallPenetration,
    });
    // Drop the oldest rather than the lot: clearing meant one frame in which
    // every lamp on screen had to be traced again.
    while (this.cache.size >= this.cacheLimit) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
    this.cache.set(key, polygon);
    return polygon;
  }
}

/** A cone has to include its own apex or the clip region is a crescent. */
const withApex = (arc: Float32Array, x: number, y: number): Float32Array => {
  const points = new Float32Array(arc.length + 2);
  points[0] = x;
  points[1] = y;
  points.set(arc, 2);
  return points;
};
