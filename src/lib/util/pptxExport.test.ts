import { strFromU8, unzipSync } from 'fflate';
import { toBase64 } from 'js-base64';
import { describe, expect, it } from 'vitest';
import type { DrawioCell } from './drawioExport';
import {
  buildPptx,
  connectionSites,
  connectorShape,
  decodeDataUrl,
  EMU_PER_PX,
  labelLines,
  lineEnd,
  markerPaths,
  nearestSite,
  nearlyStraight,
  orthogonalRoute,
  pictureSources,
  PPTX_PARTS,
  presetFor,
  reachBox,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  slidePlacement
} from './pptxExport';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';

// A 1×1 PNG.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (char) => char.codePointAt(0) ?? 0
);
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>';
const ICON_URL = `data:image/svg+xml,${toBase64(ICON)}`;

const shape = (style: Record<string, number | string>) => ({
  fillColor: '#ffffff',
  html: 1,
  strokeColor: '#333333',
  strokeWidth: 1,
  ...style
});

const cells: DrawioCell[] = [
  {
    height: 40,
    id: '2',
    kind: 'vertex',
    parent: '1',
    style: shape({ fontColor: '#111111', fontFamily: 'Noto Sans JP', fontSize: 16, shape: 'rect' }),
    value: '申請 &amp; &lt;確認&gt;<br>2行目',
    width: 100,
    x: 10,
    y: 10
  },
  {
    height: 60,
    id: '3',
    kind: 'vertex',
    parent: '1',
    style: shape({ perimeter: 'rhombusPerimeter', shape: 'rhombus' }),
    value: 'OK?',
    width: 60,
    x: 200,
    y: 0
  },
  {
    height: 40,
    id: '4',
    kind: 'vertex',
    outline: [
      { c: 'M', x: 0, y: 5 },
      { c: 'C', x: 60, x1: 0, x2: 60, y: 5, y1: -2, y2: -2 },
      { c: 'L', x: 60, y: 35 },
      { c: 'C', x: 0, x1: 60, x2: 0, y: 35, y1: 42, y2: 42 },
      { c: 'Z' }
    ],
    parent: '1',
    style: shape({ shape: 'stencil(abc)' }),
    value: 'DB',
    width: 60,
    x: 10,
    y: 120
  },
  {
    height: 20,
    id: '5',
    kind: 'vertex',
    parent: '1',
    style: { '': 'text', align: 'left', fontColor: '#222222', fontSize: 20, fontStyle: 1 },
    value: 'Title',
    width: 60,
    x: 400,
    y: 200
  },
  {
    height: 20,
    id: '6',
    kind: 'vertex',
    parent: '1',
    style: { image: ICON_URL, shape: 'image', verticalLabelPosition: 'bottom' },
    value: 'Server',
    width: 20,
    x: 120,
    y: 120
  },
  {
    height: 150,
    id: '7',
    kind: 'vertex',
    parent: '1',
    style: shape({ collapsible: 0, container: 1, shape: 'rect' }),
    value: 'Group',
    width: 200,
    x: 300,
    y: 0
  },
  {
    height: 30,
    id: '8',
    kind: 'vertex',
    parent: '7',
    style: shape({ arcSize: 10, rounded: 1, shape: 'rect' }),
    value: 'Inner',
    width: 50,
    x: 20,
    y: 40
  },
  {
    height: 60,
    id: '9',
    kind: 'vertex',
    parent: '1',
    style: shape({ shape: 'rect' }),
    value: 'Class',
    width: 80,
    x: 10,
    y: 200
  },
  {
    height: 16,
    id: '10',
    kind: 'vertex',
    parent: '9',
    style: { '': 'text', align: 'left', fontSize: 14 },
    value: '+int age',
    width: 60,
    x: 4,
    y: 30
  },
  {
    id: '11',
    kind: 'edge',
    labelBox: { height: 16, width: 30, x: 140, y: 12 },
    parent: '1',
    points: [],
    source: '2',
    sourcePoint: { x: 110, y: 30 },
    style: { endArrow: 'block', endFill: 1, strokeColor: '#333333', strokeWidth: 1 },
    target: '3',
    targetPoint: { x: 200, y: 30 },
    value: 'yes'
  },
  {
    id: '12',
    kind: 'edge',
    parent: '1',
    points: [
      { x: 280, y: 30 },
      { x: 280, y: 70 }
    ],
    source: '3',
    sourcePoint: { x: 260, y: 30 },
    style: { endArrow: 'block', endFill: 1, strokeColor: '#333333', strokeWidth: 1 },
    target: '8',
    targetPoint: { x: 320, y: 70 },
    value: ''
  },
  {
    id: '13',
    kind: 'edge',
    parent: '1',
    points: [],
    source: '2',
    sourcePoint: { x: 40, y: 50 },
    style: {
      dashPattern: '3 3',
      dashed: 1,
      endArrow: 'ERzeroToMany',
      endFill: 0,
      strokeColor: '#333333',
      strokeWidth: 1
    },
    target: '4',
    targetPoint: { x: 40, y: 120 },
    value: ''
  }
];

const code = 'flowchart LR\n  A["申請 & <確認>"] --> B\n';
const file = buildPptx(
  {
    background: '#fafafa',
    cells,
    code,
    height: 260,
    pictures: new Map([[ICON_URL, { png: PNG, svg: new TextEncoder().encode(ICON) }]]),
    title: '経費精算',
    width: 520
  },
  new Date('2026-10-22T12:00:00Z')
);
const parts = unzipSync(file);

const xml = (path: string) => {
  expect(parts[path], path).toBeDefined();
  const document = new DOMParser().parseFromString(strFromU8(parts[path]), 'application/xml');
  expect(document.getElementsByTagName('parsererror'), path).toHaveLength(0);
  return document;
};
const slide = xml(PPTX_PARTS.slide);
const all = (scope: Document | Element, ns: string, name: string) => [
  ...scope.getElementsByTagNameNS(ns, name)
];
/** The shape (sp, cxnSp, pic) whose name is `name`. */
const named = (name: string) => {
  const properties = all(slide, P, 'cNvPr').find((node) => node.getAttribute('name') === name);
  expect(properties, name).toBeDefined();
  return properties?.parentElement?.parentElement as Element;
};
const idOf = (name: string) => named(name).getElementsByTagNameNS(P, 'cNvPr')[0].getAttribute('id');
const texts = (scope: Element) => all(scope, A, 't').map((node) => node.textContent);

describe('buildPptx', () => {
  it('is a ZIP whose first entry is [Content_Types].xml', () => {
    expect([...file.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Object.keys(parts)[0]).toBe('[Content_Types].xml');
  });

  it('has every part a presentation needs, each well-formed XML, and the pictures', () => {
    expect(Object.keys(parts).sort()).toEqual(
      [...Object.values(PPTX_PARTS), 'ppt/media/image1.png', 'ppt/media/image2.svg'].sort()
    );
    for (const path of Object.values(PPTX_PARTS)) xml(path);
    const types = strFromU8(parts[PPTX_PARTS.contentTypes]);
    expect(types).toContain('Extension="png" ContentType="image/png"');
    expect(types).toContain('Extension="svg" ContentType="image/svg+xml"');
    expect(types).toContain('presentationml.slide+xml');
    expect(types).toContain('presentationml.notesSlide+xml');
  });

  it('has one 16:9 slide with its notes', () => {
    const presentation = xml(PPTX_PARTS.presentation);
    const size = all(presentation, P, 'sldSz')[0];
    expect(size.getAttribute('cx')).toBe(String(SLIDE_WIDTH));
    expect(size.getAttribute('cy')).toBe(String(SLIDE_HEIGHT));
    expect(all(presentation, P, 'sldId')).toHaveLength(1);
    const rels = strFromU8(parts[PPTX_PARTS.slideRels]);
    expect(rels).toContain('../notesSlides/notesSlide1.xml');
    expect(rels).toContain('../media/image1.png');
  });

  it('keeps the Mermaid source in the notes, line by line', () => {
    const notes = xml(PPTX_PARTS.notes);
    expect(texts(notes.documentElement)).toEqual([
      'Mermaid',
      'flowchart LR',
      '  A["申請 & <確認>"] --> B'
    ]);
  });

  it('writes the title and the slide colour', () => {
    expect(strFromU8(parts[PPTX_PARTS.core])).toContain('<dc:title>経費精算</dc:title>');
    const background = all(slide, P, 'bg')[0];
    expect(all(background, A, 'srgbClr')[0].getAttribute('val')).toBe('FAFAFA');
  });

  it('makes each node a shape holding its label, a line per paragraph', () => {
    const node = named('申請 & <確認>');
    expect(node.localName).toBe('sp');
    expect(all(node, A, 'prstGeom')[0].getAttribute('prst')).toBe('rect');
    expect(texts(node)).toEqual(['申請 & <確認>', '2行目']);
    const run = all(node, A, 'rPr')[0];
    // 16 px is 12 pt.
    expect(run.getAttribute('sz')).toBe('1200');
    expect(run.getAttribute('lang')).toBe('ja-JP');
    expect(all(run, A, 'latin')[0].getAttribute('typeface')).toBe('Noto Sans JP');
    expect(all(run, A, 'ea')[0].getAttribute('typeface')).toBe('Noto Sans JP');
    expect(all(run, A, 'srgbClr')[0].getAttribute('val')).toBe('111111');
    expect(all(named('OK?'), A, 'prstGeom')[0].getAttribute('prst')).toBe('diamond');
    const rounded = all(named('Inner'), A, 'prstGeom')[0];
    expect(rounded.getAttribute('prst')).toBe('roundRect');
    // A 5 px radius on a 30 px high box.
    expect(all(rounded, A, 'gd')[0].getAttribute('fmla')).toBe('val 16667');
  });

  it('places shapes at their size, centred on the slide', () => {
    const { offsetX, offsetY, scale } = slidePlacement(520, 260);
    expect(scale).toBe(1);
    const frame = all(named('申請 & <確認>'), A, 'off')[0];
    expect(frame.getAttribute('x')).toBe(String(offsetX + 10 * EMU_PER_PX));
    expect(frame.getAttribute('y')).toBe(String(offsetY + 10 * EMU_PER_PX));
    // A child of a container is placed relative to it.
    const inner = all(named('Inner'), A, 'off')[0];
    expect(inner.getAttribute('x')).toBe(String(offsetX + 320 * EMU_PER_PX));
  });

  it('draws a custom outline as a freeform with connection sites', () => {
    const database = named('DB');
    expect(all(database, A, 'custGeom')).toHaveLength(1);
    expect(all(database, A, 'cubicBezTo')).toHaveLength(2);
    expect(all(database, A, 'cxn')).toHaveLength(4);
  });

  it('makes free text a text box', () => {
    const title = named('Title');
    expect(all(title, P, 'cNvSpPr')[0].getAttribute('txBox')).toBe('1');
    expect(all(title, A, 'pPr')[0].getAttribute('algn')).toBe('l');
    expect(all(title, A, 'rPr')[0].getAttribute('b')).toBe('1');
    expect(all(title, A, 'bodyPr')[0].getAttribute('wrap')).toBe('none');
  });

  it('groups a node with its parts; a container stays apart from what it holds', () => {
    const group = named('Class');
    expect(group.localName).toBe('grpSp');
    expect(texts(group)).toEqual(['Class', '+int age']);
    expect(named('Group').parentElement?.localName).toBe('spTree');
    expect(named('Inner').parentElement?.localName).toBe('spTree');
  });

  it('makes a picture of an icon, SVG with a PNG fallback, and its caption a text box', () => {
    const picture = all(slide, P, 'pic')[0];
    const blip = all(picture, A, 'blip')[0];
    expect(blip.getAttribute('r:embed')).toBe('rId3');
    expect(strFromU8(parts[PPTX_PARTS.slideRels])).toContain('Id="rId4"');
    expect(picture.innerHTML).toContain('svgBlip');
    expect(named('Server').localName).toBe('sp');
  });

  it('glues each link to the shapes it joins, as a connector with its arrowhead', () => {
    const connectors = all(slide, P, 'cxnSp');
    expect(connectors).toHaveLength(3);
    const [straight, elbow, dashed] = connectors;
    const glue = (connector: Element, tag: string) => all(connector, A, tag)[0]?.getAttribute('id');
    expect(glue(straight, 'stCxn')).toBe(idOf('申請 & <確認>'));
    expect(glue(straight, 'endCxn')).toBe(idOf('OK?'));
    // Leaves the rectangle on its right side (site 3) and enters the diamond on its left (1).
    expect(all(straight, A, 'stCxn')[0].getAttribute('idx')).toBe('3');
    expect(all(straight, A, 'endCxn')[0].getAttribute('idx')).toBe('1');
    expect(all(straight, A, 'prstGeom')[0].getAttribute('prst')).toBe('straightConnector1');
    expect(all(straight, A, 'tailEnd')[0].getAttribute('type')).toBe('triangle');
    expect(glue(elbow, 'endCxn')).toBe(idOf('Inner'));
    const geometry = all(elbow, A, 'prstGeom')[0];
    expect(geometry.getAttribute('prst')).toBe('bentConnector3');
    expect(all(geometry, A, 'gd')[0].getAttribute('fmla')).toBe('val 33333');
    expect(all(dashed, A, 'ds')).toHaveLength(1);
  });

  it('puts the label of a link in a text box over it', () => {
    const label = named('yes');
    expect(all(label, P, 'cNvSpPr')[0].getAttribute('txBox')).toBe('1');
  });

  it('draws arrowheads PowerPoint has no line end for as shapes', () => {
    const heads = all(slide, P, 'cNvPr').filter((node) =>
      node.getAttribute('name')?.startsWith('Arrowhead')
    );
    expect(heads).toHaveLength(2);
  });

  it('gives every object its own id', () => {
    const ids = all(slide, P, 'cNvPr').map((node) => node.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('slidePlacement', () => {
  it('keeps a small diagram at its size, centred', () => {
    const { offsetX, offsetY, scale } = slidePlacement(100, 50);
    expect(scale).toBe(1);
    expect(offsetX).toBe((SLIDE_WIDTH - 100 * EMU_PER_PX) / 2);
    expect(offsetY).toBe((SLIDE_HEIGHT - 50 * EMU_PER_PX) / 2);
  });

  it('scales a large diagram down to fit inside the margin', () => {
    const { offsetX, scale } = slidePlacement(4000, 500);
    expect(scale).toBeLessThan(1);
    expect(4000 * EMU_PER_PX * scale).toBeCloseTo(SLIDE_WIDTH - 2 * offsetX, -1);
    expect(offsetX).toBe(228_600);
  });
});

describe('pieces', () => {
  it('reads draw.io labels as lines', () => {
    expect(labelLines('a &amp;lt; b<br>c &lt;d&gt; &quot;e&quot;')).toEqual([
      'a &lt; b',
      'c <d> "e"'
    ]);
  });

  it('maps draw.io shapes to presets', () => {
    expect(presetFor({ shape: 'ellipse' }, 10, 10)?.prst).toBe('ellipse');
    expect(presetFor({ shape: 'hexagon', size: 10 }, 100, 40)).toEqual({
      adj: 25_000,
      prst: 'hexagon'
    });
    expect(presetFor({ flipH: 1, shape: 'parallelogram', size: 20 }, 100, 40)).toEqual({
      adj: 50_000,
      flipH: true,
      prst: 'parallelogram'
    });
    expect(presetFor({ flipV: 1, shape: 'trapezoid', size: 10 }, 100, 40)?.flipV).toBe(true);
    expect(presetFor({ shape: 'stencil(x)' }, 10, 10)).toBeUndefined();
    expect(presetFor({ shape: 'image' }, 10, 10)).toBeUndefined();
    expect(presetFor({ '': 'text' }, 10, 10)?.prst).toBe('rect');
  });

  it('finds the connection site nearest to a point', () => {
    const box = { height: 40, width: 100, x: 0, y: 0 };
    const sites = connectionSites({ prst: 'rect' }, 100, 40);
    expect(nearestSite(sites, box, { x: 50, y: -3 })).toBe(0);
    expect(nearestSite(sites, box, { x: 101, y: 20 })).toBe(3);
    const ellipse = connectionSites({ prst: 'ellipse' }, 100, 100);
    expect(ellipse).toHaveLength(8);
    expect(nearestSite(ellipse, { ...box, height: 100 }, { x: 90, y: 90 })).toBe(5);
    expect(connectionSites({ prst: 'hexagon', adj: 25_000 }, 100, 40)).toHaveLength(6);
  });

  it('takes the line ends PowerPoint has and draws the others', () => {
    expect(lineEnd('block', 1)).toBe('triangle');
    expect(lineEnd('block', 0)).toBe('marker');
    expect(lineEnd('open', 0)).toBe('arrow');
    expect(lineEnd('oval', 1)).toBe('oval');
    expect(lineEnd('none', 1)).toBe('none');
    expect(lineEnd(undefined, undefined)).toBe('none');
    expect(lineEnd('ERmandOne', 0)).toBe('marker');
    for (const arrow of ['block', 'diamondThin', 'ERmandOne', 'ERzeroToMany', 'cross', 'oval']) {
      expect(markerPaths(arrow, 0).length, arrow).toBeGreaterThan(0);
    }
  });

  it('reads a route as corners, taking out small jogs', () => {
    // Mermaid's route from a diamond to a cylinder, with a 4 px step after the start.
    expect(
      orthogonalRoute([
        { x: 345.83, y: 228.08 },
        { x: 391, y: 228.08 },
        { x: 391, y: 224.16 },
        { x: 715.04, y: 224.16 },
        { x: 715.04, y: 202.91 },
        { x: 755.04, y: 202.91 },
        { x: 755.04, y: 175.62 },
        { x: 805.04, y: 175.63 }
      ])
    ).toEqual([
      { x: 345.83, y: 228.08 },
      { x: 715.04, y: 228.08 },
      { x: 715.04, y: 202.91 },
      { x: 755.04, y: 202.91 },
      { x: 755.04, y: 175.63 },
      { x: 805.04, y: 175.63 }
    ]);
    expect(
      orthogonalRoute([
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ])
    ).toBeUndefined();
  });

  it('chooses the elbow connector, its rotation and flips', () => {
    const across = connectorShape([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
      { x: 100, y: 40 }
    ]);
    expect(across).toMatchObject({
      adjust: [30_000],
      box: { height: 40, width: 100, x: 0, y: 0 },
      flipH: false,
      flipV: false,
      prst: 'bentConnector3',
      rotation: 0
    });
    // Down first: the same connector turned a quarter.
    const down = connectorShape([
      { x: 209, y: 143 },
      { x: 209, y: 163 },
      { x: 91, y: 163 },
      { x: 91, y: 183 }
    ]);
    expect(down?.prst).toBe('bentConnector3');
    expect(down?.rotation === 90 || down?.rotation === 270).toBe(true);
    expect(down?.adjust).toEqual([50_000]);
    expect(
      connectorShape([
        { x: 100, y: 50 },
        { x: 0, y: 50 },
        { x: 0, y: 0 }
      ])
    ).toMatchObject({ prst: 'bentConnector2' });
    expect(
      connectorShape([
        { x: 100, y: 0 },
        { x: 0, y: 40 }
      ])
    ).toMatchObject({ flipH: true, flipV: false, prst: 'straightConnector1' });
    // A U-turn has no elbow connector.
    expect(
      connectorShape([
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 50, y: 20 },
        { x: 50, y: 0 }
      ])
    ).toBeUndefined();
  });

  it('carries a line that stops short on to the box', () => {
    const box = { height: 100, width: 100, x: 0, y: 0 };
    expect(reachBox({ x: 50, y: 140 }, { x: 50, y: 118 }, box)).toEqual({ x: 50, y: 100 });
    expect(reachBox({ x: 50, y: 140 }, { x: 50, y: 100 }, box)).toBeUndefined();
    expect(reachBox({ x: 50, y: 200 }, { x: 50, y: 160 }, box)).toBeUndefined();
    expect(reachBox({ x: 200, y: 140 }, { x: 150, y: 140 }, box)).toBeUndefined();
  });

  it('tells a nearly straight curve from a bent one', () => {
    expect(
      nearlyStraight([
        { x: 0, y: 0 },
        { x: 50, y: 1 },
        { x: 100, y: 0 }
      ])
    ).toBe(true);
    expect(
      nearlyStraight([
        { x: 0, y: 0 },
        { x: 50, y: 20 },
        { x: 100, y: 0 }
      ])
    ).toBe(false);
  });

  it('reads the pictures of image cells, and only data URLs', () => {
    expect(pictureSources(cells)).toEqual([ICON_URL]);
    expect(strFromU8(decodeDataUrl(ICON_URL)?.bytes ?? new Uint8Array())).toBe(ICON);
    expect(decodeDataUrl('data:image/svg+xml,%3Csvg%2F%3E')).toMatchObject({
      type: 'image/svg+xml'
    });
    expect(strFromU8(decodeDataUrl('data:image/svg+xml,%3Csvg%2F%3E')?.bytes ?? PNG)).toBe(
      '<svg/>'
    );
    expect(decodeDataUrl('https://example.com/a.png')).toBeUndefined();
  });
});
