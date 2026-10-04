import { defaultState, TID } from '$/constants';
import { serializeState } from '$/util/serde';
import { expect, t, test } from './test';

// Cross-feature checks for the 0.2.0 additions: each one in a place the
// feature-specific specs do not cover (other pages, mobile, other tabs,
// exports, other diagram types, the English UI, failure paths).

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

test.describe('Editor column', () => {
  test('stays reachable when the page reloads with the column collapsed', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    // The pane group saves its layout shortly after a change.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.entries(localStorage).some(
            ([key, value]) => key.startsWith('paneforge:') && value.includes('"layout":[0,')
          )
        )
      )
      .toBe(true);
    await page.reload();
    await editPage.checkTextInView('B');
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    await page.getByTestId(TID.editorRailExpand).click();
    await expect(page.getByTestId(TID.editorPaneToggle)).toBeVisible();
  });

  test('the rail opens the config tab', async ({ editPage, page }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await page.getByTestId(TID.editorPaneToggle).click();
    await page.getByTestId(`${TID.editorRail}-config`).click();
    await expect(page.getByTestId(TID.editorRail)).toBeHidden();
    await expect(page.getByTestId(TID.resetConfigButton)).toBeVisible();
  });
});

test.describe('Icon picker', () => {
  test('clearing the search while packs load leaves no loading message', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await page.getByTestId(TID.iconPacksCard).click();
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
    await page.getByTestId(TID.iconPacksCard).click();
    await expect(page.getByTestId(TID.iconPacksCard).locator('..')).toContainText(
      t('icons.pickStandardLegend')
    );
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('server');
    await editPage.editor.getByText('A --> B').click();
    await page.getByTestId(TID.iconPickerResults).getByRole('button').first().click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText(
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
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('cloud');
    await page.getByTestId(TID.iconPickerResults).getByRole('button').first().click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText('cloud');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('cloud');
    expect(JSON.parse((await storedConfig(page)) ?? '{}')).toEqual(JSON.parse(before ?? '{}'));
  });
});

test.describe('Mobile', () => {
  test.use({ viewport: { height: 800, width: 390 } });

  test('has no rail, and the picker copies the name', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(editUrl('architecture-beta\n  service a(server)[A]'));
    await page.getByText(t('editor.mobileEdit')).first().click();
    await expect(page.getByTestId(TID.editorPaneToggle)).toHaveCount(0);
    await expect(page.getByTestId(TID.editorRail)).toHaveCount(0);
    await page.getByTestId(TID.iconPacksCard).scrollIntoViewIfNeeded();
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('mermaid');
    await page.getByTestId(TID.iconPickerSearch).fill('disk');
    await page.getByTestId(TID.iconPickerResults).getByRole('button').first().click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText('disk');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('disk');
  });
});

test.describe('Exports with icons', () => {
  test('HTML and GitLab exports report a diagram that does not render', async ({
    editPage,
    page
  }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    await editPage.typeInEditor('\n  C -->');
    await page.getByTestId(TID.actionsCard).click();
    await page.getByTestId(TID.downloadHTML).click();
    await expect(page.getByTestId(TID.exportMessage)).toHaveText(t('actions.exportFailed'));
    await page.getByTestId(TID.exportGitLab).click();
    await expect(page.getByTestId(TID.exportMessage)).toHaveText(t('actions.exportFailed'));
  });

  test('PNG export works for a diagram with logos', async ({ editPage, page }) => {
    await editPage.start(editUrl(logoDiagram));
    await editPage.checkTextInView('Orders DB');
    await page.getByTestId(TID.actionsCard).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(TID.downloadPNG).click()
    ]);
    const { size } = await import('node:fs').then(async (fs) =>
      fs.promises.stat((await download.path()) ?? '')
    );
    expect(size).toBeGreaterThan(5000);
  });
});

test.describe('Layout card', () => {
  test('turns a state diagram left to right', async ({ editPage, page }) => {
    await editPage.start(editUrl('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy'));
    await editPage.checkTextInView('Busy');
    await page.getByTestId(TID.layoutCard).click();
    await page.getByTestId(TID.layoutDirectionLR).click();
    await expect.poll(() => storedCode(page)).toContain('  direction LR\n');
    await editPage.checkTextInView('Busy');
  });

  test('reports when the diagram cannot be compared', async ({ editPage, page }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await editPage.checkTextInView('B');
    await page.getByTestId(TID.layoutCard).click();
    await editPage.typeInEditor('\n  C -->');
    await page.getByTestId(TID.layoutFit).click();
    await expect(page.getByTestId(TID.layoutMessage)).toHaveText(t('layout.fitFailed'));
  });
});

test.describe('English UI', () => {
  test('shows the new cards and controls in English', async ({ editPage, page }) => {
    await editPage.start(editUrl('flowchart TD\n  A --> B'));
    await page.getByTestId(TID.localeToggleButton).click();
    await expect(page.getByTestId(TID.layoutCard)).toContainText('Layout');
    await expect(page.getByTestId(TID.iconPacksCard)).toContainText('Icons');
    await expect(page.getByTestId(TID.editorFocusToggle)).toContainText('Hide the tools');
    await page.getByTestId(TID.actionsCard).click();
    await expect(page.getByTestId(TID.exportGitLab)).toContainText('Export for GitLab');
  });
});
