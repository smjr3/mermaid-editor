/**
 * Local: SVG path data and 2D geometry for the .drawio converter (svgToDrawio.ts).
 * A path is parsed into absolute move/line/cubic/quadratic/close segments (arcs
 * become cubics, so an affine transform keeps the shape exact), which can be
 * transformed, measured and flattened into polylines.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** An affine matrix as in SVG: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export type Segment =
  | { c: 'C'; x: number; x1: number; x2: number; y: number; y1: number; y2: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'M'; x: number; y: number }
  | { c: 'Q'; x: number; x1: number; y: number; y1: number }
  | { c: 'Z' };

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `m · n`: n is applied first. */
export const multiply = (m: Matrix, n: Matrix): Matrix => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e,
  f: m.b * n.e + m.d * n.f + m.f
});

export const apply = (m: Matrix, p: Point): Point => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f
});

/** The uniform scale of a matrix (the geometric mean of its axis scales). */
export const scaleOf = (m: Matrix): number => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;

/** The rotation of a matrix in degrees, clockwise as in SVG. */
export const rotationOf = (m: Matrix): number => (Math.atan2(m.b, m.a) * 180) / Math.PI;

/** A `transform` attribute as a matrix (translate, scale, rotate, skewX/Y, matrix). */
export const parseTransform = (value: null | string | undefined): Matrix => {
  let result = IDENTITY;
  if (!value) return result;
  const pattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (const [, name, args] of value.matchAll(pattern)) {
    const n = (args.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    let m = IDENTITY;
    if (name === 'matrix' && n.length >= 6) {
      m = { a: n[0], b: n[1], c: n[2], d: n[3], e: n[4], f: n[5] };
    } else if (name === 'translate') {
      m = { ...IDENTITY, e: n[0] ?? 0, f: n[1] ?? 0 };
    } else if (name === 'scale') {
      m = { ...IDENTITY, a: n[0] ?? 1, d: n[1] ?? n[0] ?? 1 };
    } else if (name === 'rotate') {
      const angle = ((n[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [n[1] ?? 0, n[2] ?? 0];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      m = multiply(
        { ...IDENTITY, e: cx, f: cy },
        multiply({ a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }, { ...IDENTITY, e: -cx, f: -cy })
      );
    } else if (name === 'skewX') {
      m = { ...IDENTITY, c: Math.tan(((n[0] ?? 0) * Math.PI) / 180) };
    } else if (name === 'skewY') {
      m = { ...IDENTITY, b: Math.tan(((n[0] ?? 0) * Math.PI) / 180) };
    }
    result = multiply(result, m);
  }
  return result;
};

// One cubic per quarter turn at most (the standard arc conversion, SVG 1.1 F.6.5).
const arcToCubics = (
  from: Point,
  rxIn: number,
  ryIn: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  to: Point
): Segment[] => {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y)) {
    return [{ c: 'L', x: to.x, y: to.y }];
  }
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let factor = Math.sqrt(Math.max(0, numerator / denominator));
  if (large === sweep) factor = -factor;
  const cx1 = (factor * rx * y1) / ry;
  const cy1 = (-factor * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return sign * Math.acos(Math.min(1, Math.max(-1, dot)));
  };
  const theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number) => ({
    x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos
  });
  const derivative = (t: number) => ({
    x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos
  });
  const segments: Segment[] = [];
  for (let index = 0; index < count; index++) {
    const t1 = theta + index * step;
    const t2 = t1 + step;
    const p1 = point(t1);
    const p2 = index === count - 1 ? to : point(t2);
    const d1 = derivative(t1);
    const d2 = derivative(t2);
    segments.push({
      c: 'C',
      x: p2.x,
      x1: p1.x + k * d1.x,
      x2: p2.x - k * d2.x,
      y: p2.y,
      y1: p1.y + k * d1.y,
      y2: p2.y - k * d2.y
    });
  }
  return segments;
};

const ARGUMENT_COUNTS: Record<string, number> = {
  a: 7,
  c: 6,
  h: 1,
  l: 2,
  m: 2,
  q: 4,
  s: 4,
  t: 2,
  v: 1,
  z: 0
};

/** Path data as absolute segments; unknown or malformed data ends the path there. */
export const parsePath = (d: null | string | undefined): Segment[] => {
  const segments: Segment[] = [];
  if (!d) return segments;
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let index = 0;
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let lastControl: Point | undefined;
  let lastCommand = '';
  let command = '';
  const flag = () => Number(tokens[index++]) !== 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[a-z]$/i.test(token)) {
      command = token;
      index++;
    } else if (!command) {
      break;
    }
    const lower = command.toLowerCase();
    const relative = command !== command.toUpperCase();
    const count = ARGUMENT_COUNTS[lower];
    if (count === undefined) break;
    if (lower === 'z') {
      segments.push({ c: 'Z' });
      current = { ...start };
      lastControl = undefined;
      lastCommand = 'z';
      command = '';
      continue;
    }
    if (lower === 'a') {
      // Arc flags may be written without separators ("a5 5 0 1020 0").
      for (const position of [index + 3, index + 4]) {
        const flagToken = tokens[position] as string | undefined;
        if (flagToken && flagToken.length > 1 && /^[01]/.test(flagToken)) {
          tokens.splice(position, 1, flagToken[0], flagToken.slice(1));
        }
      }
    }
    if (index + count > tokens.length) break;
    if (tokens.slice(index, index + (lower === 'a' ? 3 : count)).some((t) => /^[a-z]$/i.test(t))) {
      break;
    }
    const number = () => Number(tokens[index++]);
    const ox = relative ? current.x : 0;
    const oy = relative ? current.y : 0;
    if (lower === 'm') {
      current = { x: ox + number(), y: oy + number() };
      start = { ...current };
      segments.push({ c: 'M', ...current });
      // Further pairs after a move are lines.
      command = relative ? 'l' : 'L';
      lastControl = undefined;
    } else if (lower === 'l') {
      current = { x: ox + number(), y: oy + number() };
      segments.push({ c: 'L', ...current });
      lastControl = undefined;
    } else if (lower === 'h') {
      current = { x: ox + number(), y: current.y };
      segments.push({ c: 'L', ...current });
      lastControl = undefined;
    } else if (lower === 'v') {
      current = { x: current.x, y: oy + number() };
      segments.push({ c: 'L', ...current });
      lastControl = undefined;
    } else if (lower === 'c' || lower === 's') {
      let c1: Point;
      if (lower === 'c') {
        c1 = { x: ox + number(), y: oy + number() };
      } else {
        c1 =
          lastControl && (lastCommand === 'c' || lastCommand === 's')
            ? { x: 2 * current.x - lastControl.x, y: 2 * current.y - lastControl.y }
            : { ...current };
      }
      const c2 = { x: ox + number(), y: oy + number() };
      current = { x: ox + number(), y: oy + number() };
      segments.push({ c: 'C', x: current.x, x1: c1.x, x2: c2.x, y: current.y, y1: c1.y, y2: c2.y });
      lastControl = c2;
    } else if (lower === 'q' || lower === 't') {
      let c1: Point;
      if (lower === 'q') {
        c1 = { x: ox + number(), y: oy + number() };
      } else {
        c1 =
          lastControl && (lastCommand === 'q' || lastCommand === 't')
            ? { x: 2 * current.x - lastControl.x, y: 2 * current.y - lastControl.y }
            : { ...current };
      }
      current = { x: ox + number(), y: oy + number() };
      segments.push({ c: 'Q', x: current.x, x1: c1.x, y: current.y, y1: c1.y });
      lastControl = c1;
    } else {
      const rx = number();
      const ry = number();
      const rotation = number();
      const large = flag();
      const sweep = flag();
      const to = { x: ox + number(), y: oy + number() };
      segments.push(...arcToCubics(current, rx, ry, rotation, large, sweep, to));
      current = to;
      lastControl = undefined;
    }
    if (Number.isNaN(current.x) || Number.isNaN(current.y)) {
      segments.pop();
      break;
    }
    lastCommand = lower;
  }
  // A path must start with a move.
  return segments[0]?.c === 'M' ? segments : [];
};

export const transformSegments = (segments: Segment[], m: Matrix): Segment[] =>
  segments.map((segment) => {
    if (segment.c === 'Z') return segment;
    const p = apply(m, segment);
    if (segment.c === 'C') {
      const p1 = apply(m, { x: segment.x1, y: segment.y1 });
      const p2 = apply(m, { x: segment.x2, y: segment.y2 });
      return { c: 'C', x: p.x, x1: p1.x, x2: p2.x, y: p.y, y1: p1.y, y2: p2.y };
    }
    if (segment.c === 'Q') {
      const p1 = apply(m, { x: segment.x1, y: segment.y1 });
      return { c: 'Q', x: p.x, x1: p1.x, y: p.y, y1: p1.y };
    }
    return { ...segment, x: p.x, y: p.y };
  });

export interface Polyline {
  closed: boolean;
  points: Point[];
}

/** The path as polylines, one per subpath; curves are sampled. */
export const flatten = (segments: Segment[], steps = 12): Polyline[] => {
  const lines: Polyline[] = [];
  let line: Polyline | undefined;
  let current: Point = { x: 0, y: 0 };
  for (const segment of segments) {
    if (segment.c === 'M') {
      line = { closed: false, points: [{ x: segment.x, y: segment.y }] };
      lines.push(line);
      current = { x: segment.x, y: segment.y };
      continue;
    }
    if (!line) {
      line = { closed: false, points: [{ ...current }] };
      lines.push(line);
    }
    if (segment.c === 'Z') {
      line.closed = true;
      const first = line.points[0];
      current = { ...first };
      // A drawing command after a close starts at the subpath start.
      line = undefined;
      continue;
    }
    if (segment.c === 'L') {
      line.points.push({ x: segment.x, y: segment.y });
    } else if (segment.c === 'C') {
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const u = 1 - t;
        line.points.push({
          x:
            u * u * u * current.x +
            3 * u * u * t * segment.x1 +
            3 * u * t * t * segment.x2 +
            t * t * t * segment.x,
          y:
            u * u * u * current.y +
            3 * u * u * t * segment.y1 +
            3 * u * t * t * segment.y2 +
            t * t * t * segment.y
        });
      }
    } else {
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const u = 1 - t;
        line.points.push({
          x: u * u * current.x + 2 * u * t * segment.x1 + t * t * segment.x,
          y: u * u * current.y + 2 * u * t * segment.y1 + t * t * segment.y
        });
      }
    }
    current = { x: segment.x, y: segment.y };
  }
  return lines.filter((polyline) => polyline.points.length > 0);
};

export const boundsOf = (points: Point[]): Box | undefined => {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
};

/** The axis-aligned box around a box transformed by `m`. */
export const transformBox = (m: Matrix, box: Box): Box =>
  boundsOf(
    [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width, y: box.y + box.height }
    ].map((p) => apply(m, p))
  ) ?? box;

const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Ramer–Douglas–Peucker: the points that matter for a polyline, within `tolerance`. */
export const simplify = (points: Point[], tolerance = 0.5): Point[] => {
  const unique = points.filter(
    (p, index) =>
      index === 0 ||
      Math.abs(p.x - points[index - 1].x) > 1e-6 ||
      Math.abs(p.y - points[index - 1].y) > 1e-6
  );
  if (unique.length < 3) return unique;
  const keep = new Array<boolean>(unique.length).fill(false);
  keep[0] = true;
  keep[unique.length - 1] = true;
  const stack: [number, number][] = [[0, unique.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() ?? [0, 0];
    let farthest = -1;
    let distance = tolerance;
    for (let index = first + 1; index < last; index++) {
      const d = distanceToSegment(unique[index], unique[first], unique[last]);
      if (d > distance) {
        distance = d;
        farthest = index;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return unique.filter((_, index) => keep[index]);
};

/** The point halfway along a polyline. */
export const midpoint = (points: Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  const lengths = points
    .slice(1)
    .map((p, index) => Math.hypot(p.x - points[index].x, p.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total / 2;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return {
        x: points[index].x + t * (points[index + 1].x - points[index].x),
        y: points[index].y + t * (points[index + 1].y - points[index].y)
      };
    }
    remaining -= length;
  }
  return points.at(-1) ?? points[0];
};
