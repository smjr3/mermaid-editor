import { expect, t, test } from './test';

test.describe('Check actions', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleActions();
  });

  // Upstream offers a "Copy Markdown" field holding a mermaid.ink image URL, which
  // carries the diagram source to an external renderer. This fork empties
  // MERMAID_RENDERER_URL so no such link is produced. Local PNG/SVG export is
  // unaffected and still covered below.
  test('should not offer a Markdown link that sends the diagram off-site', async ({ editPage }) => {
    await expect(editPage.markdownInput).toBeHidden();
    await editPage.typeInEditor('C --> HistoryTest', { bottom: true, newline: true });
    await expect(editPage.markdownInput).toBeHidden();
  });

  test('should still export PNG and SVG locally', async ({ page }) => {
    await expect(page.getByTestId('download-PNG')).toBeVisible();
    await expect(page.getByTestId('download-SVG')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByTestId('download-PNG').click();
    expect((await download).suggestedFilename()).toContain('.png');
  });

  test.skip('should load gists from URL', async ({ page }) => {
    await page
      .locator('#gist')
      .fill('https://gist.github.com/sidharthv96/6268a23e673a533dcb198f241fd7012a');
    await page.getByText(t('actions.loadGist')).click();
    await expect(page.getByText('Go shopping!!')).toBeVisible();
  });

  test('should download png and svg', async ({ editPage }) => {
    const firstPngSize = await editPage.checkAndDownloadPNG(20_000);
    const firstSvgSize = await editPage.downloadSVG(10_000);

    // Verify downloaded file is different for different diagrams
    await editPage.toggleSampleDiagrams();
    await editPage.loadSampleDiagram('Entity Relationship');
    // One tool card is open at a time: the Samples card closed Actions.
    await editPage.toggleActions();

    const secondPngSize = await editPage.checkAndDownloadPNG(20_000);
    const secondSvgSize = await editPage.downloadSVG(10_000);

    // Verify files are actually different
    expect(firstPngSize).not.toBe(secondPngSize);
    expect(firstSvgSize).not.toBe(secondSvgSize);
  });

  // R10: the copy button reports the outcome of the whole copy, not its start.
  test('copies the PNG to the clipboard and shows the tick only then', async ({ page }) => {
    const copy = page.getByRole('button', { name: t('actions.copyImage') });
    await copy.click();
    await expect(copy).toHaveAttribute('data-copy-state', 'busy');
    await expect(copy).toHaveAttribute('data-copy-state', 'done', { timeout: 15_000 });
    const types = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return items.flatMap((item) => item.types);
    });
    expect(types).toContain('image/png');
  });

  test('reports a refused clipboard write instead of a tick', async ({ page }) => {
    await page.evaluate(() => {
      navigator.clipboard.write = () =>
        Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
    });
    const copy = page.getByRole('button', { name: t('actions.copyImage') });
    await copy.click();
    await expect(copy).toHaveAttribute('data-copy-state', 'failed', { timeout: 15_000 });
    await expect(page.getByText(t('notify.copyFailed'))).toBeVisible();
    // Pan/zoom, paused for the capture, is back on afterwards.
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('codeStore') ?? '{}').panZoom)
      )
      .toBe(true);
  });
});
