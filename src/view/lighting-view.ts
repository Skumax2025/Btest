/**
 * L4: the darkness pass.
 *
 * Every light is clipped to a visibility polygon, so a lamp in the next room
 * does not shine through the wall. Lamp polygons never change once computed —
 * the building does not move — so they are cached; the player's own sight and
 * the flashlight cone are recomputed every frame.
 */

import type { CameraView } from '@core/camera';
import { viewBounds } from '@core/camera';
import type { Renderer } from '@core/renderer';
import type { SolidSampler } from '@systems/collision';
import { visibilityPolygon } from '@systems/vision';
import type { LightSource, LightingConfig } from '@game/lighting';
import type { Palette } from '@content/palettes';
import type { ViewConfig } from '@content/view';

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
  readonly rays: {
    readonly lightRays: number;
    readonly playerRays: number;
    readonly flashlightRays: number;
  };
  readonly config: ViewConfig;
}

export class LightingView {
  private readonly cache = new Map<string, Float32Array>();
  private scratchPlayer?: Float32Array;
  private scratchCone?: Float32Array;
  private scratchLos?: Float32Array;

  constructor(private readonly cacheLimit: number) {}

  draw(renderer: Renderer, params: DarknessParams): void {
    const bounds = viewBounds(params.view, params.tileSize * 2);
    renderer.beginDarkness(params.palette.darkness, params.view);

    // Lamps are only seen where the player could actually be looking. A lit room
    // behind a wall stays dark; the same room down an open corridor does not.
    this.scratchLos = visibilityPolygon(
      params.playerX,
      params.playerY,
      params.losRadius,
      params.isSolid,
      {
        rayCount: params.rays.playerRays,
        tileSize: params.tileSize,
        halfAngle: Math.PI,
        facing: 0,
        overshoot: params.tileSize * params.config.overshootTiles,
      },
      this.scratchLos,
    );
    renderer.beginVisibility(this.scratchLos);

    for (const light of params.lights) {
      if (
        light.x + light.radius < bounds.minX ||
        light.x - light.radius > bounds.maxX ||
        light.y + light.radius < bounds.minY ||
        light.y - light.radius > bounds.maxY
      ) {
        continue;
      }
      const polygon = this.cachedPolygon(light, params);
      renderer.punchPolygon(polygon, light.x, light.y, light.radius, light.strength);
    }
    renderer.endVisibility();

    this.scratchPlayer = visibilityPolygon(
      params.playerX,
      params.playerY,
      params.sightRadius,
      params.isSolid,
      {
        rayCount: params.rays.playerRays,
        tileSize: params.tileSize,
        halfAngle: Math.PI,
        facing: 0,
        overshoot: params.tileSize * params.config.overshootTiles,
      },
      this.scratchPlayer,
    );
    renderer.punchPolygon(
      this.scratchPlayer,
      params.playerX,
      params.playerY,
      params.sightRadius,
      params.config.playerLightStrength,
    );

    if (params.flashlightOn) {
      this.scratchCone = visibilityPolygon(
        params.playerX,
        params.playerY,
        params.lighting.flashlightRadius,
        params.isSolid,
        {
          rayCount: params.rays.flashlightRays,
          tileSize: params.tileSize,
          halfAngle: params.lighting.flashlightHalfAngle,
          facing: params.playerFacing,
          overshoot: params.tileSize * params.config.overshootTiles,
        },
        this.scratchCone,
      );
      renderer.punchPolygon(
        withApex(this.scratchCone, params.playerX, params.playerY),
        params.playerX,
        params.playerY,
        params.lighting.flashlightRadius,
        params.lighting.flashlightStrength,
      );
    }

    renderer.endDarkness();
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
      overshoot: params.tileSize * params.config.overshootTiles,
    });
    if (this.cache.size >= this.cacheLimit) this.cache.clear();
    this.cache.set(key, polygon);
    return polygon;
  }
}

/** A cone has to include its own apex or the clip region is a crescent. */
const withApex = (arc: Float32Array, x: number, y: number): Float32Array => {
  const out = new Float32Array(arc.length + 2);
  out[0] = x;
  out[1] = y;
  out.set(arc, 2);
  return out;
};
