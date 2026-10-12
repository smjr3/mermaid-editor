import { TID } from '$/constants';
import { codeTab } from './helpers/shell';
import { expect, t, test } from './test';

const configKeys = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const { mermaid } = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
      mermaid?: string;
    };
    return Object.keys(JSON.parse(mermaid ?? '{}') as object).filter((key) => key !== 'theme');
  });

test.describe('Config reset', () => {
  test('restores the default config after it was broken', async ({ editPage, page }) => {
    await codeTab(page, 'config');
    await editPage.clearEditor();
    await editPage.typeInEditor('{ "theme": ', { bottom: false });
    await expect(page.getByTestId(TID.errorContainer)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(TID.wsCodeFooter)).toHaveAttribute('data-error', 'true');

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId(TID.resetConfigButton).click();

    await expect(page.getByTestId(TID.errorContainer)).toBeHidden();
    await expect(page.getByTestId(TID.wsCodeFooter)).toHaveText(t('ws.codeFooterConfigOk'));
    await expect.poll(() => configKeys(page)).toEqual([]);
  });

  test('asks first: cancelling keeps the config', async ({ editPage, page }) => {
    await codeTab(page, 'config');
    await editPage.clearEditor();
    // Typed as one piece: Monaco would close the braces and quotes of typed keys itself.
    await page.keyboard.insertText('{ "fontSize": 20 }');
    await expect.poll(() => configKeys(page)).toEqual(['fontSize']);

    let asked = '';
    page.once('dialog', (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page.getByTestId(TID.resetConfigButton).click();
    await expect.poll(() => asked).toBe(t('editor.resetConfigConfirm'));
    expect(await configKeys(page)).toEqual(['fontSize']);
  });
});
