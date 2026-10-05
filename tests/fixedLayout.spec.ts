import { TID } from '$/constants';
import { expect, test } from './test';

// Desktop layout: the code pane, the diagram view and the tools pane are fixed panes
// split by visible dividers, not cards floating over a padded background.
test.describe('Fixed pane layout', () => {
  test.use({ viewport: { height: 800, width: 1280 } });

  test('code, view and tools are edge-to-edge panes split by visible dividers', async ({
    editPage,
    page
  }) => {
    const dividers = page.locator('[data-pane-resizer]');
    await expect(dividers).toHaveCount(2);
    const panes = page.locator('[data-pane]');
    const boxes = await Promise.all(
      [panes.nth(0), dividers.nth(0), panes.nth(1), dividers.nth(1), panes.nth(2)].map((l) =>
        l.boundingBox()
      )
    );
    const [editorBox, firstDivider, viewBox, secondDivider, toolsBox] = boxes.map((box) => {
      if (!box) throw new Error('layout boxes missing');
      return box;
    });

    // No padding around the panes, and nothing between them but the dividers.
    expect(editorBox.x).toBeLessThanOrEqual(1);
    expect(Math.abs(editorBox.x + editorBox.width - firstDivider.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(firstDivider.x + firstDivider.width - viewBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(viewBox.x + viewBox.width - secondDivider.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(secondDivider.x + secondDivider.width - toolsBox.x)).toBeLessThanOrEqual(1);
    expect(toolsBox.x + toolsBox.width).toBeGreaterThanOrEqual(1279);

    // The editor and the tool cards fill their panes flat, not as rounded cards.
    const card = editPage.editor.locator('xpath=ancestor::div[contains(@class,"card")]').first();
    await expect(card).toHaveCSS('border-top-left-radius', '0px');
    const toolCard = page
      .getByTestId(TID.layoutCard)
      .locator('xpath=ancestor::div[contains(@class,"card")]')
      .first();
    await expect(toolCard).toHaveCSS('border-top-left-radius', '0px');
  });
});
