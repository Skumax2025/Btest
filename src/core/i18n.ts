/**
 * L0: localization.
 *
 * Knows: how to hold dictionaries, which one is active, how to substitute
 * parameters and how to pick a plural form. Knows no strings of its own — every
 * dictionary arrives from content (L3).
 *
 * Changing the active locale is a plain setter: nothing is cached, so a caller
 * that re-reads its strings after the change sees the new language immediately.
 */

/** CLDR-style categories. Russian uses one/few/many; English uses one/other. */
export type PluralCategory = 'one' | 'few' | 'many' | 'other';

export type PluralRule = (count: number) => PluralCategory;

/** A string, or its plural forms keyed by category. */
export type LocaleString = string | Readonly<Partial<Record<PluralCategory, string>>>;

export type LocaleStrings = Readonly<Record<string, LocaleString>>;

export interface Locale {
  readonly id: string;
  /** Name of the language written in that language. */
  readonly label: string;
  readonly plural: PluralRule;
  readonly strings: LocaleStrings;
}

export type TextParams = Readonly<Record<string, string | number>>;

export const englishPlural: PluralRule = (count) => (Math.abs(count) === 1 ? 'one' : 'other');

/**
 * 1 патрон, 2 патрона, 5 патронов — and 11 патронов, 21 патрон, 112 патронов.
 * The teens are the exception that catches naive implementations.
 */
export const russianPlural: PluralRule = (count) => {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'many';
  const last = n % 10;
  if (last === 1) return 'one';
  if (last >= 2 && last <= 4) return 'few';
  return 'many';
};

const PARAM_PATTERN = /\{(\w+)\}/g;

export const interpolate = (template: string, params?: TextParams): string => {
  if (!params) return template;
  return template.replace(PARAM_PATTERN, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
};

const pickForm = (value: LocaleString, category: PluralCategory): string => {
  if (typeof value === 'string') return value;
  return value[category] ?? value.other ?? value.many ?? value.one ?? '';
};

export type LocaleListener = (locale: Locale) => void;

/**
 * The dictionary the whole game reads through. A missing key returns the key
 * itself: a visible `hud.health` on screen is a louder bug report than a blank.
 */
export class Localizer {
  private active: Locale;
  private readonly locales = new Map<string, Locale>();
  private readonly listeners: LocaleListener[] = [];

  constructor(locales: readonly Locale[], activeId: string) {
    if (locales.length === 0) throw new Error('Localizer needs at least one locale');
    for (const locale of locales) this.locales.set(locale.id, locale);
    this.active = this.locales.get(activeId) ?? locales[0];
  }

  get locale(): Locale {
    return this.active;
  }

  get localeId(): string {
    return this.active.id;
  }

  available(): readonly Locale[] {
    return [...this.locales.values()];
  }

  has(id: string): boolean {
    return this.locales.has(id);
  }

  /** Applies immediately and tells every listener; nothing is rebuilt lazily. */
  setLocale(id: string): void {
    const next = this.locales.get(id);
    if (!next || next.id === this.active.id) return;
    this.active = next;
    for (const listener of this.listeners) listener(next);
  }

  onChange(listener: LocaleListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  t(key: string, params?: TextParams): string {
    const value = this.active.strings[key];
    if (value === undefined) return key;
    return interpolate(pickForm(value, 'other'), params);
  }

  /** `count` is also available to the template as `{count}`. */
  plural(key: string, count: number, params?: TextParams): string {
    const value = this.active.strings[key];
    if (value === undefined) return key;
    const form = pickForm(value, this.active.plural(count));
    return interpolate(form, { count, ...params });
  }
}

export type Translate = (key: string, params?: TextParams) => string;
