/**
 * L2: what the player can currently sense.
 *
 * Pure inputs in, plain numbers out, so the stats module can be driven from a
 * test without a level. Takes explicit parameters rather than the run itself,
 * which is what keeps the module graph acyclic.
 */

import type { PropSpawn } from '@game/level';
import { collectLights, lightLevelAt, visionRadius } from '@game/lighting';
import type { LightSource, LightingConfig } from '@game/lighting';
import { sanityPressure } from '@game/ai';
import type { CreatureCatalog, CreatureState } from '@game/ai';

export interface PerceptionParams {
  readonly props: readonly PropSpawn[];
  readonly creatures: readonly CreatureState[];
  readonly creatureDefs: CreatureCatalog;
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly ambient: number;
  readonly lighting: LightingConfig;
  readonly flashlightOn: boolean;
  readonly ticksSinceNoise: number;
  readonly silenceTicks: number;
}

export interface Perception {
  readonly lights: LightSource[];
  readonly lightLevel: number;
  readonly inDark: boolean;
  readonly inSilence: boolean;
  readonly creaturePressure: number;
  readonly sightRadius: number;
}

export const perceive = (params: PerceptionParams): Perception => {
  const lights = collectLights(params.props, params.tick, params.lighting);
  const lampLight = lightLevelAt(params.x, params.y, lights, params.ambient);
  const lightLevel = params.flashlightOn ? Math.max(lampLight, params.lighting.darkThreshold + 0.1) : lampLight;

  let pressure = 0;
  for (const creature of params.creatures) {
    const def = params.creatureDefs[creature.defId];
    if (!def) continue;
    const distance = Math.hypot(creature.x - params.x, creature.y - params.y);
    const value = sanityPressure(distance, def);
    if (value > pressure) pressure = value;
  }

  return {
    lights,
    lightLevel,
    inDark: lightLevel < params.lighting.darkThreshold,
    inSilence: params.ticksSinceNoise > params.silenceTicks,
    creaturePressure: pressure,
    sightRadius: visionRadius(lightLevel, params.lighting),
  };
};
