import { beforeAll, describe, expect, it, vi } from 'vitest';

// svg-pan-zoom needs a laid-out SVG; a stand-in that reports its zoom and pan is enough
// to see what PanZoomState tells the view.
const instance = {
  destroy: vi.fn(),
  disableDblClickZoom: vi.fn(),
  enablePan: vi.fn(),
  enableZoom: vi.fn(),
  getPan: () => ({ x: 0, y: 0 }),
  getZoom: () => 1,
  pan: vi.fn(),
  reset: vi.fn(),
  resize: vi.fn(),
  zoom: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn()
};
vi.mock('svg-pan-zoom', () => ({ default: vi.fn(() => instance) }));
vi.mock('hammerjs', () => ({ default: vi.fn() }));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn();
      observe = vi.fn();
    }
  );
});

describe('PanZoomState', () => {
  it('says a zoom button or a fit is complete, so it is stored at once', async () => {
    const { PanZoomState } = await import('./panZoom');
    const state = new PanZoomState();
    state.updateElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
      pan: { x: 1, y: 2 },
      zoom: 1
    });
    const settled = vi.fn();
    state.onPanZoomSettled = settled;
    state.zoomIn();
    expect(instance.zoomIn).toHaveBeenCalled();
    expect(settled).toHaveBeenCalledTimes(1);
    state.zoomOut();
    expect(settled).toHaveBeenCalledTimes(2);
    state.reset();
    expect(settled).toHaveBeenCalledTimes(3);
  });
});
