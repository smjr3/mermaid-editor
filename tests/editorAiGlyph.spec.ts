import { expect, test } from './test';

// With MERMAID_IS_ENABLED_AI_FEATURES off (the default here), the editor must not
// offer the AI prompt: its gutter button used to appear on hover and, when
// clicked, open an empty zone in the editor that nothing could close.
test.describe('Editor AI prompt, feature off', () => {
  test('shows no AI button in the gutter and opens no empty zone', async ({ editPage, page }) => {
    const line = editPage.editor.locator('.view-line').first();
    await expect(line).toBeVisible();
    await line.hover();

    await expect(editPage.editor.locator('.suggestion-icon')).toHaveCount(0);

    // Clicking where the button used to be must not insert a view zone.
    const box = await line.boundingBox();
    if (!box) throw new Error('editor line has no box');
    const gutter = editPage.editor.locator('.glyph-margin');
    const gutterBox = await gutter.boundingBox();
    if (gutterBox) {
      await page.mouse.click(gutterBox.x + gutterBox.width / 2, box.y + box.height / 2);
    }
    await expect(editPage.editor.locator('.view-zones > div')).toHaveCount(0);
  });
});
