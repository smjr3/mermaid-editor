import { TID } from '$/constants';
import { expect, t, test } from './test';

const code = `architecture-beta
  service web(tabler:server)[Web]
  service fn(aws:lambda)[Fn]
  web:R --> L:fn`;
const urlFor = (text: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code: text, mermaid: '{}' })).toString('base64')}`;

test.describe('AI icon helpers', () => {
  test('collects icons in the picker and copies a briefing for an AI', async ({
    editPage,
    page,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await editPage.start();
    await page.getByTestId(TID.inspIconBrowse).click();
    const dialog = page.getByTestId(TID.inspIconDialog);
    await expect(dialog).toBeVisible();

    await page.getByTestId(TID.iconPickerCollect).check();
    await page.getByTestId(TID.iconPickerSearch).fill('load-balancer');
    const result = page
      .getByTestId(TID.iconPickerResults)
      .getByRole('button', { name: /^tabler:load-balancer/ });
    await expect(result.first()).toBeVisible({ timeout: 30_000 });
    await result.first().click();
    // Collecting keeps the dialog open and does not touch the code.
    await expect(page.getByTestId(TID.iconPickerMessage)).toHaveText(
      t('icons.aiCollected', { id: 'tabler:load-balancer' })
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(editPage.editor).not.toContainText('load-balancer');
    // The briefing row of 図全体 lists it.
    await expect(page.getByTestId(TID.aiCollected)).toContainText('tabler:load-balancer');

    await page.getByTestId(TID.inspAiCopy).click();
    await expect(page.getByTestId(TID.aiMessage)).toHaveText(t('icons.aiCopied'));
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('architecture-beta');
    expect(text).toContain('- tabler:load-balancer');
    expect(text).toContain('tabler:server');

    await page.getByTestId(TID.aiClearButton).click();
    await expect(page.getByTestId(TID.aiCollected)).toBeHidden();
  });

  test('lists an unknown icon name and replaces it with a real one', async ({ editPage, page }) => {
    await editPage.start(urlFor(code));

    const count = page.getByTestId(TID.inspUnknownCount);
    await expect(count).toHaveAttribute('data-count', '1', { timeout: 60_000 });
    const section = page.getByTestId(TID.unknownIcons);
    await expect(section).toContainText('aws:lambda');
    await expect(section).not.toContainText('tabler:server');

    const choice = page.getByTestId(`${TID.unknownIconChoice}-aws:lambda`);
    await expect(choice).toHaveValue('logos:aws-lambda');
    await page.getByTestId(`${TID.unknownIconReplace}-aws:lambda`).click();
    await expect(editPage.editor).toContainText('fn(logos:aws-lambda)[Fn]');
    await expect(section).toBeHidden({ timeout: 60_000 });
    await expect(count).toHaveAttribute('data-count', '0');
    await expect(page.getByTestId(TID.inspUnknownReplace)).toBeDisabled();
  });

  test('replaces every unknown icon with its suggestion at once', async ({ editPage, page }) => {
    await editPage.start(urlFor(`${code}\n  service db(aws:dynamodb)[DB]\n  fn:R --> L:db`));
    const count = page.getByTestId(TID.inspUnknownCount);
    await expect(count).toHaveAttribute('data-count', '2', { timeout: 60_000 });
    await expect(count).toHaveText(t('insp.unknownCount', { count: '2' }));
    await page.getByTestId(TID.inspUnknownReplace).click();
    await expect(editPage.editor).toContainText('fn(logos:aws-lambda)[Fn]');
    await expect(editPage.editor).not.toContainText('(aws:dynamodb)');
    await expect(count).toHaveAttribute('data-count', '0', { timeout: 60_000 });
  });
});
