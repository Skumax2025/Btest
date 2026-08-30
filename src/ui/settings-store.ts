/**
 * L4: the player's own preferences.
 *
 * Kept under a different storage key from the run on purpose: wiping progress
 * must never cost someone their language, their keys or their volume. Defaults
 * come from content, so no number is invented here.
 */

import { clearEnvelope, loadEnvelope, saveEnvelope } from '@core/serialize';
import type { StorageLike } from '@core/serialize';
import { DEFAULT_LOCALE } from '@content/locales';
import { KEY_BINDINGS, SETTINGS_DEFAULTS } from '@content/tuning';

export const SETTINGS_KEY = 'backrooms.settings';
export const SETTINGS_VERSION = 1;

export interface GameSettings {
  locale: string;
  volumeMaster: number;
  volumeEffects: number;
  volumeAmbient: number;
  brightness: number;
  uiScale: number;
  debugOverlay: boolean;
  bindings: Record<string, string[]>;
}

export const defaultBindings = (): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [action, codes] of Object.entries(KEY_BINDINGS)) out[action] = [...codes];
  return out;
};

export const defaultSettings = (): GameSettings => ({
  locale: DEFAULT_LOCALE,
  volumeMaster: SETTINGS_DEFAULTS.volumeMaster,
  volumeEffects: SETTINGS_DEFAULTS.volumeEffects,
  volumeAmbient: SETTINGS_DEFAULTS.volumeAmbient,
  brightness: SETTINGS_DEFAULTS.brightness,
  uiScale: SETTINGS_DEFAULTS.uiScale,
  debugOverlay: SETTINGS_DEFAULTS.debugOverlay,
  bindings: defaultBindings(),
});

/** A stored file that is missing fields is filled in rather than thrown away. */
export const loadSettings = (storage: StorageLike): GameSettings => {
  const stored = loadEnvelope<Partial<GameSettings>>(storage, SETTINGS_KEY, SETTINGS_VERSION);
  const settings = defaultSettings();
  if (!stored) return settings;
  return {
    ...settings,
    ...stored,
    bindings: { ...settings.bindings, ...(stored.bindings ?? {}) },
  };
};

export const saveSettings = (storage: StorageLike, settings: GameSettings): void => {
  saveEnvelope(storage, SETTINGS_KEY, SETTINGS_VERSION, settings);
};

export const clearSettings = (storage: StorageLike): void => {
  clearEnvelope(storage, SETTINGS_KEY);
};
