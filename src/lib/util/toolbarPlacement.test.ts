import { describe, expect, it } from 'vitest';
import { toolbarPlacement } from './toolbarPlacement';

const size = { height: 42, width: 200 };
const host = { hostHeight: 800, hostWidth: 1000 };

describe('toolbarPlacement', () => {
  it('centres the toolbar above the selection', () => {
    expect(
      toolbarPlacement({ ...host, box: { height: 50, width: 100, x: 400, y: 300 }, size })
    ).toEqual({
      left: 350,
      top: 248
    });
  });

  it('goes below the selection when there is no room above', () => {
    expect(
      toolbarPlacement({ ...host, box: { height: 50, width: 100, x: 400, y: 20 }, size }).top
    ).toBe(80);
  });

  it('keeps clear of a panel over the place above the selection', () => {
    // The notice shown while the code is broken, across the top of the diagram.
    const notice = { height: 98, width: 560, x: 220, y: 8 };
    const box = { height: 134, width: 450, x: 270, y: 84 };
    const { left, top } = toolbarPlacement({ ...host, avoid: [notice], box, size });
    expect(top).toBe(228);
    expect(top >= notice.y + notice.height || top + size.height <= notice.y).toBe(true);
    expect(left).toBe(395);
  });

  it('ignores a panel that is not shown or not in the way', () => {
    const box = { height: 50, width: 100, x: 400, y: 300 };
    expect(
      toolbarPlacement({ ...host, avoid: [{ height: 0, width: 560, x: 220, y: 8 }], box, size }).top
    ).toBe(248);
    expect(
      toolbarPlacement({ ...host, avoid: [{ height: 98, width: 560, x: 220, y: 8 }], box, size })
        .top
    ).toBe(248);
  });
});
