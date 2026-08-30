import { describe, expect, it } from 'vitest';
import { lampIsLit, lightLevelAt, visionRadius, type LightSource, type LightingConfig } from '@game/lighting';
import type { PropSpawn } from '@game/level';
import { LAMP_FLICKER } from '@game/level';

const config: LightingConfig = {
  lampRadius: 100,
  lampStrength: 0.9,
  falloffExponent: 1.55,
  flickerPeriod: 7,
  flickerOnChance: 0.62,
  visionRadius: 220,
  darkVisionRadius: 94,
  flashlightRadius: 430,
  flashlightHalfAngle: 0.42,
  flashlightStrength: 1,
  darkThreshold: 0.22,
  flashlightLightLevel: 0.34,
};

const lamp = (seed: number): PropSpawn => ({
  key: `lamp-${seed}`,
  kind: 'lamp',
  defId: 'prop.lamp',
  tx: 0,
  ty: 0,
  variant: LAMP_FLICKER,
  seed,
  x: 0,
  y: 0,
});

describe('lighting', () => {
  it('keeps flicker deterministic and stable within a decision period', () => {
    expect(lampIsLit(lamp(42), 10, config)).toBe(lampIsLit(lamp(42), 16, config));
    expect(lampIsLit(lamp(42), 10, config)).toBe(lampIsLit(lamp(42), 16, config));
  });

  it('uses a soft monotonic falloff', () => {
    const light: LightSource = { x: 0, y: 0, radius: 100, strength: 1 };
    expect(lightLevelAt(0, 0, [light], 0, config)).toBe(1);
    expect(lightLevelAt(25, 0, [light], 0, config)).toBeGreaterThan(lightLevelAt(75, 0, [light], 0, config));
    expect(lightLevelAt(100, 0, [light], 0, config)).toBe(0);
  });

  it('blends multiple lamps with diminishing returns and preserves ambient', () => {
    const lights: LightSource[] = [
      { x: -20, y: 0, radius: 100, strength: 0.7 },
      { x: 20, y: 0, radius: 100, strength: 0.7 },
    ];
    const level = lightLevelAt(0, 0, lights, 0.15, config);
    expect(level).toBeGreaterThan(0.7);
    expect(level).toBeLessThanOrEqual(1);
    expect(lightLevelAt(500, 0, [], 0.4, config)).toBe(0.4);
  });

  it('maps light level into the configured vision range', () => {
    expect(visionRadius(0, config)).toBe(config.darkVisionRadius);
    expect(visionRadius(1, config)).toBe(config.visionRadius);
  });
});
