/**
 * L4: what an automatic fight looks like.
 *
 * Nobody presses a key to swing, so everything the player knows about their own
 * combat comes from here: how far the weapon reaches, whether the next swing is
 * ready, and what the last one did. Reads `run.combat` and draws; writes nothing.
 */

import type { Renderer } from '@core/renderer';
import type { CombatEvent } from '@game/run';
import type { Run } from '@game/run';
import type { CombatViewConfig } from '@content/view';

/** Full ticks an event mark lives, matching the simulation's own window. */
const EVENT_TICKS = 40;

const colourFor = (event: CombatEvent, config: CombatViewConfig): string => {
  switch (event) {
    case 'hit':
      return config.hitColour;
    case 'blockedByYou':
      return config.blockColour;
    case 'blockedByThem':
      return config.missColour;
    case 'miss':
      return config.missColour;
    case 'broke':
      return config.breakColour;
    default:
      return config.tiredColour;
  }
};

export const drawCombat = (
  renderer: Renderer,
  run: Run,
  x: number,
  y: number,
  config: CombatViewConfig,
): void => {
  const combat = run.combat;

  // The ring appears the moment something is standing in it, and not before.
  if (combat.targets > 0 && combat.reach > 0) {
    const radius = combat.reach + config.ringPadding;
    const winding = combat.windup > 0;
    const colour = winding
      ? config.windupColour
      : combat.cooldown > 0
        ? config.coolingColour
        : config.readyColour;
    renderer.strokeCircle(x, y, radius, colour, config.ringWidth + (winding ? 1 : 0));

    // A second ring closing in on the first is the swing timer: full means ready.
    if (combat.cooldown > 0 && combat.interval > 0) {
      const ready = 1 - combat.cooldown / combat.interval;
      renderer.strokeCircle(x, y, radius * (0.55 + 0.45 * ready), config.coolingColour, 1);
    }
  }

  if (combat.event && combat.eventTicks > 0) {
    const age = 1 - combat.eventTicks / EVENT_TICKS;
    const radius = combat.reach * 0.5 + config.eventGrowth * age;
    renderer.setAlpha(1 - age);
    renderer.strokeCircle(x, y, radius, colourFor(combat.event, config), config.eventWidth);
    if (combat.event === 'broke' || combat.event === 'tired') {
      renderer.strokeCircle(x, y, radius * 0.6, colourFor(combat.event, config), 1.5);
    }
    renderer.setAlpha(1);
  }
};
