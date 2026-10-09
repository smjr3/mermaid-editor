import { describe, expect, it } from 'vitest';
import {
  apply,
  boundsOf,
  flatten,
  midpoint,
  parsePath,
  parseTransform,
  rotationOf,
  scaleOf,
  simplify,
  transformBox,
  transformSegments
} from './svgPath';

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 3);

describe('parsePath', () => {
  it('makes every command absolute', () => {
    expect(parsePath('M10,20 l5 5 h10 v-5 H0 V0 z')).toEqual([
      { c: 'M', x: 10, y: 20 },
      { c: 'L', x: 15, y: 25 },
      { c: 'L', x: 25, y: 25 },
      { c: 'L', x: 25, y: 20 },
      { c: 'L', x: 0, y: 20 },
      { c: 'L', x: 0, y: 0 },
      { c: 'Z' }
    ]);
  });

  it('treats pairs after a move as lines and reflects smooth curve controls', () => {
    const segments = parsePath('m0 0 10 0 c0 10 10 10 10 0 s10 -10 10 0 q5 5 10 0 t10 0');
    expect(segments.map((s) => s.c)).toEqual(['M', 'L', 'C', 'C', 'Q', 'Q']);
    expect(segments[3]).toEqual({ c: 'C', x: 30, x1: 20, x2: 30, y: 0, y1: -10, y2: -10 });
    expect(segments[5]).toEqual({ c: 'Q', x: 50, x1: 45, y: 0, y1: -5 });
  });

  it('turns arcs into cubics that end where the arc ends', () => {
    const segments = parsePath('M0,0 a10,10 0 0,0 20,0');
    expect(segments.every((s) => s.c === 'M' || s.c === 'C')).toBe(true);
    const last = segments.at(-1);
    expect(last?.c === 'C' && [last.x, last.y]).toEqual([20, 0]);
    // A half circle below the chord (sweep 0 from left to right in y-down space).
    const box = boundsOf(flatten(segments).flatMap((line) => line.points));
    close(box?.height ?? 0, 10);
    close(box?.y ?? 0, 0);
    // Flags written without separators.
    expect(parsePath('M0,0a5,5 0 1020,0').at(-1)).toMatchObject({ x: 20, y: 0 });
  });

  it('stops at malformed data and needs a leading move', () => {
    expect(parsePath('L10 10')).toEqual([]);
    expect(parsePath('M0 0 L5')).toEqual([{ c: 'M', x: 0, y: 0 }]);
    expect(parsePath('')).toEqual([]);
  });
});

describe('transforms', () => {
  it('parses translate, scale, rotate and matrix in order', () => {
    const m = parseTransform('translate(10, 20) scale(2)');
    expect(apply(m, { x: 1, y: 1 })).toEqual({ x: 12, y: 22 });
    const r = parseTransform('rotate(90)');
    const p = apply(r, { x: 1, y: 0 });
    close(p.x, 0);
    close(p.y, 1);
    close(rotationOf(r), 90);
    expect(scaleOf(parseTransform('matrix(3,0,0,3,0,0)'))).toBe(3);
    expect(parseTransform(null)).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it('moves segments and boxes', () => {
    const m = parseTransform('translate(5,5)');
    expect(transformSegments(parsePath('M0 0 Q1 1 2 0'), m)).toEqual([
      { c: 'M', x: 5, y: 5 },
      { c: 'Q', x: 7, x1: 6, y: 5, y1: 6 }
    ]);
    expect(transformBox(parseTransform('rotate(90)'), { height: 2, width: 4, x: 0, y: 0 })).toEqual(
      expect.objectContaining({ height: 4 })
    );
  });
});

describe('polylines', () => {
  it('flattens subpaths and marks closed ones', () => {
    const lines = flatten(parsePath('M0 0 L10 0 L10 10 Z M20 0 L30 0'));
    expect(lines.map((line) => line.closed)).toEqual([true, false]);
    expect(lines[1].points).toEqual([
      { x: 20, y: 0 },
      { x: 30, y: 0 }
    ]);
  });

  it('drops points on a straight run and finds the middle', () => {
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 5, y: 0.1 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]);
    expect(
      midpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ])
    ).toEqual({ x: 10, y: 0 });
  });
});
