/**
 * Localization guards. Two of them are structural rather than behavioural: the
 * key sets must match, and no screen may hold a string of its own — those are
 * the two ways a translated game quietly stops being translated.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Localizer, englishPlural, interpolate, russianPlural } from '@core/i18n';
import { DEFAULT_LOCALE, LOCALES } from '@content/locales';
import { RU } from '@content/locales/ru';
import { EN } from '@content/locales/en';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });

const sourcesIn = (...dirs: string[]): Array<{ file: string; text: string }> =>
  dirs
    .flatMap((dir) => listFiles(join(root, 'src', dir)))
    .map((file) => ({ file: relative(root, file), text: readFileSync(file, 'utf8') }));

describe('plural rules', () => {
  it('declines Russian counts, teens included', () => {
    const forms = (n: number): string =>
      ({ one: 'патрон', few: 'патрона', many: 'патронов', other: 'патронов' })[russianPlural(n)];
    expect(forms(1)).toBe('патрон');
    expect(forms(2)).toBe('патрона');
    expect(forms(4)).toBe('патрона');
    expect(forms(5)).toBe('патронов');
    expect(forms(11)).toBe('патронов');
    expect(forms(12)).toBe('патронов');
    expect(forms(14)).toBe('патронов');
    expect(forms(21)).toBe('патрон');
    expect(forms(22)).toBe('патрона');
    expect(forms(25)).toBe('патронов');
    expect(forms(101)).toBe('патрон');
    expect(forms(111)).toBe('патронов');
    expect(forms(0)).toBe('патронов');
  });

  it('declines English counts', () => {
    expect(englishPlural(1)).toBe('one');
    expect(englishPlural(0)).toBe('other');
    expect(englishPlural(2)).toBe('other');
  });
});

describe('localizer', () => {
  it('substitutes parameters and leaves unknown ones alone', () => {
    expect(interpolate('{a} and {b}', { a: 1, b: 'two' })).toBe('1 and two');
    expect(interpolate('{missing}', {})).toBe('{missing}');
  });

  it('returns the key itself when a string is missing', () => {
    const localizer = new Localizer(LOCALES, DEFAULT_LOCALE);
    expect(localizer.t('no.such.key')).toBe('no.such.key');
  });

  it('switches language immediately and tells its listeners', () => {
    const localizer = new Localizer(LOCALES, 'ru');
    const seen: string[] = [];
    localizer.onChange((locale) => seen.push(locale.id));
    const before = localizer.t('menu.newRun');
    localizer.setLocale('en');
    expect(localizer.t('menu.newRun')).not.toBe(before);
    expect(seen).toEqual(['en']);
    localizer.setLocale('en');
    expect(seen).toEqual(['en']);
  });

  it('picks the right plural form per language', () => {
    const localizer = new Localizer(LOCALES, 'ru');
    expect(localizer.plural('summary.tiles', 1)).toContain('шаг');
    expect(localizer.plural('summary.tiles', 3)).toContain('шага');
    expect(localizer.plural('summary.tiles', 7)).toContain('шагов');
    localizer.setLocale('en');
    expect(localizer.plural('summary.tiles', 1)).toBe('1 step');
    expect(localizer.plural('summary.tiles', 7)).toBe('7 steps');
  });
});

describe('locale files', () => {
  it('have exactly the same key set', () => {
    const ru = Object.keys(RU).sort();
    const en = Object.keys(EN).sort();
    expect(en).toEqual(ru);
  });

  it('leave no string empty and no parameter unmatched between languages', () => {
    const params = (value: unknown): string[] => {
      const text = typeof value === 'string' ? value : Object.values(value as object).join(' ');
      return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    };
    for (const key of Object.keys(RU) as Array<keyof typeof RU>) {
      const ruValue = RU[key];
      const enValue = EN[key];
      expect(ruValue, key).toBeTruthy();
      expect(enValue, key).toBeTruthy();
      // `{count}` is injected by the plural helper, so it may appear on one side.
      const strip = (list: string[]): string[] => list.filter((name) => name !== 'count');
      expect(strip(params(enValue)), key).toEqual(strip(params(ruValue)));
    }
  });

  it('never bakes a key name into a hint — keys arrive as parameters', () => {
    for (const [key, value] of Object.entries(RU)) {
      if (!key.startsWith('hint.') && !key.startsWith('summary.restart')) continue;
      const text = typeof value === 'string' ? value : Object.values(value).join(' ');
      expect(/\b(WASD|SHIFT|CTRL|TAB|ENTER|SPACE|Shift|Ctrl)\b/.test(text), key).toBe(false);
    }
  });

  it('resolves every static key the interface asks for', () => {
    const known = new Set(Object.keys(RU));
    const missing: string[] = [];
    for (const { file, text } of sourcesIn('ui', 'view', 'content')) {
      for (const match of text.matchAll(/\b(?:t|bind)\(\s*(?:[\w.]+,\s*)?'([a-z][\w.]*\.[\w.]+)'/g)) {
        const key = match[1];
        if (key.includes('/') || known.has(key)) continue;
        missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('no on-screen literals above L3', () => {
  /** A literal with two letters in a row is prose; `x`, ` · `, `%` are not. */
  const PROSE = /[A-Za-zА-Яа-я]{2}/;
  // The first argument may itself be a call, so allow one level of nesting
  // before the literal we are actually judging.
  const CALLS = [
    /setText\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*,\s*'([^']*)'\s*\)/g,
    /\.textContent\s*=\s*'([^']*)'/g,
    /drawText\(\s*'([^']*)'/g,
  ];

  it('would actually catch an offender', () => {
    const samples = [
      "setText(this.body, 'Press start');",
      "setText(el('h2', 'guide-heading', root), 'Press start');",
      "node.textContent = 'Press start';",
      "renderer.drawText('Press start', 0, 0, style);",
    ];
    for (const sample of samples) {
      const caught = CALLS.some((pattern) =>
        [...sample.matchAll(pattern)].some((match) => PROSE.test(match[1])),
      );
      expect(caught, sample).toBe(true);
    }
    // ...and not trip over a class name or a separator.
    const clean = "setText(el('h2', 'guide-heading', root), this.ui.t('x'));";
    expect(CALLS.some((p2) => [...clean.matchAll(p2)].some((m) => PROSE.test(m[1])))).toBe(false);
  });

  it('keeps prose out of the ui and view layers', () => {
    const offenders: string[] = [];
    for (const { file, text } of sourcesIn('ui', 'view')) {
      for (const pattern of CALLS) {
        for (const match of text.matchAll(pattern)) {
          if (PROSE.test(match[1])) offenders.push(`${file}: "${match[1]}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps display names out of the game layer', () => {
    const offenders: string[] = [];
    for (const { file, text } of sourcesIn('game')) {
      for (const match of text.matchAll(/\b(?:name|label|title|description)\s*:\s*'([^']*)'/g)) {
        if (PROSE.test(match[1])) offenders.push(`${file}: "${match[1]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
