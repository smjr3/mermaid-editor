import { C, TID } from '$/constants';
import type { Page } from '@playwright/test';
import {
  collapseCode,
  collapseInspector,
  expandCode,
  expandInspector,
  paneWidth
} from './helpers/shell';
import { expect, t, test } from './test';

const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

const stored = <T>(page: Page, key: string) =>
  page.evaluate((name) => {
    const value = localStorage.getItem(name);
    return value === null ? null : (JSON.parse(value) as unknown);
  }, key) as Promise<T | null>;

/** Drags the divider `index` (0: code | diagram, 1: diagram | inspector) by `dx` pixels. */
const dragDivider = async (page: Page, index: number, dx: number) => {
  const handle = page.locator('[data-pane-resizer]').nth(index);
  const box = await handle.boundingBox();
  if (!box) throw new Error('no divider');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x + (dx * step) / 10, y);
  await page.mouse.up();
};

test.describe('Code pane and inspector', () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test('fold to thin rails and open again from them', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('Start');
    const canvasBefore = await paneWidth(page, 'canvas');

    await collapseCode(page);
    await expect.poll(() => paneWidth(page, 'code')).toBeLessThan(2);
    await expect(page.getByTestId(TID.wsCodeExpand)).toHaveAttribute('title', t('ws.codeExpand'));
    await editPage.checkTextInView('Start');
    await collapseInspector(page);
    await expect.poll(() => paneWidth(page, 'inspector')).toBeLessThan(2);
    // The diagram takes the room the two columns left.
    expect(await paneWidth(page, 'canvas')).toBeGreaterThan(canvasBefore + 400);
    // A rail is thin.
    const rail = await page.getByTestId(TID.wsCodeRail).boundingBox();
    expect(rail?.width ?? 0).toBeLessThan(48);

    await expandCode(page);
    await expect.poll(() => paneWidth(page, 'code')).toBeGreaterThan(150);
    await expect(editPage.editor).toBeVisible();
    await expandInspector(page);
    await expect.poll(() => paneWidth(page, 'inspector')).toBeGreaterThan(150);
    await expect(page.getByTestId(TID.inspPanel)).toBeVisible();
  });

  test('the page itself never scrolls: a dialog does not shift the header up', async ({
    editPage,
    page
  }) => {
    // mermaid's hidden tooltip once sat below the page, and the focus a dialog moves let
    // the whole editor scroll by its height, cutting off the header until a reload.
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('Start');
    await page.getByTestId(TID.wsNewMenu).click();
    await page.getByTestId(TID.wsNewFromType).click();
    await expect(page.getByTestId(TID.newDlg)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.newDlg)).toBeHidden();
    const scroll = await page.evaluate(() => ({
      header: document.querySelector('[data-testid="header-bar"]')?.getBoundingClientRect().top,
      height: document.documentElement.scrollHeight,
      top: document.documentElement.scrollTop,
      view: window.innerHeight
    }));
    expect(scroll).toEqual({ header: 0, height: scroll.view, top: 0, view: scroll.view });
  });

  test('remember what is folded across a reload', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('Start');
    await collapseCode(page);
    await collapseInspector(page);
    await expect.poll(() => stored<boolean>(page, 'editorCodeCollapsed')).toBe(true);
    await expect.poll(() => stored<boolean>(page, 'editorInspectorCollapsed')).toBe(true);

    await page.reload();
    await editPage.checkTextInView('Start');
    await expect(page.getByTestId(TID.wsCodeRail)).toBeVisible();
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();

    await expandCode(page);
    await expect.poll(() => stored<boolean>(page, 'editorCodeCollapsed')).toBe(false);
    await page.reload();
    await editPage.checkTextInView('Start');
    await expect(page.getByTestId(TID.wsCodeRail)).toBeHidden();
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
  });

  test('remember the widths the dividers were dragged to', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('Start');
    const code = await paneWidth(page, 'code');
    const inspector = await paneWidth(page, 'inspector');

    await dragDivider(page, 0, 120);
    await dragDivider(page, 1, -100);
    await expect.poll(() => paneWidth(page, 'code')).toBeGreaterThan(code + 100);
    await expect.poll(() => paneWidth(page, 'inspector')).toBeGreaterThan(inspector + 80);
    const dragged = {
      code: await paneWidth(page, 'code'),
      inspector: await paneWidth(page, 'inspector')
    };
    await expect
      .poll(async () => {
        const sizes = await stored<{ code?: number; inspector?: number }>(page, 'editorPaneSizes');
        return typeof sizes?.code === 'number' && typeof sizes.inspector === 'number';
      })
      .toBe(true);

    await page.reload();
    await editPage.checkTextInView('Start');
    await expect.poll(() => paneWidth(page, 'code')).toBeGreaterThan(dragged.code - 8);
    expect(await paneWidth(page, 'code')).toBeLessThan(dragged.code + 8);
    await expect.poll(() => paneWidth(page, 'inspector')).toBeGreaterThan(dragged.inspector - 8);
    expect(await paneWidth(page, 'inspector')).toBeLessThan(dragged.inspector + 8);
  });
});

test.describe('Moving from the previous layout', () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  // What the tools | diagram | code editor left behind, with every migration before the
  // layout one already applied, and the language button's choice.
  const seedPreviousLayout = (page: Page) =>
    page.addInitScript((chooserKey) => {
      if (localStorage.getItem('migrations') !== null) return;
      localStorage.setItem('migrations', JSON.stringify({ version: 2 }));
      localStorage.setItem(chooserKey, 'true');
      localStorage.setItem('toolsPaneWidths', JSON.stringify({ fix: 30, normal: 25 }));
      localStorage.setItem('paneOrder', JSON.stringify('tools-left'));
      localStorage.setItem('foldCodeWhileFixing', 'true');
      localStorage.setItem('codeFoldedForFix', 'true');
      localStorage.setItem(
        'paneforge:liveEditorToolsLeft',
        JSON.stringify({ key: { expandToSizes: { 'pane-code': 25 }, layout: [30, 70, 0] } })
      );
      localStorage.setItem('locale', 'en');
    }, C.editorChooserDismissedKey);

  test('takes the old widths, unfolds the code and forgets the old keys', async ({ page }) => {
    await seedPreviousLayout(page);
    await page.goto('/edit');
    await expect(page.locator('#view svg').first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => stored<{ version: number }>(page, 'migrations'))
      .toEqual({ version: 3 });
    expect(await stored(page, 'editorPaneSizes')).toEqual({ code: 25, inspector: 30 });
    for (const key of [
      'toolsPaneWidths',
      'paneOrder',
      'foldCodeWhileFixing',
      'codeFoldedForFix',
      'paneforge:liveEditorToolsLeft',
      'locale'
    ]) {
      expect(await stored(page, key), key).toBeNull();
    }
    // The code pane was folded only while 直す was shown: it comes back open.
    await expect(page.getByTestId(TID.wsCodeRail)).toBeHidden();
    await expect.poll(() => paneWidth(page, 'code')).toBeGreaterThan(1440 * 0.25 - 12);
    await expect.poll(() => paneWidth(page, 'inspector')).toBeGreaterThan(1440 * 0.3 - 12);
  });

  // W0 report #10: the stored language was removed by the migration, but only after the
  // page had already been rendered in it.
  test('renders the build’s language even on the first visit with a stored one', async ({
    page
  }) => {
    await seedPreviousLayout(page);
    await page.goto('/edit');
    await expect(page.locator('#view svg').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', process.env.MERMAID_LOCALE ?? 'ja');
    await expect(page.getByTestId(TID.wsNewMenu)).toContainText(t('ws.newMenu'));
    await expect(page.getByTestId(`${TID.wsCodeTab}-config`)).toHaveText(t('editor.configTab'));
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
