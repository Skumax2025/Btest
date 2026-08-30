/**
 * L2 module: light and electricity.
 *
 * Knows: which lamps are burning this tick, how bright a point in the world is,
 * and how far the player can see. Lamp flicker is a pure function of the lamp's
 * seed and the current tick, so two identical runs flicker identically.
 *
 * Does not know: how any of it is drawn. The view asks for light sources and
 * paints them; the run asks for a light level and drains sanity with it.
 */

import { clamp } from '@core/math';
import { streamFor } from '@core/rng';
import { LAMP_DEAD, LAMP_LIT } from '@game/level';
import type { PropSpawn } from '@game/level';

export interface LightingConfig {
  readonly lampRadius: number;
  readonly lampStrength: number;
  /** Ticks between flicker decisions for an unstable lamp. */
  readonly flickerPeriod: number;
  readonly flickerOnChance: number;
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

export const lampIsLit = (prop: PropSpawn, tick: number, config: LightingConfig): boolean => {
  if (prop.variant === LAMP_DEAD) return false;
  if (prop.variant === LAMP_LIT) return true;
  const phase = Math.floor(tick / Math.max(1, config.flickerPeriod));
  return streamFor(prop.seed, phase).next() < config.flickerOnChance;
};

/** Lamps currently burning near a point, as light sources. */
export const collectLights = (
  props: readonly PropSpawn[],
  tick: number,
  config: LightingConfig,
): LightSource[] => {
  const lights: LightSource[] = [];
  for (const prop of props) {
    if (prop.kind !== 'lamp' || !lampIsLit(prop, tick, config)) continue;
    lights.push({ x: prop.x, y: prop.y, radius: config.lampRadius, strength: config.lampStrength });
  }
  return lights;
};

/** Brightest contribution at a point, in [0, 1]; occlusion is deliberately ignored. */
export const lightLevelAt = (
  x: number,
  y: number,
  lights: readonly LightSource[],
  ambient: number,
): number => {
  let best = ambient;
  for (const light of lights) {
    const distance = Math.hypot(light.x - x, light.y - y);
    if (distance >= light.radius) continue;
    const value = light.strength * (1 - distance / light.radius);
    if (value > best) best = value;
  }
  return clamp(best, 0, 1);
};

/** How far the player can make anything out, given the light they are standing in. */
export const visionRadius = (lightLevel: number, config: LightingConfig): number =>
  config.darkVisionRadius +
  (config.visionRadius - config.darkVisionRadius) * clamp(lightLevel, 0, 1);
