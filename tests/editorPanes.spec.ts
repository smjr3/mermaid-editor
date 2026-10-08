import { TID } from '$/constants';
import { expect, t, test } from './test';

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

test.describe('Code pane', () => {
  test('collapses to an icon rail and reopens a section from it', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await expect(editPage.editor).toBeVisible();

    // Collapsed to zero width (Monaco keeps a few pixels of its own); the rail stays.
    const editorWidth = async () => (await editPage.editor.boundingBox())?.width ?? 0;
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect.poll(editorWidth).toBeLessThan(10);
    const rail = page.getByTestId(TID.editorRail);
    const editorMode = () =>
      page.evaluate(
        () =>
          (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { editorMode?: string })
            .editorMode
      );
    await expect(rail).toBeVisible();
    await editPage.checkTextInView('Start');
    // The tools keep their own pane, so the code rail offers only code and config.
    await expect(rail.getByRole('button')).toHaveCount(3);
    await expect(page.getByTestId(TID.layoutCard)).toBeVisible();

    await page.getByTestId(`${TID.editorRail}-config`).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
    await expect(rail).toBeHidden();
    await expect.poll(editorMode).toBe('config');

    await page.getByTestId(TID.editorPaneToggle).click();
    await page.getByTestId(`${TID.editorRail}-code`).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
    await expect.poll(editorMode).toBe('code');

    await page.getByTestId(TID.editorPaneToggle).click();
    await page.getByTestId(TID.editorRailExpand).click();
    await expect.poll(editorWidth).toBeGreaterThan(100);
  });

  test('stays collapsed across a reload', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    // paneforge stores the sizes after a short debounce; reload once the collapse is saved.
    // The default order is tools | diagram | code, so the code is the last pane.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.values(
            JSON.parse(localStorage.getItem('paneforge:liveEditorToolsLeft') ?? '{}') as Record<
              string,
              { layout: number[] }
            >
          ).some(({ layout }) => layout.length === 3 && layout[2] === 0)
        )
      )
      .toBe(true);
    await page.reload();
    await editPage.checkTextInView('Start');
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    await expect(page.getByTestId(TID.toolsPane)).toBeVisible();
  });
});

test.describe('Dark site', () => {
  test.use({ colorScheme: 'dark' });

  // The diagram looks the same in the site's light and dark mode: no grey backdrop.
  test('adds no backdrop to a light-themed diagram', async ({ editPage }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]', '{"theme":"neutral"}'));
    await editPage.checkTextInView('Start');
    await expect(editPage.view.locator('svg').first()).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)'
    );
  });

  test('draws a dark theme the user picked with bright lines', async ({ editPage }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]', '{"theme":"dark"}'));
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
    await expect(first).toHaveAttribute('title', /^logos:aws-lambda /, { timeout: 30_000 });

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
    await expect(results.getByRole('button', { name: /^tabler:database —/ })).toBeVisible({
      timeout: 30_000
    });
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
      .getByRole('button', { name: /^tabler:database —/ })
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

  test('lists mermaid standard icons first, written without a prefix', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('architecture-beta\n  service db()[Database]'));
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('database');
    const first = page.getByTestId(TID.iconPickerResults).getByRole('button').first();
    await expect(first).toHaveAttribute('data-standard', 'true', { timeout: 30_000 });

    await editPage.editor.getByText('db()').click();
    await page.keyboard.press('End');
    for (let index = 0; index < '[Database]'.length + 1; index++) {
      await page.keyboard.press('ArrowLeft');
    }
    await first.click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
        )
      )
      .toContain('service db(database)[Database]');
    await expect(page.getByTestId(TID.iconPickerMessage)).not.toContainText(
      t('icons.pickExtendedNote')
    );
  });
});
