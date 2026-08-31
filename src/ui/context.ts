/**
 * L4: the handful of things every screen needs — the dictionary, the binder that
 * rewrites static labels when the language changes, and the live key bindings so
 * a hint can name the key that is actually bound right now.
 */

import type { Localizer, Translate } from '@core/i18n';
import type { Bindings } from './keys';
import type { IconSource } from './icons';
import { TextBinder } from './i18n-dom';

export interface UiContext {
  readonly localizer: Localizer;
  readonly binder: TextBinder;
  readonly t: Translate;
  /** Read fresh every call: rebinding a key must change every hint at once. */
  readonly bindings: () => Bindings;
  /** The catalogue's art, ready to hang on a DOM node. */
  readonly icons: IconSource;
}

export const createUiContext = (
  localizer: Localizer,
  bindings: () => Bindings,
  icons: IconSource,
): UiContext => {
  const binder = new TextBinder(localizer);
  return {
    localizer,
    binder,
    t: (key, params) => localizer.t(key, params),
    bindings,
    icons,
  };
};
