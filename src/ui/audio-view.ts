/**
 * L4: turns what the simulation did into what the player hears.
 *
 * Read-only: it observes the run's noise field and stats and never writes to
 * them, so nothing about audio can change the outcome of a run.
 */

import type { AudioOutput } from '@core/audio';
import { hashInts } from '@core/rng';
import { lampIsLit } from '@game/lighting';
import type { LightingConfig } from '@game/lighting';
import type { Run } from '@game/run';
import { AUDIO, AUDIO_CUES, NOISE_CUES } from '@content/audio';

export class AudioView {
  private lastTick = 0;
  private lastHealth = Number.POSITIVE_INFINITY;
  private lastWhisper = 0;

  constructor(
    private readonly output: AudioOutput,
    private readonly lighting: LightingConfig,
  ) {}

  update(run: Run, derangement: number): void {
    this.playNoises(run);
    this.playHurt(run);
    this.playWhispers(run, derangement);
    this.updateDrone(run, derangement);
    this.lastTick = run.tick;
  }

  reset(): void {
    this.lastTick = 0;
    this.lastHealth = Number.POSITIVE_INFINITY;
    this.lastWhisper = 0;
  }

  private playNoises(run: Run): void {
    for (const event of run.noise.recent()) {
      if (event.tick <= this.lastTick) continue;
      const cueId = NOISE_CUES[event.source];
      if (!cueId) continue;
      const cue = AUDIO_CUES[cueId];
      if (!cue) continue;
      const dx = event.x - run.player.x;
      const distance = Math.hypot(dx, event.y - run.player.y);
      const volume = Math.max(0, 1 - distance / AUDIO.cueRange) ** 2;
      if (volume <= 0.01) continue;
      this.output.play(cue, Math.max(-1, Math.min(1, dx / AUDIO.cueRange)), volume);
    }
  }

  private playHurt(run: Run): void {
    if (run.stats.health < this.lastHealth - 0.5) {
      this.output.play(AUDIO_CUES.hurt, 0, 1);
    }
    if (run.phase === 'dead' && this.lastHealth > 0) {
      this.output.play(AUDIO_CUES.death, 0, 1);
    }
    this.lastHealth = run.stats.health;
  }

  private playWhispers(run: Run, derangement: number): void {
    if (derangement <= 0.2) return;
    if (run.tick - this.lastWhisper < AUDIO.whisperInterval) return;
    this.lastWhisper = run.tick;
    const noise = hashInts(run.tick, 4177);
    this.output.play(AUDIO_CUES.whisper, ((noise % 200) / 100 - 1) * 0.8, derangement);
  }

  /** The hum only exists where a lamp is actually burning. */
  private updateDrone(run: Run, derangement: number): void {
    let nearest = Number.POSITIVE_INFINITY;
    for (const prop of run.propsNear(run.player.x, run.player.y, AUDIO.droneRadius)) {
      if (prop.kind !== 'lamp' || !lampIsLit(prop, run.tick, this.lighting)) continue;
      nearest = Math.min(nearest, Math.hypot(prop.x - run.player.x, prop.y - run.player.y));
    }
    const closeness = nearest === Number.POSITIVE_INFINITY ? 0 : 1 - nearest / AUDIO.droneRadius;
    this.output.setDrone(
      AUDIO.droneFrequency,
      Math.max(0, closeness) * AUDIO.droneGain,
      derangement * AUDIO.droneDetuneAtBreaking,
    );
  }
}
