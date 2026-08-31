/**
 * The thing that decides how much work a frame may be.
 *
 * It is the one piece of the renderer that changes what the player sees without
 * being asked to, so it has to be predictable: it must not oscillate, it must
 * not react to a single bad frame, and a player who picks a tier by hand must
 * keep it.
 */
import { describe, expect, it } from 'vitest';
import { QUALITY, QUALITY_GOVERNOR, VIEW, viewFor } from '@content/view';
import { QualityGovernor } from '@ui/quality';

const governor = (start: 'low' | 'medium' | 'high' = 'medium'): QualityGovernor =>
  new QualityGovernor(QUALITY, QUALITY_GOVERNOR, start);

/** Feeds `count` identical frames. Returns how often the tier changed. */
const feed = (
  subject: QualityGovernor,
  frame: { frameMs: number; workMs: number },
  count: number,
): number => {
  let changes = 0;
  for (let i = 0; i < count; i++) if (subject.frame(frame.frameMs, frame.workMs)) changes++;
  return changes;
};

/** A frame the machine plainly cannot draw: long, and long because of us. */
const STRUGGLING = {
  frameMs: QUALITY_GOVERNOR.downshiftMs * 2,
  workMs: QUALITY_GOVERNOR.downshiftWorkMs * 2,
};
/** A frame with room to spare, at the 60 Hz the display pins every frame to. */
const COMFORTABLE = { frameMs: 16.6, workMs: QUALITY_GOVERNOR.upshiftWorkMs / 2 };

describe('quality tiers', () => {
  it('are ordered from cheapest to most expensive', () => {
    for (let i = 1; i < QUALITY.length; i++) {
      const before = QUALITY[i - 1];
      const tier = QUALITY[i];
      expect(tier.maxPixelRatio).toBeGreaterThanOrEqual(before.maxPixelRatio);
      expect(tier.darknessScale).toBeGreaterThanOrEqual(before.darknessScale);
      expect(tier.maxPixels).toBeGreaterThanOrEqual(before.maxPixels);
      expect(tier.rays.playerRays).toBeGreaterThanOrEqual(before.rays.playerRays);
      expect(tier.beamSegments).toBeGreaterThanOrEqual(before.beamSegments);
    }
  });

  it('never asks for more than the design, only for less', () => {
    for (const tier of QUALITY) {
      const view = viewFor(tier);
      expect(view.light.lampGlow).toBeLessThanOrEqual(VIEW.light.lampGlow);
      expect(view.light.lampCore).toBeLessThanOrEqual(VIEW.light.lampCore);
      expect(view.light.beamSegments).toBeLessThanOrEqual(VIEW.light.beamSegments);
      expect(view.phantomCount).toBeLessThanOrEqual(VIEW.phantomCount);
      // Everything not named by a tier is the design untouched.
      expect(view.wallFaceHeight).toBe(VIEW.wallFaceHeight);
      expect(view.combat).toBe(VIEW.combat);
    }
  });
});

describe('quality governor', () => {
  it('steps down through the tiers while frames are too long', () => {
    const subject = governor('high');
    feed(subject, STRUGGLING, QUALITY_GOVERNOR.window);
    expect(subject.tier.id).toBe('medium');
    feed(subject, STRUGGLING, QUALITY_GOVERNOR.window);
    expect(subject.tier.id).toBe('low');
    // And stops at the bottom rather than falling off it.
    feed(subject, STRUGGLING, QUALITY_GOVERNOR.window * 3);
    expect(subject.tier.id).toBe('low');
  });

  it('climbs back only after several windows with room to spare', () => {
    const subject = governor('low');
    feed(subject, COMFORTABLE, QUALITY_GOVERNOR.window * (QUALITY_GOVERNOR.settleWindows - 1));
    expect(subject.tier.id).toBe('low');
    feed(subject, COMFORTABLE, QUALITY_GOVERNOR.window);
    expect(subject.tier.id).toBe('medium');
  });

  /**
   * The whole reason the decision reads two clocks. A display pins every frame
   * to its refresh rate, so a machine drawing a tenth of a frame's worth of work
   * still reports 16.6 ms — and would never be allowed to climb if that were the
   * only number consulted.
   */
  it('climbs on a machine locked to its refresh rate', () => {
    const subject = governor('low');
    feed(subject, { frameMs: 16.6, workMs: 1.2 }, QUALITY_GOVERNOR.window * QUALITY_GOVERNOR.settleWindows);
    expect(subject.tier.id).toBe('medium');
  });

  /** A browser throttling a background or power-saving tab is not our fault. */
  it('keeps its tier when long frames are not our doing', () => {
    const subject = governor('high');
    const throttled = { frameMs: 33.4, workMs: 2 };
    // Nothing at all happens: it is already at the top, and there is no reason
    // to leave it — half a frame's headroom is not a machine in trouble.
    expect(feed(subject, throttled, QUALITY_GOVERNOR.window * 4)).toBe(0);
    expect(subject.tier.id).toBe('high');
  });

  it('ignores a single terrible frame among good ones', () => {
    const subject = governor('high');
    for (let window = 0; window < 6; window++) {
      subject.frame(500, 400);
      feed(subject, { frameMs: 8, workMs: 6 }, QUALITY_GOVERNOR.window - 1);
    }
    // A tab coming back, a chunk streaming in, a collection: not a slow machine.
    expect(subject.tier.id).toBe('high');
  });

  it('does not oscillate on a machine sitting between two tiers', () => {
    const subject = governor('medium');
    // Work between the two thresholds: too expensive to climb, cheap enough to stay.
    const between = {
      frameMs: 16.6,
      workMs: (QUALITY_GOVERNOR.upshiftWorkMs + QUALITY_GOVERNOR.downshiftWorkMs) / 2,
    };
    const changes = feed(subject, between, QUALITY_GOVERNOR.window * 20);
    expect(changes).toBe(0);
    expect(subject.tier.id).toBe('medium');
  });

  it('keeps a tier the player picked, whatever the frames are doing', () => {
    const subject = governor('high');
    subject.setPreference('low');
    expect(subject.tier.id).toBe('low');
    expect(subject.auto).toBe(false);
    expect(feed(subject, COMFORTABLE, QUALITY_GOVERNOR.window * 10)).toBe(0);
    expect(subject.tier.id).toBe('low');
    // Handing the decision back starts the measurement again from nothing.
    subject.setPreference('auto');
    expect(subject.auto).toBe(true);
    feed(subject, COMFORTABLE, QUALITY_GOVERNOR.window * QUALITY_GOVERNOR.settleWindows);
    expect(subject.tier.id).toBe('medium');
  });
});
