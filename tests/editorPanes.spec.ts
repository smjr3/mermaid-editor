import { TID } from '$/constants';
import { expect, test } from './test';

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

test.describe('Editor column', () => {
  test('collapses to an icon rail and reopens a section from it', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await expect(editPage.editor).toBeVisible();

    // Collapsed to zero width (Monaco keeps a few pixels of its own); the rail stays.
    const editorWidth = async () => (await editPage.editor.boundingBox())?.width ?? 0;
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect.poll(editorWidth).toBeLessThan(10);
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    await editPage.checkTextInView('Start');

    await page.getByTestId(`${TID.editorRail}-icons`).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
    await expect(page.getByTestId(TID.editorRail)).toBeHidden();
    await expect(page.getByTestId(TID.iconPickerSearch)).toBeVisible();

    await page.getByTestId(TID.editorPaneToggle).click();
    await page.getByTestId(TID.editorRailExpand).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
  });

  test('the tools bar hides the tool cards and is remembered', async ({ editPage, page }) => {
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

  test('gives a light-themed diagram a light grey background', async ({ editPage }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]', '{"theme":"neutral"}'));
    await editPage.checkTextInView('Start');
    await expect(editPage.view.locator('svg').first()).toHaveCSS(
      'background-color',
      'rgb(207, 212, 218)'
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

test.describe('Icon picker', () => {
  test('inserts the clicked icon at the cursor', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service fn()[Function]'));
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('logos');
    await page.getByTestId(TID.iconPickerSearch).fill('aws lambda');
    const first = page.getByTestId(TID.iconPickerResults).getByRole('button').first();
    await expect(first).toHaveAttribute('title', 'logos:aws-lambda', { timeout: 30_000 });

    // Cursor between the parentheses of fn().
    await editPage.editor.getByText('fn()').click();
    await page.keyboard.press('End');
    for (let index = 0; index < '[Function]'.length + 1; index++) {
      await page.keyboard.press('ArrowLeft');
    }
    await first.click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText('logos:aws-lambda');
    await expect
      .poll(() =>
        page.evaluate(
          () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
        )
      )
      .toContain('service fn(logos:aws-lambda)[Function]');
    await editPage.checkTextInView('Function');
  });

  test('picks from the enlarged view, with names under the icons', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service db()[Database]'));
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerEnlarge).click();
    await page.getByTestId(TID.iconPickerLargePack).selectOption('tabler');
    await page.getByTestId(TID.iconPickerLargeSearch).fill('database');
    const results = page.getByTestId(TID.iconPickerLargeResults);
    await expect(results.getByRole('button', { name: 'tabler:database', exact: true })).toBeVisible(
      {
        timeout: 30_000
      }
    );
    await expect(results).toContainText('database');

    await page.keyboard.press('Escape');
    await editPage.editor.getByText('db()').click();
    await page.keyboard.press('End');
    for (let index = 0; index < '[Database]'.length + 1; index++) {
      await page.keyboard.press('ArrowLeft');
    }
    await page.getByTestId(TID.iconPickerEnlarge).click();
    await page
      .getByTestId(TID.iconPickerLargeResults)
      .getByRole('button', { name: 'tabler:database', exact: true })
      .click();
    await expect(page.getByTestId(TID.iconPickerLargeResults)).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(
          () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
        )
      )
      .toContain('service db(tabler:database)[Database]');
  });
});
