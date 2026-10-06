import mermaid from 'mermaid';
import { sanitizeIconSet, type IconifyJSON } from './customIcons';

/**
 * Icon packs a user imported, kept in this browser's IndexedDB (packs of
 * official icon sets run to several MB, beyond what localStorage holds) and
 * registered with mermaid on load. They are per browser: a diagram shared with
 * someone who has not imported the same pack shows mermaid's "?" placeholder.
 */

const DB_NAME = 'mermaid-editor-icons';
const STORE = 'packs';

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'prefix' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });

const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    db.close();
  }
};

const register = (pack: IconifyJSON): void => {
  // `icons` (not `loader`) replaces any cached copy, so a re-import takes effect at once.
  mermaid.registerIconPacks([{ icons: pack, name: pack.prefix }]);
};

/** Every stored pack, re-sanitised: storage is not trusted any more than an import is. */
export const listIconPacks = async (): Promise<IconifyJSON[]> => {
  const stored = await run<unknown[]>('readonly', (store) => store.getAll());
  return stored.flatMap((value) => {
    try {
      return [sanitizeIconSet(value)];
    } catch {
      return [];
    }
  });
};

/** Fired on `window` when a pack is imported or removed, so the view draws the diagram again. */
export const ICON_PACKS_CHANGED = 'mermaid-editor:icon-packs-changed';
const announce = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ICON_PACKS_CHANGED));
};

export const saveIconPack = async (pack: IconifyJSON): Promise<void> => {
  await run('readwrite', (store) => store.put(pack));
  register(pack);
  announce();
};

export const deleteIconPack = async (prefix: string): Promise<void> => {
  await run('readwrite', (store) => store.delete(prefix));
  // Leave an empty pack behind so the deleted icons stop rendering without a reload.
  register({ icons: {}, prefix });
  announce();
};

/** Register the stored packs; resolves (never rejects) once done, so rendering can wait for it. */
export const registerStoredIconPacks = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;
  try {
    for (const pack of await listIconPacks()) register(pack);
  } catch {
    // Storage blocked (private window, site-data settings): only the bundled packs are available.
  }
};
