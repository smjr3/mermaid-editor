import type { HistoryEntry, HistoryType, Optional, State } from '$lib/types';
import { persisted, readJSON, type Persisted } from '$lib/util/persist.svelte';
import { defaultState, inputState } from '$lib/util/state.svelte';
import { isStateLike, normalizeState } from '$lib/util/stateGuard';
import { logEvent } from '$lib/util/stats';
import { generateSlug } from 'random-word-slugs';
import { v4 as uuidV4 } from 'uuid';

const MAX_AUTO_HISTORY_LENGTH = 30;
const AUTO_SAVE_INTERVAL = 60_000;

const auto = persisted<HistoryEntry[]>('autoHistoryStore', []);
const manual = persisted<HistoryEntry[]>('manualHistoryStore', []);
const mode = persisted<HistoryType>('autoHistoryMode', 'manual');
let loader = $state<HistoryEntry[]>([]);

// Loader entries are in-memory, so a persisted 'loader' mode is empty after reload.
if (mode.value === 'loader') {
  mode.value = 'manual';
}

// The persisted slot backing a mode; loader is in-memory and has no slot.
const slotFor = (m: HistoryType): Persisted<HistoryEntry[]> | null => {
  switch (m) {
    case 'auto': {
      return auto;
    }
    case 'manual': {
      return manual;
    }
    default: {
      return null;
    }
  }
};

export const historyState = {
  get entries(): HistoryEntry[] {
    return slotFor(mode.value)?.value ?? loader;
  },
  get loaderEntries(): HistoryEntry[] {
    return loader;
  },
  get mode(): HistoryType {
    return mode.value;
  }
};

export const setMode = (next: HistoryType): void => {
  mode.value = next;
};

// Dedup key: only the fields that define the diagram, so volatile/view-only
// fields (renderCount, pan/zoom, …) don't count as a change.
export const stateKey = (state: State): string =>
  JSON.stringify({ code: state.code, mermaid: state.mermaid });

const createEntry = (state: State, type: 'auto' | 'manual'): HistoryEntry => ({
  id: uuidV4(),
  name: generateSlug(2),
  state,
  time: Date.now(),
  type
});

// Returns true if added, false if it duplicated the most recent entry.
const addEntry = (
  slot: Persisted<HistoryEntry[]>,
  state: State,
  type: 'auto' | 'manual',
  maxLength?: number
): boolean => {
  const entries = slot.value;
  if (entries.length > 0 && stateKey(entries[0].state) === stateKey(state)) {
    return false;
  }
  const trimmed =
    maxLength && entries.length >= maxLength ? entries.slice(0, maxLength - 1) : entries;
  slot.value = [createEntry(state, type), ...trimmed];
  logEvent('history', { action: 'save', type });
  return true;
};

export const addManualEntry = (state: State): boolean => addEntry(manual, state, 'manual');

export const addAutoEntry = (state: State): boolean =>
  addEntry(auto, state, 'auto', MAX_AUTO_HISTORY_LENGTH);

// Replaces the in-memory revisions (e.g. when a gist is loaded), assigning ids.
export const setLoaderEntries = (entries: Optional<HistoryEntry, 'id'>[]): void => {
  loader = entries.map((entry) =>
    entry.id ? (entry as HistoryEntry) : { ...entry, id: uuidV4() }
  );
};

export const removeEntry = (id: string): void => {
  const slot = slotFor(mode.value);
  if (!slot) {
    return;
  }
  slot.value = slot.value.filter((entry) => entry.id !== id);
  logEvent('history', { action: 'clear', type: 'single' });
};

export const renameEntry = (id: string, name: string): void => {
  const trimmed = name.trim();
  const slot = slotFor(mode.value);
  if (!trimmed || !slot) {
    return;
  }
  slot.value = slot.value.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry));
  logEvent('history', { action: 'rename' });
};

export const clearActive = (): void => {
  const slot = slotFor(mode.value);
  if (!slot) {
    return;
  }
  slot.value = [];
  logEvent('history', { action: 'clear', type: 'all' });
};

export interface RestoreResult {
  restored: number;
  invalid: number;
  duplicates: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Local: an imported entry is whatever JSON the file held. Only an entry with a
// store to go to (auto or manual), a finite time, a saved state (stateGuard.ts)
// and a text id is taken; one without an id gets a new one, as the id migration
// (`injectHistoryIDs`) gives one. Returns undefined for anything else.
const importedEntry = (raw: unknown): HistoryEntry | undefined => {
  if (!isRecord(raw)) return undefined;
  const { id, name, state, time, type, url } = raw;
  if (type !== 'auto' && type !== 'manual') return undefined;
  if (typeof time !== 'number' || !Number.isFinite(time)) return undefined;
  if (!isStateLike(state)) return undefined;
  if (id !== undefined && id !== null && id !== '' && typeof id !== 'string') return undefined;
  const entry: HistoryEntry = {
    id: typeof id === 'string' && id ? id : uuidV4(),
    state: normalizeState(state, defaultState),
    time,
    type
  };
  if (typeof name === 'string') entry.name = name;
  if (typeof url === 'string') entry.url = url;
  return entry;
};

// Routes each uploaded entry to the store matching its own type, skipping ids
// that already exist — in the store or earlier in the same file.
export const restoreEntries = (data: readonly unknown[]): RestoreResult => {
  const valid = data.map((raw) => importedEntry(raw)).filter((entry) => entry !== undefined);
  const invalid = data.length - valid.length;
  let restored = 0;

  const slots: [HistoryType, Persisted<HistoryEntry[]>][] = [
    ['auto', auto],
    ['manual', manual]
  ];
  for (const [type, slot] of slots) {
    const incoming = valid.filter((entry) => entry.type === type);
    if (incoming.length === 0) {
      continue;
    }
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local lookup, not state
    const seen = new Set(slot.value.map(({ id }) => id));
    const fresh = incoming.filter(({ id }) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    restored += fresh.length;
    slot.value = [...slot.value, ...fresh].sort((a, b) => b.time - a.time);
  }

  const duplicates = valid.length - restored;
  logEvent('history', { action: 'restore', duplicates, invalid, success: restored });
  return { restored, invalid, duplicates };
};

/**
 * Restores the entries of an uploaded history file. Undefined, with the history
 * left as it was, when the file is not JSON or does not hold a list of entries.
 */
export const importHistory = (text: string): RestoreResult | undefined => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return undefined;
  }
  return Array.isArray(data) ? restoreEntries(data) : undefined;
};

const setIDs = (entries: HistoryEntry[]): HistoryEntry[] =>
  entries.map((entry) => (entry.id ? entry : { ...entry, id: uuidV4() }));

// One-time migration: re-reads localStorage so entries written by an older
// version get ids, then persists and updates the reactive state.
export const injectHistoryIDs = (): void => {
  auto.value = setIDs(readJSON<HistoryEntry[]>('autoHistoryStore', []));
  manual.value = setIDs(readJSON<HistoryEntry[]>('manualHistoryStore', []));
};

let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

// Idempotent; returns the stop function for use as a lifecycle cleanup.
export const startAutoSave = (): (() => void) => {
  if (autoSaveTimer === undefined) {
    autoSaveTimer = setInterval(
      () => addAutoEntry($state.snapshot(inputState)),
      AUTO_SAVE_INTERVAL
    );
  }
  return stopAutoSave;
};

export const stopAutoSave = (): void => {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
};
