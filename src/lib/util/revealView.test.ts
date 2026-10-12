import { describe, expect, it } from 'vitest';
import { isInside, revealPlan } from './revealView';

const view = { height: 400, left: 100, top: 50, width: 600 };

describe('isInside', () => {
  it('is true for a box within the viewport, edges included', () => {
    expect(isInside({ height: 40, left: 200, top: 100, width: 80 }, view)).toBe(true);
    expect(isInside({ height: 400, left: 100, top: 50, width: 600 }, view)).toBe(true);
  });
  it('is false for a box partly or wholly outside', () => {
    expect(isInside({ height: 40, left: 90, top: 100, width: 80 }, view)).toBe(false);
    expect(isInside({ height: 40, left: 680, top: 100, width: 80 }, view)).toBe(false);
    expect(isInside({ height: 40, left: 200, top: 440, width: 80 }, view)).toBe(false);
    expect(isInside({ height: 40, left: 2000, top: 2000, width: 80 }, view)).toBe(false);
  });
});

describe('revealPlan', () => {
  it('leaves the view alone when the box is fully visible', () => {
    expect(revealPlan({ height: 40, left: 101, top: 51, width: 80 }, view)).toBeUndefined();
  });

  it('pans a box off the right edge back in with the margin, keeping the zoom', () => {
    // right edge 800, view right 700: shift by 700 - 24 - 800.
    expect(revealPlan({ height: 40, left: 720, top: 100, width: 80 }, view)).toEqual({
      dx: -124,
      dy: 0,
      scale: 1
    });
  });

  it('pans a box above and left of the view down and right', () => {
    expect(revealPlan({ height: 40, left: 20, top: -30, width: 80 }, view)).toEqual({
      dx: 104,
      dy: 104,
      scale: 1
    });
  });

  it('pans a box partly below the view up', () => {
    const plan = revealPlan({ height: 40, left: 300, top: 430, width: 80 }, view);
    expect(plan).toEqual({ dx: 0, dy: -44, scale: 1 });
  });

  it('uses only the margin there is room for', () => {
    // 590 wide in a 600 wide view: 5px each side.
    expect(revealPlan({ height: 40, left: 120, top: 100, width: 590 }, view)).toEqual({
      dx: -15,
      dy: 0,
      scale: 1
    });
  });

  it('zooms out about the centre and centres a box bigger than the view', () => {
    const plan = revealPlan({ height: 800, left: 0, top: 0, width: 300 }, view);
    expect(plan?.scale).toBeCloseTo((400 - 48) / 800);
    expect(plan?.dx).toBe(400 - 150);
    expect(plan?.dy).toBe(250 - 400);
  });

  it('does nothing for an empty box or viewport', () => {
    expect(revealPlan({ height: 0, left: 2000, top: 0, width: 0 }, view)).toBeUndefined();
    expect(
      revealPlan({ height: 10, left: 0, top: 0, width: 10 }, { ...view, width: 0 })
    ).toBeUndefined();
  });
});
