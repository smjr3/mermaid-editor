import { TID } from '$/constants';
import { resolveLocale } from '$/i18n/translate';
import { helpContent } from '$/util/helpContent';
import { expect, t, test } from './test';

const sections = helpContent[resolveLocale(process.env.MERMAID_LOCALE)];

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

  test('lists every topic, each with its points', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.helpButton).click();
    const content = page.getByTestId(TID.helpContent);
    for (const section of sections) {
      await page.getByTestId(`${TID.helpSection}-${section.id}`).click();
      await expect(content.locator('h3')).toHaveText(section.title);
      await expect(content.locator('ul.list-disc > li')).toHaveCount(section.items.length);
    }
    // The licence table and the version numbers are on their own pages.
    await page.getByTestId(`${TID.helpSection}-about`).click();
    await expect(page.getByTestId(TID.appVersion)).toBeVisible();
  });

  test('describes the layout in place today, not the removed tools', async ({ editPage, page }) => {
    await editPage.checkTextInView('Car');
    await page.getByTestId(TID.helpButton).click();
    const content = page.getByTestId(TID.helpContent);
    await page.getByTestId(`${TID.helpSection}-basics`).click();
    for (const point of sections[0].items) await expect(content).toContainText(point);
    const all = sections.flatMap(({ items }) => items).join('\n');
    expect(all).not.toMatch(/ctrl\+k|⌘k|gist/i);
  });
});
