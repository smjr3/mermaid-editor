/**
 * Local: the rendered Mermaid SVG as native draw.io cells, for the .drawio file
 * (drawioExport.ts, docs-dev/EXPORTS.md). Every visible element becomes its own
 * cell, so each can be selected, moved and edited in draw.io:
 *
 * - a node (`g.node`, architecture services) is a vertex: its outline as a
 *   draw.io shape (rectangle, rounded rectangle, ellipse, rhombus, hexagon,
 *   parallelogram, trapezoid; any other outline as a custom stencil shape with
 *   the same path), its label as the value; extra parts (class members, ER
 *   attributes, dividers, icons) are cells inside it;
 * - a subgraph, composite state, swimlane lane or architecture group is a
 *   container (`container=1`) holding the cells that lie inside it;
 * - a link is an edge with source and target when its ends can be matched to
 *   nodes (by the ids mermaid writes, else by the nearest shape), its route as
 *   waypoints, its arrowheads, dash and label;
 * - everything else (titles, notes, messages, axes, slices, legends) is walked
 *   element by element: shapes become shape cells, lines and open paths
 *   become edges, text becomes text cells, and what has no draw.io equivalent
 *   (icons, pictures) becomes an SVG image cell of just that element.
 *
 * Geometry and styles come from the live DOM (getBBox, getScreenCTM,
 * getComputedStyle) through `Measure`, so the cells match what is on screen.
 */
import { toBase64 } from 'js-base64';
import { type DrawioCell, type DrawioStyle, htmlLabel, LAYER, stencilShape } from './drawioExport';
import {
  apply,
  boundsOf,
  type Box,
  flatten,
  IDENTITY,
  type Matrix,
  midpoint,
  parsePath,
  type Point,
  rotationOf,
  scaleOf,
  type Segment,
  simplify,
  transformBox,
  transformSegments
} from './svgPath';

/** Where geometry and computed styles come from (the browser, or a stub in tests). */
export interface Measure {
  /** The element's box in its own user space (getBBox). */
  bbox(element: Element): Box | undefined;
  /** From the element's user space to the root SVG's user space. */
  matrix(element: Element): Matrix;
  /** A computed CSS property value. */
  style(element: Element, property: string): string;
  /** The rendered text of an HTML element, with its line breaks (innerText). */
  text(element: Element): string;
}

export interface DrawioPage {
  cells: DrawioCell[];
  height: number;
  width: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SKIPPED = new Set([
  'clippath',
  'defs',
  'desc',
  'filter',
  'lineargradient',
  'marker',
  'mask',
  'metadata',
  'pattern',
  'radialgradient',
  'script',
  'style',
  'symbol',
  'title'
]);
const SHAPES = new Set(['circle', 'ellipse', 'path', 'polygon', 'polyline', 'rect', 'line']);

interface Font {
  fontColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: number;
}

interface VertexItem {
  box: Box;
  children: Item[];
  /** Mermaid ids this node answers to, for matching edge ends. */
  keys: string[];
  kind: 'vertex';
  role: 'cluster' | 'image' | 'node' | 'shape' | 'text';
  /** Degrees, for text drawn rotated. */
  rotation?: number;
  style: DrawioStyle;
  /** Label font, for moving a text's look onto the shape it labels. */
  textStyle?: DrawioStyle;
  value: string;
}

interface EdgeItem {
  connector: boolean;
  key?: string;
  kind: 'edge';
  labelAt?: Point;
  /** Absolute route: start, waypoints, end. */
  points: Point[];
  source?: VertexItem;
  style: DrawioStyle;
  target?: VertexItem;
  value: string;
}

type Item = EdgeItem | VertexItem;

interface Paint {
  dash?: number[];
  fill: string;
  fillOpacity: number;
  opacity: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
}

interface PendingLabel {
  box: Box;
  key?: string;
  text: VertexItem;
}

const round = (value: number) => Math.round(value * 100) / 100;
const area = (box: Box) => box.width * box.height;
const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const tag = (element: Element) => element.localName.toLowerCase();
const classes = (element: Element) => (element.getAttribute('class') ?? '').split(/\s+/);
const hasClass = (element: Element, name: string) => classes(element).includes(name);
const inside = (inner: Box, outer: Box, tolerance = 1) =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance;
const containsPoint = (box: Box, p: Point, tolerance = 0) =>
  p.x >= box.x - tolerance &&
  p.x <= box.x + box.width + tolerance &&
  p.y >= box.y - tolerance &&
  p.y <= box.y + box.height + tolerance;
const distanceToBox = (box: Box, p: Point) =>
  Math.hypot(
    Math.max(box.x - p.x, 0, p.x - box.x - box.width),
    Math.max(box.y - p.y, 0, p.y - box.y - box.height)
  );
const distanceToBorder = (box: Box, p: Point) =>
  containsPoint(box, p)
    ? Math.min(p.x - box.x, box.x + box.width - p.x, p.y - box.y, box.y + box.height - p.y)
    : distanceToBox(box, p);

const NAMED_COLOURS: Record<string, string> = {
  black: '#000000',
  blue: '#0000ff',
  gray: '#808080',
  green: '#008000',
  grey: '#808080',
  red: '#ff0000',
  white: '#ffffff',
  yellow: '#ffff00'
};

/** A CSS colour as draw.io takes it: `#rrggbb` plus alpha 0–1, or `none`. */
export const parseColour = (value: string | undefined): { alpha: number; colour: string } => {
  const text = (value ?? '').trim().toLowerCase();
  if (!text || text === 'none' || text === 'transparent') return { alpha: 0, colour: 'none' };
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const channel = (part: string) =>
      part.endsWith('%') ? (Number.parseFloat(part) * 255) / 100 : Number.parseFloat(part);
    const alphaPart = parts[3];
    const alpha =
      alphaPart === undefined
        ? 1
        : alphaPart.endsWith('%')
          ? Number.parseFloat(alphaPart) / 100
          : Number.parseFloat(alphaPart);
    if (alpha === 0) return { alpha: 0, colour: 'none' };
    return {
      alpha: Number.isNaN(alpha) ? 1 : alpha,
      colour: `#${hex(channel(parts[0]))}${hex(channel(parts[1]))}${hex(channel(parts[2]))}`
    };
  }
  const short = /^#([\da-f])([\da-f])([\da-f])([\da-f])?$/.exec(text);
  if (short) {
    const alpha = short[4] ? Number.parseInt(short[4] + short[4], 16) / 255 : 1;
    return {
      alpha,
      colour: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
    };
  }
  const long = /^#([\da-f]{6})([\da-f]{2})?$/.exec(text);
  if (long) {
    return { alpha: long[2] ? Number.parseInt(long[2], 16) / 255 : 1, colour: `#${long[1]}` };
  }
  return { alpha: 1, colour: NAMED_COLOURS[text] ?? text };
};

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isNaN(parsed) ? fallback : parsed;
};

/** Mermaid's arrowheads (marker ids) as draw.io arrows. */
export const markerArrow = (reference: string): { arrow: string; fill: number } | undefined => {
  // `onlyOneStart`, `ONLY_ONE_START`…: compared without case or separators.
  const id = reference.toLowerCase().replaceAll(/[_-]/g, '');
  if (!id || id === 'none') return undefined;
  if (id.includes('zeroorone')) return { arrow: 'ERzeroToOne', fill: 0 };
  if (id.includes('onlyone')) return { arrow: 'ERmandOne', fill: 0 };
  if (id.includes('zeroormore')) return { arrow: 'ERzeroToMany', fill: 0 };
  if (id.includes('oneormore')) return { arrow: 'ERoneToMany', fill: 0 };
  if (id.includes('composition')) return { arrow: 'diamondThin', fill: 1 };
  if (id.includes('aggregation')) return { arrow: 'diamondThin', fill: 0 };
  if (id.includes('extension')) return { arrow: 'block', fill: 0 };
  if (id.includes('lollipop')) return { arrow: 'oval', fill: 0 };
  if (id.includes('cross')) return { arrow: 'cross', fill: 0 };
  if (id.includes('circle') || id.includes('sequencenumber')) return { arrow: 'oval', fill: 1 };
  if (id.includes('open') || id.includes('stick')) return { arrow: 'open', fill: 0 };
  return { arrow: 'block', fill: 1 };
};

const percent = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);

/** The style keys of a paint: fill, stroke, width, dash, opacity. */
const paintStyle = (paint: Paint, { line = false } = {}): DrawioStyle => {
  const style: DrawioStyle = {};
  if (!line) style.fillColor = paint.fill;
  style.strokeColor = paint.strokeWidth > 0 ? paint.stroke : 'none';
  if (paint.strokeWidth > 0 && paint.stroke !== 'none') style.strokeWidth = paint.strokeWidth;
  if (!line && paint.fill !== 'none' && paint.fillOpacity < 1) {
    style.fillOpacity = percent(paint.fillOpacity);
  }
  if (paint.stroke !== 'none' && paint.strokeOpacity < 1) {
    style.strokeOpacity = percent(paint.strokeOpacity);
  }
  if (paint.opacity < 1) style.opacity = percent(paint.opacity);
  if (paint.dash && paint.strokeWidth > 0) {
    style.dashed = 1;
    style.dashPattern = paint.dash.map((v) => round(v / paint.strokeWidth)).join(' ');
  }
  return style;
};

// draw.io HTML labels; text cells are not wrapped (draw.io's fonts differ a little).
const TEXT_BASE: DrawioStyle = {
  '': 'text',
  fillColor: 'none',
  html: 1,
  spacing: 0,
  strokeColor: 'none',
  whiteSpace: 'nowrap'
};

const stencilXml = (segments: Segment[], box: Box, fill: boolean): string => {
  const w = Math.max(box.width, 1);
  const h = Math.max(box.height, 1);
  const x = (value: number) => round(value - box.x);
  const y = (value: number) => round(value - box.y);
  const commands = segments.map((segment) => {
    if (segment.c === 'Z') return '<close/>';
    if (segment.c === 'M') return `<move x="${x(segment.x)}" y="${y(segment.y)}"/>`;
    if (segment.c === 'L') return `<line x="${x(segment.x)}" y="${y(segment.y)}"/>`;
    if (segment.c === 'Q') {
      return `<quad x1="${x(segment.x1)}" y1="${y(segment.y1)}" x2="${x(segment.x)}" y2="${y(segment.y)}"/>`;
    }
    return `<curve x1="${x(segment.x1)}" y1="${y(segment.y1)}" x2="${x(segment.x2)}" y2="${y(segment.y2)}" x3="${x(segment.x)}" y3="${y(segment.y)}"/>`;
  });
  return `<shape w="${round(w)}" h="${round(h)}" aspect="variable" strokewidth="inherit"><connections/><background><path>${commands.join('')}</path></background><foreground>${fill ? '<fillstroke/>' : '<stroke/>'}</foreground></shape>`;
};

/** The draw.io shape for an outline, by its vertices in the unit square, if it has one. */
export const polygonShape = (points: Point[], box: Box): DrawioStyle | undefined => {
  if (box.width < 2 || box.height < 2) return undefined;
  const unit = points.map((p) => ({
    x: (p.x - box.x) / box.width,
    y: (p.y - box.y) / box.height
  }));
  const vertices = unit.filter((p, index) => {
    const previous = unit[(index + unit.length - 1) % unit.length];
    return Math.abs(p.x - previous.x) > 0.01 || Math.abs(p.y - previous.y) > 0.01;
  });
  const tolerance = 0.03;
  const has = (x: number, y: number) =>
    vertices.some((p) => Math.abs(p.x - x) < tolerance && Math.abs(p.y - y) < tolerance);
  const all = (list: [number, number][]) =>
    vertices.length === list.length && list.every(([x, y]) => has(x, y));
  if (
    all([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ])
  )
    return { shape: 'rect' };
  if (
    all([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5]
    ])
  ) {
    return { shape: 'rhombus', perimeter: 'rhombusPerimeter' };
  }
  if (vertices.length === 4) {
    const top = vertices.filter((p) => p.y < tolerance).map((p) => p.x);
    const bottom = vertices.filter((p) => p.y > 1 - tolerance).map((p) => p.x);
    if (top.length === 2 && bottom.length === 2) {
      const [t1, t2] = top.toSorted((a, b) => a - b);
      const [b1, b2] = bottom.toSorted((a, b) => a - b);
      if (Math.abs(t2 - t1 - (b2 - b1)) < tolerance) {
        // draw.io's parallelogram leans right: its top edge starts `size` in.
        const leansRight = t1 > b1;
        return {
          fixedSize: 1,
          perimeter: 'parallelogramPerimeter',
          shape: 'parallelogram',
          size: round((leansRight ? t1 : b1) * box.width),
          ...(leansRight ? {} : { flipH: 1 })
        };
      }
      if (Math.abs(t1 - (1 - t2)) < tolerance && Math.abs(b1 - (1 - b2)) < tolerance) {
        // draw.io's trapezoid is narrower at the top.
        const narrowTop = t2 - t1 < b2 - b1;
        return {
          fixedSize: 1,
          perimeter: 'trapezoidPerimeter',
          shape: 'trapezoid',
          size: round((narrowTop ? t1 : b1) * box.width),
          ...(narrowTop ? {} : { flipV: 1 })
        };
      }
    }
  }
  if (vertices.length === 6) {
    const s = Math.min(...vertices.filter((p) => p.y < tolerance).map((p) => p.x));
    if (
      s > 0 &&
      s < 0.5 &&
      all([
        [s, 0],
        [1 - s, 0],
        [1, 0.5],
        [1 - s, 1],
        [s, 1],
        [0, 0.5]
      ])
    ) {
      return {
        shape: 'hexagon',
        perimeter: 'hexagonPerimeter2',
        fixedSize: 1,
        size: round(s * box.width)
      };
    }
  }
  return undefined;
};

/** The draw.io shape for a closed outline given as sampled points, if it has one. */
export const outlineShape = (points: Point[], box: Box): DrawioStyle | undefined => {
  if (box.width < 2 || box.height < 2 || points.length < 4) return undefined;
  const rx = box.width / 2;
  const ry = box.height / 2;
  const c = center(box);
  const tolerance = Math.max(0.75, Math.min(box.width, box.height) * 0.01);
  const near = (x: number, y: number) =>
    points.some((p) => Math.abs(p.x - x) <= tolerance && Math.abs(p.y - y) <= tolerance);
  const onBorder = points.every(
    (p) =>
      Math.abs(p.x - box.x) <= tolerance ||
      Math.abs(p.x - box.x - box.width) <= tolerance ||
      Math.abs(p.y - box.y) <= tolerance ||
      Math.abs(p.y - box.y - box.height) <= tolerance
  );
  if (
    onBorder &&
    near(box.x, box.y) &&
    near(box.x + box.width, box.y) &&
    near(box.x, box.y + box.height) &&
    near(box.x + box.width, box.y + box.height)
  ) {
    return { shape: 'rect' };
  }
  const normal = points.map((p) => ({ x: (p.x - c.x) / rx, y: (p.y - c.y) / ry }));
  if (normal.every((p) => Math.abs(p.x * p.x + p.y * p.y - 1) < 0.05)) {
    return { shape: 'ellipse', perimeter: 'ellipsePerimeter' };
  }
  if (
    normal.every((p) => Math.abs(Math.abs(p.x) + Math.abs(p.y) - 1) < 0.03) &&
    near(c.x, box.y) &&
    near(box.x + box.width, c.y)
  ) {
    return { shape: 'rhombus', perimeter: 'rhombusPerimeter' };
  }
  return undefined;
};

/** Mermaid's node ids without the SVG id prefix, plus the bare name (`flowchart-A-0` → `A`). */
const keysOf = (element: Element, prefix: string): string[] => {
  const keys = new Set<string>();
  const add = (value: null | string) => {
    if (!value) return;
    const bare = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    keys.add(bare);
    const short = /^[a-zA-Z]+-(.+?)(?:-\d+)?$/.exec(bare)?.[1];
    if (short) keys.add(short);
  };
  add(element.getAttribute('id'));
  add(element.getAttribute('data-id'));
  return [...keys];
};

/** Decoded `data-points` (mermaid's edge layout points), if any. */
const dataPoints = (element: Element): Point[] | undefined => {
  const raw = element.getAttribute('data-points');
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(atob(raw));
    if (!Array.isArray(parsed)) return undefined;
    const points = parsed.filter(
      (p): p is Point =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Point).x === 'number' &&
        typeof (p as Point).y === 'number'
    );
    return points.length >= 2 ? points : undefined;
  } catch {
    return undefined;
  }
};

class Converter {
  private readonly consumed = new Set<Element>();
  private readonly edges: EdgeItem[] = [];
  private readonly labels: PendingLabel[] = [];
  private readonly nodes: VertexItem[] = [];
  private readonly prefix: string;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly measure: Measure
  ) {
    this.prefix = svg.id ? `${svg.id}-` : '';
  }

  convert(): DrawioPage {
    const items: Item[] = [];
    this.walkChildren(this.svg, items);
    this.attachLabels(items);
    this.connect();
    const top = this.nest(items);
    const viewBox = this.svg
      .getAttribute('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    let origin: Point = { x: 0, y: 0 };
    let size = { height: 0, width: 0 };
    if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
      origin = { x: viewBox[0], y: viewBox[1] };
      size = { height: viewBox[3], width: viewBox[2] };
    } else {
      const bounds = boundsOf(
        top.flatMap((item) =>
          item.kind === 'vertex'
            ? [
                { x: item.box.x, y: item.box.y },
                { x: item.box.x + item.box.width, y: item.box.y + item.box.height }
              ]
            : item.points
        )
      );
      if (bounds) {
        origin = { x: bounds.x, y: bounds.y };
        size = { height: bounds.height, width: bounds.width };
      }
    }
    // What lies wholly outside the picture is not drawn (gantt's "today" line far off).
    const page: Box = { ...origin, ...size };
    const visible =
      size.width > 0
        ? top.filter((item) =>
            item.kind === 'vertex'
              ? item.box.x < page.x + page.width &&
                item.box.x + item.box.width > page.x &&
                item.box.y < page.y + page.height &&
                item.box.y + item.box.height > page.y
              : item.points.some((p) => containsPoint(page, p, 1))
          )
        : top;
    return { cells: this.emit(visible, origin), height: size.height, width: size.width };
  }

  // ---------------------------------------------------------------- walking

  private hidden(element: Element): boolean {
    const display = this.measure.style(element, 'display');
    const visibility = this.measure.style(element, 'visibility');
    const opacity = this.measure.style(element, 'opacity');
    return (
      display === 'none' ||
      visibility === 'hidden' ||
      visibility === 'collapse' ||
      (opacity !== '' && Number.parseFloat(opacity) === 0)
    );
  }

  private walkChildren(parent: Element, sink: Item[]) {
    const children = [...parent.children];
    const start = sink.length;
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const next = children[index + 1] as Element | undefined;
      if (next && this.isPaintPair(child, next)) {
        this.consumed.add(next);
        this.walk(child, sink, next);
        index++;
        continue;
      }
      this.walk(child, sink);
    }
    this.mergeCenteredText(sink, start);
  }

  private walk(element: Element, sink: Item[], strokeElement?: Element) {
    const name = tag(element);
    if (SKIPPED.has(name) || this.consumed.has(element) || this.hidden(element)) return;
    if (name === 'g' && this.isCluster(element)) {
      this.group(element, sink, 'cluster');
    } else if (name === 'g' && this.isNode(element)) {
      this.group(element, sink, 'node');
    } else if (name === 'g' && hasClass(element, 'edgeLabel')) {
      this.edgeLabel(element);
    } else if (this.isConnector(element)) {
      this.connector(element, sink);
    } else if (name === 'rect' && this.isGroupBackground(element)) {
      this.group(element, sink, 'cluster');
    } else if (name === 'g' || name === 'a' || name === 'switch') {
      this.walkChildren(element, sink);
    } else if (name === 'text' || name === 'foreignobject') {
      const text = this.textItem(element);
      if (text) sink.push(text);
    } else if (SHAPES.has(name)) {
      const shape = this.shape(element, strokeElement);
      if (shape) sink.push(shape);
    } else if (name === 'svg' || name === 'image' || name === 'use') {
      const image = this.image(element);
      if (image) sink.push(image);
    }
  }

  private isCluster(element: Element) {
    return classes(element).some((name) => name === 'cluster' || name.endsWith('-cluster'));
  }

  private isNode(element: Element) {
    return (
      hasClass(element, 'node') ||
      hasClass(element, 'architecture-service') ||
      hasClass(element, 'architecture-junction') ||
      element.getAttribute('data-node') === 'true'
    );
  }

  /** Architecture groups: a lone rect, with their icon and title drawn next to it. */
  private isGroupBackground(element: Element) {
    return hasClass(element, 'node-bkg') && element.closest('.architecture-groups') !== null;
  }

  private isConnector(element: Element) {
    const name = tag(element);
    if (name !== 'path' && name !== 'line' && name !== 'polyline') return false;
    if (element.getAttribute('data-edge') === 'true') return true;
    if (element.closest('.edgePaths, .architecture-edges') !== null) return true;
    return classes(element).some((c) =>
      ['edge', 'flowchart-link', 'relation', 'relationshipLine', 'transition'].includes(c)
    );
  }

  /** roughjs draws a shape as a filled path and a stroked copy; those are one cell. */
  private isPaintPair(first: Element, second: Element) {
    if (!SHAPES.has(tag(first)) || tag(first) !== tag(second)) return false;
    if (this.isConnector(first) || this.isConnector(second)) return false;
    const a = this.boxOf(first);
    const b = this.boxOf(second);
    if (!a || !b) return false;
    // The stroked copy is hand-drawn, so its box can differ by a pixel or two.
    const tolerance = Math.max(1.5, Math.min(a.width, a.height) * 0.03);
    const same =
      Math.abs(a.x - b.x) < tolerance &&
      Math.abs(a.y - b.y) < tolerance &&
      Math.abs(a.width - b.width) < tolerance &&
      Math.abs(a.height - b.height) < tolerance;
    if (!same) return false;
    // roughjs marks the copies with `stroke="none"` / `fill="none"`; the page's CSS may
    // still paint both, so the attributes say which is which.
    if (first.getAttribute('stroke') === 'none' || second.getAttribute('fill') === 'none') {
      return true;
    }
    return this.paint(first).fill !== 'none' && this.paint(second).fill === 'none';
  }

  // ---------------------------------------------------------------- geometry and paint

  private boxOf(element: Element): Box | undefined {
    const box = this.measure.bbox(element);
    if (!box) return undefined;
    return transformBox(this.measure.matrix(element), box);
  }

  private colour(element: Element, property: string): { alpha: number; colour: string } {
    const value = this.measure.style(element, property);
    const reference = /url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(value);
    if (reference) {
      // A gradient or pattern: its first stop stands in for it.
      const target = this.svg.querySelector(`[id="${reference[1].replaceAll('"', '\\"')}"]`);
      const stop = target?.querySelector('stop');
      return stop ? parseColour(this.measure.style(stop, 'stop-color')) : parseColour('#ffffff');
    }
    return parseColour(value);
  }

  private paint(element: Element): Paint {
    const scale = scaleOf(this.measure.matrix(element));
    const fill = this.colour(element, 'fill');
    const stroke = this.colour(element, 'stroke');
    const strokeWidth =
      stroke.colour === 'none' ? 0 : number(this.measure.style(element, 'stroke-width'), 1) * scale;
    const dashText = this.measure.style(element, 'stroke-dasharray');
    let dash: number[] | undefined;
    if (dashText && dashText !== 'none') {
      const values = dashText
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number.parseFloat);
      // `0 0 L g` is mermaid's way of drawing a solid line that stops short.
      if (values.length > 0 && values.every((v) => !Number.isNaN(v)) && values[0] > 0) {
        dash = values.map((v) => v * scale);
      }
    }
    return {
      dash,
      fill: fill.colour,
      fillOpacity: fill.alpha * number(this.measure.style(element, 'fill-opacity'), 1),
      opacity: number(this.measure.style(element, 'opacity'), 1),
      stroke: stroke.colour,
      strokeOpacity: stroke.alpha * number(this.measure.style(element, 'stroke-opacity'), 1),
      strokeWidth
    };
  }

  private font(element: Element, colourProperty: string, scale: number): Font {
    const size = number(this.measure.style(element, 'font-size'), 16) * scale;
    const family = this.measure
      .style(element, 'font-family')
      .split(',')[0]
      ?.trim()
      .replaceAll(/["']/g, '');
    const weight = this.measure.style(element, 'font-weight');
    const italic = /italic|oblique/.test(this.measure.style(element, 'font-style'));
    const underline = this.measure.style(element, 'text-decoration-line').includes('underline');
    const bold = weight === 'bold' || weight === 'bolder' || number(weight, 400) >= 600;
    const colour = parseColour(this.measure.style(element, colourProperty));
    return {
      fontColor: colour.colour === 'none' ? undefined : colour.colour,
      fontFamily: family || undefined,
      fontSize: round(size),
      fontStyle: (bold ? 1 : 0) + (italic ? 2 : 0) + (underline ? 4 : 0)
    };
  }

  // ---------------------------------------------------------------- shapes

  private shape(element: Element, strokeElement?: Element): Item | undefined {
    const name = tag(element);
    const m = this.measure.matrix(element);
    const paint = this.paint(element);
    const strokeCopy = strokeElement ? this.paint(strokeElement) : undefined;
    if (strokeCopy && paint.fill === 'none') {
      paint.fill = strokeCopy.fill;
      paint.fillOpacity = strokeCopy.fillOpacity;
    }
    if (strokeCopy && strokeCopy.stroke !== 'none' && strokeCopy.strokeWidth > 0) {
      const stroke = strokeCopy;
      paint.stroke = stroke.stroke;
      paint.strokeWidth = stroke.strokeWidth;
      paint.strokeOpacity = stroke.strokeOpacity;
      paint.dash = stroke.dash;
    }
    const filled = paint.fill !== 'none';
    const stroked = paint.stroke !== 'none' && paint.strokeWidth > 0;
    if (!filled && !stroked) return undefined;
    const attribute = (key: string) => number(element.getAttribute(key) ?? undefined, 0);
    const local = this.measure.bbox(element);
    const straight = Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6;

    if (name === 'line') {
      const from = apply(m, { x: attribute('x1'), y: attribute('y1') });
      const to = apply(m, { x: attribute('x2'), y: attribute('y2') });
      return this.line(element, [from, to], paint);
    }

    let segments: Segment[];
    if (name === 'rect') {
      if (!local || local.width <= 0 || local.height <= 0) return undefined;
      const rx = attribute('rx') || attribute('ry');
      if (straight) {
        const box = transformBox(m, local);
        const style: DrawioStyle = { shape: 'rect', ...paintStyle(paint) };
        if (rx > 0) {
          style.rounded = 1;
          style.absoluteArcSize = 1;
          style.arcSize = round(Math.min(rx * scaleOf(m), Math.min(box.width, box.height) / 2) * 2);
        }
        return this.vertex(box, style);
      }
      segments = parsePath(
        `M${local.x},${local.y}h${local.width}v${local.height}h${-local.width}z`
      );
    } else if (name === 'circle' || name === 'ellipse') {
      if (!local || local.width <= 0 || local.height <= 0) return undefined;
      if (straight) {
        return this.vertex(transformBox(m, local), {
          shape: 'ellipse',
          perimeter: 'ellipsePerimeter',
          ...paintStyle(paint)
        });
      }
      const { x, y, width: w, height: h } = local;
      segments = parsePath(
        `M${x},${y + h / 2}a${w / 2},${h / 2} 0 1,0 ${w},0a${w / 2},${h / 2} 0 1,0 ${-w},0z`
      );
    } else if (name === 'polygon' || name === 'polyline') {
      const values = (element.getAttribute('points') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const points: Point[] = [];
      for (let index = 0; index + 1 < values.length; index += 2) {
        points.push({ x: values[index], y: values[index + 1] });
      }
      if (points.length < 2) return undefined;
      if (name === 'polyline' && !filled) {
        return this.line(
          element,
          points.map((p) => apply(m, p)),
          paint
        );
      }
      segments = parsePath(`M${points.map((p) => `${p.x},${p.y}`).join('L')}z`);
    } else {
      segments = parsePath(element.getAttribute('d'));
    }
    segments = transformSegments(segments, m);
    if (segments.length === 0) return undefined;
    const lines = flatten(segments);
    const all = lines.flatMap((line) => line.points);
    const box = boundsOf(all);
    if (!box || (box.width < 0.5 && box.height < 0.5)) return undefined;
    const closed = lines.every((line) => line.closed);
    const straightOnly = segments.every((s) => s.c !== 'C' && s.c !== 'Q');
    // An open outline that is not filled is a line (or a curve, kept as drawn).
    if (!filled && !closed) {
      if (straightOnly && lines.length === 1) return this.line(element, lines[0].points, paint);
      return this.vertex(box, {
        shape: stencilShape(stencilXml(segments, box, false)),
        ...paintStyle(paint),
        fillColor: 'none'
      });
    }
    const known =
      lines.length === 1
        ? straightOnly
          ? polygonShape(lines[0].points, box)
          : outlineShape(lines[0].points, box)
        : undefined;
    const shape = known ?? { shape: stencilShape(stencilXml(segments, box, true)) };
    return this.vertex(box, { ...shape, ...paintStyle(paint) });
  }

  private vertex(box: Box, style: DrawioStyle, role: VertexItem['role'] = 'shape'): VertexItem {
    return {
      box,
      children: [],
      keys: [],
      kind: 'vertex',
      role,
      style: { ...style, html: 1, whiteSpace: 'wrap' },
      value: ''
    };
  }

  private arrows(element: Element): DrawioStyle {
    const style: DrawioStyle = {};
    const reference = (side: 'end' | 'start') =>
      element.getAttribute(`marker-${side}`) ?? this.measure.style(element, `marker-${side}`);
    const end = markerArrow(reference('end') ?? '');
    const start = markerArrow(reference('start') ?? '');
    style.endArrow = end?.arrow ?? 'none';
    if (end) style.endFill = end.fill;
    style.startArrow = start?.arrow ?? 'none';
    if (start) style.startFill = start.fill;
    return style;
  }

  private line(element: Element, points: Point[], paint: Paint): EdgeItem | undefined {
    const route = simplify(points, 0.5);
    if (route.length < 2) return undefined;
    return {
      connector: false,
      kind: 'edge',
      points: route,
      style: {
        edgeStyle: 'none',
        html: 1,
        rounded: 0,
        ...this.arrows(element),
        ...paintStyle(paint, { line: true })
      },
      value: ''
    };
  }

  // ---------------------------------------------------------------- text and images

  private textLines(element: Element): string {
    if (tag(element) === 'foreignobject') {
      const content = element.firstElementChild ?? element;
      return this.measure.text(content);
    }
    const rows = [...element.children].filter((child) => tag(child) === 'tspan');
    const lines =
      rows.length > 1 &&
      rows.every((row) => row.hasAttribute('x') || row.hasAttribute('dy') || hasClass(row, 'row'))
        ? rows.map((row) => row.textContent ?? '')
        : [element.textContent ?? ''];
    return lines.map((line) => line.replaceAll(/\s+/g, ' ').trim()).join('\n');
  }

  private textItem(element: Element): VertexItem | undefined {
    const text = this.textLines(element)
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
    if (!text) return undefined;
    const local = this.measure.bbox(element);
    if (!local) return undefined;
    const m = this.measure.matrix(element);
    const scale = scaleOf(m);
    const rotation = round(rotationOf(m));
    let box: Box;
    if (Math.abs(rotation) > 0.5) {
      // draw.io rotates a cell about its centre: the unrotated box around the same centre.
      const c = apply(m, center(local));
      const width = local.width * scale;
      const height = local.height * scale;
      box = { height, width, x: c.x - width / 2, y: c.y - height / 2 };
    } else {
      box = transformBox(m, local);
    }
    let fontElement: Element = element;
    let align = 'center';
    let background: string | undefined;
    // The innermost element holding all the text carries the font that is drawn.
    const whole = element.textContent?.trim() ?? '';
    for (const candidate of element.querySelectorAll('*')) {
      if ((candidate.textContent?.trim() ?? '') === whole) fontElement = candidate;
    }
    if (tag(element) === 'foreignobject') {
      for (const candidate of element.querySelectorAll('*')) {
        const fill = parseColour(this.measure.style(candidate, 'background-color'));
        if (!background && fill.colour !== 'none' && fill.alpha > 0.5) background = fill.colour;
      }
      const textAlign = this.measure.style(fontElement, 'text-align');
      if (textAlign === 'left' || textAlign === 'start') align = 'left';
      if (textAlign === 'right' || textAlign === 'end') align = 'right';
    } else {
      const anchor = this.measure.style(element, 'text-anchor');
      if (anchor === 'start') align = 'left';
      if (anchor === 'end') align = 'right';
    }
    const font = this.font(fontElement, tag(element) === 'foreignobject' ? 'color' : 'fill', scale);
    const textStyle: DrawioStyle = {};
    for (const [key, value] of Object.entries(font)) {
      if (value !== undefined) textStyle[key] = value as number | string;
    }
    const style: DrawioStyle = { ...TEXT_BASE, align, verticalAlign: 'middle', ...textStyle };
    if (Math.abs(rotation) > 0.5) style.rotation = rotation;
    if (background) style.labelBackgroundColor = background;
    return {
      box,
      children: [],
      keys: [],
      kind: 'vertex',
      role: 'text',
      rotation: Math.abs(rotation) > 0.5 ? rotation : undefined,
      style,
      textStyle: background ? { ...textStyle, labelBackgroundColor: background } : textStyle,
      value: htmlLabel(text)
    };
  }

  /** The element alone as an SVG picture, with its computed styles written in. */
  private image(element: Element): VertexItem | undefined {
    const box = this.boxOf(element);
    if (!box || box.width < 0.5 || box.height < 0.5) return undefined;
    if (tag(element) === 'image') {
      const href = element.getAttribute('href') ?? element.getAttribute('xlink:href') ?? '';
      if (!href) return undefined;
      // draw.io style values cannot hold `;`, so a data URI drops `;base64` (as draw.io does).
      const source = href.replace(/^(data:[^;,]+)[^,]*;base64,/, '$1,');
      return this.vertex(box, { shape: 'image', image: source, imageAspect: 0 }, 'image');
    }
    const clone = element.cloneNode(true) as Element;
    this.inlineStyles(element, clone);
    const references = new Set<string>();
    const collect = (node: Element) => {
      for (const attribute of node.attributes) {
        for (const match of attribute.value.matchAll(/url\(\s*["']?#([^"')]+)["']?\s*\)/g)) {
          references.add(match[1]);
        }
        if (
          (attribute.name === 'href' || attribute.name === 'xlink:href') &&
          attribute.value.startsWith('#')
        ) {
          references.add(attribute.value.slice(1));
        }
      }
      for (const child of node.children) collect(child);
    };
    collect(clone);
    const definitions: Element[] = [];
    const seen = new Set<string>();
    for (const id of references) {
      if (seen.has(id)) continue;
      seen.add(id);
      const target = this.svg.querySelector(`[id="${id.replaceAll('"', '\\"')}"]`);
      if (target && !target.contains(element)) {
        const copy = target.cloneNode(true) as Element;
        definitions.push(copy);
        collect(copy);
        for (const extra of references) if (!seen.has(extra)) references.add(extra);
      }
    }
    const parent = element.parentElement;
    const m = parent ? this.measure.matrix(parent) : IDENTITY;
    const document = element.ownerDocument;
    const wrapper = document.createElementNS(SVG_NS, 'svg');
    wrapper.setAttribute('xmlns', SVG_NS);
    wrapper.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    wrapper.setAttribute('width', `${round(box.width)}`);
    wrapper.setAttribute('height', `${round(box.height)}`);
    wrapper.setAttribute(
      'viewBox',
      `${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}`
    );
    if (definitions.length > 0) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      defs.append(...definitions);
      wrapper.append(defs);
    }
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].join(',')})`);
    group.append(clone);
    wrapper.append(group);
    const markup = new XMLSerializer().serializeToString(wrapper);
    return this.vertex(
      box,
      {
        shape: 'image',
        image: `data:image/svg+xml,${toBase64(markup)}`,
        imageAspect: 0,
        verticalAlign: 'top'
      },
      'image'
    );
  }

  private inlineStyles(original: Element, clone: Element) {
    const properties = [
      'fill',
      'fill-opacity',
      'fill-rule',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'stroke-dasharray',
      'stroke-linecap',
      'stroke-linejoin',
      'opacity',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'text-anchor',
      'dominant-baseline',
      'color'
    ];
    if (original.namespaceURI === SVG_NS) {
      const declarations = properties
        .map((property) => [property, this.measure.style(original, property)] as const)
        .filter(([, value]) => value !== '')
        .map(([property, value]) => `${property}:${value}`);
      if (declarations.length > 0) clone.setAttribute('style', declarations.join(';'));
    }
    const originals = [...original.children];
    const clones = [...clone.children];
    for (const [index, child] of originals.entries()) {
      if (clones[index]) this.inlineStyles(child, clones[index]);
    }
  }

  // ---------------------------------------------------------------- nodes and clusters

  private group(element: Element, sink: Item[], role: 'cluster' | 'node') {
    const items: Item[] = [];
    if (tag(element) === 'g') {
      this.walkChildren(element, items);
    } else {
      const shape = this.shape(element);
      if (shape) items.push(shape);
    }
    const shapes = items.filter(
      (item): item is VertexItem => item.kind === 'vertex' && item.role !== 'text'
    );
    let main = shapes.reduce<VertexItem | undefined>(
      (best, item) => (!best || area(item.box) > area(best.box) ? item : best),
      undefined
    );
    if (!main) {
      const lone = items.length === 1 ? items[0] : undefined;
      if (lone?.kind === 'vertex') {
        main = lone;
      } else {
        const bounds = boundsOf(
          items.flatMap((item) =>
            item.kind === 'vertex'
              ? [
                  { x: item.box.x, y: item.box.y },
                  { x: item.box.x + item.box.width, y: item.box.y + item.box.height }
                ]
              : item.points
          )
        );
        if (!bounds) return;
        main = this.vertex(bounds, { fillColor: 'none', strokeColor: 'none' });
        items.unshift(main);
      }
    }
    const rest = items.filter((item) => item !== main);
    const texts = rest.filter(
      (item): item is VertexItem => item.kind === 'vertex' && item.role === 'text'
    );
    if (!main.value && texts.length === 1 && main.role !== 'text') {
      const label = texts[0];
      if (
        this.labelInto(main, label, role === 'cluster') ||
        (rest.length === 1 && this.labelBeside(main, label))
      ) {
        rest.splice(rest.indexOf(label), 1);
      }
    }
    if (main.role !== 'text') main.role = role;
    main.keys = keysOf(element, this.prefix);
    main.children.push(...rest);
    if (role === 'cluster') {
      main.style = { ...main.style, container: 1, collapsible: 0 };
    }
    this.nodes.push(main);
    sink.push(main);
  }

  /** A label inside its shape becomes the shape's value, aligned where it was drawn. */
  private labelInto(shape: VertexItem, label: VertexItem, topFirst: boolean): boolean {
    const c = center(label.box);
    if (!containsPoint(shape.box, c, 1)) return false;
    const box = shape.box;
    const style: DrawioStyle = { ...label.textStyle };
    const dx = c.x - (box.x + box.width / 2);
    const dy = c.y - (box.y + box.height / 2);
    if (Math.abs(dx) > Math.max(2, box.width * 0.05)) {
      if (dx < 0) {
        style.align = 'left';
        style.spacingLeft = round(label.box.x - box.x);
      } else {
        style.align = 'right';
        style.spacingRight = round(box.x + box.width - label.box.x - label.box.width);
      }
    }
    if (topFirst || Math.abs(dy) > Math.max(2, box.height * 0.1)) {
      if (dy < 0 || (topFirst && dy <= 0)) {
        style.verticalAlign = 'top';
        style.spacingTop = round(Math.max(0, label.box.y - box.y));
      } else {
        style.verticalAlign = 'bottom';
        style.spacingBottom = round(
          Math.max(0, box.y + box.height - label.box.y - label.box.height)
        );
      }
    }
    if (label.rotation !== undefined && Math.abs(Math.abs(label.rotation) - 90) < 1) {
      style.horizontal = 0;
    }
    shape.style = { ...shape.style, ...style };
    shape.value = label.value;
    return true;
  }

  /** A lone label next to its shape (an icon's caption) stays its value, outside. */
  private labelBeside(shape: VertexItem, label: VertexItem): boolean {
    const box = shape.box;
    const c = center(label.box);
    const style: DrawioStyle = { ...label.textStyle };
    if (c.y > box.y + box.height) {
      Object.assign(style, { verticalAlign: 'top', verticalLabelPosition: 'bottom' });
      style.spacingTop = round(Math.max(0, label.box.y - box.y - box.height));
    } else if (c.y < box.y) {
      Object.assign(style, { verticalAlign: 'bottom', verticalLabelPosition: 'top' });
      style.spacingBottom = round(Math.max(0, box.y - label.box.y - label.box.height));
    } else if (c.x > box.x + box.width) {
      Object.assign(style, { align: 'left', labelPosition: 'right' });
    } else if (c.x < box.x) {
      Object.assign(style, { align: 'right', labelPosition: 'left' });
    } else {
      return false;
    }
    shape.style = { ...shape.style, ...style, labelBackgroundColor: 'none' };
    shape.value = label.value;
    return true;
  }

  /** Text centred on a shape drawn just before it (a sequence actor, a gantt bar) labels it. */
  private mergeCenteredText(items: Item[], start: number) {
    for (let index = items.length - 1; index > start; index--) {
      const text = items[index];
      if (text.kind !== 'vertex' || text.role !== 'text') continue;
      let best: VertexItem | undefined;
      for (let other = start; other < items.length; other++) {
        const shape = items[other];
        if (
          shape.kind !== 'vertex' ||
          shape.role !== 'shape' ||
          shape.value ||
          !inside(text.box, shape.box, 2)
        ) {
          continue;
        }
        const dx = Math.abs(center(text.box).x - center(shape.box).x);
        const dy = Math.abs(center(text.box).y - center(shape.box).y);
        if (dx > Math.max(2, shape.box.width * 0.05) || dy > Math.max(2, shape.box.height * 0.12)) {
          continue;
        }
        if (!best || area(shape.box) < area(best.box)) best = shape;
      }
      if (best && this.labelInto(best, text, false)) items.splice(index, 1);
    }
  }

  // ---------------------------------------------------------------- edges

  private connector(element: Element, sink: Item[]) {
    const m = this.measure.matrix(element);
    const name = tag(element);
    let segments: Segment[];
    if (name === 'line') {
      const value = (key: string) => number(element.getAttribute(key) ?? undefined, 0);
      segments = [
        { c: 'M', x: value('x1'), y: value('y1') },
        { c: 'L', x: value('x2'), y: value('y2') }
      ];
    } else if (name === 'polyline') {
      const values = (element.getAttribute('points') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      segments = [];
      for (let index = 0; index + 1 < values.length; index += 2) {
        segments.push({ c: index === 0 ? 'M' : 'L', x: values[index], y: values[index + 1] });
      }
    } else {
      segments = parsePath(element.getAttribute('d'));
    }
    const lines = flatten(transformSegments(segments, m));
    const traced = lines.flatMap((line) => line.points);
    if (traced.length < 2) return;
    const start = traced[0];
    const end = traced.at(-1) ?? start;
    const layout = dataPoints(element)?.map((p) => apply(m, p));
    const middle = (layout ?? traced).slice(1, -1);
    const route = simplify([start, ...middle, end], 1);
    const paint = this.paint(element);
    const pattern = classes(element)
      .map((c) => /^edge-pattern-(\w+)$/.exec(c)?.[1])
      .find(Boolean);
    const style: DrawioStyle = {
      edgeStyle: 'none',
      html: 1,
      ...this.arrows(element),
      ...paintStyle(pattern ? { ...paint, dash: undefined } : paint, { line: true })
    };
    if (pattern === 'dotted') Object.assign(style, { dashed: 1, dashPattern: '1 2' });
    if (pattern === 'dashed') Object.assign(style, { dashed: 1, dashPattern: '3 3' });
    const d = element.getAttribute('d') ?? '';
    if (/[CcSs]/.test(d)) style.curved = 1;
    else style.rounded = /[QqTt]/.test(d) ? 1 : 0;
    // Architecture diagrams draw arrowheads as polygons beside the path.
    for (const sibling of element.parentElement?.children ?? []) {
      if (sibling === element || !hasClass(sibling, 'arrow') || this.consumed.has(sibling))
        continue;
      const box = this.boxOf(sibling);
      if (!box) continue;
      const c = center(box);
      const near = (p: Point) =>
        Math.hypot(p.x - c.x, p.y - c.y) <= Math.max(box.width, box.height) + 4;
      if (near(end)) {
        Object.assign(style, { endArrow: 'block', endFill: 1 });
        this.consumed.add(sibling);
      } else if (near(start)) {
        Object.assign(style, { startArrow: 'block', startFill: 1 });
        this.consumed.add(sibling);
      }
    }
    const raw = element.getAttribute('data-id') ?? element.getAttribute('id') ?? '';
    const edge: EdgeItem = {
      connector: true,
      key: raw.startsWith(this.prefix) ? raw.slice(this.prefix.length) : raw,
      kind: 'edge',
      points: route.length >= 2 ? route : [start, end],
      style,
      value: ''
    };
    this.edges.push(edge);
    sink.push(edge);
  }

  private edgeLabel(element: Element) {
    const items: Item[] = [];
    this.walkChildren(element, items);
    const texts = items.filter(
      (item): item is VertexItem => item.kind === 'vertex' && item.role === 'text'
    );
    if (texts.length === 0) return;
    const text = texts[0];
    if (texts.length > 1) {
      text.value = texts.map((t) => t.value).join('<br>');
    }
    const keyed =
      element.querySelector('[data-id]')?.getAttribute('data-id') ??
      element.getAttribute('id') ??
      undefined;
    const box = boundsOf(
      texts.flatMap((t) => [
        { x: t.box.x, y: t.box.y },
        { x: t.box.x + t.box.width, y: t.box.y + t.box.height }
      ])
    );
    if (!box) return;
    text.box = box;
    this.labels.push({
      box,
      key: keyed?.startsWith(this.prefix) ? keyed.slice(this.prefix.length) : keyed,
      text
    });
  }

  /** Labels go on their edges (by id, else the nearest edge); the rest become text cells. */
  private attachLabels(items: Item[]) {
    for (const label of this.labels) {
      let edge: EdgeItem | undefined;
      if (label.key) {
        const key = label.key;
        edge =
          this.edges.find((e) => e.key === key && !e.value) ??
          this.edges
            .filter((e) => e.key && !e.value && key.endsWith(e.key))
            .toSorted((a, b) => (b.key?.length ?? 0) - (a.key?.length ?? 0))[0];
      }
      if (!edge) {
        const c = center(label.box);
        let best = Infinity;
        for (const candidate of this.edges) {
          if (candidate.value) continue;
          const distance = Math.min(
            ...flatten(
              candidate.points.map((p, index) => ({ c: index === 0 ? 'M' : 'L', ...p }) as Segment)
            )[0].points.map((p) => Math.hypot(p.x - c.x, p.y - c.y))
          );
          if (distance < best && distance <= Math.max(label.box.width, label.box.height)) {
            best = distance;
            edge = candidate;
          }
        }
      }
      if (edge) {
        edge.value = label.text.value;
        edge.labelAt = center(label.box);
        const { labelBackgroundColor, ...font } = label.text.textStyle ?? {};
        Object.assign(edge.style, font, {
          labelBackgroundColor: labelBackgroundColor ?? 'none'
        });
      } else {
        items.push(label.text);
      }
    }
  }

  /** Edge ends onto nodes: by mermaid's ids (`L_A_B_0`), else the nearest shape. */
  private connect() {
    const byKey = new Map<string, VertexItem[]>();
    for (const node of this.nodes) {
      for (const key of node.keys) byKey.set(key, [...(byKey.get(key) ?? []), node]);
    }
    const unique = (key: string) => {
      const found = byKey.get(key);
      return found?.length === 1 ? found[0] : undefined;
    };
    const fit = (node: VertexItem, p: Point) =>
      node.role === 'cluster' ? distanceToBorder(node.box, p) : distanceToBox(node.box, p);
    const nearest = (p: Point) => {
      let best: undefined | VertexItem;
      let distance = 20;
      for (const node of this.nodes) {
        const d = fit(node, p);
        if (
          d < distance ||
          (d === distance && best?.role === 'cluster' && node.role !== 'cluster')
        ) {
          distance = d;
          best = node;
        }
      }
      return best;
    };
    for (const edge of this.edges) {
      const start = edge.points[0];
      const end = edge.points.at(-1) ?? start;
      let source: undefined | VertexItem;
      let target: undefined | VertexItem;
      const body = (edge.key ?? '').replace(/^(?:L|id)[_-]/, '').replace(/[_-]\d+$/, '');
      const pairs: [VertexItem, VertexItem][] = [];
      for (let index = body.indexOf('_'); index > 0; index = body.indexOf('_', index + 1)) {
        const a = unique(body.slice(0, index));
        const b = unique(body.slice(index + 1));
        if (a && b && !pairs.some(([x, y]) => x === a && y === b)) pairs.push([a, b]);
      }
      if (pairs.length === 1) {
        let [a, b] = pairs[0];
        if (fit(a, start) + fit(b, end) > fit(a, end) + fit(b, start)) [a, b] = [b, a];
        if (fit(a, start) <= 60 && fit(b, end) <= 60) [source, target] = [a, b];
      }
      source ??= nearest(start);
      target ??= nearest(end);
      edge.source = source;
      edge.target = target;
      const constraint = (node: VertexItem, p: Point, side: 'entry' | 'exit') => {
        const { box } = node;
        // A fixed point only on a box-shaped outline; draw.io projects others itself.
        if (box.width <= 0 || box.height <= 0 || node.style.perimeter !== undefined) return;
        edge.style[`${side}X`] = round(Math.max(0, Math.min(1, (p.x - box.x) / box.width)));
        edge.style[`${side}Y`] = round(Math.max(0, Math.min(1, (p.y - box.y) / box.height)));
        edge.style[`${side}Dx`] = 0;
        edge.style[`${side}Dy`] = 0;
      };
      if (source) constraint(source, start, 'exit');
      if (target) constraint(target, end, 'entry');
    }
  }

  // ---------------------------------------------------------------- output

  /** Cells inside a container become its children (smallest container first). */
  private nest(items: Item[]): Item[] {
    const clusters = items.filter(
      (item): item is VertexItem => item.kind === 'vertex' && item.role === 'cluster'
    );
    if (clusters.length === 0) return items;
    const top: Item[] = [];
    const parents = new Map<Item, VertexItem>();
    for (const item of items) {
      if (item.kind !== 'vertex') continue;
      let parent: VertexItem | undefined;
      for (const cluster of clusters) {
        if (cluster === item || area(cluster.box) <= area(item.box)) continue;
        if (!inside(item.box, cluster.box, 1)) continue;
        if (!parent || area(cluster.box) < area(parent.box)) parent = cluster;
      }
      if (parent) parents.set(item, parent);
    }
    for (const item of items) {
      const parent = parents.get(item);
      if (parent) parent.children.push(item);
      else top.push(item);
    }
    return top;
  }

  private emit(top: Item[], origin: Point): DrawioCell[] {
    const ids = new Map<Item, string>();
    let next = 2;
    const assign = (item: Item) => {
      ids.set(item, String(next++));
      if (item.kind === 'vertex') item.children.forEach(assign);
    };
    top.forEach(assign);
    const cells: DrawioCell[] = [];
    const write = (item: Item, parent: string, base: Point) => {
      const id = ids.get(item) ?? '';
      if (item.kind === 'vertex') {
        cells.push({
          height: item.box.height,
          id,
          kind: 'vertex',
          parent,
          style: item.style,
          value: item.value,
          width: item.box.width,
          x: item.box.x - base.x,
          y: item.box.y - base.y
        });
        for (const child of item.children) write(child, id, { x: item.box.x, y: item.box.y });
        return;
      }
      const relative = (p: Point) => ({ x: p.x - base.x, y: p.y - base.y });
      const start = item.points[0];
      const end = item.points.at(-1) ?? start;
      const inner = item.points.slice(1, -1);
      const labelOffset = item.labelAt
        ? (() => {
            const middle = midpoint(item.points);
            const dx = item.labelAt.x - middle.x;
            const dy = item.labelAt.y - middle.y;
            return Math.hypot(dx, dy) > 1 ? { x: round(dx), y: round(dy) } : undefined;
          })()
        : undefined;
      cells.push({
        id,
        kind: 'edge',
        labelOffset,
        parent,
        points: inner.map(relative),
        source: item.source ? ids.get(item.source) : undefined,
        sourcePoint: relative(start),
        style: item.style,
        target: item.target ? ids.get(item.target) : undefined,
        targetPoint: relative(end),
        value: item.value
      });
    };
    for (const item of top) write(item, LAYER, origin);
    return cells;
  }
}

/** Geometry and styles from the browser, for an SVG in the document. */
export const browserMeasure = (svg: SVGSVGElement): Measure => {
  const root = svg.getScreenCTM()?.inverse();
  return {
    bbox(element) {
      if (!(element instanceof SVGGraphicsElement)) return undefined;
      try {
        const box = element.getBBox();
        return { height: box.height, width: box.width, x: box.x, y: box.y };
      } catch {
        return undefined;
      }
    },
    matrix(element) {
      const screen = (element as SVGGraphicsElement).getScreenCTM?.();
      if (!root || !screen) return IDENTITY;
      const m = root.multiply(screen);
      return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
    },
    style(element, property) {
      return getComputedStyle(element).getPropertyValue(property);
    },
    text(element) {
      return element instanceof HTMLElement ? element.innerText : (element.textContent ?? '');
    }
  };
};

/** The SVG as draw.io cells, sized to its viewBox. */
export const svgToDrawio = (
  svg: SVGSVGElement,
  measure: Measure = browserMeasure(svg)
): DrawioPage => new Converter(svg, measure).convert();
