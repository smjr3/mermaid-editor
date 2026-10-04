/**
 * Local: remembers an async result per diagram code. The Add and Colours cards
 * each read the same code through mermaid's parse on every change; sharing the
 * result keeps a large diagram from being parsed several times per edit.
 */
export const memoByCode = <T>(
  compute: (code: string) => Promise<T>,
  size = 8
): ((code: string) => Promise<T>) => {
  const cache = new Map<string, Promise<T>>();
  return (code) => {
    const hit = cache.get(code);
    if (hit) {
      // Most recently used goes last.
      cache.delete(code);
      cache.set(code, hit);
      return hit;
    }
    const result = compute(code);
    cache.set(code, result);
    if (cache.size > size) cache.delete(cache.keys().next().value as string);
    return result;
  };
};
