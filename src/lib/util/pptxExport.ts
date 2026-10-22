/**
 * Local: the diagram as a PowerPoint presentation, `.pptx` (PresentationML,
 * ECMA-376), with every element of the diagram as its own PowerPoint object.
 *
 * It starts from the same cells as the .drawio file (svgToDrawio.ts reads the
 * SVG on screen), so what is one draw.io cell is one PowerPoint object:
 *
 * - a node is a shape (rectangle, rounded rectangle, ellipse, diamond, hexagon,
 *   parallelogram, trapezoid; any other outline as a freeform with exactly that
 *   outline) holding its label as text; a node with parts (class members, ER
 *   attributes, icons) is a group of the shape and its parts;
 * - a subgraph is a shape drawn behind the nodes inside it;
 * - a link is a connector glued to the shapes it joins (`stCxn` / `endCxn`),
 *   drawn along mermaid's route, with its arrowheads; arrowheads PowerPoint has
 *   no line end for (hollow triangles and diamonds, ER cardinalities, crosses)
 *   are small freeforms at the end of the line; a link's label is a text box;
 * - titles, messages and axis labels are text boxes, lines are connectors
 *   without ends, icons and pictures are pictures (SVG with a PNG fallback).
 *
 * The slide is 16:9 (13.33 × 7.5 in); a diagram larger than the slide is scaled
 * down to fit, a smaller one keeps its size, centred. The Mermaid source is kept
 * in the slide's notes. See docs-dev/EXPORTS.md.
 */
import { strToU8, zipSync } from 'fflate';
import { type DrawioCell, type DrawioEdge, type DrawioVertex, LAYER } from './drawioExport';
import { boundsOf, type Box, flatten, type Point, type Segment } from './svgPath';
import { escapeXml } from './xmlText';

/** A picture for an image cell: a PNG, and the SVG it was drawn from, if any. */
export interface PptxPicture {
  png: Uint8Array;
  svg?: Uint8Array;
}

export interface PptxInput {
  /** The slide colour (`#rrggbb`), or undefined for the default white. */
  background?: string;
  cells: DrawioCell[];
  code: string;
  /** Diagram height in CSS pixels (96 per inch). */
  height: number;
  /** Pictures for image cells, by the `image` of the cell's style. */
  pictures?: Map<string, PptxPicture>;
  title: string;
  /** Diagram width in CSS pixels (96 per inch). */
  width: number;
}

export const PPTX_PARTS = {
  app: 'docProps/app.xml',
  contentTypes: '[Content_Types].xml',
  core: 'docProps/core.xml',
  layout: 'ppt/slideLayouts/slideLayout1.xml',
  layoutRels: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
  master: 'ppt/slideMasters/slideMaster1.xml',
  masterRels: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
  notes: 'ppt/notesSlides/notesSlide1.xml',
  notesMaster: 'ppt/notesMasters/notesMaster1.xml',
  notesMasterRels: 'ppt/notesMasters/_rels/notesMaster1.xml.rels',
  notesRels: 'ppt/notesSlides/_rels/notesSlide1.xml.rels',
  presProps: 'ppt/presProps.xml',
  presentation: 'ppt/presentation.xml',
  presentationRels: 'ppt/_rels/presentation.xml.rels',
  rels: '_rels/.rels',
  slide: 'ppt/slides/slide1.xml',
  slideRels: 'ppt/slides/_rels/slide1.xml.rels',
  tableStyles: 'ppt/tableStyles.xml',
  theme: 'ppt/theme/theme1.xml',
  theme2: 'ppt/theme/theme2.xml',
  viewProps: 'ppt/viewProps.xml'
} as const;

/** EMU per CSS pixel (914400 per inch, 96 pixels per inch). */
export const EMU_PER_PX = 9525;
export const SLIDE_WIDTH = 12_192_000;
export const SLIDE_HEIGHT = 6_858_000;
/** Margin kept free around a diagram that has to be scaled down, in EMU (0.25 in). */
const MARGIN = 228_600;

const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NAMESPACES = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const SVG_BLIP_EXT = '{96DAC541-7B7A-43D3-8B79-37D633B846F1}';
const NS_ASVG = 'http://schemas.microsoft.com/office/drawing/2016/SVG/main';
const CONTENT = 'application/vnd.openxmlformats-officedocument';

/** The scale and offset that place a diagram of `width` × `height` px on the slide. */
export const slidePlacement = (
  width: number,
  height: number
): { offsetX: number; offsetY: number; scale: number } => {
  const w = Math.max(width, 1) * EMU_PER_PX;
  const h = Math.max(height, 1) * EMU_PER_PX;
  const scale = Math.min(1, (SLIDE_WIDTH - 2 * MARGIN) / w, (SLIDE_HEIGHT - 2 * MARGIN) / h);
  return {
    offsetX: Math.round((SLIDE_WIDTH - w * scale) / 2),
    offsetY: Math.round((SLIDE_HEIGHT - h * scale) / 2),
    scale
  };
};

// ---------------------------------------------------------------------------
// Pure helpers

/** A draw.io HTML label (htmlLabel) as plain lines. */
export const labelLines = (value: string): string[] =>
  value.split(/<br\s*\/?>/i).map((line) =>
    line
      .replaceAll(/<[^>]*>/g, '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
  );

/** `#rrggbb` as PowerPoint's `RRGGBB`, or undefined for none or anything else. */
export const hexColour = (value: number | string | undefined): string | undefined => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  const match = /^#?([\da-f]{6})$/.exec(text);
  return match ? match[1].toUpperCase() : undefined;
};

const numeric = (value: number | string | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** A PowerPoint preset outline for a draw.io shape, with its adjust value. */
export interface Preset {
  adj?: number;
  flipH?: boolean;
  flipV?: boolean;
  prst: 'diamond' | 'ellipse' | 'hexagon' | 'parallelogram' | 'rect' | 'roundRect' | 'trapezoid';
}

/** The preset for a cell's style and size (px), or undefined for a freeform or a picture. */
export const presetFor = (
  style: DrawioCell['style'],
  width: number,
  height: number
): Preset | undefined => {
  const shape = String(style.shape ?? (style[''] === 'text' ? 'rect' : 'rect'));
  const ss = Math.max(Math.min(width, height), 1);
  const ratio = (px: number, max: number) => Math.round(clamp((px / ss) * 100_000, 0, max));
  switch (shape) {
    case 'ellipse': {
      return { prst: 'ellipse' };
    }
    case 'hexagon': {
      return { adj: ratio(numeric(style.size, ss / 4), (50_000 * width) / ss), prst: 'hexagon' };
    }
    case 'parallelogram': {
      return {
        adj: ratio(numeric(style.size, ss / 4), (100_000 * width) / ss),
        flipH: style.flipH === 1,
        prst: 'parallelogram'
      };
    }
    case 'rect': {
      if (style.rounded !== 1) return { prst: 'rect' };
      // draw.io's absolute arc size is twice the corner radius.
      return { adj: ratio(numeric(style.arcSize, 0) / 2, 50_000), prst: 'roundRect' };
    }
    case 'rhombus': {
      return { prst: 'diamond' };
    }
    case 'trapezoid': {
      return {
        adj: ratio(numeric(style.size, ss / 4), (50_000 * width) / ss),
        flipV: style.flipV === 1,
        prst: 'trapezoid'
      };
    }
    default: {
      return shape.startsWith('stencil(') || shape === 'image' ? undefined : { prst: 'rect' };
    }
  }
};

const ELLIPSE_INSET = 0.5 - Math.SQRT1_2 / 2;

/**
 * The connection sites of a preset (PowerPoint's own `cxnLst`, in its order), as
 * fractions of the shape's box. A freeform gets the four sides' middles.
 */
export const connectionSites = (preset: Preset | undefined, width: number, height: number) => {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const ss = Math.min(w, h);
  const a = preset?.adj ?? 25_000;
  let sites: Point[];
  switch (preset?.prst) {
    case 'ellipse': {
      const c = ELLIPSE_INSET;
      sites = [
        { x: 0.5, y: 0 },
        { x: c, y: c },
        { x: 0, y: 0.5 },
        { x: c, y: 1 - c },
        { x: 0.5, y: 1 },
        { x: 1 - c, y: 1 - c },
        { x: 1, y: 0.5 },
        { x: 1 - c, y: c }
      ];
      break;
    }
    case 'hexagon': {
      const x1 = (ss * a) / 100_000 / w;
      sites = [
        { x: 1, y: 0.5 },
        { x: 1 - x1, y: 1 },
        { x: x1, y: 1 },
        { x: 0, y: 0.5 },
        { x: x1, y: 0 },
        { x: 1 - x1, y: 0 }
      ];
      break;
    }
    case 'parallelogram': {
      const x1 = (ss * a) / 200_000;
      const x2 = (ss * a) / 100_000;
      const x3 = (w - x2) / 2;
      const y1 = Math.min(h, (h * (w / 2)) / Math.max(x2, 1e-6));
      sites = [
        { x: 0.5, y: (h - y1) / h },
        { x: (w - x3) / w, y: 0 },
        { x: (w - x1) / w, y: 0.5 },
        { x: x3 / w, y: 1 },
        { x: 0.5, y: y1 / h },
        { x: x1 / w, y: 0.5 }
      ];
      break;
    }
    case 'trapezoid': {
      const x1 = (ss * a) / 200_000 / w;
      sites = [
        { x: 0.5, y: 0 },
        { x: x1, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 1 - x1, y: 0.5 }
      ];
      break;
    }
    default: {
      sites = [
        { x: 0.5, y: 0 },
        { x: 0, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0.5 }
      ];
    }
  }
  return sites.map((p) => ({
    x: preset?.flipH ? 1 - p.x : p.x,
    y: preset?.flipV ? 1 - p.y : p.y
  }));
};

/** The index of the site nearest to `p` on a shape at `box`. */
export const nearestSite = (sites: Point[], box: Box, p: Point): number => {
  let best = 0;
  let distance = Infinity;
  for (const [index, site] of sites.entries()) {
    const d = Math.hypot(box.x + site.x * box.width - p.x, box.y + site.y * box.height - p.y);
    if (d < distance) {
      distance = d;
      best = index;
    }
  }
  return best;
};

/** A draw.io arrow as a PowerPoint line end, or `marker` when it has to be drawn. */
export const lineEnd = (
  arrow: number | string | undefined,
  fill: number | string | undefined
): 'arrow' | 'marker' | 'none' | 'oval' | 'triangle' => {
  const filled = fill === undefined || Number(fill) === 1;
  switch (arrow) {
    case undefined:
    case 'none': {
      return 'none';
    }
    case 'block': {
      return filled ? 'triangle' : 'marker';
    }
    case 'open': {
      return 'arrow';
    }
    case 'oval': {
      return filled ? 'oval' : 'marker';
    }
    default: {
      return 'marker';
    }
  }
};

interface MarkerPath {
  fill: 'line' | 'none' | 'paper';
  segments: Segment[];
}

const circle = (cx: number, cy: number, r: number): Segment[] => {
  const k = 0.552_284_75 * r;
  return [
    { c: 'M', x: cx + r, y: cy },
    { c: 'C', x: cx, x1: cx + r, x2: cx + k, y: cy + r, y1: cy + k, y2: cy + r },
    { c: 'C', x: cx - r, x1: cx - k, x2: cx - r, y: cy, y1: cy + r, y2: cy + k },
    { c: 'C', x: cx, x1: cx - r, x2: cx - k, y: cy - r, y1: cy - k, y2: cy - r },
    { c: 'C', x: cx + r, x1: cx + k, x2: cx + r, y: cy, y1: cy - r, y2: cy - k },
    { c: 'Z' }
  ];
};
const polyline = (points: [number, number][], closed = false): Segment[] => [
  ...points.map(([x, y], index) => ({ c: index === 0 ? 'M' : 'L', x, y }) as Segment),
  ...(closed ? [{ c: 'Z' } as Segment] : [])
];
const bar = (x: number, half: number) =>
  polyline([
    [x, -half],
    [x, half]
  ]);
const crow = (length: number, half: number): Segment[] => [
  ...polyline([
    [0, -half],
    [-length, 0],
    [0, half]
  ]),
  ...polyline([
    [0, 0],
    [-length, 0]
  ])
];

/**
 * The arrowhead PowerPoint has no line end for, in a frame where the line ends at
 * the origin coming from negative x (so the head points along +x), in px.
 */
export const markerPaths = (
  arrow: number | string | undefined,
  fill: number | string | undefined
): MarkerPath[] => {
  const filled = Number(fill) === 1;
  switch (arrow) {
    case 'block': {
      return [
        {
          fill: 'paper',
          segments: polyline(
            [
              [0, 0],
              [-12, 6],
              [-12, -6]
            ],
            true
          )
        }
      ];
    }
    case 'cross': {
      return [
        {
          fill: 'none',
          segments: [
            ...polyline([
              [-10, -4],
              [-4, 4]
            ]),
            ...polyline([
              [-10, 4],
              [-4, -4]
            ])
          ]
        }
      ];
    }
    case 'diamondThin': {
      return [
        {
          fill: filled ? 'line' : 'paper',
          segments: polyline(
            [
              [0, 0],
              [-9, 5],
              [-18, 0],
              [-9, -5]
            ],
            true
          )
        }
      ];
    }
    case 'ERmandOne': {
      return [{ fill: 'none', segments: [...bar(-6, 7), ...bar(-11, 7)] }];
    }
    case 'ERoneToMany': {
      return [{ fill: 'none', segments: [...crow(12, 7), ...bar(-16, 7)] }];
    }
    case 'ERzeroToMany': {
      return [
        { fill: 'none', segments: crow(12, 7) },
        { fill: 'paper', segments: circle(-18, 0, 4) }
      ];
    }
    case 'ERzeroToOne': {
      return [
        { fill: 'none', segments: bar(-6, 7) },
        { fill: 'paper', segments: circle(-14, 0, 4) }
      ];
    }
    case 'oval': {
      return [{ fill: 'paper', segments: circle(-5, 0, 5) }];
    }
    default: {
      return [];
    }
  }
};

const mapSegments = (segments: Segment[], f: (p: Point) => Point): Segment[] =>
  segments.map((s) => {
    if (s.c === 'Z') return s;
    const p = f(s);
    if (s.c === 'M' || s.c === 'L') return { c: s.c, ...p };
    const c1 = f({ x: s.x1, y: s.y1 });
    if (s.c === 'Q') return { c: 'Q', x: p.x, x1: c1.x, y: p.y, y1: c1.y };
    const c2 = f({ x: s.x2, y: s.y2 });
    return { c: 'C', x: p.x, x1: c1.x, x2: c2.x, y: p.y, y1: c1.y, y2: c2.y };
  });

const segmentPoints = (segments: Segment[]): Point[] =>
  segments.flatMap((s) => {
    if (s.c === 'Z') return [];
    if (s.c === 'M' || s.c === 'L') return [{ x: s.x, y: s.y }];
    if (s.c === 'Q') return [{ x: s.x1, y: s.y1 }, s];
    return [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, s];
  });

/**
 * A route of horizontal and vertical segments as its corner points (start and end
 * included), with jogs shorter than `jog` px between two parallel segments taken out
 * (mermaid steps a link by a few pixels to meet a node's centre); undefined when a
 * segment is neither horizontal nor vertical.
 */
export const orthogonalRoute = (route: Point[], tolerance = 0.75, jog = 6): Point[] | undefined => {
  let points = route.filter(
    (p, index) =>
      index === 0 || Math.hypot(p.x - route[index - 1].x, p.y - route[index - 1].y) > tolerance
  );
  if (points.length < 2) return undefined;
  const horizontal = (a: Point, b: Point) => Math.abs(a.y - b.y) <= tolerance;
  const vertical = (a: Point, b: Point) => Math.abs(a.x - b.x) <= tolerance;
  for (let index = 1; index < points.length; index++) {
    if (
      !horizontal(points[index - 1], points[index]) &&
      !vertical(points[index - 1], points[index])
    )
      return undefined;
  }
  /** Points where the line does not turn are dropped; coordinates snapped along a segment. */
  const tidy = (list: Point[]) => {
    const out = list.map((p) => ({ ...p }));
    for (let index = 1; index < out.length; index++) {
      const a = out[index - 1];
      const b = out[index];
      // The end keeps its place; the corner before it moves.
      if (horizontal(a, b))
        (index === out.length - 1 ? a : b).y = (index === out.length - 1 ? b : a).y;
      else (index === out.length - 1 ? a : b).x = (index === out.length - 1 ? b : a).x;
    }
    return out.filter((p, index) => {
      if (index === 0 || index === out.length - 1) return true;
      const a = out[index - 1];
      const b = out[index + 1];
      const same = Math.hypot(p.x - a.x, p.y - a.y) <= tolerance;
      return (
        !same && !(horizontal(a, p) && horizontal(p, b)) && !(vertical(a, p) && vertical(p, b))
      );
    });
  };
  points = tidy(points);
  for (let guard = 0; guard < 20; guard++) {
    const segments = points.length - 1;
    let changed = false;
    for (let index = 1; index < segments - 1 && !changed; index++) {
      const a = points[index];
      const b = points[index + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) >= jog) continue;
      const along = vertical(a, b) ? 'y' : 'x';
      if (index + 1 < segments - 1) {
        // Move the segment after the jog onto the line of the one before it.
        points[index + 1][along] = a[along];
        points[index + 2][along] = a[along];
      } else if (index - 1 > 0) {
        // The segment after it ends at the end: move the one before it instead.
        points[index][along] = b[along];
        points[index - 1][along] = b[along];
      } else {
        continue;
      }
      points = tidy(points);
      changed = true;
    }
    if (!changed) break;
  }
  return points;
};

export interface ConnectorShape {
  adjust: number[];
  /** The unrotated box, in px. */
  box: Box;
  flipH: boolean;
  flipV: boolean;
  prst:
    | 'bentConnector2'
    | 'bentConnector3'
    | 'bentConnector4'
    | 'bentConnector5'
    | 'straightConnector1';
  /** Clockwise, in degrees. */
  rotation: number;
}

/**
 * The PowerPoint connector that draws a route of corner points (orthogonalRoute), as
 * its preset, box, flips, rotation and adjust values; undefined when no elbow connector
 * draws it (more than five segments, or a U-turn).
 */
export const connectorShape = (corners: Point[]): ConnectorShape | undefined => {
  const start = corners[0];
  const end = corners.at(-1);
  if (!start || !end || corners.length < 2 || corners.length > 6) return undefined;
  const c = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (corners.length === 2) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    return {
      adjust: [],
      box: { height, width, x: c.x - width / 2, y: c.y - height / 2 },
      flipH: end.x < start.x,
      flipV: end.y < start.y,
      prst: 'straightConnector1',
      rotation: 0
    };
  }
  const prst = (['bentConnector2', 'bentConnector3', 'bentConnector4', 'bentConnector5'] as const)[
    corners.length - 3
  ];
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  for (const rotation of [0, 90, 180, 270]) {
    const turned = rotation === 90 || rotation === 270;
    const w = turned ? Math.abs(end.y - start.y) : Math.abs(end.x - start.x);
    const h = turned ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
    if (w < 1 || h < 1) continue;
    const cos = Math.round(Math.cos((rotation * Math.PI) / 180));
    const sin = Math.round(Math.sin((rotation * Math.PI) / 180));
    for (const flipH of [false, true]) {
      for (const flipV of [false, true]) {
        const local = corners.map((p) => {
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          // Undo the rotation (clockwise on screen), then the flips.
          const x = dx * cos + dy * sin;
          const y = -dx * sin + dy * cos;
          return { x: (flipH ? -x : x) + w / 2, y: (flipV ? -y : y) + h / 2 };
        });
        const [first] = local;
        const last = local.at(-1) ?? first;
        if (!near(first.x, 0) || !near(first.y, 0) || !near(last.x, w) || !near(last.y, h))
          continue;
        const [, c1, c2, c3, c4] = local;
        let adjust: number[] | undefined;
        if (prst === 'bentConnector2' && near(c1.x, w) && near(c1.y, 0)) adjust = [];
        if (prst === 'bentConnector3' && near(c1.y, 0) && near(c2.x, c1.x) && near(c2.y, h)) {
          adjust = [c1.x / w];
        }
        if (
          prst === 'bentConnector4' &&
          near(c1.y, 0) &&
          near(c2.x, c1.x) &&
          near(c3.y, c2.y) &&
          near(c3.x, w)
        ) {
          adjust = [c1.x / w, c2.y / h];
        }
        if (
          prst === 'bentConnector5' &&
          near(c1.y, 0) &&
          near(c2.x, c1.x) &&
          near(c3.y, c2.y) &&
          near(c4.x, c3.x) &&
          near(c4.y, h)
        ) {
          adjust = [c1.x / w, c2.y / h, c3.x / w];
        }
        if (!adjust) continue;
        return {
          adjust: adjust.map((value) => Math.round(value * 100_000)),
          box: { height: h, width: w, x: c.x - w / 2, y: c.y - h / 2 },
          flipH,
          flipV,
          prst,
          rotation
        };
      }
    }
  }
  return undefined;
};

/**
 * Where a line arriving at `tip` from `before` reaches `box` when carried on straight,
 * if `tip` is outside the box and the box is no more than `max` px away; else undefined.
 */
export const reachBox = (before: Point, tip: Point, box: Box, max = 30): Point | undefined => {
  const length = Math.hypot(tip.x - before.x, tip.y - before.y);
  if (length === 0) return undefined;
  const u = { x: (tip.x - before.x) / length, y: (tip.y - before.y) / length };
  const inside = (p: Point) =>
    p.x >= box.x - 0.5 &&
    p.x <= box.x + box.width + 0.5 &&
    p.y >= box.y - 0.5 &&
    p.y <= box.y + box.height + 0.5;
  if (inside(tip)) return undefined;
  let enter = 0;
  let leave = Infinity;
  for (const [p, d, low, high] of [
    [tip.x, u.x, box.x, box.x + box.width],
    [tip.y, u.y, box.y, box.y + box.height]
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < low || p > high) return undefined;
      continue;
    }
    const t1 = (low - p) / d;
    const t2 = (high - p) / d;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
  }
  if (enter > leave || enter <= 0.5 || enter > max) return undefined;
  return { x: tip.x + u.x * enter, y: tip.y + u.y * enter };
};

/** Whether a drawn line stays within `tolerance` px of the straight line between its ends. */
export const nearlyStraight = (points: Point[], tolerance = 2): boolean => {
  const start = points[0];
  const end = points.at(-1);
  if (!start || !end) return false;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 1) return false;
  return points.every(
    (p) =>
      Math.abs((end.x - start.x) * (start.y - p.y) - (start.x - p.x) * (end.y - start.y)) /
        length <=
      tolerance
  );
};

// ---------------------------------------------------------------------------
// XML pieces

const colourXml = (hex: string, alpha = 1) =>
  alpha < 1
    ? `<a:srgbClr val="${hex}"><a:alpha val="${Math.round(clamp(alpha, 0, 1) * 100_000)}"/></a:srgbClr>`
    : `<a:srgbClr val="${hex}"/>`;

const solidFill = (hex: string, alpha = 1) => `<a:solidFill>${colourXml(hex, alpha)}</a:solidFill>`;

const percent = (value: number | string | undefined) => clamp(numeric(value, 100), 0, 100) / 100;

const relationships = (rels: [id: string, type: string, target: string][]) =>
  `${HEADER}<Relationships xmlns="${PACKAGE_RELS}">${rels
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

const emptyTree =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const CLR_MAP =
  'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

/** Fonts that have Japanese glyphs, used for East Asian text as well. */
const JAPANESE_FONT =
  /jp|japan|gothic|mincho|meiryo|hiragino|osaka|biz ud|游|メイリオ|ヒラギノ|ゴシック|明朝/i;

/** Characters drawn full width (CJK, kana, full-width forms). */
const WIDE = /[\u3000-\u9FFF\uFF00-\uFFEF]/;

const fontFace = (family: string): string => family.replaceAll(/["']/g, '').trim();

// ---------------------------------------------------------------------------
// The slide

interface Placed {
  box: Box;
  cell: DrawioVertex;
  id: number;
  preset?: Preset;
}

interface Media {
  extension: 'png' | 'svg';
  data: Uint8Array;
  path: string;
  relId: string;
}

class SlideWriter {
  private readonly byId = new Map<string, DrawioCell>();
  private readonly children = new Map<string, DrawioCell[]>();
  private readonly media: Media[] = [];
  private nextId = 2;
  private readonly offsetX: number;
  private readonly offsetY: number;
  private readonly origins = new Map<string, Point>();
  private readonly pictureRels = new Map<string, { png: string; svg?: string }>();
  private readonly placed = new Map<string, Placed>();
  private readonly scale: number;

  constructor(private readonly input: PptxInput) {
    const placement = slidePlacement(input.width, input.height);
    this.scale = placement.scale;
    this.offsetX = placement.offsetX;
    this.offsetY = placement.offsetY;
    for (const cell of input.cells) {
      this.byId.set(cell.id, cell);
      this.children.set(cell.parent, [...(this.children.get(cell.parent) ?? []), cell]);
    }
  }

  /** The shapes of the slide, and the pictures it refers to. */
  write(): { media: Media[]; shapes: string } {
    // Every vertex's box first, so a connector can glue to a shape drawn after it.
    for (const cell of this.input.cells) {
      if (cell.kind !== 'vertex') continue;
      const origin = this.origin(cell.parent);
      const box = {
        height: cell.height,
        width: cell.width,
        x: origin.x + cell.x,
        y: origin.y + cell.y
      };
      this.placed.set(cell.id, {
        box,
        cell,
        id: this.nextId++,
        preset: presetFor(cell.style, cell.width, cell.height)
      });
    }
    const shapes = (this.children.get(LAYER) ?? []).map((cell) => this.cellXml(cell)).join('');
    return { media: this.media, shapes };
  }

  // ------------------------------------------------------------ geometry

  /** A parent cell's top left, absolute (px). */
  private origin(id: string): Point {
    const known = this.origins.get(id);
    if (known) return known;
    const cell = this.byId.get(id);
    let origin: Point = { x: 0, y: 0 };
    if (cell?.kind === 'vertex') {
      const parent = this.origin(cell.parent);
      origin = { x: parent.x + cell.x, y: parent.y + cell.y };
    }
    this.origins.set(id, origin);
    return origin;
  }

  private emu(px: number) {
    return Math.round(px * EMU_PER_PX * this.scale);
  }

  private x(px: number) {
    return this.offsetX + this.emu(px);
  }

  private y(px: number) {
    return this.offsetY + this.emu(px);
  }

  private xfrm(box: Box, extra = '') {
    return (
      `<a:xfrm${extra}><a:off x="${this.x(box.x)}" y="${this.y(box.y)}"/>` +
      `<a:ext cx="${Math.max(this.emu(box.width), 1)}" cy="${Math.max(this.emu(box.height), 1)}"/></a:xfrm>`
    );
  }

  /** A freeform from absolute segments (px): its box and its `custGeom`. */
  private freeform(
    paths: { fill: boolean; segments: Segment[] }[],
    { sites = false } = {}
  ): { box: Box; geometry: string } | undefined {
    const box = boundsOf(paths.flatMap((path) => segmentPoints(path.segments)));
    if (!box) return undefined;
    const w = Math.max(this.emu(box.width), 1);
    const h = Math.max(this.emu(box.height), 1);
    const px = (value: number) => this.emu(value);
    const pt = (x: number, y: number) => `<a:pt x="${px(x - box.x)}" y="${px(y - box.y)}"/>`;
    const commands = (segments: Segment[]) =>
      segments
        .map((s) => {
          switch (s.c) {
            case 'C': {
              return `<a:cubicBezTo>${pt(s.x1, s.y1)}${pt(s.x2, s.y2)}${pt(s.x, s.y)}</a:cubicBezTo>`;
            }
            case 'L': {
              return `<a:lnTo>${pt(s.x, s.y)}</a:lnTo>`;
            }
            case 'M': {
              return `<a:moveTo>${pt(s.x, s.y)}</a:moveTo>`;
            }
            case 'Q': {
              return `<a:quadBezTo>${pt(s.x1, s.y1)}${pt(s.x, s.y)}</a:quadBezTo>`;
            }
            case 'Z': {
              return '<a:close/>';
            }
          }
        })
        .join('');
    const cxn = sites
      ? '<a:cxnLst><a:cxn ang="3cd4"><a:pos x="hc" y="t"/></a:cxn><a:cxn ang="cd2"><a:pos x="l" y="vc"/></a:cxn><a:cxn ang="cd4"><a:pos x="hc" y="b"/></a:cxn><a:cxn ang="0"><a:pos x="r" y="vc"/></a:cxn></a:cxnLst>'
      : '<a:cxnLst/>';
    const pathList = paths
      .map(
        (path) =>
          `<a:path w="${w}" h="${h}"${path.fill ? '' : ' fill="none"'}>${commands(path.segments)}</a:path>`
      )
      .join('');
    return {
      box: { height: box.height, width: box.width, x: box.x, y: box.y },
      geometry: `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/>${cxn}<a:rect l="l" t="t" r="r" b="b"/><a:pathLst>${pathList}</a:pathLst></a:custGeom>`
    };
  }

  // ------------------------------------------------------------ paint and text

  private fill(style: DrawioCell['style']): string {
    const hex = hexColour(style.fillColor);
    if (!hex || style.fillColor === 'none') return '<a:noFill/>';
    return solidFill(hex, percent(style.fillOpacity) * percent(style.opacity));
  }

  private line(style: DrawioCell['style'], ends = ''): string {
    const hex = hexColour(style.strokeColor);
    if (!hex) return `<a:ln>${'<a:noFill/>'}${ends}</a:ln>`;
    const width = numeric(style.strokeWidth, 1);
    let dash = '';
    if (Number(style.dashed) === 1) {
      const values = String(style.dashPattern ?? '3 3')
        .split(/\s+/)
        .map(Number)
        .filter((v) => Number.isFinite(v) && v >= 0);
      const pairs = values.length % 2 === 1 ? [...values, ...values] : values;
      const ds: string[] = [];
      for (let index = 0; index + 1 < pairs.length; index += 2) {
        ds.push(
          `<a:ds d="${Math.round(Math.max(pairs[index], 0.1) * 100_000)}" sp="${Math.round(pairs[index + 1] * 100_000)}"/>`
        );
      }
      dash = ds.length > 0 ? `<a:custDash>${ds.join('')}</a:custDash>` : '<a:prstDash val="dash"/>';
    }
    return (
      `<a:ln w="${Math.max(this.emu(width), 1)}">` +
      solidFill(hex, percent(style.strokeOpacity) * percent(style.opacity)) +
      dash +
      '<a:round/>' +
      ends +
      '</a:ln>'
    );
  }

  private runProperties(style: DrawioCell['style'], text: string): string {
    const size = numeric(style.fontSize, 16) * 0.75 * this.scale;
    const bits = numeric(style.fontStyle, 0);
    const colour = hexColour(style.fontColor) ?? '000000';
    const family = fontFace(String(style.fontFamily ?? ''));
    const latin = family && !/^(sans-serif|serif|monospace|system-ui)$/i.test(family) ? family : '';
    const ea = latin && JAPANESE_FONT.test(latin) ? latin : '';
    const lang = WIDE.test(text) ? 'ja-JP' : 'en-US';
    return (
      `<a:rPr lang="${lang}" altLang="en-US" sz="${Math.max(100, Math.round(size * 100))}"` +
      `${bits & 1 ? ' b="1"' : ' b="0"'}${bits & 2 ? ' i="1"' : ''}${bits & 4 ? ' u="sng"' : ''} dirty="0">` +
      solidFill(colour) +
      (latin ? `<a:latin typeface="${escapeXml(latin)}"/>` : '') +
      (ea ? `<a:ea typeface="${escapeXml(ea)}"/>` : '') +
      '</a:rPr>'
    );
  }

  /** The text of a shape or a text box; `beside`: a caption or a link label, centred. */
  private textBody(
    style: DrawioCell['style'],
    value: string,
    { beside = false, box = true }: { beside?: boolean; box?: boolean } = {}
  ): string {
    const lines = value ? labelLines(value) : [];
    const align = style.align === 'left' ? 'l' : style.align === 'right' ? 'r' : 'ctr';
    const anchor =
      beside || style.verticalAlign === 'middle' || style.verticalAlign === undefined
        ? 'ctr'
        : style.verticalAlign === 'top'
          ? 't'
          : style.verticalAlign === 'bottom'
            ? 'b'
            : 'ctr';
    const inset = (key: string) => (beside ? 0 : this.emu(Math.max(numeric(style[key], 0), 0)));
    const vertical = style.horizontal === 0 ? ' vert="vert270"' : '';
    const body =
      `<a:bodyPr wrap="none" lIns="${inset('spacingLeft')}" tIns="${inset('spacingTop')}" rIns="${inset('spacingRight')}" bIns="${inset('spacingBottom')}" anchor="${anchor}" rtlCol="0"${vertical}><a:noAutofit/></a:bodyPr>` +
      '<a:lstStyle/>';
    const paragraphs =
      lines.length === 0
        ? `<a:p><a:pPr algn="${align}"/><a:endParaRPr lang="ja-JP" altLang="en-US" sz="${Math.max(100, Math.round(numeric(style.fontSize, 16) * 75 * this.scale))}" dirty="0"/></a:p>`
        : lines
            .map((line) => {
              const properties = this.runProperties(style, line);
              if (!line) {
                return `<a:p><a:pPr algn="${align}"/>${properties.replace('<a:rPr', '<a:endParaRPr').replace('</a:rPr>', '</a:endParaRPr>')}</a:p>`;
              }
              return `<a:p><a:pPr algn="${align}"/><a:r>${properties}<a:t>${escapeXml(line)}</a:t></a:r></a:p>`;
            })
            .join('');
    return box ? `<p:txBody>${body}${paragraphs}</p:txBody>` : `${body}${paragraphs}`;
  }

  private name(prefix: string, value: string, id: number): string {
    const first = labelLines(value)
      .map((line) => line.trim())
      .find(Boolean);
    return first ? first.slice(0, 60) : `${prefix} ${id}`;
  }

  // ------------------------------------------------------------ cells

  private cellXml(cell: DrawioCell): string {
    if (cell.kind === 'edge') return this.edgeXml(cell);
    const placed = this.placed.get(cell.id);
    if (!placed) return '';
    const own = this.vertexXml(placed);
    const kids = this.children.get(cell.id) ?? [];
    const inner = kids.map((child) => this.cellXml(child)).join('');
    // A container is drawn behind the nodes it holds; a node with parts is a group.
    if (kids.length === 0 || cell.style.container === 1) return own + inner;
    const bounds = this.bounds(cell);
    const id = this.nextId++;
    const frame =
      `<a:off x="${this.x(bounds.x)}" y="${this.y(bounds.y)}"/>` +
      `<a:ext cx="${Math.max(this.emu(bounds.width), 1)}" cy="${Math.max(this.emu(bounds.height), 1)}"/>`;
    return (
      `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${escapeXml(this.name('Group', cell.value, id))}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm>${frame}${frame.replace('<a:off', '<a:chOff').replace('<a:ext', '<a:chExt')}</a:xfrm></p:grpSpPr>` +
      own +
      inner +
      '</p:grpSp>'
    );
  }

  /** The box around a cell and everything inside it (px, absolute). */
  private bounds(cell: DrawioVertex): Box {
    const points: Point[] = [];
    const visit = (current: DrawioCell) => {
      if (current.kind === 'vertex') {
        const box = this.placed.get(current.id)?.box;
        if (box) {
          points.push({ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height });
        }
      } else {
        points.push(...this.route(current));
      }
      for (const child of this.children.get(current.id) ?? []) visit(child);
    };
    visit(cell);
    return boundsOf(points) ?? { height: cell.height, width: cell.width, x: cell.x, y: cell.y };
  }

  private vertexXml({ box, cell, id, preset }: Placed): string {
    const style = cell.style;
    if (style.shape === 'image') return this.pictureXml(cell, box, id);
    const isText = style[''] === 'text';
    const outside =
      style.verticalLabelPosition === 'bottom' ||
      style.verticalLabelPosition === 'top' ||
      style.labelPosition === 'left' ||
      style.labelPosition === 'right';
    const rotation = numeric(style.rotation, 0);
    const flips = `${preset?.flipH ? ' flipH="1"' : ''}${preset?.flipV ? ' flipV="1"' : ''}${
      rotation ? ` rot="${Math.round(rotation * 60_000)}"` : ''
    }`;
    let geometry: string;
    let frame = box;
    if (preset) {
      const adjust =
        preset.adj === undefined
          ? '<a:avLst/>'
          : `<a:avLst><a:gd name="adj" fmla="val ${preset.adj}"/></a:avLst>`;
      geometry = `<a:prstGeom prst="${preset.prst}">${adjust}</a:prstGeom>`;
    } else {
      const outline = cell.outline ?? [];
      const filled = style.fillColor !== 'none';
      const freeform = this.freeform(
        [
          {
            fill: filled,
            segments: mapSegments(outline, (p) => ({ x: p.x + box.x, y: p.y + box.y }))
          }
        ],
        { sites: true }
      );
      if (freeform) {
        geometry = freeform.geometry;
        frame = freeform.box;
      } else {
        geometry = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
      }
    }
    const name = escapeXml(this.name(isText ? 'Text' : 'Shape', cell.value, id));
    const textBox = isText ? ' txBox="1"' : '';
    const text = outside ? this.textBody(style, '') : this.textBody(style, cell.value);
    const fill = isText
      ? hexColour(style.labelBackgroundColor)
        ? solidFill(hexColour(style.labelBackgroundColor) ?? 'FFFFFF')
        : '<a:noFill/>'
      : this.fill(style);
    const line = isText ? '<a:ln><a:noFill/></a:ln>' : this.line(style);
    const shape =
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr${textBox}/><p:nvPr/></p:nvSpPr>` +
      `<p:spPr>${this.xfrm(frame, flips)}${geometry}${fill}${line}</p:spPr>${text}</p:sp>`;
    return outside && cell.value ? shape + this.captionXml(style, cell.value, box) : shape;
  }

  /** A label drawn beside its shape (an icon's caption) as a text box there. */
  private captionXml(style: DrawioCell['style'], value: string, shape: Box): string {
    const lines = labelLines(value);
    const size = numeric(style.fontSize, 16);
    const width = Math.max(
      ...lines.map((line) => [...line].reduce((sum, ch) => sum + (WIDE.test(ch) ? 1 : 0.6), 0)),
      1
    );
    const box: Box = { height: lines.length * size * 1.25, width: width * size + 4, x: 0, y: 0 };
    if (style.verticalLabelPosition === 'bottom') {
      box.x = shape.x + shape.width / 2 - box.width / 2;
      box.y = shape.y + shape.height + numeric(style.spacingTop, 0);
    } else if (style.verticalLabelPosition === 'top') {
      box.x = shape.x + shape.width / 2 - box.width / 2;
      box.y = shape.y - numeric(style.spacingBottom, 0) - box.height;
    } else if (style.labelPosition === 'right') {
      box.x = shape.x + shape.width;
      box.y = shape.y + shape.height / 2 - box.height / 2;
    } else {
      box.x = shape.x - box.width;
      box.y = shape.y + shape.height / 2 - box.height / 2;
    }
    return this.textBoxXml(style, value, box);
  }

  private textBoxXml(style: DrawioCell['style'], value: string, box: Box): string {
    const id = this.nextId++;
    const background = hexColour(style.labelBackgroundColor);
    return (
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(this.name('Text', value, id))}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
      `<p:spPr>${this.xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${
        background ? solidFill(background) : '<a:noFill/>'
      }<a:ln><a:noFill/></a:ln></p:spPr>` +
      this.textBody({ ...style, align: 'center', verticalAlign: 'middle' }, value, {
        beside: true
      }) +
      '</p:sp>'
    );
  }

  private pictureXml(cell: DrawioVertex, box: Box, id: number): string {
    const source = String(cell.style.image ?? '');
    const picture = this.input.pictures?.get(source);
    const caption = cell.value ? this.captionXml(cell.style, cell.value, box) : '';
    if (!picture) return caption;
    let rels = this.pictureRels.get(source);
    if (!rels) {
      // rId1 and rId2 are the layout and the notes.
      const add = (data: Uint8Array, extension: 'png' | 'svg') => {
        const index = this.media.length + 1;
        this.media.push({
          data,
          extension,
          path: `media/image${index}.${extension}`,
          relId: `rId${index + 2}`
        });
        return `rId${index + 2}`;
      };
      rels = { png: add(picture.png, 'png'), svg: picture.svg && add(picture.svg, 'svg') };
      this.pictureRels.set(source, rels);
    }
    const svgExt = rels.svg
      ? `<a:extLst><a:ext uri="${SVG_BLIP_EXT}"><asvg:svgBlip xmlns:asvg="${NS_ASVG}" r:embed="${rels.svg}"/></a:ext></a:extLst>`
      : '';
    return (
      `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
      `<p:blipFill><a:blip r:embed="${rels.png}">${svgExt}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
      `<p:spPr>${this.xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
      caption
    );
  }

  /** An edge's route, absolute (px): start, waypoints, end. */
  private route(edge: DrawioEdge): Point[] {
    const origin = this.origin(edge.parent);
    const absolute = (p: Point) => ({ x: p.x + origin.x, y: p.y + origin.y });
    return [edge.sourcePoint, ...edge.points, edge.targetPoint].map(absolute);
  }

  private edgeXml(edge: DrawioEdge): string {
    const origin = this.origin(edge.parent);
    const absolute = (p: Point) => ({ x: p.x + origin.x, y: p.y + origin.y });
    const route = this.route(edge);
    let path = edge.path ? mapSegments(edge.path, absolute) : undefined;
    const drawn = path && path.length > 1 ? flatten(path).flatMap((line) => line.points) : route;
    if (drawn.length < 2) return '';
    // Where mermaid stops a link short of a box for its arrowhead (class diagrams), the
    // line goes on to the box, so the arrowhead touches it as drawn.
    const reach = (cellId: string | undefined, tip: Point, before: Point) => {
      const box = cellId ? this.placed.get(cellId)?.box : undefined;
      return box ? reachBox(before, tip, box) : undefined;
    };
    const newEnd = reach(edge.target, drawn.at(-1) ?? drawn[0], drawn.at(-2) ?? drawn[0]);
    if (newEnd) {
      drawn.push(newEnd);
      route[route.length - 1] = newEnd;
      path = path && [...path, { c: 'L', ...newEnd }];
    }
    const newStart = reach(edge.source, drawn[0], drawn[1]);
    if (newStart) {
      drawn.unshift(newStart);
      route[0] = newStart;
      path = path && [
        { c: 'M', ...newStart },
        { c: 'L', x: drawn[1].x, y: drawn[1].y },
        ...path.slice(1)
      ];
    }
    const start = drawn[0];
    const end = drawn.at(-1) ?? start;
    const style = edge.style;
    const tail = lineEnd(style.endArrow, style.endFill);
    const head = lineEnd(style.startArrow, style.startFill);
    const width = numeric(style.strokeWidth, 1);
    const size = width <= 1.5 ? 'lg' : 'med';
    const ends =
      (head === 'none' || head === 'marker'
        ? ''
        : `<a:headEnd type="${head}" w="${size}" len="${size}"/>`) +
      (tail === 'none' || tail === 'marker'
        ? ''
        : `<a:tailEnd type="${tail}" w="${size}" len="${size}"/>`);

    const id = this.nextId++;
    const glue = (cellId: string | undefined, p: Point, tag: 'endCxn' | 'stCxn') => {
      const target = cellId ? this.placed.get(cellId) : undefined;
      if (!target) return '';
      const sites = connectionSites(target.preset, target.box.width, target.box.height);
      return `<a:${tag} id="${target.id}" idx="${nearestSite(sites, target.box, p)}"/>`;
    };
    const glued = glue(edge.source, start, 'stCxn') + glue(edge.target, end, 'endCxn');
    // An elbow or straight connector where one draws the route, so PowerPoint can
    // re-route it when a shape moves; any other route as drawn.
    const corners = orthogonalRoute(route);
    const preset =
      (corners && connectorShape(corners)) ??
      (nearlyStraight(drawn) ? connectorShape([start, end]) : undefined);
    let spPr: string;
    if (preset) {
      const attributes = `${preset.rotation ? ` rot="${preset.rotation * 60_000}"` : ''}${
        preset.flipH ? ' flipH="1"' : ''
      }${preset.flipV ? ' flipV="1"' : ''}`;
      const adjust = preset.adjust
        .map((value, index) => `<a:gd name="adj${index + 1}" fmla="val ${value}"/>`)
        .join('');
      spPr = `${this.xfrm(preset.box, attributes)}<a:prstGeom prst="${preset.prst}"><a:avLst>${adjust}</a:avLst></a:prstGeom>`;
    } else {
      const segments =
        path ?? route.map((p, index) => ({ c: index === 0 ? 'M' : 'L', ...p }) as Segment);
      const freeform = this.freeform([{ fill: false, segments }]);
      if (!freeform) return '';
      spPr = `${this.xfrm(freeform.box)}${freeform.geometry}`;
    }
    const name = escapeXml(this.name('Connector', '', id));
    let xml =
      `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr>${glued}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>` +
      `<p:spPr>${spPr}<a:noFill/>${this.line(style, ends)}</p:spPr></p:cxnSp>`;
    if (tail === 'marker') xml += this.markerXml(style.endArrow, style.endFill, drawn, style);
    if (head === 'marker') {
      xml += this.markerXml(style.startArrow, style.startFill, drawn.toReversed(), style);
    }
    if (edge.value) xml += this.edgeLabelXml(edge, drawn, absolute);
    return xml;
  }

  /** An arrowhead with no PowerPoint line end, drawn at the end of `points`. */
  private markerXml(
    arrow: number | string | undefined,
    fill: number | string | undefined,
    points: Point[],
    style: DrawioCell['style']
  ): string {
    const tip = points.at(-1);
    if (!tip) return '';
    // The direction the line arrives in, from a point a little way back along it.
    let from = points.at(-2) ?? tip;
    for (let index = points.length - 2; index >= 0; index--) {
      from = points[index];
      if (Math.hypot(tip.x - from.x, tip.y - from.y) >= 4) break;
    }
    const length = Math.hypot(tip.x - from.x, tip.y - from.y);
    if (length === 0) return '';
    const u = { x: (tip.x - from.x) / length, y: (tip.y - from.y) / length };
    const toSlide = (p: Point) => ({
      x: tip.x + p.x * u.x - p.y * u.y,
      y: tip.y + p.x * u.y + p.y * u.x
    });
    const parts = markerPaths(arrow, fill);
    if (parts.length === 0) return '';
    const stroke = hexColour(style.strokeColor) ?? '000000';
    return parts
      .map((part) => {
        const freeform = this.freeform([
          { fill: part.fill !== 'none', segments: mapSegments(part.segments, toSlide) }
        ]);
        if (!freeform) return '';
        const id = this.nextId++;
        const paint =
          part.fill === 'none'
            ? '<a:noFill/>'
            : part.fill === 'line'
              ? solidFill(stroke)
              : solidFill(hexColour(this.input.background) ?? 'FFFFFF');
        return (
          `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Arrowhead ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
          `<p:spPr>${this.xfrm(freeform.box)}${freeform.geometry}${paint}${this.line({ ...style, dashed: 0 })}</p:spPr></p:sp>`
        );
      })
      .join('');
  }

  private edgeLabelXml(edge: DrawioEdge, drawn: Point[], absolute: (p: Point) => Point): string {
    let box: Box;
    if (edge.labelBox) {
      const at = absolute(edge.labelBox);
      box = { ...edge.labelBox, x: at.x, y: at.y };
    } else {
      const middle = drawn[Math.floor(drawn.length / 2)];
      const offset = edge.labelOffset ?? { x: 0, y: 0 };
      const lines = labelLines(edge.value);
      const size = numeric(edge.style.fontSize, 14);
      const width = Math.max(...lines.map((line) => line.length), 1) * size * 0.7;
      const height = lines.length * size * 1.25;
      box = {
        height,
        width,
        x: middle.x + offset.x - width / 2,
        y: middle.y + offset.y - height / 2
      };
    }
    return this.textBoxXml(edge.style, edge.value, box);
  }
}

// ---------------------------------------------------------------------------
// The package

const theme = (name: string) => {
  const fonts = (latin: string) =>
    `<a:latin typeface="${latin}"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="游ゴシック"/>`;
  const lines = [9525, 25_400, 38_100]
    .map(
      (w) =>
        `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`
    )
    .join('');
  const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return (
    `${HEADER}<a:theme xmlns:a="${NS_A}" name="${name}"><a:themeElements>` +
    '<a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>' +
    `<a:fontScheme name="Office"><a:majorFont>${fonts('Calibri Light')}</a:majorFont><a:minorFont>${fonts('Calibri')}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Office"><a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst><a:lnStyleLst>${lines}</a:lnStyleLst>` +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    `<a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst></a:fmtScheme>` +
    '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
  );
};

const slideXml = (shapes: string, background?: string) => {
  const hex = hexColour(background);
  const bg = hex ? `<p:bg><p:bgPr>${solidFill(hex)}<a:effectLst/></p:bgPr></p:bg>` : '';
  return (
    `${HEADER}<p:sld ${NAMESPACES}><p:cSld>${bg}<p:spTree>${emptyTree}${shapes}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  );
};

const masterXml = () =>
  `${HEADER}<p:sldMaster ${NAMESPACES}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>` +
  `<p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/>` +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>' +
  '<p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>' +
  '<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';

const layoutXml = () =>
  `${HEADER}<p:sldLayout ${NAMESPACES} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${emptyTree}</p:spTree></p:cSld>` +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

// The notes page is portrait, 7.5 × 10 in, with the notes in its lower part.
const NOTES_BODY =
  '<a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm>';

const notesMasterXml = () =>
  `${HEADER}<p:notesMaster ${NAMESPACES}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${emptyTree}` +
  '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="1"/></p:nvPr></p:nvSpPr>' +
  `<p:spPr>${NOTES_BODY}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p></p:txBody></p:sp>' +
  `</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/>` +
  '<p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle>' +
  '</p:notesMaster>';

const notesXml = (code: string) => {
  const paragraphs = code
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) =>
      line
        ? `<a:p><a:r><a:rPr lang="en-US" dirty="0"><a:latin typeface="Consolas"/></a:rPr><a:t>${escapeXml(line.replaceAll('\t', '    '))}</a:t></a:r></a:p>`
        : '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>'
    )
    .join('');
  return (
    `${HEADER}<p:notes ${NAMESPACES}><p:cSld><p:spTree>${emptyTree}` +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
    `<p:spPr>${NOTES_BODY}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Mermaid</a:t></a:r></a:p>${paragraphs}</p:txBody></p:sp>` +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>'
  );
};

const presentationXml = () =>
  `${HEADER}<p:presentation ${NAMESPACES} saveSubsetFonts="1">` +
  '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
  '<p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst>' +
  '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>' +
  `<p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/><p:notesSz cx="6858000" cy="9144000"/>` +
  '<p:defaultTextStyle><a:defPPr><a:defRPr lang="ja-JP"/></a:defPPr><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle>' +
  '</p:presentation>';

const contentTypes = (media: Media[]) =>
  `${HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  (media.some((m) => m.extension === 'png')
    ? '<Default Extension="png" ContentType="image/png"/>'
    : '') +
  (media.some((m) => m.extension === 'svg')
    ? '<Default Extension="svg" ContentType="image/svg+xml"/>'
    : '') +
  `<Override PartName="/${PPTX_PARTS.presentation}" ContentType="${CONTENT}.presentationml.presentation.main+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.master}" ContentType="${CONTENT}.presentationml.slideMaster+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.layout}" ContentType="${CONTENT}.presentationml.slideLayout+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.slide}" ContentType="${CONTENT}.presentationml.slide+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.notesMaster}" ContentType="${CONTENT}.presentationml.notesMaster+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.notes}" ContentType="${CONTENT}.presentationml.notesSlide+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.theme}" ContentType="${CONTENT}.theme+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.theme2}" ContentType="${CONTENT}.theme+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.presProps}" ContentType="${CONTENT}.presentationml.presProps+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.viewProps}" ContentType="${CONTENT}.presentationml.viewProps+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.tableStyles}" ContentType="${CONTENT}.presentationml.tableStyles+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.core}" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `<Override PartName="/${PPTX_PARTS.app}" ContentType="${CONTENT}.extended-properties+xml"/>` +
  '</Types>';

const coreXml = (title: string, now: Date) => {
  const stamp = `${now.toISOString().slice(0, 19)}Z`;
  return (
    `${HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escapeXml(title)}</dc:title>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
};

const appXml = () =>
  `${HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  '<Application>mermaid-editor</Application><Slides>1</Slides><Notes>1</Notes></Properties>';

/** The XML parts of the package, by path, and the pictures (`ppt/media/…`). */
export const pptxParts = (
  input: PptxInput,
  now = new Date()
): { media: Record<string, Uint8Array>; parts: Record<string, string> } => {
  const { media, shapes } = new SlideWriter(input).write();
  const parts: Record<string, string> = {
    [PPTX_PARTS.app]: appXml(),
    [PPTX_PARTS.contentTypes]: contentTypes(media),
    [PPTX_PARTS.core]: coreXml(input.title, now),
    [PPTX_PARTS.layout]: layoutXml(),
    [PPTX_PARTS.layoutRels]: relationships([
      ['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml']
    ]),
    [PPTX_PARTS.master]: masterXml(),
    [PPTX_PARTS.masterRels]: relationships([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/theme`, '../theme/theme1.xml']
    ]),
    [PPTX_PARTS.notes]: notesXml(input.code),
    [PPTX_PARTS.notesMaster]: notesMasterXml(),
    [PPTX_PARTS.notesMasterRels]: relationships([['rId1', `${REL}/theme`, '../theme/theme2.xml']]),
    [PPTX_PARTS.notesRels]: relationships([
      ['rId1', `${REL}/notesMaster`, '../notesMasters/notesMaster1.xml'],
      ['rId2', `${REL}/slide`, '../slides/slide1.xml']
    ]),
    [PPTX_PARTS.presProps]: `${HEADER}<p:presentationPr ${NAMESPACES}/>`,
    [PPTX_PARTS.presentation]: presentationXml(),
    [PPTX_PARTS.presentationRels]: relationships([
      ['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'],
      ['rId2', `${REL}/slide`, 'slides/slide1.xml'],
      ['rId3', `${REL}/notesMaster`, 'notesMasters/notesMaster1.xml'],
      ['rId4', `${REL}/theme`, 'theme/theme1.xml'],
      ['rId5', `${REL}/presProps`, 'presProps.xml'],
      ['rId6', `${REL}/viewProps`, 'viewProps.xml'],
      ['rId7', `${REL}/tableStyles`, 'tableStyles.xml']
    ]),
    [PPTX_PARTS.rels]: relationships([
      ['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'],
      ['rId2', `${PACKAGE_RELS}/metadata/core-properties`, 'docProps/core.xml'],
      ['rId3', `${REL}/extended-properties`, 'docProps/app.xml']
    ]),
    [PPTX_PARTS.slide]: slideXml(shapes, input.background),
    [PPTX_PARTS.slideRels]: relationships([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/notesSlide`, '../notesSlides/notesSlide1.xml'],
      ...media.map((m) => [m.relId, `${REL}/image`, `../${m.path}`] as [string, string, string])
    ]),
    [PPTX_PARTS.tableStyles]: `${HEADER}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
    [PPTX_PARTS.theme]: theme('Office Theme'),
    [PPTX_PARTS.theme2]: theme('Office Theme'),
    [PPTX_PARTS.viewProps]:
      `${HEADER}<p:viewPr ${NAMESPACES}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>` +
      '<p:gridSpacing cx="76200" cy="76200"/></p:viewPr>'
  };
  return {
    media: Object.fromEntries(media.map((m) => [`ppt/${m.path}`, m.data])),
    parts
  };
};

/** The `.pptx` file. `[Content_Types].xml` comes first, as Office writes it. */
export const buildPptx = (input: PptxInput, now = new Date()): Uint8Array => {
  const { media, parts } = pptxParts(input, now);
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    [PPTX_PARTS.contentTypes]: [strToU8(parts[PPTX_PARTS.contentTypes]), { level: 6 }]
  };
  for (const [path, text] of Object.entries(parts)) {
    if (path !== PPTX_PARTS.contentTypes) files[path] = [strToU8(text), { level: 6 }];
  }
  for (const [path, data] of Object.entries(media)) {
    files[path] = [data, { level: path.endsWith('.png') ? 0 : 6 }];
  }
  return zipSync(files, { mtime: now });
};

/** The image URLs of the cells that are pictures, for the caller to turn into PNGs. */
export const pictureSources = (cells: DrawioCell[]): string[] => [
  ...new Set(
    cells
      .filter((cell) => cell.kind === 'vertex' && cell.style.shape === 'image')
      .map((cell) => String(cell.style.image ?? ''))
      .filter(Boolean)
  )
];

/**
 * A draw.io image URL's bytes and type. draw.io style values hold no `;`, so the
 * converter writes `data:<type>,<base64>`; a URL-encoded SVG stays URL-encoded.
 */
export const decodeDataUrl = (url: string): undefined | { bytes: Uint8Array; type: string } => {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!match) return undefined;
  const [, type, , payload] = match;
  try {
    if (/^(%3c|<)/i.test(payload)) {
      return { bytes: strToU8(decodeURIComponent(payload)), type };
    }
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.codePointAt(index) ?? 0;
    return { bytes, type };
  } catch {
    return undefined;
  }
};
