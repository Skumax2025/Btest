/**
 * L4: the numbers panel. Frame cost, entity counts, streaming state and what the
 * player currently senses — everything needed to tell a balance problem from a
 * performance one.
 */

import type { LoopStats } from '@core/loop';
import type { Run } from '@game/run';
import { el, setStyle, setText } from './dom';

export class DebugOverlay {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'debug', parent);
    this.body = el('pre', 'debug-body', this.root);
    this.setVisible(false);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    setStyle(this.root, 'display', visible ? 'block' : 'none');
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  /** `quality` is the tier in force and how it is being chosen. */
  update(run: Run, stats: LoopStats, pixelRatio: number, quality: string): void {
    if (!this.visible) return;
    const lines = [
      `fps        ${stats.fps.toString().padStart(5)}   frame ms ${stats.frameMs.toFixed(1)}  ticks/frame ${stats.ticksLastFrame}`,
      `sim  ms    ${stats.simMs.toFixed(2).padStart(5)}   render ms  ${stats.renderMs.toFixed(2)}`,
      `tick       ${run.tick.toString().padStart(5)}   time ${run.elapsedSeconds.toFixed(1)}s`,
      `seed       ${run.config.seed.toString(16)}   level ${run.levelIndex} (${run.spec.id})`,
      `creatures  ${run.creatures.size.toString().padStart(5)}   projectiles ${run.projectiles.size}`,
      `chunks     ${run.level.loadedChunkCount.toString().padStart(5)}   noise events ${run.noise.recent().length}`,
      `light      ${run.perception.lightLevel.toFixed(2)}    sight ${run.perception.sightRadius.toFixed(0)}`,
      `dark ${run.perception.inDark ? 'Y' : 'n'}  silence ${run.perception.inSilence ? 'Y' : 'n'}  pressure ${run.perception.creaturePressure.toFixed(2)}`,
      `stance     ${run.player.stance.padEnd(7)} torch ${run.flashlightOn ? 'on' : 'off'} ${run.flashlightCharge.toFixed(0)}s`,
      `dpr        ${pixelRatio.toFixed(2)}    quality ${quality}`,
    ];
    setText(this.body, lines.join('\n'));
  }
}
