/**
 * Guards the architecture itself: no import may point at a higher layer, and the
 * module graph must stay acyclic. ESLint enforces the first rule while editing;
 * this test enforces both in CI and catches relative-path escapes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');

const LAYERS: Record<string, number> = {
  core: 0,
  systems: 1,
  game: 2,
  content: 3,
  ui: 4,
  view: 4,
};

const ALIASES: Record<string, string> = {
  '@core': join(srcRoot, 'core'),
  '@systems': join(srcRoot, 'systems'),
  '@game': join(srcRoot, 'game'),
  '@content': join(srcRoot, 'content'),
  '@ui': join(srcRoot, 'ui'),
};

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });

const layerOf = (file: string): number => {
  const rel = relative(srcRoot, file);
  const top = rel.split(/[\\/]/)[0];
  return LAYERS[top] ?? 4; // main.ts and anything loose at the root is the entry layer
};

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;

const importsOf = (file: string): string[] => {
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) found.push(match[1]);
  return found;
};

const resolveSpecifier = (fromFile: string, specifier: string): string | null => {
  let base: string | null = null;
  if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else {
    const alias = Object.keys(ALIASES).find(
      (key) => specifier === key || specifier.startsWith(`${key}/`),
    );
    if (!alias) return null;
    base = join(ALIASES[alias], specifier.slice(alias.length));
  }
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep trying
    }
  }
  return null;
};

const files = listFiles(srcRoot);

describe('layer discipline', () => {
  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never imports from a higher layer', () => {
    const violations: string[] = [];
    for (const file of files) {
      const from = layerOf(file);
      for (const specifier of importsOf(file)) {
        const target = resolveSpecifier(file, specifier);
        if (!target) continue;
        const to = layerOf(target);
        if (to > from) {
          violations.push(`${relative(root, file)} (L${from}) -> ${specifier} (L${to})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('has no import cycles', () => {
    const graph = new Map<string, string[]>();
    for (const file of files) {
      graph.set(
        file,
        importsOf(file)
          .map((specifier) => resolveSpecifier(file, specifier))
          .filter((value): value is string => value !== null),
      );
    }
    const state = new Map<string, number>();
    const cycles: string[] = [];
    const stack: string[] = [];
    const visit = (node: string): void => {
      if (state.get(node) === 2) return;
      if (state.get(node) === 1) {
        cycles.push([...stack.slice(stack.indexOf(node)), node].map((f) => relative(root, f)).join(' -> '));
        return;
      }
      state.set(node, 1);
      stack.push(node);
      for (const next of graph.get(node) ?? []) visit(next);
      stack.pop();
      state.set(node, 2);
    };
    for (const file of files) visit(file);
    expect(cycles).toEqual([]);
  });
});
