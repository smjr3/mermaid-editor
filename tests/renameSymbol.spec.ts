import { expect, t, test } from './test';

const code = 'flowchart TD\n  order[Order] --> ship[Ship the order]\n  order --> cancel';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

// Monaco may write CRLF line endings; compare the lines, not the separator.
const storedCode = async (page: import('@playwright/test').Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code
    )
    .then((value) => value?.replaceAll('\r\n', '\n'));

test.describe('Rename symbol (F2)', () => {
  test('renames every use of a node id and leaves label text alone', async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Ship the order');

    // Put the cursor inside the first `order` and rename it.
    await editPage.editor.getByText('order', { exact: true }).first().click();
    await page.keyboard.press('F2');
    const input = page.locator('.rename-box input');
    await expect(input).toBeVisible();
    await input.fill('purchase');
    await page.keyboard.press('Enter');

    await expect
      .poll(() => storedCode(page))
      .toBe('flowchart TD\n  purchase[Order] --> ship[Ship the order]\n  purchase --> cancel');
  });

  // R02: mermaid merges two nodes that share an id without an error.
  test('refuses an id another node already has', async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Ship the order');

    await editPage.editor.getByText('order', { exact: true }).first().click();
    await page.keyboard.press('F2');
    const input = page.locator('.rename-box input');
    await expect(input).toBeVisible();
    await input.fill('ship');
    await page.keyboard.press('Enter');

    // Monaco shows the rejection beside the cursor and changes nothing.
    await expect(page.getByText(t('editor.renameTaken', { name: 'ship' }))).toBeVisible();
    expect(await storedCode(page)).toBe(code);
    await editPage.checkTextInView('Order');
  });
});
