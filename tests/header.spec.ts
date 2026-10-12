import { defaultState, TID } from '$/constants';
import type { Locator } from '@playwright/test';
import { codeTab, headerActions, openNewMenu } from './helpers/shell';
import { expect, t, test } from './test';

const stored = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        code?: string;
        editorMode?: string;
        mermaid?: string;
        pan?: unknown;
        zoom?: number;
      }
  );

const left = async (locator: Locator): Promise<number> => (await locator.boundingBox())?.x ?? -1;

test.describe('Header', () => {
  test('shows the app name, undo / redo, 新規 / 共有 / 書き出す, then the site buttons', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await expect(page).toHaveTitle('Mermaid Live Editor');
    const header = page.getByTestId(TID.headerBar);
    await expect(header.getByTestId(TID.appIcon)).toContainText('Mermaid Live Editor');
    await expect(header.getByTestId(TID.appIcon).locator('img')).toBeVisible();

    // Left to right, in the order the layout gives them.
    const order = [
      TID.appIcon,
      TID.undoButton,
      TID.redoButton,
      TID.wsNewMenu,
      TID.wsShareButton,
      TID.wsExportButton,
      TID.helpButton,
      TID.wsHistoryButton,
      TID.resetAllButton,
      TID.themeToggleButton
    ];
    const xs: number[] = [];
    for (const id of order) {
      const item = header.getByTestId(id);
      await expect(item, id).toBeVisible();
      xs.push(await left(item));
    }
    expect(xs).toEqual([...xs].sort((a, b) => a - b));

    // 新規 / 共有 / 書き出す are one group (the guide points at it).
    for (const id of [TID.wsNewMenu, TID.wsShareButton, TID.wsExportButton]) {
      await expect(headerActions(page).getByTestId(id)).toBeVisible();
    }

    // Gone: the language button, the command search, the old share button and menu.
    for (const id of [TID.localeToggleButton, TID.commandButton, TID.shareButton]) {
      await expect(page.getByTestId(id), id).toHaveCount(0);
    }
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId(TID.commandPalette)).toHaveCount(0);
  });

  test('新規 offers exactly two items, each opening its tab of the new-diagram dialog', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await openNewMenu(page);
    const menu = page.getByTestId(TID.wsNewFromType).locator('..');
    await expect(menu.getByRole('button')).toHaveCount(2);
    await expect(page.getByTestId(TID.wsNewFromType)).toHaveText(t('ws.newFromType'));
    await expect(page.getByTestId(TID.wsNewFromSample)).toHaveText(t('ws.newFromSample'));

    await page.getByTestId(TID.wsNewFromType).click();
    await expect(page.getByTestId(TID.newDlg)).toBeVisible();
    await expect(page.getByTestId(`${TID.newDlgTab}-type`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.newDlg)).toBeHidden();

    await openNewMenu(page);
    await page.getByTestId(TID.wsNewFromSample).click();
    await expect(page.getByTestId(`${TID.newDlgTab}-sample`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('共有 and 書き出す open their dialogs', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.wsShareButton).click();
    await expect(page.getByTestId(TID.shareDlg)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.shareDlg)).toBeHidden();

    await page.getByTestId(TID.wsExportButton).click();
    await expect(page.getByTestId(TID.exportDlg)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.exportDlg)).toBeHidden();
  });

  test('keeps the version numbers, and no owner or repository, on a page of 使い方', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.helpButton).click();
    await page.getByTestId(`${TID.helpSection}-about`).click();
    await expect(page.getByTestId(TID.appVersion)).toHaveText(/\d+\.\d+\.\d+/);
    await expect(page.getByTestId(TID.mermaidVersion)).toHaveText(/^v\d+\.\d+\.\d+/);
    // The page names no owner and links no repository.
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toContainText(/smjr3/i);
    await expect(dialog).not.toContainText(/github/i);
    await expect(dialog.locator('a[href*="github"], a[href*="smjr3"]')).toHaveCount(0);
    await expect(page.getByTestId(TID.appVersion)).not.toContainText('@');
  });

  test('the code pane has コード and 設定 JSON tabs, and 設定をリセット only on 設定 JSON', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    const configTab = page.getByTestId(`${TID.wsCodeTab}-config`);
    await expect(page.getByTestId(`${TID.wsCodeTab}-code`)).toHaveText(t('editor.textTab'));
    await expect(configTab).toHaveText(t('editor.configTab'));
    await expect(configTab).toHaveAttribute('title', t('editor.configTabTooltip'));
    await expect(page.getByTestId(`${TID.wsCodeTab}-code`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId(TID.resetConfigButton)).toHaveCount(0);

    await codeTab(page, 'config');
    await expect(configTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(TID.resetConfigButton)).toBeVisible();
    await expect(page.getByTestId(TID.resetConfigButton)).toHaveAttribute(
      'title',
      t('editor.resetConfig')
    );
    await expect.poll(async () => (await stored(page)).editorMode).toBe('config');
    // No Docs link and no undo / redo in the code pane: undo lives in the header.
    const pane = page.getByTestId(TID.wsCodePane);
    await expect(pane.getByTestId(TID.undoButton)).toHaveCount(0);
    await expect(pane.locator('a[href*="mermaid"]')).toHaveCount(0);

    await codeTab(page, 'code');
    await expect(page.getByTestId(TID.resetConfigButton)).toHaveCount(0);
  });

  test('Reset asks first, then restores the starting diagram and keeps History', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await editPage.setEditorMode('Code');
    await editPage.typeInEditor('\n    G[Extra node]');
    await editPage.checkTextInView('Extra node');
    await page.locator('#view').hover();
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
    await expect.poll(async () => (await stored(page)).zoom).toBeGreaterThan(1.2);

    // A saved History entry (its own store) must outlive the reset.
    const seeded = JSON.stringify([
      { id: 'h1', name: 'kept', state: { code: 'graph TD\n A-->B' }, time: 1, type: 'manual' }
    ]);
    await page.evaluate((value) => localStorage.setItem('manualHistoryStore', value), seeded);

    // Cancelling changes nothing.
    await page.getByTestId(TID.resetAllButton).click();
    await expect(page.getByTestId(TID.resetAllDialog)).toBeVisible();
    await page.getByTestId(TID.resetAllCancel).click();
    await expect(page.getByTestId(TID.resetAllDialog)).toBeHidden();
    await editPage.checkTextInView('Extra node');

    await page.getByTestId(TID.resetAllButton).click();
    await page.getByTestId(TID.resetAllConfirm).click();
    await expect(page.getByTestId(TID.resetAllDialog)).toBeHidden();
    await editPage.checkTextInView('Car');
    await expect(editPage.view).not.toContainText('Extra node');

    await expect
      .poll(async () => {
        const state = await stored(page);
        // The managed theme is filled in after validation; everything else must be gone.
        const config = JSON.parse(state.mermaid ?? '{}') as { theme?: string };
        delete config.theme;
        return { code: state.code, config };
      })
      .toEqual({ code: defaultState.code, config: {} });
    // The view is fitted again rather than left zoomed in.
    await expect.poll(async () => (await stored(page)).zoom).toBeLessThan(1.2);
    // History is its own store and survives.
    expect(await page.evaluate(() => localStorage.getItem('manualHistoryStore'))).toBe(seeded);
    // Undo starts again from the starting diagram.
    await expect(page.getByTestId(TID.undoButton)).toBeDisabled();
  });
});
