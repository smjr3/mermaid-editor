import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AutoSync = typeof import('./autoSync');

const settled = async (promise: Promise<void>): Promise<boolean> => {
  let done = false;
  void promise.then(() => (done = true));
  await vi.advanceTimersByTimeAsync(0);
  return done;
};

describe('autoSync', () => {
  let autoSync: AutoSync;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    autoSync = await import('./autoSync');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('releases waitForRender when the deferred render turns out to be unnecessary', async () => {
    const updater = vi.fn();
    autoSync.shouldRefreshView();
    // A slow render puts the view into deferred mode.
    autoSync.recordRenderTime(500, updater);

    // The next state change is deferred, leaving a render pending.
    expect(autoSync.shouldRefreshView()).toBe(false);
    const pending = autoSync.waitForRender();
    expect(await settled(pending)).toBe(false);

    // The state then settles back to what is already on screen.
    autoSync.markViewCurrent();
    expect(await settled(pending)).toBe(true);
    expect(await settled(autoSync.waitForRender())).toBe(true);
  });

  it('keeps waiting while a render is still due', async () => {
    autoSync.shouldRefreshView();
    autoSync.recordRenderTime(500, vi.fn());
    autoSync.shouldRefreshView();
    expect(await settled(autoSync.waitForRender())).toBe(false);
  });
});
