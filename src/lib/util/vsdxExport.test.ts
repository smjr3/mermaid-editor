import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildVsdx, VSDX_PARTS } from './vsdxExport';

// A 1×1 PNG.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (char) => char.charCodeAt(0)
);
const code = 'flowchart LR\n  A["申請 & <確認>"] --> B\n';
const file = buildVsdx(
  { code, height: 192, png: PNG, title: '経費精算', width: 480 },
  new Date('2026-10-08T12:00:00Z')
);
const parts = unzipSync(file);
const MAIN = 'http://schemas.microsoft.com/office/visio/2012/main';

const xml = (path: string) => {
  expect(parts[path], path).toBeDefined();
  const document = new DOMParser().parseFromString(strFromU8(parts[path]), 'application/xml');
  expect(document.getElementsByTagName('parsererror'), path).toHaveLength(0);
  return document;
};
const cellValue = (scope: Element, name: string) =>
  [...scope.getElementsByTagName('Cell')]
    .find((cell) => cell.getAttribute('N') === name)
    ?.getAttribute('V');

describe('buildVsdx', () => {
  it('is a ZIP whose first entry is [Content_Types].xml', () => {
    expect([...file.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Object.keys(parts)[0]).toBe('[Content_Types].xml');
  });

  it('has every part a Visio package needs, each well-formed XML', () => {
    expect(Object.keys(parts).sort()).toEqual(Object.values(VSDX_PARTS).sort());
    for (const path of Object.values(VSDX_PARTS)) {
      if (path !== VSDX_PARTS.image) xml(path);
    }
    expect(parts[VSDX_PARTS.image]).toEqual(PNG);
  });

  it('declares the Visio content types', () => {
    const types = xml(VSDX_PARTS.contentTypes);
    const overrides = Object.fromEntries(
      [...types.getElementsByTagName('Override')].map((entry) => [
        entry.getAttribute('PartName'),
        entry.getAttribute('ContentType')
      ])
    );
    expect(overrides).toEqual({
      '/docProps/app.xml': 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
      '/docProps/core.xml': 'application/vnd.openxmlformats-package.core-properties+xml',
      '/visio/document.xml': 'application/vnd.ms-visio.drawing.main+xml',
      '/visio/pages/page1.xml': 'application/vnd.ms-visio.page+xml',
      '/visio/pages/pages.xml': 'application/vnd.ms-visio.pages+xml',
      '/visio/windows.xml': 'application/vnd.ms-visio.windows+xml'
    });
    const defaults = Object.fromEntries(
      [...types.getElementsByTagName('Default')].map((entry) => [
        entry.getAttribute('Extension'),
        entry.getAttribute('ContentType')
      ])
    );
    expect(defaults.png).toBe('image/png');
    expect(defaults.rels).toBe('application/vnd.openxmlformats-package.relationships+xml');
  });

  it('links package → document → pages → page → image, every target present', () => {
    const resolve = (from: string, target: string) => {
      const base = from.split('/').slice(0, -1);
      for (const step of target.split('/')) {
        if (step === '..') base.pop();
        else base.push(step);
      }
      return base.join('/');
    };
    const chain: [string, string, string][] = [
      [VSDX_PARTS.rels, '', 'http://schemas.microsoft.com/visio/2010/relationships/document'],
      [
        VSDX_PARTS.documentRels,
        'visio/document.xml',
        'http://schemas.microsoft.com/visio/2010/relationships/pages'
      ],
      [
        VSDX_PARTS.pagesRels,
        'visio/pages/pages.xml',
        'http://schemas.microsoft.com/visio/2010/relationships/page'
      ],
      [
        VSDX_PARTS.pageRels,
        'visio/pages/page1.xml',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
      ]
    ];
    for (const [rels, source, type] of chain) {
      const entries = [...xml(rels).getElementsByTagName('Relationship')];
      const entry = entries.find((relationship) => relationship.getAttribute('Type') === type);
      expect(entry, `${rels} ${type}`).toBeDefined();
      for (const relationship of entries) {
        const target = resolve(source || 'x', relationship.getAttribute('Target') ?? '');
        expect(parts[target], target).toBeDefined();
      }
    }
  });

  it('places one picture shape the size of the diagram on a page that fits it', () => {
    const pages = xml(VSDX_PARTS.pages);
    expect(pages.documentElement.namespaceURI).toBe(MAIN);
    const sheet = pages.getElementsByTagName('PageSheet')[0];
    // 480×192 px at 96 per inch, plus a quarter inch all round.
    expect(Number(cellValue(sheet, 'PageWidth'))).toBeCloseTo(5.5);
    expect(Number(cellValue(sheet, 'PageHeight'))).toBeCloseTo(2.5);
    expect(pages.getElementsByTagName('Rel')[0].getAttribute('r:id')).toBe('rId1');

    const page = xml(VSDX_PARTS.page);
    const shapes = page.getElementsByTagName('Shape');
    expect(shapes).toHaveLength(1);
    const shape = shapes[0];
    expect(shape.getAttribute('Type')).toBe('Foreign');
    expect(Number(cellValue(shape, 'Width'))).toBeCloseTo(5);
    expect(Number(cellValue(shape, 'Height'))).toBeCloseTo(2);
    expect(Number(cellValue(shape, 'PinX'))).toBeCloseTo(2.75);
    expect(Number(cellValue(shape, 'PinY'))).toBeCloseTo(1.25);
    const foreign = shape.getElementsByTagName('ForeignData')[0];
    expect(foreign.getAttribute('ForeignType')).toBe('Bitmap');
    expect(foreign.getAttribute('CompressionType')).toBe('PNG');
    expect(foreign.getElementsByTagName('Rel')[0].getAttribute('r:id')).toBe('rId1');
  });

  it('keeps the Mermaid source, line breaks and all, as the shape data', () => {
    const shape = xml(VSDX_PARTS.page).getElementsByTagName('Shape')[0];
    const row = [...shape.getElementsByTagName('Row')].find(
      (entry) => entry.getAttribute('N') === 'MermaidSource'
    );
    expect(row?.parentElement?.getAttribute('N')).toBe('Property');
    expect(cellValue(row as Element, 'Value')).toBe(code);
    expect(cellValue(row as Element, 'Label')).toBe('Mermaid');
  });

  it('records the title in the document properties', () => {
    const core = xml(VSDX_PARTS.core);
    expect(core.getElementsByTagName('dc:title')[0].textContent).toBe('経費精算');
    expect(core.getElementsByTagName('dcterms:created')[0].textContent).toBe(
      '2026-10-08T12:00:00Z'
    );
    const document = xml(VSDX_PARTS.document);
    expect(document.documentElement.tagName).toBe('VisioDocument');
    expect(document.getElementsByTagName('StyleSheet')[0].getAttribute('ID')).toBe('0');
  });
});
