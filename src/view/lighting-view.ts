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
  /** Fractional tick, so the torch's own restlessness runs at frame rate. */
  readonly tick: number;
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
  readonly sight: LightProfile;
  readonly beam: LightProfile;
  readonly beamGlow: LightProfile;
}

export class LightingView {
  private readonly cache = new Map<string, Float32Array>();
  private geometryKey = '';
  private profiles?: Profiles;
  private profileKey?: LightingConfig;
  private viewKey?: LightViewConfig;
  private readonly sightFan: Fan = createFan();
  private scratchLos?: Float32Array;
  private scratchSight?: Float32Array;
  private scratchSpill?: Float32Array;

  constructor(private readonly cacheLimit: number) {}

  draw(renderer: Renderer, params: DarknessParams): void {
    const light = params.config.light;
    const profiles = this.profilesFor(params.lighting, light);
    this.invalidate(params.geometryKey);
    renderer.beginDarkness(params.palette.darkness, params.view, {
      softness: light.softness,
      bloom: light.bloom,
      bloomStrength: light.bloomStrength,
    });

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
      strength: light.playerLightStrength,
      profile: profiles.sight,
    });

    if (params.flashlightOn) this.drawFlashlight(renderer, params, profiles);
    renderer.endDarkness();
    renderer.vignette(light.vignetteColour, light.vignette, light.vignetteInner);
  }

  private drawLamps(renderer: Renderer, params: DarknessParams, profiles: Profiles): void {
    const bounds = viewBounds(params.view, params.tileSize * 2);
    const glow = params.config.light.lampGlow;
    for (const source of params.lights) {
      if (
        source.x + source.radius < bounds.minX ||
        source.x - source.radius > bounds.maxX ||
        source.y + source.radius < bounds.minY ||
        source.y - source.radius > bounds.maxY
      ) {
        continue;
      }
      renderer.punchPolygon(this.cachedPolygon(source, params), {
        x: source.x,
        y: source.y,
        radius: source.radius,
        strength: source.strength,
        profile: profiles.lamp,
        glow: {
          colour: params.palette.lampGlow,
          strength: source.strength * glow,
          profile: profiles.lampGlow,
        },
      });
    }
  }

  /**
   * One beam, not a chain of pools.
   *
   * The pools were an attempt at a soft edge and they cost one: every pool
   * subtracted its own darkness, so where two overlapped the floor went brighter
   * than either had asked for — a blown-out core down the aim line and a ring at
   * every seam. The shape now lives in a mask the backend builds once, falloff
   * along the beam and soft edge across it in the same texture, and the beam is
   * a single stamp of it. The visibility cone still clips it, which is what keeps
   * the light out of the next room, and the floor at the player's feet still gets
   * a little back so the torch reads as held rather than as floating in front.
   */
  private drawFlashlight(renderer: Renderer, params: DarknessParams, profiles: Profiles): void {
    const light = params.config.light;
    const { lighting } = params;
    const aim = this.torchAim(params);
    const strength = lighting.flashlightStrength * this.torchFlutter(params);
    const cone = {
      facing: aim,
      halfAngle: lighting.flashlightHalfAngle,
      core: light.beamCore,
      bulb: light.beamBulb,
    };

    renderer.punchPolygon(this.beamCone(params, aim), {
      x: params.playerX,
      y: params.playerY,
      radius: lighting.flashlightRadius,
      strength,
      profile: profiles.beam,
      cone,
      glow: {
        colour: params.palette.lampGlow,
        strength: strength * light.flashlightGlow,
        profile: profiles.beamGlow,
      },
    });

    const spill = Math.min(light.flashlightSpill, params.losRadius);
    this.scratchSpill = this.polygonAt(params, spill, this.scratchSpill);
    renderer.punchPolygon(this.scratchSpill, {
      x: params.playerX,
      y: params.playerY,
      radius: spill,
      strength: light.flashlightSpillStrength * strength,
      profile: profiles.lamp,
      glow: {
        colour: params.palette.lampGlow,
        strength: light.flashlightSpillStrength * light.flashlightGlow,
        profile: profiles.lampGlow,
      },
    });
  }

  /**
   * Where the torch is actually pointing. Two cycles that do not divide into one
   * another, so the wander never repeats on a beat the eye can pick out — a hand
   * holding a torch is never quite still, and a beam that is says "cursor".
   */
  private torchAim(params: DarknessParams): number {
    const { torchSway, torchSwayPeriod } = params.config.light;
    if (torchSway <= 0) return params.playerFacing;
    const phase = (params.tick / Math.max(1, torchSwayPeriod)) * Math.PI * 2;
    return params.playerFacing + torchSway * (Math.sin(phase) * 0.6 + Math.sin(phase * 2.7 + 1.3) * 0.4);
  }

  /** The same restlessness in brightness. Never dips far enough to read as a fault. */
  private torchFlutter(params: DarknessParams): number {
    const { torchFlutter, torchSwayPeriod } = params.config.light;
    if (torchFlutter <= 0) return 1;
    const phase = (params.tick / Math.max(1, torchSwayPeriod)) * Math.PI * 2;
    return 1 - torchFlutter * 0.5 * (1 - Math.cos(phase * 1.7 + 0.7));
  }

  /** The player's fan, reshaped to a smaller radius. Exact, and free. */
  private polygonAt(params: DarknessParams, radius: number, out?: Float32Array): Float32Array {
    return fanPolygon(params.playerX, params.playerY, this.sightFan, radius, out);
  }

  /** What the beam is allowed to reach at all — the shadows in it, and nothing else. */
  private beamCone(params: DarknessParams, aim: number): Float32Array {
    const options: FanOptions = {
      rayCount: params.rays.flashlightRays,
      tileSize: params.tileSize,
      // Clamped below a half-turn: at or above it the fan wraps into a circle.
      halfAngle: Math.min(
        params.lighting.flashlightHalfAngle * params.config.light.beamClip,
        Math.PI * 0.49,
      ),
      facing: aim,
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
      sight: flatProfile(samples, config.sightCore),
      // A torch does not fall off like a bare bulb: it holds its brightness down
      // the beam and then runs out, which is what `flatProfile` describes.
      beam: flatProfile(samples, config.beamReach),
      beamGlow: flatProfile(samples, config.beamReach, config.glowConcentration),
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
