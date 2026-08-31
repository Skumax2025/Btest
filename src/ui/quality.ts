/**
 * L4: how much work a frame is allowed to be.
 *
 * The demo runs on whatever the player has, and the darkness pass scales with
 * the number of pixels it is computed over rather than with anything the player
 * chose. So instead of asking them to guess, this watches how long frames are
 * actually taking and moves between the tiers in `QUALITY` until they fit.
 *
 * It counts slow frames rather than averaging them. One 200 ms frame — a tab
 * coming back, a chunk streaming in, the garbage collector — would drag an
 * average over the threshold on its own and cost the player a tier they did not
 * need to lose; it cannot outvote forty-four good ones.
 *
 * Auto starts in the middle. A strong machine climbs out of it within a couple
 * of seconds and never sees the difference; a weak one is spared the second in
 * which it would have discovered it could not draw the top tier.
 */

import type {
  QualityGovernorConfig,
  QualityId,
  QualityPreference,
  QualityTier,
} from '@content/view';

export class QualityGovernor {
  private index: number;
  private preference: QualityPreference = 'auto';
  private frames = 0;
  private slow = 0;
  private fast = 0;
  /** Consecutive windows with room to spare, counted towards a step up. */
  private calm = 0;

  constructor(
    private readonly tiers: readonly QualityTier[],
    private readonly config: QualityGovernorConfig,
    start: QualityId,
  ) {
    this.index = Math.max(0, this.tiers.findIndex((tier) => tier.id === start));
  }

  get tier(): QualityTier {
    return this.tiers[this.index];
  }

  get auto(): boolean {
    return this.preference === 'auto';
  }

  /** Pins a tier, or hands the decision back to the frame clock. */
  setPreference(preference: QualityPreference): void {
    this.preference = preference;
    this.reset();
    if (preference === 'auto') return;
    const index = this.tiers.findIndex((tier) => tier.id === preference);
    if (index >= 0) this.index = index;
  }

  /**
   * Feeds one frame: how long it took, and how much of that was ours. True when
   * the tier changed and the renderer has to follow.
   */
  frame(frameMs: number, workMs: number): boolean {
    if (this.preference !== 'auto') return false;
    this.frames++;
    // Long frames we are not causing are the display's business, not ours.
    if (frameMs > this.config.downshiftMs && workMs > this.config.downshiftWorkMs) this.slow++;
    if (workMs < this.config.upshiftWorkMs) this.fast++;
    if (this.frames < this.config.window) return false;

    const majority = this.frames / 2;
    const comfortable = this.frames * 0.9;
    let changed = false;
    if (this.slow > majority && this.index > 0) {
      this.index--;
      changed = true;
      this.calm = 0;
    } else if (this.fast >= comfortable) {
      this.calm++;
      if (this.calm >= this.config.settleWindows && this.index < this.tiers.length - 1) {
        this.index++;
        changed = true;
        this.calm = 0;
      }
    } else {
      this.calm = 0;
    }
    this.frames = 0;
    this.slow = 0;
    this.fast = 0;
    return changed;
  }

  /** Forgets the current window — after a resize, a pause or a level change. */
  reset(): void {
    this.frames = 0;
    this.slow = 0;
    this.fast = 0;
    this.calm = 0;
  }
}
