import { defaultState, TID } from '$/constants';
import { expect, t, test } from './test';

const stored = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
        code?: string;
        mermaid?: string;
        pan?: unknown;
        zoom?: number;
      }
  );

test.describe('Header', () => {
  test('shows the app icon and the English title, and carries the site controls', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await expect(page).toHaveTitle('Mermaid Live Editor');
    const header = page.getByTestId(TID.headerBar);
    await expect(header.getByTestId(TID.appIcon)).toContainText('Mermaid Live Editor');
    await expect(header.getByTestId(TID.appIcon).locator('img')).toBeVisible();
    for (const id of [
      TID.themeToggleButton,
      TID.localeToggleButton,
      TID.resetAllButton,
      TID.helpButton
    ]) {
      await expect(header.getByTestId(id)).toBeVisible();
    }
    // The hamburger menu and the Share button are gone from the header.
    await expect(header.getByTestId(TID.shareButton)).toHaveCount(0);
    await expect(header.getByRole('button', { name: t('menu.new') })).toHaveCount(0);
  });

  test('keeps the version and the project links on a page of 使い方', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await expect(page.getByTestId(TID.diagramToolbar).getByTestId(TID.mermaidVersion)).toHaveCount(
      0
    );
    await page.getByTestId(TID.helpButton).click();
    await page.getByTestId(`${TID.helpSection}-about`).click();
    await expect(page.getByTestId(TID.appVersion)).toHaveText(/\d+\.\d+\.\d+/);
    await expect(page.getByTestId(TID.mermaidVersion)).toHaveText(/^v\d+\.\d+\.\d+/);
    await expect(page.getByTestId(TID.aboutRepoLink)).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\//
    );
  });

  test('the style tab is labelled as diagram style code, not settings', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    const tab = page.getByRole('tab').filter({ hasText: t('editor.configTab') });
    await expect(tab).toHaveAttribute('title', t('editor.configTabTooltip'));
    await expect(tab.locator('svg')).toHaveCount(2);
    await editPage.setEditorMode('Config');
    await expect.poll(async () => (await stored(page)).code).toBeTruthy();
  });

  test('Reset asks first, then restores the starting diagram and keeps History', async ({
    editPage,
    page
  }) => {
    await editPage.checkTextInView('Car');
    await editPage.setEditorMode('Code');
    await editPage.typeInEditor('\n    G[Extra node]');
    await editPage.checkTextInView('Extra node');
    for (let i = 0; i < 4; i++) await page.getByTestId(TID.zoomInButton).click();
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
  });
});
