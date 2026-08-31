/**
 * L3: colour. Level 0 is yellowed wallpaper and damp carpet — no saturated
 * colour anywhere except items and danger, which is why those two have their
 * own entries.
 */

export interface Palette {
  readonly background: string;
  /** Top of a wall — the surface the camera looks down on. */
  readonly wall: string;
  /** A raised side of a wall that is not the one turned away from the light. */
  readonly wallShade: string;
  /** The side turned away from it, which is the one the camera sees most of. */
  readonly wallFaceDark: string;
  /** The crest where the top meets a side: the one bright line on a wall. */
  readonly wallEdge: string;
  readonly floor: string;
  readonly floorAlt: string;
  readonly stain: string;
  readonly wet: string;
  readonly pillar: string;
  readonly darkness: string;
  readonly lampGlow: string;
  readonly decal: string;
  readonly item: string;
  readonly danger: string;
  readonly exit: string;
  readonly text: string;
  readonly textDim: string;
}

export const PALETTES: Readonly<Record<string, Palette>> = {
  'level0.yellow': {
    background: '#0a0907',
    wall: '#dcc57c',
    wallShade: '#8a7436',
    wallFaceDark: '#5c4b1f',
    wallEdge: '#f6e9bb',
    floor: '#5c4e28',
    floorAlt: '#524621',
    stain: '#40361c',
    wet: '#4b4a30',
    pillar: '#b09a58',
    darkness: 'rgba(5,4,9,0.95)',
    lampGlow: '#fff3c4',
    decal: '#3f3520',
    item: '#7fd0c8',
    danger: '#c05a4a',
    exit: '#9ad7a0',
    text: '#efe3bb',
    textDim: '#9a8f6f',
  },
  'level1.grey': {
    background: '#07080a',
    wall: '#8d9296',
    wallShade: '#5c6165',
    wallFaceDark: '#41474a',
    wallEdge: '#b6bcc0',
    floor: '#4a5054',
    floorAlt: '#414649',
    stain: '#33383b',
    wet: '#2e3a3c',
    pillar: '#7b8185',
    darkness: 'rgba(4,5,10,0.96)',
    lampGlow: '#cfe6ff',
    decal: '#262b2e',
    item: '#7fd0c8',
    danger: '#c05a4a',
    exit: '#9ad7a0',
    text: '#dfe6ea',
    textDim: '#8b9398',
  },
};

const DEFAULT_PALETTE_ID = 'level0.yellow';

export const paletteOf = (id: string): Palette => PALETTES[id] ?? PALETTES[DEFAULT_PALETTE_ID];
