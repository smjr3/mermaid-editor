/**
 * Local: the colours this browser picked freely (「＋好きな色」), latest first, kept in
 * one `persisted('colorRecent')` shared by every colour row (ColorRow.svelte), so a
 * colour picked for a lane is offered again for a node, an arrow or the line colour.
 */
import { addRecent } from './colors';
import { persisted } from './persist.svelte';

const store = persisted<string[]>('colorRecent', []);

export const colorRecent = {
  /** Whatever an older or hand-edited store holds, only a list of #rrggbb colours. */
  get list(): string[] {
    const value: unknown = store.value;
    return Array.isArray(value)
      ? value.filter(
          (color): color is string => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)
        )
      : [];
  },
  /** Remembers a colour picked freely (at most eight are kept, see `addRecent`). */
  remember(color: string): void {
    store.value = addRecent(this.list, color);
  }
};
