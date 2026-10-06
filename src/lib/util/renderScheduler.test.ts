import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLatestGuard, createRenderScheduler, createSettler } from './renderScheduler';

/** A render that finishes when the test says so. */
const controlledRender = () => {
  const calls: { value: string; token: number; finish: () => void }[] = [];
  const render = vi.fn(
    (value: string, token: number) =>
      new Promise<void>((resolve) => calls.push({ finish: resolve, token, value }))
  );
  return { calls, render };
};

describe('createRenderScheduler', () => {
  let clock = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a burst of typed changes once, with the last value', async () => {
    const { calls, render } = controlledRender();
    const scheduler = createRenderScheduler({ now: () => clock, render });
    for (const value of 'abcdefghijklmnopqrst') {
      scheduler.schedule(value);
      await vi.advanceTimersByTimeAsync(40);
    }
    expect(render).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.map(({ value }) => value)).toEqual(['t']);
  });

  it('renders straight away when asked to', async () => {
    const { calls, render } = controlledRender();
    const scheduler = createRenderScheduler({ render });
    scheduler.schedule('a', { immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map(({ value }) => value)).toEqual(['a']);
  });

  it('never overlaps renders and skips what was superseded while one ran', async () => {
    const { calls, render } = controlledRender();
    const scheduler = createRenderScheduler({ render });
    scheduler.schedule('a', { immediate: true });
    scheduler.schedule('b', { immediate: true });
    scheduler.schedule('c', { immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map(({ value }) => value)).toEqual(['a']);
    calls[0].finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map(({ value }) => value)).toEqual(['a', 'c']);
  });

  it('waits longer after a slow render, but never more than the maximum', async () => {
    const { calls, render } = controlledRender();
    const scheduler = createRenderScheduler({ now: () => clock, render });
    expect(scheduler.delay).toBe(100);
    scheduler.schedule('a', { immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    clock = 2000;
    calls[0].finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.delay).toBe(300);
  });

  it('does not let an older render overwrite a newer picture', () => {
    const scheduler = createRenderScheduler({ render: () => Promise.resolve() });
    // Token 2 was placed first; token 1 finishing afterwards must not be placed.
    expect(scheduler.isNewer(2)).toBe(true);
    expect(scheduler.isNewer(1)).toBe(false);
    expect(scheduler.isNewer(3)).toBe(true);
  });

  it('settles idle() only once everything waiting has been drawn', async () => {
    const { calls, render } = controlledRender();
    const scheduler = createRenderScheduler({ render });
    let idle = false;
    scheduler.schedule('a');
    void scheduler.idle().then(() => (idle = true));
    await vi.advanceTimersByTimeAsync(200);
    expect(idle).toBe(false);
    scheduler.schedule('b', { immediate: true });
    calls[0].finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(idle).toBe(false);
    calls[1].finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(idle).toBe(true);
    await expect(scheduler.idle()).resolves.toBeUndefined();
  });

  it('keeps going after a render fails', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const scheduler = createRenderScheduler<string>({ render });
    scheduler.schedule('a', { immediate: true });
    scheduler.schedule('b', { immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(render.mock.calls.map(([value]) => value as string)).toEqual(['a', 'b']);
  });
});

describe('createLatestGuard', () => {
  it('accepts only the newest ticket', () => {
    const guard = createLatestGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });
});

describe('createSettler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes typed code on once typing pauses, and only the last of a burst', async () => {
    const publish = vi.fn();
    const settle = createSettler(publish, 250);
    settle({ code: 'a', error: undefined });
    expect(publish).toHaveBeenCalledTimes(1);
    for (const code of ['ab', 'abc', 'abcd']) {
      settle({ code, error: undefined });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(publish).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith({ code: 'abcd', error: undefined });
  });

  it("passes a button's edit on at once", () => {
    const publish = vi.fn();
    const settle = createSettler(publish, 250);
    settle({ code: 'a', error: undefined });
    settle({ code: 'b', error: undefined, updateDiagram: true });
    expect(publish).toHaveBeenLastCalledWith({ code: 'b', error: undefined });
  });

  it('ignores states with the same code and error (pan, zoom, editor mode)', async () => {
    const publish = vi.fn();
    const settle = createSettler(publish, 250);
    settle({ code: 'a', error: new Error('x') });
    settle({ code: 'a', error: new Error('x') });
    expect(publish).toHaveBeenCalledTimes(1);
    // A pending typed change survives a pan that repeats it.
    settle({ code: 'ab', error: undefined });
    settle({ code: 'ab', error: undefined });
    await vi.advanceTimersByTimeAsync(250);
    expect(publish).toHaveBeenLastCalledWith({ code: 'ab', error: undefined });
  });
});
