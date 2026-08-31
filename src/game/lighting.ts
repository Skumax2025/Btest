/**
 * L2 module: light and electricity.
 *
 * Knows: how brightly each lamp is burning this tick, how lit a point in the
 * world is, and how far the player can see. Lamp flicker is a pure function of
 * the lamp's seed and the current tick, so two identical runs flicker
 * identically.
 *
 * Does not know: how any of it is drawn. The view asks for light sources and
 * paints them; the run asks for a light level and drains sanity with it. The one
 * thing both sides share is `lightFalloff` — the view builds its gradient out of
 * the same curve the simulation reads, so what the player sees is what the game
 * counts as light rather than an artist's impression of it.
 */

import { clamp } from '@core/math';
import { streamFor } from '@core/rng';
import { LAMP_DEAD, LAMP_LIT } from '@game/level';
import type { PropSpawn } from '@game/level';

export interface LightingConfig {
  readonly lampRadius: number;
  readonly lampStrength: number;
  /** Falloff curve: 1 is a plain soft shoulder, higher keeps the centre brighter. */
  readonly falloffExponent: number;
  /** Ticks between flicker decisions for an unstable lamp. */
  readonly flickerPeriod: number;
  readonly flickerOnChance: number;
  /** Brightness an unstable lamp drops to rather than going fully black. */
  readonly flickerLow: number;
  /** Depth of the slow breath a healthy lamp has, 0 for a dead-steady one. */
  readonly steadyPulse: number;
  /** Ticks per breath of that pulse. */
  readonly steadyPulsePeriod: number;
  /** Brightness at or above which a lamp counts as burning, for sound and sprite. */
  readonly litThreshold: number;
  readonly visionRadius: number;
  /** Vision radius with no light at all — the darkness penalty. */
  readonly darkVisionRadius: number;
  readonly flashlightRadius: number;
  readonly flashlightHalfAngle: number;
  readonly flashlightStrength: number;
  /** Below this light level the player counts as standing in the dark. */
  readonly darkThreshold: number;
  /** Light level a burning flashlight guarantees, whatever the lamps are doing. */
  readonly flashlightLightLevel: number;
}

export interface LightSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
}

/** Smoothstep — flat at both ends, which is what stops a light having an edge. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * Brightness of a light at `normalized` = 1 at its centre falling to 0 at its
 * rim. Flat in the middle and flat at the edge, so a lamp reads as a pool rather
 * than as a cone with a visible boundary.
 */
export const lightFalloff = (normalized: number, config: LightingConfig): number =>
  Math.pow(ease(clamp(normalized, 0, 1)), Math.max(0.25, config.falloffExponent));

/** Where an unstable lamp is heading at flicker decision `phase`. */
const flickerTarget = (seed: number, phase: number, config: LightingConfig): number =>
  streamFor(seed, phase).next() < config.flickerOnChance ? 1 : clamp(config.flickerLow, 0, 1);

/** The faint breath of a lamp on a tired mains supply. Never reaches zero. */
const steadyPulse = (seed: number, tick: number, config: LightingConfig): number => {
  if (config.steadyPulse <= 0) return 1;
  const period = Math.max(1, config.steadyPulsePeriod);
  // The seed only sets the phase, so no two lamps in a corridor breathe together.
  const phase = ((seed % 1000) / 1000) * Math.PI * 2;
  return 1 - config.steadyPulse * 0.5 * (1 - Math.cos((tick / period) * Math.PI * 2 + phase));
};

/**
 * How brightly a lamp is burning, in [0, 1].
 *
 * An unstable lamp is interpolated between its flicker decisions instead of
 * being switched on and off: the strobe it used to be was both ugly and, at
 * eight decisions a second, genuinely unpleasant to look at.
 */
export const lampIntensity = (prop: PropSpawn, tick: number, config: LightingConfig): number => {
  if (prop.variant === LAMP_DEAD) return 0;
  const breath = steadyPulse(prop.seed, tick, config);
  if (prop.variant === LAMP_LIT) return clamp(breath, 0, 1);
  const period = Math.max(1, config.flickerPeriod);
  const phase = Math.floor(tick / period);
  const blend = ease(clamp((tick - phase * period) / period, 0, 1));
  const from = flickerTarget(prop.seed, phase, config);
  const to = flickerTarget(prop.seed, phase + 1, config);
  return clamp((from + (to - from) * blend) * breath, 0, 1);
};

/** Whether a lamp reads as burning — for its sprite, its hum and the map. */
export const lampIsLit = (prop: PropSpawn, tick: number, config: LightingConfig): boolean =>
  lampIntensity(prop, tick, config) >= config.litThreshold;

/** Lamps currently burning near a point, as light sources. */
export const collectLights = (
  props: readonly PropSpawn[],
  tick: number,
  config: LightingConfig,
): LightSource[] => {
  const lights: LightSource[] = [];
  const threshold = Math.max(1e-3, config.litThreshold);
  for (const prop of props) {
    if (prop.kind !== 'lamp') continue;
    const intensity = lampIntensity(prop, tick, config);
    // Dropping a lamp the moment it fell under the threshold took a pool of a
    // sixth of full brightness out of the room between one tick and the next, so
    // a browning-out tube blinked rather than dimmed. Below the threshold the
    // lamp fades out instead, and is only dropped once there is nothing left to
    // draw — a lamp too faint to see is still a polygon to clip and fill.
    const brightness = intensity * Math.min(1, intensity / threshold);
    if (brightness < 0.01) continue;
    lights.push({
      x: prop.x,
      y: prop.y,
      radius: config.lampRadius,
      strength: clamp(config.lampStrength * brightness, 0, 1),
    });
  }
  return lights;
};

/** Brightest contribution at a point, in [0, 1]; occlusion is deliberately ignored. */
export const lightLevelAt = (
  x: number,
  y: number,
  lights: readonly LightSource[],
  ambient: number,
  config: LightingConfig,
): number => {
  let best = ambient;
  for (const light of lights) {
    const distance = Math.hypot(light.x - x, light.y - y);
    if (distance >= light.radius) continue;
    const value = light.strength * lightFalloff(1 - distance / light.radius, config);
    // Multiple lamps blend additively with diminishing returns instead of
    // allowing order-dependent or overbright gameplay values.
    best = 1 - (1 - best) * (1 - value);
  }
  return clamp(best, 0, 1);
};

/** How far the player can make anything out, given the light they are standing in. */
export const visionRadius = (lightLevel: number, config: LightingConfig): number =>
  config.darkVisionRadius +
  (config.visionRadius - config.darkVisionRadius) * clamp(lightLevel, 0, 1);
