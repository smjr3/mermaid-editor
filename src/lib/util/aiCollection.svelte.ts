import { persisted } from './persist.svelte';

/**
 * Local: the icons a user collects in the picker to brief an AI with
 * (aiPrompt.ts). Kept per browser so a list survives a reload; cleared from
 * the Icons card.
 */
const store = persisted<string[]>('aiIcons', []);

const safe = (): string[] =>
  Array.isArray(store.value) ? store.value.filter((id) => typeof id === 'string') : [];

export const aiCollection = {
  add(id: string) {
    const current = safe();
    if (!current.includes(id)) store.value = [...current, id];
  },
  clear() {
    store.value = [];
  },
  get ids(): string[] {
    return safe();
  },
  remove(id: string) {
    store.value = safe().filter((item) => item !== id);
  }
};
