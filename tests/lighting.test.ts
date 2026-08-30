import { describe, expect, it } from 'vitest';
import {
  lampIntensity,
  lampIsLit,
  lightFalloff,
  lightLevelAt,
  visionRadius,
  type LightSource,
  type LightingConfig,
} from '@game/lighting';
import type { PropSpawn } from '@game/level';
import { LAMP_DEAD, LAMP_FLICKER, LAMP_LIT } from '@game/level';

const config: LightingConfig = {
  lampRadius: 100,
  lampStrength: 0.9,
  falloffExponent: 1.55,
  flickerPeriod: 7,
  flickerOnChance: 0.62,
  flickerLow: 0.08,
  steadyPulse: 0.07,
  steadyPulsePeriod: 97,
  litThreshold: 0.16,
  visionRadius: 220,
  darkVisionRadius: 94,
  flashlightRadius: 430,
  flashlightHalfAngle: 0.42,
  flashlightStrength: 1,
  darkThreshold: 0.22,
  flashlightLightLevel: 0.34,
};

const lamp = (seed: number, variant = LAMP_FLICKER): PropSpawn => ({
  key: `lamp-${seed}`,
  kind: 'lamp',
  defId: 'prop.lamp',
  tx: 0,
  ty: 0,
  variant,
  seed,
  x: 0,
  y: 0,
});

describe('lamp flicker', () => {
  it('is a pure function of the seed and the tick', () => {
    for (const tick of [0, 3, 10, 16, 97, 1234]) {
      expect(lampIntensity(lamp(42), tick, config)).toBe(lampIntensity(lamp(42), tick, config));
    }
    // A different lamp is a different sequence, or the corridor pulses in unison.
    const ticks = [0, 5, 11, 23, 40, 61];
    const a = ticks.map((t) => lampIntensity(lamp(42), t, config));
    const b = ticks.map((t) => lampIntensity(lamp(43), t, config));
    expect(a).not.toEqual(b);
  });

  it('holds one flicker decision for a whole period', () => {
    const period = config.flickerPeriod;
    // Both ends of a period sit at its decisions, whatever happens in between.
    for (const phase of [0, 1, 2, 5]) {
      const atStart = lampIntensity(lamp(7), phase * period, config);
      const atNextStart = lampIntensity(lamp(7), (phase + 1) * period, config);
      const inside = lampIntensity(lamp(7), phase * period + 3, config);
      expect(inside).toBeGreaterThanOrEqual(Math.min(atStart, atNextStart) - 1e-9);
      expect(inside).toBeLessThanOrEqual(Math.max(atStart, atNextStart) + 1e-9);
    }
  });

  it('browns out instead of strobing', () => {
    // The old lamp jumped between full and black in a single tick, eight times a
    // second. Nothing may move more than a fraction of the range per tick now.
    let worst = 0;
    let previous = lampIntensity(lamp(42), 0, config);
    for (let tick = 1; tick < 400; tick++) {
      const value = lampIntensity(lamp(42), tick, config);
      worst = Math.max(worst, Math.abs(value - previous));
      previous = value;
    }
    expect(worst).toBeLessThan(0.35);
    expect(worst).toBeGreaterThan(0);
  });

  it('never lets a live lamp reach black, and never lights a dead one', () => {
    for (let tick = 0; tick < 200; tick++) {
      expect(lampIntensity(lamp(9), tick, config)).toBeGreaterThan(0);
      expect(lampIntensity(lamp(9, LAMP_DEAD), tick, config)).toBe(0);
      expect(lampIsLit(lamp(9, LAMP_DEAD), tick, config)).toBe(false);
      expect(lampIsLit(lamp(9, LAMP_LIT), tick, config)).toBe(true);
    }
  });
});

describe('lighting', () => {
  it('uses a soft monotonic falloff', () => {
    const light: LightSource = { x: 0, y: 0, radius: 100, strength: 1 };
    expect(lightLevelAt(0, 0, [light], 0, config)).toBe(1);
    expect(lightLevelAt(25, 0, [light], 0, config)).toBeGreaterThan(
      lightLevelAt(75, 0, [light], 0, config),
    );
    expect(lightLevelAt(100, 0, [light], 0, config)).toBe(0);
  });

  it('draws the level from the same curve it simulates', () => {
    const light: LightSource = { x: 0, y: 0, radius: 100, strength: 1 };
    for (const distance of [0, 10, 40, 70, 99]) {
      expect(lightLevelAt(distance, 0, [light], 0, config)).toBeCloseTo(
        lightFalloff(1 - distance / 100, config),
        10,
      );
    }
    // Flat at both ends, so a lamp has no visible edge and no hot spot.
    expect(lightFalloff(1, config)).toBe(1);
    expect(lightFalloff(0, config)).toBe(0);
    expect(lightFalloff(0.5, config) - lightFalloff(0.4, config)).toBeGreaterThan(
      lightFalloff(1, config) - lightFalloff(0.9, config),
    );
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
