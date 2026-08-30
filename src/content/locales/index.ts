/**
 * L3: the locale registry.
 *
 * Russian is the default and the source of truth for the key set; English is
 * typed against it. Adding a language means adding one file and one entry here.
 */

import { englishPlural, russianPlural } from '@core/i18n';
import type { Locale } from '@core/i18n';
import { RU } from './ru';
import { EN } from './en';
import { RU_GUIDE } from './ru-guide';
import { EN_GUIDE } from './en-guide';

/** Every key the game may ask for: the interface plus the guidebook. */
export type TextKey = keyof typeof RU | keyof typeof RU_GUIDE;

export const RUSSIAN: Locale = {
  id: 'ru',
  label: 'Русский',
  plural: russianPlural,
  strings: { ...RU, ...RU_GUIDE },
};

export const ENGLISH: Locale = {
  id: 'en',
  label: 'English',
  plural: englishPlural,
  strings: { ...EN, ...EN_GUIDE },
};

export const LOCALES: readonly Locale[] = [RUSSIAN, ENGLISH];

export const DEFAULT_LOCALE = RUSSIAN.id;
