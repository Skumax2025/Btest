/**
 * L3: the sound of the place.
 *
 * Everything is synthesised from these numbers — there are no audio files. The
 * hum is the constant; every other cue is something that happened, which is why
 * silence is information here rather than an absence.
 */

import type { AudioCue } from '@core/audio';

const cue = (value: AudioCue): AudioCue => value;

export const AUDIO_CUES: Readonly<Record<string, AudioCue>> = {
  step: cue({
    wave: 'noise',
    frequency: 200,
    endFrequency: 200,
    duration: 0.09,
    gain: 0.18,
    attack: 0.004,
    cutoff: 640,
  }),
  sprint: cue({
    wave: 'noise',
    frequency: 260,
    endFrequency: 260,
    duration: 0.12,
    gain: 0.32,
    attack: 0.003,
    cutoff: 1100,
  }),
  search: cue({
    wave: 'noise',
    frequency: 400,
    endFrequency: 400,
    duration: 0.34,
    gain: 0.24,
    attack: 0.02,
    cutoff: 2400,
  }),
  melee: cue({
    wave: 'triangle',
    frequency: 210,
    endFrequency: 70,
    duration: 0.2,
    gain: 0.3,
    attack: 0.002,
    cutoff: 1800,
  }),
  impact: cue({
    wave: 'square',
    frequency: 320,
    endFrequency: 110,
    duration: 0.24,
    gain: 0.26,
    attack: 0.002,
    cutoff: 2600,
  }),
  creature: cue({
    wave: 'sawtooth',
    frequency: 96,
    endFrequency: 74,
    duration: 0.5,
    gain: 0.22,
    attack: 0.08,
    cutoff: 520,
  }),
  hurt: cue({
    wave: 'sawtooth',
    frequency: 180,
    endFrequency: 62,
    duration: 0.42,
    gain: 0.4,
    attack: 0.004,
    cutoff: 900,
  }),
  pickup: cue({
    wave: 'sine',
    frequency: 520,
    endFrequency: 760,
    duration: 0.14,
    gain: 0.2,
    attack: 0.004,
    cutoff: 0,
  }),
  descend: cue({
    wave: 'sine',
    frequency: 150,
    endFrequency: 48,
    duration: 1.5,
    gain: 0.34,
    attack: 0.25,
    cutoff: 700,
  }),
  death: cue({
    wave: 'sine',
    frequency: 120,
    endFrequency: 34,
    duration: 2.4,
    gain: 0.38,
    attack: 0.1,
    cutoff: 500,
  }),
  whisper: cue({
    wave: 'noise',
    frequency: 300,
    endFrequency: 300,
    duration: 0.9,
    gain: 0.14,
    attack: 0.3,
    cutoff: 1500,
  }),
};

export const AUDIO = {
  masterGain: 0.5,
  /** Hum frequency, and how far a lamp is heard from. */
  droneFrequency: 60,
  droneRadius: 260,
  droneGain: 0.05,
  /** The hum sours as nerve runs out. */
  droneDetuneAtBreaking: 42,
  /** World distance at which a cue is inaudible. */
  cueRange: 900,
  /** Ticks between whispers when nerve is low. */
  whisperInterval: 150,
} as const;

/** Noise-event source -> cue id. Sources with no entry are silent. */
export const NOISE_CUES: Readonly<Record<string, string>> = {
  step: 'step',
  search: 'search',
  melee: 'melee',
  impact: 'impact',
  creature: 'creature',
};
