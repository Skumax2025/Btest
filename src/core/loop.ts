/**
 * L0: fixed-step simulation with an interpolated render pass.
 *
 * The only place in the codebase allowed to read wall-clock time. Simulation
 * code receives a tick index and a constant step; it never sees real time.
 */

export interface LoopOptions {
  /** Simulation step in milliseconds. */
  readonly stepMs: number;
  /** Upper bound on the time consumed by one frame, to survive tab switches. */
  readonly maxFrameMs: number;
  readonly now: () => number;
  readonly schedule: (callback: () => void) => number;
  readonly cancel: (handle: number) => void;
}

export interface LoopStats {
  fps: number;
  simMs: number;
  renderMs: number;
  ticksLastFrame: number;
}

export interface LoopCallbacks {
  fixedUpdate: (tick: number) => void;
  render: (alpha: number) => void;
}

export class GameLoop {
  readonly stats: LoopStats = { fps: 0, simMs: 0, renderMs: 0, ticksLastFrame: 0 };

  private accumulator = 0;
  private lastTime = 0;
  private handle = 0;
  private running = false;
  private tick = 0;
  private frameTimes: number[] = [];

  constructor(
    private readonly options: LoopOptions,
    private readonly callbacks: LoopCallbacks,
  ) {}

  get currentTick(): number {
    return this.tick;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = this.options.now();
    this.accumulator = 0;
    this.handle = this.options.schedule(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.options.cancel(this.handle);
  }

  private readonly frame = (): void => {
    if (!this.running) return;
    const frameStart = this.options.now();
    const elapsed = Math.min(frameStart - this.lastTime, this.options.maxFrameMs);
    this.lastTime = frameStart;
    this.accumulator += elapsed;

    let ticks = 0;
    const simStart = this.options.now();
    while (this.accumulator >= this.options.stepMs) {
      this.accumulator -= this.options.stepMs;
      this.callbacks.fixedUpdate(this.tick++);
      ticks++;
    }
    const simEnd = this.options.now();

    this.callbacks.render(this.accumulator / this.options.stepMs);
    const renderEnd = this.options.now();

    this.stats.ticksLastFrame = ticks;
    this.stats.simMs = simEnd - simStart;
    this.stats.renderMs = renderEnd - simEnd;
    this.trackFps(frameStart);

    this.handle = this.options.schedule(this.frame);
  };

  private trackFps(frameStart: number): void {
    this.frameTimes.push(frameStart);
    while (this.frameTimes.length > 0 && frameStart - this.frameTimes[0] > 1000) {
      this.frameTimes.shift();
    }
    this.stats.fps = this.frameTimes.length;
  }
}

/** Browser wiring for `GameLoop`. */
export const browserLoopOptions = (stepMs: number, maxFrameMs: number): LoopOptions => ({
  stepMs,
  maxFrameMs,
  now: () => performance.now(),
  schedule: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
});
