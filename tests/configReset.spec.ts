import { TID } from '$/constants';
import { expect, test } from './test';

test.describe('Config reset', () => {
  test('restores the default config after it was broken', async ({ editPage, page }) => {
    await editPage.setEditorMode('Config');
    await editPage.clearEditor();
    await editPage.typeInEditor('{ "theme": ', { bottom: false });
    await expect(page.getByTestId(TID.errorContainer)).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId(TID.resetConfigButton).click();

    await expect(page.getByTestId(TID.errorContainer)).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { mermaid } = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
            mermaid?: string;
          };
          return Object.keys(JSON.parse(mermaid ?? '{}') as object).filter(
            (key) => key !== 'theme'
          );
        })
      )
      .toEqual([]);
  });
});
