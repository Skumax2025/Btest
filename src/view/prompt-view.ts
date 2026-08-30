/**
 * L4: the key prompt that stands next to the thing it is about.
 *
 * A hint about a crate belongs over the crate, not on a line at the bottom of
 * the screen. The words arrive already translated — the view never holds a
 * string of its own, and the key inside them came from the live bindings.
 */

import type { Renderer } from '@core/renderer';
import type { HudConfig } from '@content/view';
import type { Palette } from '@content/palettes';

export interface Prompt {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export const drawPrompt = (
  renderer: Renderer,
  prompt: Prompt,
  palette: Palette,
  config: HudConfig,
): void => {
  const y = prompt.y - config.promptOffset;
  renderer.drawText(prompt.text, prompt.x, y + 1, {
    font: config.promptFont,
    color: 'rgba(0, 0, 0, 0.85)',
    align: 'center',
    baseline: 'middle',
  });
  renderer.drawText(prompt.text, prompt.x, y, {
    font: config.promptFont,
    color: palette.text,
    align: 'center',
    baseline: 'middle',
  });
};
