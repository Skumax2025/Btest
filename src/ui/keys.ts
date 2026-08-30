/**
 * L4: turning key codes into something a player can read.
 *
 * Locale files may hold a label for a named key (`key.Space`), and everything
 * else falls back to stripping the `KeyboardEvent.code` prefix. Hint texts never
 * contain a key name — they take one as a parameter, so rebinding a key
 * rewrites every hint that mentions it.
 */

import type { Translate } from '@core/i18n';

export type Bindings = Readonly<Record<string, readonly string[]>>;

const strip = (code: string): string => {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
};

export const keyLabel = (t: Translate, code: string): string => {
  const key = `key.${code}`;
  const translated = t(key);
  return translated === key ? strip(code) : translated;
};

/** Label of the first key bound to an action, or the "unbound" text. */
export const actionLabel = (t: Translate, bindings: Bindings, action: string): string => {
  const codes = bindings[action];
  if (!codes || codes.length === 0) return t('ui.none');
  return keyLabel(t, codes[0]);
};

/** The four movement keys as one readable clump, e.g. `WASD` or `↑←↓→`. */
export const movementLabel = (t: Translate, bindings: Bindings, axes: readonly string[]): string =>
  axes.map((action) => actionLabel(t, bindings, action)).join('');
