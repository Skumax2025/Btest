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

export type { TextKey } from './ru';

export const RUSSIAN: Locale = {
  id: 'ru',
  label: 'Русский',
  plural: russianPlural,
  strings: RU,
};

export const ENGLISH: Locale = {
  id: 'en',
  label: 'English',
  plural: englishPlural,
  strings: EN,
};

export const LOCALES: readonly Locale[] = [RUSSIAN, ENGLISH];

export const DEFAULT_LOCALE = RUSSIAN.id;
