/**
 * Runes-based localStorage persistence, shared by the persisted state in
 * `state.svelte.ts`, `migrations.svelte.ts`, `promo.svelte.ts` and History.
 *
 * Values are stored as plain JSON. Reads of missing or corrupt values fall
 * back to the provided default, so values written by older versions of the
 * editor (which serialized plain objects to the same JSON shape) stay loadable.
 */

import { t } from '$/i18n';
import { notify } from './notify';

// Local (R03): every access is guarded. Blocked site data makes the `localStorage`
// getter itself throw (SecurityError); a full quota or a refusal makes setItem throw
// (QuotaExceededError). Either used to escape into the caller — the state's update
// functions — and stop the URL update, the validation and the render after it.
const storage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

// The in-memory stand-in app.html installs when the browser blocks storage: it keeps
// the page working, but nothing written to it survives the tab.
const inMemory = (store: Storage): boolean =>
  (window as { __memoryStorage?: unknown }).__memoryStorage === store;

let noticeShown = false;

const saved = (ok: boolean): boolean => {
  // Once per page: the next keystroke would fail the same way.
  if (!ok && !noticeShown) {
    noticeShown = true;
    notify(t('storage.notSaving'));
  }
  return ok;
};

export const readJSON = <T>(key: string, fallback: T): T => {
  try {
    const store = storage();
    if (!store) {
      return fallback;
    }
    const raw = store.getItem(key);
    if (raw === null) {
      return fallback;
    }
    // A stored literal "null" means the value is absent: the pre-runes
    // persistence layer never wrote null and treated it as missing.
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

/** Stores `value`; false (and a one-time notice) when the browser would not keep it. */
export const writeJSON = (key: string, value: unknown): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const store = storage();
    if (!store) return saved(false);
    store.setItem(key, JSON.stringify(value));
    return saved(!inMemory(store));
  } catch {
    return saved(false);
  }
};

export interface Persisted<T> {
  value: T;
}

// A localStorage-backed reactive value. Reads on init, writes on every set.
// Raw state: replace `value` wholesale to change it. With a deep proxy,
// in-place mutation would update the UI without ever being persisted.
export const persisted = <T>(key: string, initial: T): Persisted<T> => {
  let value = $state.raw<T>(readJSON(key, initial));
  return {
    get value() {
      return value;
    },
    set value(next: T) {
      value = next;
      writeJSON(key, next);
    }
  };
};
