import { describe, expect, it } from 'vitest';
import {
  backgroundFill,
  computeExportLayout,
  DEFAULT_BACKGROUND,
  DEFAULT_SCALE,
  EXPORT_BACKGROUNDS,
  EXPORT_FORMATS,
  EXPORT_SCALES,
  exportBackdrop,
  exportFileName,
  fixForeignObjectClipping,
  formatExtension,
  formatUsesBackground,
  formatUsesScale,
  isCopyOnly,
  isExportBackground,
  isExportFormat,
  isExportScale,
  isHtmlMode,
  previewSvg,
  serializeSvg
} from './exportDiagram';

const NS = 'http://www.w3.org/2000/svg';

describe('options', () => {
  it('offers the three backgrounds, the three scales and seven formats in order', () => {
    expect(EXPORT_BACKGROUNDS).toEqual(['white', 'transparent', 'theme']);
    expect(EXPORT_SCALES).toEqual([1, 2, 3]);
    expect(EXPORT_FORMATS).toEqual(['png', 'svg', 'drawio', 'vsdx', 'html', 'md', 'copy']);
  });

  it('starts a new user on a transparent background at 2x', () => {
    expect(DEFAULT_BACKGROUND).toBe('transparent');
    expect(DEFAULT_SCALE).toBe(2);
  });

  it('accepts only the known values from storage', () => {
    expect(isExportBackground('white')).toBe(true);
    expect(isExportBackground('black')).toBe(false);
    expect(isExportScale(3)).toBe(true);
    expect(isExportScale(4)).toBe(false);
    expect(isExportScale('2')).toBe(false);
    expect(isExportFormat('vsdx')).toBe(true);
    expect(isExportFormat('pdf')).toBe(false);
    expect(isHtmlMode('tag')).toBe(true);
    expect(isHtmlMode('page')).toBe(false);
  });

  it('shows the scale for PNG and the copy, the background for PNG, SVG, copy and Markdown', () => {
    expect(EXPORT_FORMATS.filter(formatUsesScale)).toEqual(['png', 'copy']);
    expect(EXPORT_FORMATS.filter(formatUsesBackground)).toEqual(['png', 'svg', 'md', 'copy']);
  });

  it('copies for the image copy and the HTML tag, saves a file otherwise', () => {
    expect(isCopyOnly('copy', 'file')).toBe(true);
    expect(isCopyOnly('html', 'tag')).toBe(true);
    expect(isCopyOnly('html', 'file')).toBe(false);
    expect(isCopyOnly('png', 'tag')).toBe(false);
  });

  it('names each file with its extension; Markdown saves an SVG', () => {
    const file = 'file' as const;
    expect(EXPORT_FORMATS.map((format) => formatExtension(format, file))).toEqual([
      'png',
      'svg',
      'drawio',
      'vsdx',
      'html',
      'svg',
      undefined
    ]);
    expect(formatExtension('html', 'tag')).toBeUndefined();
  });
});

describe('exportFileName', () => {
  const titled = '---\ntitle: "経費精算フロー"\n---\nflowchart LR\n  A --> B';

  it('uses what was typed, made safe, with the extension', () => {
    expect(exportFileName('月次 報告', titled, 'png')).toBe('月次 報告.png');
    expect(exportFileName('a/b:c', titled, 'svg')).toBe('a b c.svg');
    expect(exportFileName('report.drawio', titled, 'drawio')).toBe('report.drawio');
  });

  it('falls back to the title, then to "diagram", when nothing usable was typed', () => {
    expect(exportFileName('  ', titled, 'png')).toBe('経費精算フロー.png');
    expect(exportFileName('...', 'flowchart LR\n  A', 'vsdx')).toBe('diagram.vsdx');
  });
});

describe('backgrounds', () => {
  it('fills white, nothing for transparent, or the theme colour (white without one)', () => {
    expect(backgroundFill('white', '#123')).toBe('#ffffff');
    expect(backgroundFill('transparent', '#123')).toBeNull();
    expect(backgroundFill('theme', ' #123456 ')).toBe('#123456');
    expect(backgroundFill('theme', '  ')).toBe('#ffffff');
  });

  it("puts a theme preset's own background in place of white or the theme colour", () => {
    expect(exportBackdrop('white', '#123', '#0b1020')).toBe('#0b1020');
    expect(exportBackdrop('theme', '#123', '#0b1020')).toBe('#0b1020');
    // Transparent overrides the background the preset paints on the SVG itself.
    expect(exportBackdrop('transparent', '#123', '#0b1020')).toBe('transparent');
    expect(exportBackdrop('transparent', '#123', undefined)).toBeNull();
    expect(exportBackdrop('theme', '#123', undefined)).toBe('#123');
  });
});

describe('computeExportLayout', () => {
  it('is the diagram times the scale, unpadded and rounded', () => {
    expect(computeExportLayout({ height: 100, width: 300 }, 2)).toEqual({
      draw: { height: 200, width: 600, x: 0, y: 0 },
      height: 200,
      width: 600
    });
    expect(computeExportLayout({ height: 10.4, width: 20.6 }, 3)).toMatchObject({
      height: 31,
      width: 62
    });
  });

  it('never makes an empty canvas', () => {
    expect(computeExportLayout({ height: 0, width: 0 }, 1)).toMatchObject({ height: 1, width: 1 });
  });
});

const makeSvg = (inner = '') => {
  const holder = document.createElement('div');
  holder.innerHTML = `<svg xmlns="${NS}" id="m" viewBox="0 0 40 20" width="100%" style="max-width: 40px;">${inner}</svg>`;
  return holder.querySelector('svg') as SVGSVGElement;
};

describe('serializeSvg', () => {
  it('writes well-formed XML with the backdrop and the size, leaving the view alone', () => {
    const svg = makeSvg('<g><text>a&nbsp;b</text></g>');
    const text = serializeSvg(svg, { fill: '#ffffff', height: 40, offline: true, width: 80 });
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(text).not.toContain('xml-stylesheet');
    expect(text).toContain('background-color: rgb(255, 255, 255)');
    expect(text).toContain('width="80px"');
    expect(text).toContain('height="40px"');
    expect(
      new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror')
    ).toBe(null);
    // The diagram on screen is not changed.
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.style.backgroundColor).toBe('');
  });

  it('has no backdrop for null, and links the icon stylesheet when online', () => {
    const text = serializeSvg(makeSvg(), { fill: null, offline: false });
    expect(text).not.toContain('background-color');
    expect(text).toMatch(/<\?xml-stylesheet href="https:\/\/cdnjs[^"]+font-awesome[^"]+"/);
  });

  it('gives hand-drawn text room so it is not cut off', () => {
    const svg = makeSvg(
      '<foreignObject y="10" height="20"><div xmlns="http://www.w3.org/1999/xhtml"><span>x</span></div></foreignObject>'
    );
    const text = serializeSvg(svg, { fill: null, offline: true, rough: true });
    expect(text).toContain('height="30"');
    expect(text).toContain('y="5"');
    expect(svg.querySelector('foreignObject')?.getAttribute('height')).toBe('20');
  });
});

describe('fixForeignObjectClipping', () => {
  it('grows each label box by half around its centre and centres its text', () => {
    const svg = makeSvg(
      '<foreignObject y="0" height="10"><div xmlns="http://www.w3.org/1999/xhtml">a</div></foreignObject><foreignObject height="0"></foreignObject>'
    );
    fixForeignObjectClipping(svg);
    const [grown, empty] = svg.querySelectorAll('foreignObject');
    expect(grown.getAttribute('height')).toBe('15');
    expect(grown.getAttribute('y')).toBe('-2.5');
    expect((grown.querySelector('div') as HTMLElement).style.alignItems).toBe('center');
    expect(empty.getAttribute('height')).toBe('0');
  });
});

describe('previewSvg', () => {
  it('is undefined without a diagram', () => {
    document.body.innerHTML = '';
    expect(previewSvg()).toBeUndefined();
  });

  it('copies the diagram without the pan/zoom transform or a fixed size', () => {
    document.body.innerHTML = `<div id="container"><svg xmlns="${NS}" width="500" height="300"><g class="svg-pan-zoom_viewport" transform="matrix(2,0,0,2,10,10)" style="transform: matrix(2,0,0,2,10,10)"><rect width="10" height="10"/></g></svg></div>`;
    const copy = previewSvg();
    expect(copy).toBeDefined();
    expect(copy?.getAttribute('width')).toBeNull();
    expect(copy?.getAttribute('height')).toBeNull();
    const viewport = copy?.querySelector('.svg-pan-zoom_viewport');
    expect(viewport?.getAttribute('transform')).toBeNull();
    expect(viewport?.getAttribute('style')).toBeNull();
    // The view itself keeps its pan/zoom.
    expect(
      document.querySelector('#container .svg-pan-zoom_viewport')?.getAttribute('transform')
    ).toBe('matrix(2,0,0,2,10,10)');
    document.body.innerHTML = '';
  });

  it('sizes a diagram with a viewBox (pan/zoom off) at its natural size', () => {
    document.body.innerHTML = `<div id="container"><svg xmlns="${NS}" viewBox="0 0 120 40" width="100%"><rect width="10" height="10"/></svg></div>`;
    const copy = previewSvg();
    expect(copy?.getAttribute('width')).toBe('120');
    expect(copy?.getAttribute('height')).toBe('40');
    expect(copy?.style.maxWidth).toBe('100%');
    document.body.innerHTML = '';
  });
});
