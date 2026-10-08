import { TID } from '$/constants';
import { expect, t, test } from './test';

const firewall =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#123456"/></svg>';
const code = `architecture-beta
  service fw(corp:firewall)[Firewall]`;
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('Icon import', () => {
  test('imports SVG files as a pack that diagrams can use, keeps it, and removes it', async ({
    editPage,
    page
  }) => {
    await editPage.start(url);
    await page.getByTestId(TID.iconPacksCard).click();

    await page.getByTestId(TID.iconPackPrefix).fill('corp');
    await page.getByTestId(TID.iconPackFiles).setInputFiles({
      buffer: Buffer.from(firewall),
      mimeType: 'image/svg+xml',
      name: 'Firewall.svg'
    });
    await page.getByTestId(TID.iconPackImport).click();
    await expect(page.getByTestId(TID.iconPackList)).toContainText('corp');

    const icon = editPage.view.locator('rect[fill="#123456"]');
    await expect(icon.first()).toBeAttached({ timeout: 15_000 });

    // Stored in the browser: still there after a reload.
    await page.reload();
    await expect(icon.first()).toBeAttached({ timeout: 15_000 });

    await page.getByTestId(TID.iconPacksCard).click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId(TID.iconPackList).getByRole('button').first().click();
    await expect(page.getByTestId(TID.iconPackList)).not.toContainText('corp');
  });

  // R09: a pack the storage refused is not shown as imported, and can be retried.
  test('reports a full storage, keeps the pack out of the list, and imports on retry', async ({
    editPage,
    page
  }) => {
    await page.addInitScript(() => {
      const flags = window as unknown as { failIconPut?: boolean };
      flags.failIconPut = true;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        if (flags.failIconPut) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        return put.apply(this, args);
      };
    });
    await editPage.start(url);
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPackPrefix).fill('corp');
    await page.getByTestId(TID.iconPackFiles).setInputFiles({
      buffer: Buffer.from(firewall),
      mimeType: 'image/svg+xml',
      name: 'Firewall.svg'
    });
    await page.getByTestId(TID.iconPackImport).click();
    await expect(page.getByText(t('icons.errorStorageFull'))).toBeVisible();
    await expect(page.getByTestId(TID.iconPackList)).not.toContainText('corp');

    await page.evaluate(() => {
      (window as unknown as { failIconPut?: boolean }).failIconPut = false;
    });
    await page.getByTestId(TID.iconPackImport).click();
    await expect(page.getByTestId(TID.iconPackList)).toContainText('corp');
    await expect(page.getByText(t('icons.errorStorageFull'))).toBeHidden();
  });
});
