/**
 * Local, tests only: a minimal in-memory IndexedDB with the parts
 * customIconStore.ts uses (open with an upgrade, one object store keyed by a
 * path, put / getAll / delete, transaction complete and abort). jsdom has no
 * IndexedDB. Like the real one, a request's success comes before its
 * transaction's `complete`, and a transaction that aborts after its requests
 * succeeded writes nothing: `failNextTransaction` makes the next readwrite
 * transaction do that, with the given error (a QuotaExceededError, say).
 */

type Handler = ((event: Event) => void) | null;

class FakeRequest<T = unknown> {
  result: T | undefined;
  error: DOMException | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
  onupgradeneeded: Handler = null;
}

interface Store {
  keyPath: string;
  rows: Map<unknown, unknown>;
}

const later = (callback: () => void) => setTimeout(callback, 0);

export interface FakeIndexedDB {
  factory: IDBFactory;
  /** The next readwrite transaction aborts after its requests succeeded. */
  failNextTransaction: (error: DOMException) => void;
  /** The next `open` fails with this error, as a blocked storage does. */
  failNextOpen: (error: DOMException) => void;
  rows: (store: string) => unknown[];
}

export const createFakeIndexedDB = (): FakeIndexedDB => {
  const stores = new Map<string, Store>();
  let version = 0;
  let nextAbort: DOMException | undefined;
  let nextOpenError: DOMException | undefined;

  const db = {
    close: () => undefined,
    createObjectStore: (name: string, { keyPath }: { keyPath: string }) => {
      stores.set(name, { keyPath, rows: new Map() });
    },
    transaction: (name: string, mode: IDBTransactionMode) => {
      const store = stores.get(name);
      if (!store) throw new DOMException(`No store ${name}`, 'NotFoundError');
      const staged = new Map(store.rows);
      const abortWith = mode === 'readwrite' ? nextAbort : undefined;
      if (mode === 'readwrite') nextAbort = undefined;
      const transaction = {
        error: null as DOMException | null,
        objectStore: () => objectStore,
        onabort: null as Handler,
        oncomplete: null as Handler,
        onerror: null as Handler
      };
      let pending = 0;
      const finish = () => {
        if (abortWith) {
          transaction.error = abortWith;
          transaction.onabort?.(new Event('abort'));
          return;
        }
        store.rows = staged;
        transaction.oncomplete?.(new Event('complete'));
      };
      const request = <T>(work: () => T) => {
        const result = new FakeRequest<T>();
        pending++;
        later(() => {
          result.result = work();
          result.onsuccess?.(new Event('success'));
          pending--;
          if (pending === 0) later(finish);
        });
        return result;
      };
      const objectStore = {
        delete: (key: unknown) => request(() => void staged.delete(key)),
        getAll: () => request(() => [...staged.values()].map((value) => structuredClone(value))),
        put: (value: Record<string, unknown>) =>
          request(() => {
            staged.set(value[store.keyPath], structuredClone(value));
            return value[store.keyPath];
          })
      };
      return transaction;
    }
  };

  const factory = {
    open: (_name: string, wanted = 1) => {
      const request = new FakeRequest<typeof db>();
      later(() => {
        if (nextOpenError) {
          request.error = nextOpenError;
          nextOpenError = undefined;
          request.onerror?.(new Event('error'));
          return;
        }
        request.result = db;
        if (wanted > version) {
          version = wanted;
          request.onupgradeneeded?.(new Event('upgradeneeded'));
        }
        request.onsuccess?.(new Event('success'));
      });
      return request;
    }
  } as unknown as IDBFactory;

  return {
    factory,
    failNextOpen: (error) => {
      nextOpenError = error;
    },
    failNextTransaction: (error) => {
      nextAbort = error;
    },
    rows: (name) => [...(stores.get(name)?.rows.values() ?? [])]
  };
};
