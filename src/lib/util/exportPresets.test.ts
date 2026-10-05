import { describe, expect, it } from 'vitest';
import {
  backgroundFill,
  computeExportLayout,
  computeSvgLayout,
  isExportPreset,
  MARGIN_RATIO,
  PRESET_SIZES
} from './exportPresets';

describe('computeExportLayout', () => {
  it('as-is is the diagram times the scale, unpadded', () => {
    const l = computeExportLayout({ height: 100, width: 300 }, 'asis', 2);
    expect(l).toEqual({ draw: { height: 200, width: 600, x: 0, y: 0 }, height: 200, width: 600 });
  });

  it('PowerPoint 16:9 at 2x is 3840x2160', () => {
    const l = computeExportLayout({ height: 100, width: 100 }, 'ppt169', 2);
    expect([l.width, l.height]).toEqual([3840, 2160]);
  });

  it.each(Object.keys(PRESET_SIZES) as (keyof typeof PRESET_SIZES)[])(
    '%s keeps its ratio at every scale',
    (preset) => {
      const base = PRESET_SIZES[preset];
      for (const scale of [1, 2, 3] as const) {
        const l = computeExportLayout({ height: 50, width: 80 }, preset, scale);
        expect(l.width).toBe(base.width * scale);
        expect(l.height).toBe(base.height * scale);
      }
    }
  );

  it('the ratios are 16:9, 4:3, A4 and square', () => {
    expect(PRESET_SIZES.ppt169.width / PRESET_SIZES.ppt169.height).toBeCloseTo(16 / 9);
    expect(PRESET_SIZES.ppt43.width / PRESET_SIZES.ppt43.height).toBeCloseTo(4 / 3);
    expect(PRESET_SIZES.a4landscape.width / PRESET_SIZES.a4landscape.height).toBeCloseTo(
      Math.SQRT2,
      2
    );
    expect(PRESET_SIZES.a4portrait.height / PRESET_SIZES.a4portrait.width).toBeCloseTo(
      Math.SQRT2,
      2
    );
    expect(PRESET_SIZES.square.width).toBe(PRESET_SIZES.square.height);
  });

  it('a wide diagram in a wide canvas is limited by width and centred vertically', () => {
    const l = computeExportLayout({ height: 100, width: 400 }, 'ppt169', 1);
    const margin = 1080 * MARGIN_RATIO;
    expect(l.draw.x).toBeCloseTo(margin);
    expect(l.draw.width).toBeCloseTo(1920 - 2 * margin);
    expect(l.draw.height).toBeCloseTo(l.draw.width / 4);
    expect(l.draw.y).toBeCloseTo((1080 - l.draw.height) / 2);
  });

  it('a tall diagram in a wide canvas is limited by height and centred horizontally', () => {
    const l = computeExportLayout({ height: 400, width: 100 }, 'ppt169', 1);
    const margin = 1080 * MARGIN_RATIO;
    expect(l.draw.y).toBeCloseTo(margin);
    expect(l.draw.height).toBeCloseTo(1080 - 2 * margin);
    expect(l.draw.width).toBeCloseTo(l.draw.height / 4);
    expect(l.draw.x).toBeCloseTo((1920 - l.draw.width) / 2);
  });

  it('a wide diagram in a portrait canvas is limited by width', () => {
    const l = computeExportLayout({ height: 100, width: 400 }, 'a4portrait', 1);
    const margin = 794 * MARGIN_RATIO;
    expect(l.draw.x).toBeCloseTo(margin);
    expect(l.draw.y).toBeCloseTo((1123 - l.draw.height) / 2);
  });

  it('keeps the diagram aspect ratio and stays inside the margins', () => {
    const l = computeExportLayout({ height: 333, width: 777 }, 'ppt43', 3);
    expect(l.draw.width / l.draw.height).toBeCloseTo(777 / 333);
    expect(l.draw.x).toBeGreaterThan(0);
    expect(l.draw.x + l.draw.width).toBeLessThan(l.width);
    expect(l.draw.y + l.draw.height).toBeLessThanOrEqual(l.height);
  });

  it('upscales a small diagram to fill the canvas', () => {
    const l = computeExportLayout({ height: 10, width: 10 }, 'square', 1);
    expect(l.draw.width).toBeCloseTo(1080 * (1 - 2 * MARGIN_RATIO));
  });

  it('survives a zero-sized diagram', () => {
    const l = computeExportLayout({ height: 0, width: 0 }, 'ppt169', 1);
    expect(Number.isFinite(l.draw.width)).toBe(true);
  });
});

describe('computeSvgLayout', () => {
  it('is the 1x layout', () => {
    expect(computeSvgLayout({ height: 100, width: 100 }, 'ppt169')).toEqual(
      computeExportLayout({ height: 100, width: 100 }, 'ppt169', 1)
    );
  });
});

describe('backgroundFill', () => {
  it('transparent draws nothing, so the alpha channel stays', () => {
    expect(backgroundFill('transparent', '#123456')).toBeNull();
  });
  it('white is white whatever the theme', () => {
    expect(backgroundFill('white', '#123456')).toBe('#ffffff');
  });
  it('theme follows the site colour, falling back to white', () => {
    expect(backgroundFill('theme', ' #123456 ')).toBe('#123456');
    expect(backgroundFill('theme', '')).toBe('#ffffff');
  });
});

describe('isExportPreset', () => {
  it('rejects stored garbage', () => {
    expect(isExportPreset('ppt169')).toBe(true);
    expect(isExportPreset('x')).toBe(false);
  });
});
