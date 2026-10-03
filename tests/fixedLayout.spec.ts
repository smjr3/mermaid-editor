import { expect, test } from './test';

// Desktop layout: the editor column and the diagram view are fixed panes split
// by a visible divider, not cards floating over a padded background.
test.describe('Fixed pane layout', () => {
  test.use({ viewport: { height: 800, width: 1280 } });

  test('editor column and view are edge-to-edge panes split by a visible divider', async ({
    editPage,
    page
  }) => {
    const divider = page.locator('[data-pane-resizer]').first();
    await expect(divider).toBeVisible();
    const dividerBox = await divider.boundingBox();
    const viewPane = page.locator('[data-pane]').nth(1);
    const viewBox = await viewPane.boundingBox();
    const editorPane = page.locator('[data-pane]').first();
    const editorBox = await editorPane.boundingBox();
    if (!dividerBox || !viewBox || !editorBox) throw new Error('layout boxes missing');

    // No padding around the panes, and nothing between them but the divider.
    expect(editorBox.x).toBeLessThanOrEqual(1);
    expect(Math.abs(editorBox.x + editorBox.width - dividerBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(dividerBox.x + dividerBox.width - viewBox.x)).toBeLessThanOrEqual(1);
    expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(1279);

    // The editor fills its column flat, not as a rounded card.
    const card = editPage.editor.locator('xpath=ancestor::div[contains(@class,"card")]').first();
    await expect(card).toHaveCSS('border-top-left-radius', '0px');
  });
});
