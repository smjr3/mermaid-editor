import { describe, expect, it, vi } from 'vitest';
import { memoByCode } from './memo';

describe('memoByCode', () => {
  it('computes once per code, and forgets the least recently used past its size', async () => {
    const compute = vi.fn((code: string) => Promise.resolve(code.length));
    const cached = memoByCode(compute, 2);
    expect(await cached('a')).toBe(1);
    expect(await cached('a')).toBe(1);
    expect(compute).toHaveBeenCalledTimes(1);
    await cached('bb');
    await cached('a'); // 'a' is now the most recent
    await cached('ccc'); // evicts 'bb'
    await cached('a');
    expect(compute).toHaveBeenCalledTimes(3);
    await cached('bb');
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it('shares one computation between callers asking at the same time', async () => {
    const compute = vi.fn(() => new Promise<number>((resolve) => setTimeout(() => resolve(1), 5)));
    const cached = memoByCode(compute);
    expect(await Promise.all([cached('x'), cached('x')])).toEqual([1, 1]);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
