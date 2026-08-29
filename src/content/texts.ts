/**
 * L3: every string the player reads. One file to translate.
 *
 * The demo teaches itself through the opening room and one contextual line, so
 * this list stays short on purpose — there are no story texts and no tutorial
 * screens.
 */

export const TEXTS = {
  hud: {
    health: 'BODY',
    hunger: 'FOOD',
    thirst: 'WATER',
    stamina: 'BREATH',
    sanity: 'NERVE',
    hand: 'IN HAND',
    empty: 'empty hands',
    charge: 'charge',
    weight: 'load',
    level: 'LEVEL',
  },
  hints: {
    move: 'WASD to move. The mouse points your eyes.',
    search: 'E — search',
    pickup: 'E — pick up',
    descend: 'E — go through',
    useHand: 'F — use what is in hand',
    flashlight: 'R — switch the light',
    inventory: 'TAB — bag',
    throwItem: 'Q — throw',
    attack: 'SPACE — swing',
    sprint: 'SHIFT — run (loud)',
    crouch: 'CTRL — crouch (quiet, slow)',
    exhausted: 'Out of breath.',
    heavy: 'Too heavy to carry.',
    full: 'No room in the bag.',
    nothing: 'Nothing left in it.',
    darkness: 'It is too dark to see anything.',
    listen: 'Something moved.',
  },
  inventory: {
    title: 'BAG',
    handSlot: 'HAND',
    dropHint: 'Drag to move. Right click to put in hand. G drops what you hold.',
  },
  summary: {
    title: 'THE BUILDING KEEPS YOU',
    time: 'Time inside',
    levels: 'Levels descended',
    collected: 'Things collected',
    distance: 'Ground covered',
    cause: 'Cause',
    restart: 'ENTER — go back in with a new seed',
    seed: 'Seed',
  },
  causes: {
    injury: 'Something reached you.',
    starvation: 'You stopped being able to walk.',
    thirst: 'You dried out.',
    unknown: 'You stopped.',
  },
  levelNames: {
    level0: 'Level 0',
    level1: 'Level 1',
  },
} as const;
