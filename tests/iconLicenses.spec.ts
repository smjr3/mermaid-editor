import { TID } from '$/constants';
import { expect, test } from './test';

test.describe('Icon licences', () => {
  test('the Icons card opens a dialog listing every bundled set with its licence', async ({
    editPage,
    page
  }) => {
    await editPage.start();
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconLicensesButton).click();

    const dialog = page.getByTestId(TID.iconLicensesDialog);
    await expect(dialog).toBeVisible();
    for (const text of ['Tabler Icons', 'MIT', 'Simple Icons', 'CC0-1.0', 'tabler', 'logos']) {
      await expect(dialog).toContainText(text);
    }
    // The trademark note is there, and the licence links open elsewhere.
    await expect(dialog).toContainText('商標');
    await expect(dialog.getByRole('link', { name: 'MIT' }).first()).toHaveAttribute(
      'target',
      '_blank'
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('icon tooltips name the licence and mark logos as trademarks', async ({
    editPage,
    page
  }) => {
    await editPage.start();
    await page.getByTestId(TID.iconPacksCard).click();

    await page.getByTestId(TID.iconPickerSearch).fill('aws-lambda');
    const logo = page.getByTestId(TID.iconPickerResults).getByRole('button').first();
    await expect(logo).toBeVisible({ timeout: 30_000 });
    await expect(logo).toHaveAttribute('title', /SVG Logos \(CC0-1\.0\) · ™/);

    await page.getByTestId(TID.iconPickerSearch).fill('server');
    const generic = page
      .getByTestId(TID.iconPickerResults)
      .getByRole('button', { name: /^tabler:server — / });
    await expect(generic.first()).toBeVisible({ timeout: 30_000 });
    await expect(generic.first()).toHaveAttribute('title', /Tabler Icons \(MIT\)$/);
  });
});
