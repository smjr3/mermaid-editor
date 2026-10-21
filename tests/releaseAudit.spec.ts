import { defaultState, TID } from '$/constants';
import { serializeState } from '$/util/serde';
import { chooseExport, readDownload, saveExport } from './helpers/exportDlg';
import { activeTab } from './helpers/inspector';
import { collapseCode, expandCode } from './helpers/shell';
import { expect, t, test } from './test';

// Cross-feature checks for the 0.2.0 additions: each one in a place the
// feature-specific specs do not cover (other pages, other tabs, exports, other
// diagram types, an English browser, failure paths).

const logoDiagram = 'architecture-beta\n  service db(logos:postgresql)[Orders DB]';
const editUrl = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;
const storedCode = (page: import('@playwright/test').Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
    )
    .then((code) => code?.replaceAll('\r\n', '\n'));
const storedConfig = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { mermaid?: string }).mermaid
  );

test.describe('Icons outside the editor', () => {
  test('the view page draws bundled logos', async ({ page }) => {
    await page.goto(`/view#${serializeState({ ...defaultState, code: logoDiagram })}`);
    await expect(page.locator('svg').filter({ hasText: 'Orders DB' }).first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('[fill="#336791"]').first()).toBeAttached({ timeout: 15_000 });
  });

  test('the embed page draws bundled logos', async ({ page }) => {
    await page.goto(`/embed#${serializeState({ ...defaultState, code: logoDiagram })}`);
    await expect(page.locator('#embed-view')).toContainText('Orders DB', { timeout: 15_000 });
    await expect(page.locator('#embed-view [fill="#336791"]').first()).toBeAttached({
      timeout: 15_000
    });
  });
});

test.describe('Code column', () => {
  test('stays reachable when the page reloads with the column folded', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await collapseCode(page);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('editorCodeCollapsed')))
      .toBe('true');
    await page.reload();
    await editPage.checkTextInView('B');
    await expect(page.getByTestId(TID.wsCodeRail)).toBeVisible();
    await expandCode(page);
    await expect(page.getByTestId(TID.wsCodeCollapse)).toBeVisible();
  });
});

test.describe('Icon picker', () => {
  test('clearing the search while packs load leaves no loading message', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await page.getByTestId(TID.inspIconBrowse).click();
    const search = page.getByTestId(TID.iconPickerSearch);
    await search.fill('database');
    await expect(page.getByText(t('icons.pickLoading'))).toBeVisible();
    await search.fill('');
    await expect(page.getByText(t('icons.pickLoading'))).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId(TID.iconPickerResults)).toHaveCount(0);
  });

  test('warns that standard icons only work in architecture diagrams', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    // The cursor on a line of its own: a name written mid-line would break the diagram,
    // and the picker takes such an insertion back (qaFindings.spec.ts).
    await editPage.editor.getByText('A --> B').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.getByTestId(TID.inspIconBrowse).click();
    await expect(page.getByTestId(TID.inspIconDialog)).toContainText(t('icons.pickStandardLegend'));
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('server');
    await page.getByTestId(TID.iconPickerResults).getByRole('button').first().click();
    // The dialog closes on an insertion; 図全体 repeats what it did.
    await expect(page.getByTestId(TID.inspIconMessage)).toContainText(
      t('icons.pickStandardArchitectureOnly')
    );
  });

  test('on the config tab, copies the name instead of writing it into the config', async ({
    editPage,
    page,
    context,
    browserName
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    const before = await storedConfig(page);
    await editPage.setEditorMode('Config');
    await page.getByTestId(TID.inspIconBrowse).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('cloud');
    await page.getByTestId(TID.iconPickerResults).getByRole('button').first().click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText('cloud');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('cloud');
    expect(JSON.parse((await storedConfig(page)) ?? '{}')).toEqual(JSON.parse(before ?? '{}'));
  });
});

test.describe('Exports with icons', () => {
  test('HTML and Markdown exports report a diagram that does not render', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    await editPage.typeInEditor('\n  C -->');
    const save = page.getByTestId(TID.exportDlgSave);
    for (const format of ['html', 'md'] as const) {
      await chooseExport(page, format, format === 'html' ? { htmlMode: 'file' } : {});
      await save.click();
      await expect(save).toHaveAttribute('data-export-state', 'failed');
      await expect(page.getByTestId(TID.exportDlgMessage)).toHaveText(t('actions.exportFailed'));
    }
  });

  test('PNG export works for a diagram with logos', async ({ editPage, page }) => {
    await editPage.start(editUrl(logoDiagram));
    await editPage.checkTextInView('Orders DB');
    const png = await readDownload(await saveExport(page, 'png'));
    expect(png.length).toBeGreaterThan(5000);
  });
});

test.describe('図全体 › 向き', () => {
  test('turns a state diagram left to right', async ({ editPage, page }) => {
    await editPage.start(editUrl('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy'));
    await editPage.checkTextInView('Busy');
    await page.getByTestId(`${TID.inspDirection}-LR`).click();
    await expect.poll(() => storedCode(page)).toContain('  direction LR\n');
    await editPage.checkTextInView('Busy');
  });

  test('is not offered while the diagram cannot be compared', async ({ editPage, page }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    await editPage.typeInEditor('\n  C -->');
    // The code has a mistake: the inspector says so instead of trying (errorRecovery.spec.ts).
    await expect(page.getByTestId(TID.diagramErrorNotice)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(TID.inspBlocked)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`${TID.inspDirection}-fit`)).toBeDisabled();
    expect(await storedCode(page)).toContain('C -->');
  });
});

test.describe('An English browser', () => {
  test.use({ locale: 'en-US' });

  test('still gets the Japanese UI, with no language button', async ({ editPage, page }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByTestId(TID.wsExportButton)).toContainText(t('ws.export'));
    await expect(activeTab(page)).toHaveText(t('ws.inspectorRoot'));
    // The removed language button.
    await expect(page.getByTestId('locale-toggle-button')).toHaveCount(0);
  });
});
