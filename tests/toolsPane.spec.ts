import { C, TID } from '$/constants';
import { nextLocale, resolveLocale } from '$/i18n/translate';
import type { Page } from '@playwright/test';
import { EditorPage, expect, test } from './test';

// Desktop layout: code (left), diagram (centre) and tools (right) are three panes;
// each side pane collapses to an icon rail. One toolbar runs across the top of the
// diagram pane.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flowchart = urlFor('flowchart TD\n  A[Start] --> B[End]');

const stored = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        grid?: boolean;
        rough?: boolean;
        zoom?: number;
      }
  );

/** The tools pane's stored share (%) in each saved three-pane layout. */
const storedToolsShares = (page: Page) =>
  page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('paneforge:liveEditor') ?? '{}') as Record<
      string,
      { layout: number[] }
    >;
    return Object.values(saved)
      .filter(({ layout }) => layout.length === 3)
      .map(({ layout }) => Math.round(layout[2]));
  });

test.describe('Tools pane', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test('sits right of the diagram at about a quarter of the width', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    const tools = await page.getByTestId(TID.toolsPane).boundingBox();
    const view = await editPage.view.boundingBox();
    const editor = await editPage.editor.boundingBox();
    if (!tools || !view || !editor) throw new Error('layout boxes missing');
    expect(editor.x).toBeLessThan(view.x);
    expect(view.x + view.width).toBeLessThanOrEqual(tools.x + 1);
    expect(tools.x + tools.width).toBeGreaterThanOrEqual(1399);
    expect(tools.width).toBeGreaterThan(1400 * 0.2);
    expect(tools.width).toBeLessThan(1400 * 0.3);
    // The tool cards live in the tools pane, not under the code.
    await expect(page.getByTestId(TID.toolsPane).getByTestId(TID.layoutCard)).toBeVisible();
    await expect(page.getByTestId(TID.toolsPane).getByTestId(TID.actionsCard)).toBeAttached();
  });

  test('collapses to a rail whose icons reopen the pane on that card', async ({
    editPage,
    page
  }) => {
    await editPage.start(flowchart);
    const pane = page.getByTestId(TID.toolsPane);
    const rail = page.getByTestId(TID.toolsRail);
    const paneWidth = async () => (await pane.boundingBox())?.width ?? 0;

    await page.getByTestId(TID.toolsPaneToggle).click();
    await expect.poll(paneWidth).toBeLessThan(5);
    await expect(rail).toBeVisible();
    await editPage.checkTextInView('Start');
    // The code pane is untouched.
    await expect(page.getByTestId(TID.editorRail)).toBeHidden();
    await expect(editPage.editor).toBeVisible();

    await page.getByTestId(`${TID.toolsRail}-colors`).click();
    await expect.poll(paneWidth).toBeGreaterThan(200);
    await expect(rail).toBeHidden();
    await expect(
      page.locator('.card.isOpen').filter({ has: page.getByTestId(TID.colorsCard) })
    ).toBeInViewport();

    await page.getByTestId(TID.toolsPaneToggle).click();
    await page.getByTestId(TID.toolsRailExpand).click();
    await expect.poll(paneWidth).toBeGreaterThan(200);
  });

  test('code only and tools only both work', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    // Tools only: the code pane collapsed.
    await page.getByTestId(TID.editorPaneToggle).click();
    await expect(page.getByTestId(TID.editorRail)).toBeVisible();
    await expect(page.getByTestId(TID.toolsPane)).toBeVisible();
    // Neither: both rails, the diagram fills the rest.
    await page.getByTestId(TID.toolsPaneToggle).click();
    await expect(page.getByTestId(TID.toolsRail)).toBeVisible();
    await expect
      .poll(async () => (await editPage.view.boundingBox())?.width ?? 0)
      .toBeGreaterThan(1200);
    // Code only.
    await page.getByTestId(TID.editorRailExpand).click();
    await expect(page.getByTestId(TID.editorRail)).toBeHidden();
    await expect(page.getByTestId(TID.toolsRail)).toBeVisible();
    await expect(editPage.editor).toBeVisible();
  });

  test('keeps the pane sizes across a reload', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    const pane = page.getByTestId(TID.toolsPane);
    const before = (await pane.boundingBox())?.width ?? 0;

    // Drag the divider left of the tools pane 150px further left.
    const handle = page.locator('[data-pane-resizer]').last();
    const box = await handle.boundingBox();
    if (!box) throw new Error('divider missing');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    const widened = (await pane.boundingBox())?.width ?? 0;
    expect(widened).toBeGreaterThan(before + 100);
    // paneforge writes the sizes after a short debounce; reload only once they are stored.
    await expect.poll(async () => Math.max(...(await storedToolsShares(page)))).toBeGreaterThan(30);

    await page.reload();
    await editPage.checkTextInView('Start');
    await expect
      .poll(async () => Math.round((await pane.boundingBox())?.width ?? 0))
      .toBeGreaterThan(widened - 5);

    // A collapsed pane stays collapsed.
    await page.getByTestId(TID.toolsPaneToggle).click();
    await expect(page.getByTestId(TID.toolsRail)).toBeVisible();
    await expect.poll(() => storedToolsShares(page)).toContain(0);
    await page.reload();
    await editPage.checkTextInView('Start');
    await expect(page.getByTestId(TID.toolsRail)).toBeVisible();
  });
});

test.describe('Diagram toolbar', () => {
  test.use({ viewport: { height: 768, width: 1024 } });

  test('is one bar above the diagram that fits at 1024px', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    const bar = page.getByTestId(TID.diagramToolbar);
    const barBox = await bar.boundingBox();
    const viewBox = await editPage.view.boundingBox();
    if (!barBox || !viewBox) throw new Error('layout boxes missing');
    // A single row above the drawing, not floating over it.
    expect(barBox.height).toBeLessThan(48);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(viewBox.y + 1);
    for (const id of [
      TID.zoomOutButton,
      TID.zoomInButton,
      TID.resetViewButton,
      TID.fullScreenButton,
      TID.roughToggle,
      TID.gridToggle,
      TID.themeToggleButton,
      TID.localeToggleButton,
      TID.mermaidVersion
    ]) {
      const control = bar.getByTestId(id);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      if (!box) throw new Error(`${id} missing`);
      expect(box.x + box.width).toBeLessThanOrEqual(barBox.x + barBox.width + 1);
    }
    await expect(bar.getByTestId(TID.mermaidVersion)).toHaveText(/^v\d+\.\d+\.\d+/);
  });

  test('zooms, toggles hand-drawn and grid, theme and language', async ({ editPage, page }) => {
    await editPage.start(flowchart);
    await editPage.checkTextInView('Start');
    const zoom = async () => (await stored(page)).zoom ?? 1;

    const start = await zoom();
    await page.getByTestId(TID.zoomInButton).click();
    await expect.poll(zoom).toBeGreaterThan(start);
    const zoomedIn = await zoom();
    await page.getByTestId(TID.zoomOutButton).click();
    await expect.poll(zoom).toBeLessThan(zoomedIn);
    await page.getByTestId(TID.resetViewButton).click();
    await expect(page.getByTestId(TID.fullScreenButton)).toHaveAttribute('href', /\/view#pako:/);

    await page.getByTestId(TID.roughToggle).click();
    await expect.poll(async () => (await stored(page)).rough).toBe(true);
    await page.getByTestId(TID.roughToggle).click();
    await expect.poll(async () => (await stored(page)).rough).toBe(false);

    const grid = (await stored(page)).grid ?? true;
    await page.getByTestId(TID.gridToggle).click();
    await expect.poll(async () => (await stored(page)).grid).toBe(!grid);

    await editPage.checkTheme('light');
    await editPage.toggleTheme();
    await editPage.checkTheme('dark');
    await editPage.toggleTheme();
    await editPage.checkTheme('light');

    const other = nextLocale(resolveLocale(process.env.MERMAID_LOCALE));
    await page.getByTestId(TID.localeToggleButton).click();
    await expect(page.locator('html')).toHaveAttribute('lang', other);
    await page.getByTestId(TID.localeToggleButton).click();
    await expect(page.locator('html')).not.toHaveAttribute('lang', other);
  });
});

test.describe('Mobile layout', () => {
  test.use({ viewport: { height: 844, width: 390 } });

  // Not the editPage fixture: it opens the samples card, which on a phone sits on the
  // editor side, off screen while the diagram is shown.
  test('keeps the stacked editor and diagram, with the tools under the editor', async ({
    page
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, C.editorChooserDismissedKey);
    const editPage = new EditorPage(page);
    await editPage.start(flowchart);
    // No side panes or rails on a phone.
    await expect(page.getByTestId(TID.toolsPane)).toHaveCount(0);
    await expect(page.getByTestId(TID.toolsRail)).toHaveCount(0);
    await expect(page.getByTestId(TID.editorRail)).toHaveCount(0);
    await expect(page.getByTestId(TID.editorPaneToggle)).toHaveCount(0);

    // View mode first: the diagram fills the screen with its toolbar above it.
    await editPage.checkTextInView('Start');
    const viewBox = await editPage.view.boundingBox();
    if (!viewBox) throw new Error('view missing');
    expect(viewBox.x).toBeGreaterThanOrEqual(-1);
    expect(viewBox.x + viewBox.width).toBeLessThanOrEqual(391);
    await expect(page.getByTestId(TID.diagramToolbar)).toBeVisible();
    await expect(page.getByTestId(TID.themeToggleButton)).toBeInViewport();
    await expect(page.getByTestId(TID.localeToggleButton)).toBeInViewport();

    // Edit mode: the editor, then the tool cards below it.
    await page.locator('#editorMode').click();
    await expect(page.locator('.cm-editor').first()).toBeInViewport();
    const card = page.getByTestId(TID.layoutCard);
    await expect(card).toBeInViewport();
    const editorBox = await page.locator('.cm-editor').first().boundingBox();
    const cardBox = await card.boundingBox();
    if (!editorBox || !cardBox) throw new Error('mobile boxes missing');
    expect(cardBox.y).toBeGreaterThan(editorBox.y);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(391);
  });
});
