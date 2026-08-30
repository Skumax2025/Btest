/**
 * L0: persistence helpers.
 *
 * Storage is injected so tests and headless simulation never touch the DOM.
 * `stableStringify` gives a canonical byte-for-byte encoding, which is how the
 * determinism test compares two runs.
 */

import { hashString } from './rng';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveEnvelope<T> {
  readonly version: number;
  readonly payload: T;
}

export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** localStorage when available (private-mode failures degrade to memory). */
export const bestEffortStorage = (): StorageLike => {
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
};

export const saveEnvelope = <T>(
  storage: StorageLike,
  key: string,
  version: number,
  payload: T,
): boolean => {
  try {
    storage.setItem(key, JSON.stringify({ version, payload } satisfies SaveEnvelope<T>));
    return true;
  } catch {
    return false;
  }
};

export const loadEnvelope = <T>(storage: StorageLike, key: string, version: number): T | null => {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as SaveEnvelope<T>;
    if (!parsed || parsed.version !== version) return null;
    return parsed.payload;
  } catch {
    return null;
  }
};

export const clearEnvelope = (storage: StorageLike, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // A storage that refuses to clear is not worth crashing a run over.
  }
};

/** JSON with sorted object keys, so equal states always produce equal strings. */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

/** Compact fingerprint of a state tree — used by tests and the debug overlay. */
export const fingerprint = (value: unknown): string =>
  hashString(stableStringify(value)).toString(16).padStart(8, '0');
