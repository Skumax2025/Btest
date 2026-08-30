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

/**
 * A short-lived record of what has been heard recently.
 *
 * Events are bucketed by source because the common query is "everything the
 * player did, ignoring the noise we creatures make ourselves" — and in a room
 * full of creatures their own noise dwarfs everything else. Bucketing keeps that
 * query proportional to what the listener actually cares about.
 */
export class NoiseField {
  private readonly bySource = new Map<string, NoiseEvent[]>();
  private all: NoiseEvent[] = [];

  constructor(private readonly config: SoundConfig) {}

  emit(event: NoiseEvent): void {
    this.all.push(event);
    const bucket = this.bySource.get(event.source);
    if (bucket) bucket.push(event);
    else this.bySource.set(event.source, [event]);
  }

  /** Drops events older than the memory window. Called once per tick. */
  prune(tick: number): void {
    const cutoff = tick - this.config.memoryTicks;
    if (this.all.length === 0 || this.all[0].tick >= cutoff) return;
    this.all = this.all.filter((event) => event.tick >= cutoff);
    for (const [source, bucket] of this.bySource) {
      if (bucket.length > 0 && bucket[0].tick < cutoff) {
        this.bySource.set(
          source,
          bucket.filter((event) => event.tick >= cutoff),
        );
      }
    }
  }

  recent(): readonly NoiseEvent[] {
    return this.all;
  }

  clear(): void {
    this.all = [];
    this.bySource.clear();
  }

  /** Loudest event at a point, optionally ignoring one source of noise. */
  loudest(
    x: number,
    y: number,
    tileSize: number,
    isSolid: SolidSampler,
    excludeSource?: string,
  ): { event: NoiseEvent; loudness: number } | null {
    let best: { event: NoiseEvent; loudness: number } | null = null;
    for (const [source, bucket] of this.bySource) {
      if (source === excludeSource) continue;
      for (const event of bucket) {
        const loudness = loudnessAt(event, x, y, tileSize, isSolid, this.config);
        if (loudness > 0 && (best === null || loudness > best.loudness)) best = { event, loudness };
      }
    }
    return best;
  }
}
