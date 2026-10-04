import { TID } from '$/constants';
import { expect, test } from './test';

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

test.describe('Editor column', () => {
  test('collapses and expands from the navbar', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await expect(editPage.editor).toBeVisible();

    // Collapsed to zero width (Monaco keeps a few pixels of its own).
    const editorWidth = async () => (await editPage.editor.boundingBox())?.width ?? 0;
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect.poll(editorWidth).toBeLessThan(10);
    await expect(page.getByTestId(TID.editorPaneToggle)).toHaveAttribute('aria-pressed', 'true');
    await editPage.checkTextInView('Start');

    await page.getByTestId(TID.editorPaneToggle).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
  });

  test('focus mode hides the tool cards and is remembered', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await expect(page.getByTestId(TID.sampleDiagramsCard)).toBeVisible();

    await page.getByTestId(TID.editorFocusToggle).click();
    await expect(page.getByTestId(TID.sampleDiagramsCard)).toBeHidden();
    await expect(page.getByTestId(TID.layoutCard)).toBeHidden();

    await page.reload();
    await expect(editPage.editor).toBeVisible();
    await expect(page.getByTestId(TID.sampleDiagramsCard)).toBeHidden();

    await page.getByTestId(TID.editorFocusToggle).click();
    await expect(page.getByTestId(TID.sampleDiagramsCard)).toBeVisible();
  });
});

test.describe('Dark site', () => {
  test.use({ colorScheme: 'dark' });

  test('gives a light-themed diagram a light background', async ({ editPage }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]', '{"theme":"neutral"}'));
    await editPage.checkTextInView('Start');
    await expect(editPage.view.locator('svg').first()).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)'
    );
  });

  test('draws the managed dark theme with bright lines', async ({ editPage }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('Start');
    await expect(editPage.view.locator('.flowchart-link').first()).toHaveCSS(
      'stroke',
      'rgb(242, 242, 242)'
    );
  });
});
