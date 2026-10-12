import { TID } from '$/constants';
import { paneWidth } from './helpers/shell';
import { expect, test } from './test';

// Desktop layout: code | diagram | inspector, three fixed columns split by visible
// dividers, edge to edge under the header.
test.describe('Fixed pane layout', () => {
  test.use({ viewport: { height: 800, width: 1280 } });

  test('code, diagram and inspector are edge-to-edge columns split by dividers', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    const dividers = page.locator('[data-pane-resizer]');
    await expect(dividers).toHaveCount(2);
    const boxes = await Promise.all(
      [
        page.getByTestId(TID.wsCodePane),
        dividers.nth(0),
        page.getByTestId(TID.wsCanvasPane),
        dividers.nth(1),
        page.getByTestId(TID.wsInspectorPane)
      ].map((l) => l.boundingBox())
    );
    const [codeBox, firstDivider, canvasBox, secondDivider, inspectorBox] = boxes.map((box) => {
      if (!box) throw new Error('layout boxes missing');
      return box;
    });

    // No padding around the columns, and nothing between them but the dividers.
    expect(codeBox.x).toBeLessThanOrEqual(1);
    expect(Math.abs(codeBox.x + codeBox.width - firstDivider.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(firstDivider.x + firstDivider.width - canvasBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvasBox.x + canvasBox.width - secondDivider.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(secondDivider.x + secondDivider.width - inspectorBox.x)).toBeLessThanOrEqual(1);
    expect(inspectorBox.x + inspectorBox.width).toBeGreaterThanOrEqual(1279);
    // Right under the 46px header, down to the bottom of the window.
    const header = await page.getByTestId(TID.headerBar).boundingBox();
    expect(header?.height).toBeCloseTo(46, 0);
    for (const box of [codeBox, canvasBox, inspectorBox]) {
      expect(Math.abs(box.y - 46)).toBeLessThanOrEqual(1);
      expect(box.y + box.height).toBeGreaterThanOrEqual(799);
    }

    // The editor and the inspector are in their columns.
    await expect(page.getByTestId(TID.wsCodePane).locator('.monaco-editor')).toBeVisible();
    await expect(page.getByTestId(TID.wsInspectorPane).getByTestId(TID.inspPanel)).toBeVisible();
    await expect(page.getByTestId(TID.wsCanvasPane).locator('#view')).toBeVisible();
  });

  test('starts at about 270px of code and 300px of inspector', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    expect(Math.abs((await paneWidth(page, 'code')) - 270)).toBeLessThan(12);
    expect(Math.abs((await paneWidth(page, 'inspector')) - 300)).toBeLessThan(12);
  });
});

test.describe('Narrow window', () => {
  test.use({ viewport: { height: 800, width: 900 } });

  // PC only: below 1024px the page keeps its width and scrolls sideways.
  test('keeps a 1024px layout and scrolls sideways', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    const header = await page.getByTestId(TID.headerBar).boundingBox();
    expect(header?.width).toBeGreaterThanOrEqual(1023);
    const scroller = page.getByTestId(TID.headerBar).locator('xpath=../..');
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true
    );
  });
});
