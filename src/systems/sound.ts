/**
 * L1: noise propagation.
 *
 * Every loud thing in the game emits an event here; listeners ask how loud it
 * was where they stand. Walls attenuate, distance attenuates. Nothing in this
 * file knows who is listening — creatures and the player's own sanity both read
 * the same field.
 */

import type { SolidSampler } from './collision';
import { wallsBetween } from './raycast';

export interface NoiseEvent {
  readonly x: number;
  readonly y: number;
  /** Radius at which the noise fades to nothing, in world units. */
  readonly radius: number;
  readonly tick: number;
  /** Free-form tag so listeners can react differently to a lure and a footstep. */
  readonly source: string;
}

export interface SoundConfig {
  /** Effective radius lost per wall between source and listener, as a fraction. */
  readonly wallAttenuation: number;
  /** Ticks an event stays audible to a listener that has not reacted yet. */
  readonly memoryTicks: number;
}

/** Loudness in [0, 1] at a listening point; 0 means inaudible. */
export const loudnessAt = (
  event: NoiseEvent,
  listenerX: number,
  listenerY: number,
  tileSize: number,
  isSolid: SolidSampler,
  config: SoundConfig,
): number => {
  const distance = Math.hypot(event.x - listenerX, event.y - listenerY);
  if (distance >= event.radius) return 0;
  const walls = wallsBetween(event.x, event.y, listenerX, listenerY, tileSize, isSolid);
  const effective = event.radius * Math.max(0, 1 - walls * config.wallAttenuation);
  if (effective <= 0 || distance >= effective) return 0;
  return 1 - distance / effective;
};

/** A short-lived ring of noise events; the only shared state sound needs. */
export class NoiseField {
  private events: NoiseEvent[] = [];

  constructor(private readonly config: SoundConfig) {}

  emit(event: NoiseEvent): void {
    this.events.push(event);
  }

  /** Drops events older than the memory window. Called once per tick. */
  prune(tick: number): void {
    const cutoff = tick - this.config.memoryTicks;
    if (this.events.length > 0 && this.events[0].tick < cutoff) {
      this.events = this.events.filter((event) => event.tick >= cutoff);
    }
  }

  recent(): readonly NoiseEvent[] {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }

  /** Loudest event at a point, with the event that produced it. */
  loudest(
    x: number,
    y: number,
    tileSize: number,
    isSolid: SolidSampler,
    accept?: (event: NoiseEvent) => boolean,
  ): { event: NoiseEvent; loudness: number } | null {
    let best: { event: NoiseEvent; loudness: number } | null = null;
    for (const event of this.events) {
      if (accept && !accept(event)) continue;
      const loudness = loudnessAt(event, x, y, tileSize, isSolid, this.config);
      if (loudness > 0 && (best === null || loudness > best.loudness)) best = { event, loudness };
    }
    return best;
  }
}
