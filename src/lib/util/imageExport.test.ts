// Local (R10): the PNG export / image copy pipeline settles only when it is done.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasToBlob, copyImageBlob, createPanZoomPause, loadImage } from './imageExport';

// jsdom loads no images; this one fires what the test tells it to.
class FakeImage extends EventTarget {
  static next: 'error' | 'load' | 'never' = 'load';
  set src(_value: string) {
    const outcome = FakeImage.next;
    if (outcome !== 'never') setTimeout(() => this.dispatchEvent(new Event(outcome)), 0);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loadImage', () => {
  it('resolves once the image has loaded', async () => {
    vi.stubGlobal('Image', FakeImage);
    FakeImage.next = 'load';
    await expect(loadImage('data:image/svg+xml;base64,')).resolves.toBeInstanceOf(FakeImage);
  });

  it('rejects when the image cannot be drawn', async () => {
    vi.stubGlobal('Image', FakeImage);
    FakeImage.next = 'error';
    await expect(loadImage('data:')).rejects.toThrow(/could not be drawn/);
  });

  it('rejects when the image neither loads nor fails in time', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', FakeImage);
    FakeImage.next = 'never';
    const loading = loadImage('data:', 5000);
    const settled = expect(loading).rejects.toThrow(/did not load/);
    await vi.advanceTimersByTimeAsync(5000);
    await settled;
  });
});

describe('canvasToBlob', () => {
  it('resolves with the blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const canvas = { toBlob: (done: (b: Blob | null) => void) => done(blob) };
    await expect(canvasToBlob(canvas as unknown as HTMLCanvasElement)).resolves.toBe(blob);
  });

  it('rejects when the canvas gives no blob', async () => {
    const canvas = { toBlob: (done: (b: Blob | null) => void) => done(null) };
    await expect(canvasToBlob(canvas as unknown as HTMLCanvasElement)).rejects.toThrow(/empty/);
  });
});

describe('copyImageBlob', () => {
  const blob = new Blob(['x'], { type: 'image/png' });

  it('settles after the clipboard write', async () => {
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(readonly items: Record<string, Blob>) {}
      }
    );
    let finish: () => void = () => undefined;
    const write = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    let done = false;
    const copying = copyImageBlob(blob, { write } as unknown as Clipboard).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    expect(done).toBe(false);
    finish();
    await copying;
    expect(done).toBe(true);
  });

  it('passes a refused write on to the caller', async () => {
    vi.stubGlobal('ClipboardItem', vi.fn());
    const write = vi.fn(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    await expect(copyImageBlob(blob, { write } as unknown as Clipboard)).rejects.toMatchObject({
      name: 'NotAllowedError'
    });
  });

  it('rejects where the browser has no image clipboard', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(copyImageBlob(blob, {} as Clipboard)).rejects.toThrow(/clipboard/i);
  });
});

describe('createPanZoomPause', () => {
  const setup = (initial: boolean | undefined) => {
    let value = initial;
    const set = vi.fn((next: boolean) => {
      value = next;
    });
    return { pause: createPanZoomPause(() => value, set), set, value: () => value };
  };

  it('turns pan/zoom off for the work and back to what it was afterwards', async () => {
    const { pause, set, value } = setup(true);
    await pause(async () => {
      expect(value()).toBe(false);
      return 1;
    });
    expect(set.mock.calls).toEqual([[false], [true]]);
  });

  it('restores pan/zoom when the work fails before or after the image', async () => {
    const { pause, value } = setup(true);
    await expect(pause(() => Promise.reject(new Error('svg not found')))).rejects.toThrow(
      'svg not found'
    );
    expect(value()).toBe(true);
  });

  it('leaves pan/zoom off when it was off before', async () => {
    const { pause, value } = setup(false);
    await pause(() => Promise.resolve());
    expect(value()).toBe(false);
  });

  it('restores the value from before the first of two overlapping captures', async () => {
    const { pause, value } = setup(true);
    let finishFirst: () => void = () => undefined;
    const first = pause(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    const second = pause(() => Promise.resolve());
    await second;
    expect(value()).toBe(false);
    finishFirst();
    await first;
    expect(value()).toBe(true);
  });
});
