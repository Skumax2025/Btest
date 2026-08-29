/**
 * L0: sound output.
 *
 * Everything is synthesised — there are no audio files to ship. The interface
 * exists so the rest of the game can stay ignorant of Web Audio, and so tests
 * and headless runs can use the silent implementation.
 */

export type CueWave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface AudioCue {
  readonly wave: CueWave;
  readonly frequency: number;
  /** Frequency at the end of the cue; equal to `frequency` means no sweep. */
  readonly endFrequency: number;
  readonly duration: number;
  readonly gain: number;
  readonly attack: number;
  /** Low-pass cutoff in Hz; 0 disables the filter. */
  readonly cutoff: number;
}

export interface AudioOutput {
  /** Browsers refuse to start audio before a gesture; call this on one. */
  resume(): void;
  play(cue: AudioCue, pan: number, volume: number): void;
  /** The background hum. Gain 0 is silence, which is its own kind of pressure. */
  setDrone(frequency: number, gain: number, detune: number): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

export class SilentAudio implements AudioOutput {
  readonly muted = true;
  resume(): void {}
  play(): void {}
  setDrone(): void {}
  setMuted(): void {}
}

const NOISE_SECONDS = 1;

export class WebAudio implements AudioOutput {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOscillators: OscillatorNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted = false;

  constructor(private readonly masterGain: number) {}

  get muted(): boolean {
    return this.isMuted;
  }

  resume(): void {
    if (!this.context) this.start();
    void this.context?.resume();
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.masterGain, this.context.currentTime, 0.05);
    }
  }

  play(cue: AudioCue, pan: number, volume: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.isMuted || volume <= 0) return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(cue.gain * volume, now + Math.max(0.001, cue.attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);

    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);

    let node: AudioNode;
    if (cue.wave === 'noise') {
      const source = context.createBufferSource();
      source.buffer = this.noise(context);
      source.loop = true;
      source.start(now);
      source.stop(now + cue.duration);
      node = source;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = cue.wave;
      oscillator.frequency.setValueAtTime(cue.frequency, now);
      if (cue.endFrequency !== cue.frequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, cue.endFrequency),
          now + cue.duration,
        );
      }
      oscillator.start(now);
      oscillator.stop(now + cue.duration);
      node = oscillator;
    }

    if (cue.cutoff > 0) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cue.cutoff, now);
      node.connect(filter);
      filter.connect(gain);
    } else {
      node.connect(gain);
    }
    gain.connect(panner);
    panner.connect(master);
  }

  setDrone(frequency: number, gain: number, detune: number): void {
    const context = this.context;
    if (!context || !this.droneGain) return;
    const now = context.currentTime;
    this.droneGain.gain.setTargetAtTime(this.isMuted ? 0 : gain, now, 0.4);
    this.droneOscillators.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(frequency * (index + 1), now, 0.5);
      oscillator.detune.setTargetAtTime(detune * (index === 0 ? 1 : -1.4), now, 0.5);
    });
  }

  private start(): void {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.setValueAtTime(this.masterGain, context.currentTime);
    this.master.connect(context.destination);

    const droneGain = context.createGain();
    droneGain.gain.setValueAtTime(0, context.currentTime);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, context.currentTime);
    droneGain.connect(filter);
    filter.connect(this.master);
    this.droneGain = droneGain;

    // Mains hum plus its second harmonic: the sound of a ceiling you cannot see.
    this.droneOscillators = [0, 1].map((index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sawtooth' : 'sine';
      oscillator.frequency.setValueAtTime(60 * (index + 1), context.currentTime);
      oscillator.connect(droneGain);
      oscillator.start();
      return oscillator;
    });
  }

  private noise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = context.sampleRate * NOISE_SECONDS;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x9e3779b9;
    for (let i = 0; i < length; i++) {
      state = (Math.imul(state ^ (state >>> 15), 0x2545f491) + 0x6d2b79f5) >>> 0;
      data[i] = (state / 0x80000000 - 1) * 0.6;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
