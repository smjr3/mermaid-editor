import { TID } from '$/constants';
import { expect, test } from './test';

const code = `architecture-beta
  service web(tabler:server)[Web]
  service fn(aws:lambda)[Fn]
  web:R --> L:fn`;
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('AI icon helpers', () => {
  test('collects icons in the picker and copies a briefing for an AI', async ({
    editPage,
    page,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await editPage.start();
    await page.getByTestId(TID.iconPacksCard).click();

    await page.getByTestId(TID.iconPickerCollect).check();
    await page.getByTestId(TID.iconPickerSearch).fill('load-balancer');
    const result = page
      .getByTestId(TID.iconPickerResults)
      .getByRole('button', { name: /^tabler:load-balancer/ });
    await expect(result.first()).toBeVisible({ timeout: 30_000 });
    await result.first().click();
    // Collecting did not touch the code.
    await expect(editPage.editor).not.toContainText('load-balancer');
    // The briefing is in the 出す tab's "AI and unknown icons" section.
    await page.getByTestId(TID.aiCard).click();
    await expect(page.getByTestId(TID.aiCollected)).toContainText('tabler:load-balancer');

    await page.getByTestId(TID.aiCopyButton).click();
    await expect(page.getByTestId(TID.aiMessage)).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('architecture-beta');
    expect(text).toContain('- tabler:load-balancer');
    expect(text).toContain('tabler:server');

    await page.getByTestId(TID.aiClearButton).click();
    await expect(page.getByTestId(TID.aiCollected)).toBeHidden();
  });

  test('lists an unknown icon name and replaces it with a real one', async ({ editPage, page }) => {
    await editPage.start(url);
    await page.getByTestId(TID.aiCard).click();

    const section = page.getByTestId(TID.unknownIcons);
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(section).toContainText('aws:lambda');
    await expect(section).not.toContainText('tabler:server');

    const choice = page.getByTestId(`${TID.unknownIconChoice}-aws:lambda`);
    await expect(choice).toHaveValue('logos:aws-lambda');
    await page.getByTestId(`${TID.unknownIconReplace}-aws:lambda`).click();
    await expect(editPage.editor).toContainText('fn(logos:aws-lambda)[Fn]');
    await expect(section).toBeHidden({ timeout: 60_000 });
  });
});
