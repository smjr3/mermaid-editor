import { TID } from '$/constants';
import { expect, t, test } from './test';

test.describe('How to use', () => {
  test('opens a guide from the header and switches topics', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.helpButton).click();
    const dialog = page.getByTestId(TID.helpDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(t('help.title'))).toBeVisible();
    const content = page.getByTestId(TID.helpContent);
    await expect(content.locator('li')).not.toHaveCount(0);
    const first = await content.locator('h3').textContent();

    await page.getByTestId(`${TID.helpSection}-colours`).click();
    await expect(content.locator('h3')).not.toHaveText(first ?? '');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
