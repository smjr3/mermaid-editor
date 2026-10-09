import { describe, expect, it } from 'vitest';
import type { DrawioCell, DrawioEdge, DrawioVertex } from './drawioExport';
import {
  boundsOf,
  type Box,
  flatten,
  IDENTITY,
  type Matrix,
  multiply,
  parsePath,
  parseTransform,
  transformBox
} from './svgPath';
import {
  markerArrow,
  type Measure,
  outlineShape,
  parseColour,
  polygonShape,
  svgToDrawio
} from './svgToDrawio';

// jsdom has no layout: a stub Measure reads geometry from the attributes and
// styles from inline style / presentation attributes, inheriting like CSS.
const INHERITED = new Set([
  'color',
  'fill',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'stroke',
  'stroke-width',
  'text-anchor'
]);
const DEFAULTS: Record<string, string> = {
  fill: '#000000',
  'font-size': '16px',
  stroke: 'none',
  'stroke-width': '1'
};

const declared = (element: Element, property: string): string | undefined => {
  const inline = (element.getAttribute('style') ?? '')
    .split(';')
    .map((part) => part.split(':').map((s) => s.trim()))
    .find(([key]) => key === property)?.[1];
  return inline ?? element.getAttribute(property) ?? undefined;
};

const stubMeasure = (svg: SVGSVGElement): Measure => {
  const own = (element: Element): Matrix => parseTransform(element.getAttribute('transform'));
  const matrix = (element: Element): Matrix => {
    let m = IDENTITY;
    for (let node: Element | null = element; node && node !== svg; node = node.parentElement) {
      m = multiply(own(node), m);
    }
    return m;
  };
  const number = (element: Element, name: string) => Number(element.getAttribute(name) ?? 0);
  const bbox = (element: Element): Box | undefined => {
    const name = element.localName.toLowerCase();
    if (name === 'rect' || name === 'foreignobject' || name === 'svg') {
      return {
        height: number(element, 'height'),
        width: number(element, 'width'),
        x: number(element, 'x'),
        y: number(element, 'y')
      };
    }
    if (name === 'circle') {
      const r = number(element, 'r');
      return {
        height: 2 * r,
        width: 2 * r,
        x: number(element, 'cx') - r,
        y: number(element, 'cy') - r
      };
    }
    if (name === 'line') {
      return boundsOf([
        { x: number(element, 'x1'), y: number(element, 'y1') },
        { x: number(element, 'x2'), y: number(element, 'y2') }
      ]);
    }
    if (name === 'polygon' || name === 'polyline') {
      const values = (element.getAttribute('points') ?? '').split(/[\s,]+/).map(Number);
      const points = [];
      for (let i = 0; i + 1 < values.length; i += 2)
        points.push({ x: values[i], y: values[i + 1] });
      return boundsOf(points);
    }
    if (name === 'path') {
      return boundsOf(flatten(parsePath(element.getAttribute('d'))).flatMap((l) => l.points));
    }
    if (name === 'text') {
      const size = Number.parseFloat(style(element, 'font-size'));
      const width = (element.textContent ?? '').length * size * 0.6;
      const anchor = style(element, 'text-anchor');
      const x =
        number(element, 'x') - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
      return { height: size, width, x, y: number(element, 'y') - size * 0.8 };
    }
    const boxes = [...element.children]
      .map((child) => {
        const box = bbox(child);
        return box ? transformBox(own(child), box) : undefined;
      })
      .filter((box): box is Box => box !== undefined);
    return boundsOf(
      boxes.flatMap((b) => [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y + b.height }
      ])
    );
  };
  const style = (element: Element, property: string): string => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const value = declared(node, property);
      if (value !== undefined) return value;
      if (!INHERITED.has(property)) break;
    }
    return DEFAULTS[property] ?? '';
  };
  return { bbox, matrix, style, text: (element) => element.textContent ?? '' };
};

const points = btoa(
  JSON.stringify([
    { x: 60, y: 100 },
    { x: 120, y: 100 },
    { x: 180, y: 100 }
  ])
);
const label = (text: string, x: number, y: number, extra = '') =>
  `<g class="label" transform="translate(${x}, ${y})"${extra}><foreignObject width="20" height="20"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel" style="color: #222222; font-size: 14px"><p>${text}</p></span></div></foreignObject></g>`;

// The structure mermaid's flowchart renderer writes, cut down.
const FLOWCHART = `<svg xmlns="http://www.w3.org/2000/svg" id="g" viewBox="0 0 400 220">
  <style>.node rect { fill: red; }</style>
  <defs><marker id="g_flowchart-v2-pointEnd"><path d="M0,0L10,5L0,10z"/></marker></defs>
  <text x="10" y="20" style="fill: #123456; font-size: 12px">Title</text>
  <g class="root">
    <g class="clusters">
      <g class="cluster" id="g-S">
        <rect x="150" y="10" width="240" height="200" style="fill: #eeeeee; stroke: #999999"/>
        ${label('Sub', 260, 12)}
      </g>
    </g>
    <g class="edgePaths">
      <path id="g-L_A_B_0" class="edge-pattern-dotted flowchart-link" d="M60,100L180,100" data-points="${points}" style="fill: none; stroke: #333333; stroke-width: 2" marker-end="url(#g_flowchart-v2-pointEnd)"/>
      <path id="g-L_B_C_0" class="edge-pattern-solid flowchart-link" d="M260,100Q275,100 275,115L275,145" style="fill: none; stroke: #333333"/>
    </g>
    <g class="edgeLabels">
      <g class="edgeLabel" transform="translate(120, 100)">${label('yes', -10, -10, ' data-id="L_A_B_0"')}</g>
    </g>
    <g class="nodes">
      <g class="node default" id="g-flowchart-A-0" transform="translate(35, 100)">
        <rect class="basic label-container" x="-25" y="-15" width="50" height="30" style="fill: #ffffff; stroke: #000000"/>
        ${label('A', -10, -10)}
      </g>
      <g class="node default" id="g-flowchart-B-1" transform="translate(220, 100)">
        <polygon points="0,-30 40,0 0,30 -40,0" style="fill: #ffffff; stroke: #000000"/>
        ${label('B', -10, -10)}
      </g>
      <g class="node default" id="g-flowchart-C-2" transform="translate(275, 165)">
        <g class="basic label-container outer-path">
          <path d="M-30,-20 L30,-20 A20,20 0 0,1 30,20 L-30,20 A20,20 0 0,1 -30,-20" stroke="none" fill="#ffffff" style="fill: #fafafa"/>
          <path d="M-30,-20 C0,-20.5 0,-19.5 30,-20 A20,20 0 0,1 30,20 L-30,20 A20,20 0 0,1 -30,-20" fill="none" style="stroke: #111111; stroke-width: 2"/>
        </g>
        ${label('C', -10, -10)}
      </g>
    </g>
  </g>
  <path d="M10,150 A30,30 0 0,1 40,180 L10,180 Z" style="fill: #ecec00; stroke: #ffffff"/>
  <line x1="10" y1="200" x2="100" y2="200" style="stroke: #000000; stroke-dasharray: 3 3" marker-end="url(#g-arrowhead)"/>
  <g transform="translate(60, 30)"><svg width="10" height="10"><rect width="10" height="10" style="fill: #0000ff"/></svg></g>
  <rect x="0" y="0" width="5" height="5" style="display: none"/>
</svg>`;

const convert = (markup: string) => {
  document.body.innerHTML = markup;
  const svg = document.querySelector('svg') as SVGSVGElement;
  return svgToDrawio(svg, stubMeasure(svg));
};

const vertices = (cells: DrawioCell[]) =>
  cells.filter((cell): cell is DrawioVertex => cell.kind === 'vertex');
const edges = (cells: DrawioCell[]) =>
  cells.filter((cell): cell is DrawioEdge => cell.kind === 'edge');
const byValue = (cells: DrawioCell[], value: string) => {
  const cell = vertices(cells).find((c) => c.value === value);
  expect(cell, value).toBeDefined();
  return cell as DrawioVertex;
};

describe('svgToDrawio', () => {
  const page = convert(FLOWCHART);
  const { cells } = page;

  it('sizes the page to the viewBox and never writes one picture of the whole diagram', () => {
    expect(page).toMatchObject({ height: 220, width: 400 });
    for (const cell of vertices(cells)) {
      if (cell.style.shape === 'image') expect(cell.width).toBeLessThan(100);
    }
    expect(vertices(cells)).toHaveLength(7);
    expect(edges(cells)).toHaveLength(3);
  });

  it('makes each node a shape of its kind with its label as the value', () => {
    const a = byValue(cells, 'A');
    expect(a.style.shape).toBe('rect');
    expect(a).toMatchObject({ height: 30, parent: '1', width: 50, x: 10, y: 85 });
    expect(a.style).toMatchObject({ fillColor: '#ffffff', fontColor: '#222222', fontSize: 14 });
    expect(byValue(cells, 'B').style).toMatchObject({
      perimeter: 'rhombusPerimeter',
      shape: 'rhombus'
    });
  });

  it('keeps a hand-drawn outline (fill and stroke copies) as one stencil shape', () => {
    const c = byValue(cells, 'C');
    expect(String(c.style.shape)).toMatch(/^stencil\(/);
    expect(c.style).toMatchObject({ fillColor: '#fafafa', strokeColor: '#111111', strokeWidth: 2 });
    expect(vertices(cells).filter((cell) => cell.parent === c.id)).toHaveLength(0);
  });

  it('makes a subgraph a container holding the nodes inside it, in its coordinates', () => {
    const sub = byValue(cells, 'Sub');
    expect(sub.style).toMatchObject({ container: 1, verticalAlign: 'top' });
    expect(sub.parent).toBe('1');
    const b = byValue(cells, 'B');
    expect(b.parent).toBe(sub.id);
    expect(b).toMatchObject({ x: 30, y: 60 });
    expect(cells.indexOf(sub)).toBeLessThan(cells.indexOf(b));
    expect(byValue(cells, 'A').parent).toBe('1');
  });

  it('connects links to their nodes, with arrowheads, dash, waypoints and label', () => {
    const a = byValue(cells, 'A');
    const b = byValue(cells, 'B');
    const c = byValue(cells, 'C');
    const ab = edges(cells).find((e) => e.value === 'yes');
    expect(ab).toMatchObject({ source: a.id, target: b.id });
    expect(ab?.style).toMatchObject({
      dashed: 1,
      endArrow: 'block',
      endFill: 1,
      startArrow: 'none',
      strokeColor: '#333333',
      strokeWidth: 2
    });
    // Straight: the middle layout point is dropped.
    expect(ab?.points).toEqual([]);
    const bc = edges(cells).find((e) => e.source === b.id && e.target === c.id);
    expect(bc?.style.rounded).toBe(1);
    expect(bc?.points.length).toBeGreaterThan(0);
  });

  it('turns free text, filled paths, lines and icons into separate cells', () => {
    const title = byValue(cells, 'Title');
    expect(title.style).toMatchObject({ '': 'text', fontColor: '#123456', fontSize: 12 });
    const slice = vertices(cells).find((cell) => cell.style.fillColor === '#ecec00');
    expect(String(slice?.style.shape)).toMatch(/^stencil\(/);
    const line = edges(cells).find((e) => !e.source && e.style.dashed === 1);
    expect(line).toMatchObject({ sourcePoint: { x: 10, y: 200 }, targetPoint: { x: 100, y: 200 } });
    expect(line?.style.endArrow).toBe('block');
    const icon = vertices(cells).find((cell) => cell.style.shape === 'image');
    expect(String(icon?.style.image)).toMatch(/^data:image\/svg\+xml,[A-Za-z0-9+/=]+$/);
    expect(icon).toMatchObject({ height: 10, width: 10, x: 60, y: 30 });
    const svg = atob(String(icon?.style.image).split(',')[1]);
    expect(svg).toContain('fill:#0000ff');
  });

  it('leaves out hidden elements and gives every cell a unique id', () => {
    expect(vertices(cells).some((cell) => cell.width === 5 && cell.x === 0)).toBe(false);
    const ids = cells.map((cell) => cell.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('0');
    expect(ids).not.toContain('1');
  });
});

describe('labels outside and inside', () => {
  it('puts a caption below an icon as its value, below the shape', () => {
    const { cells } = convert(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g class="architecture-service" id="service-db" transform="translate(10,10)">
        <rect width="40" height="40" style="fill: #087ebf"/>
        <text x="20" y="60" style="text-anchor: middle">DB</text>
      </g></svg>`);
    expect(vertices(cells)).toHaveLength(1);
    expect(vertices(cells)[0]).toMatchObject({ value: 'DB' });
    expect(vertices(cells)[0].style).toMatchObject({ verticalLabelPosition: 'bottom' });
  });

  it('labels a shape with the text centred on it (a sequence actor)', () => {
    const { cells } = convert(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <g><rect x="0" y="0" width="150" height="60" style="fill: #ffffff; stroke: #000000"/>
      <text x="75" y="36" style="text-anchor: middle"><tspan x="75">経理</tspan></text></g>
      <text x="10" y="90">loose</text></svg>`);
    expect(vertices(cells).map((cell) => cell.value)).toEqual(['経理', 'loose']);
  });

  it('keeps several lines of a text as line breaks', () => {
    const { cells } = convert(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <text x="10" y="20"><tspan class="row" x="10">a &amp; b</tspan><tspan class="row" x="10" dy="1em">&lt;c&gt;</tspan></text></svg>`);
    expect(vertices(cells)[0].value).toBe('a &amp; b<br>&lt;c&gt;');
  });
});

describe('shape and style mapping', () => {
  const box = { height: 10, width: 100, x: 0, y: 0 };
  it('recognises hexagons, parallelograms and trapezoids', () => {
    expect(
      polygonShape(
        [
          { x: 20, y: 0 },
          { x: 80, y: 0 },
          { x: 100, y: 5 },
          { x: 80, y: 10 },
          { x: 20, y: 10 },
          { x: 0, y: 5 }
        ],
        box
      )
    ).toMatchObject({ shape: 'hexagon', size: 20 });
    expect(
      polygonShape(
        [
          { x: 0, y: 10 },
          { x: 90, y: 10 },
          { x: 100, y: 0 },
          { x: 10, y: 0 }
        ],
        box
      )
    ).toEqual(expect.objectContaining({ shape: 'parallelogram', size: 10 }));
    const wideTop = polygonShape(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 90, y: 10 },
        { x: 10, y: 10 }
      ],
      box
    );
    expect(wideTop).toMatchObject({ flipV: 1, shape: 'trapezoid' });
    expect(
      polygonShape(
        [
          { x: 0, y: 0 },
          { x: 50, y: 3 },
          { x: 100, y: 0 },
          { x: 60, y: 10 },
          { x: 30, y: 8 }
        ],
        box
      )
    ).toBeUndefined();
  });

  it('recognises sampled rectangles and ellipses', () => {
    const square = { height: 10, width: 10, x: 0, y: 0 };
    const circle = Array.from({ length: 24 }, (_, i) => ({
      x: 5 + 5 * Math.cos((i * Math.PI) / 12),
      y: 5 + 5 * Math.sin((i * Math.PI) / 12)
    }));
    expect(outlineShape(circle, square)).toMatchObject({ shape: 'ellipse' });
    expect(
      outlineShape(
        [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        square
      )
    ).toEqual({ shape: 'rect' });
  });

  it('maps arrowheads and colours', () => {
    expect(markerArrow('url(#g_er-onlyOneStart)')).toEqual({ arrow: 'ERmandOne', fill: 0 });
    expect(markerArrow('url(#x_classDiagram-compositionStart)')).toEqual({
      arrow: 'diamondThin',
      fill: 1
    });
    expect(markerArrow('url(#x_classDiagram-extensionStart)')).toEqual({ arrow: 'block', fill: 0 });
    expect(markerArrow('none')).toBeUndefined();
    expect(parseColour('rgb(253, 244, 255)')).toEqual({ alpha: 1, colour: '#fdf4ff' });
    expect(parseColour('rgba(0, 0, 0, 0.5)')).toEqual({ alpha: 0.5, colour: '#000000' });
    expect(parseColour('rgba(0, 0, 0, 0)').colour).toBe('none');
    expect(parseColour('#abc')).toEqual({ alpha: 1, colour: '#aabbcc' });
    expect(parseColour('white').colour).toBe('#ffffff');
  });
});
