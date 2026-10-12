import { TID } from '$/constants';
import { closeExport, copyExport, saveExport } from './helpers/exportDlg';
import { expect, t, test } from './test';

test.describe('Check actions', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleActions();
  });

  // Upstream offers a "Copy Markdown" field holding a mermaid.ink image URL, which
  // carries the diagram source to an external renderer. This fork empties
  // MERMAID_RENDERER_URL so no such link is produced. Local PNG/SVG export is
  // unaffected and still covered below.
  test('should not offer a Markdown link that sends the diagram off-site', async ({
    editPage,
    page
  }) => {
    await expect(editPage.markdownInput).toBeHidden();
    await expect(page.getByTestId(TID.exportDlgExternal)).toHaveCount(0);
    await closeExport(page);
    await editPage.typeInEditor('C --> HistoryTest', { bottom: true, newline: true });
    await editPage.toggleActions();
    await expect(editPage.markdownInput).toBeHidden();
    await expect(page.getByTestId(TID.exportDlgExternal)).toHaveCount(0);
  });

  test('should still export PNG and SVG locally', async ({ page }) => {
    await expect(page.getByTestId(`${TID.exportDlgFormat}-png`)).toBeVisible();
    await expect(page.getByTestId(`${TID.exportDlgFormat}-svg`)).toBeVisible();
    const download = await saveExport(page, 'png');
    expect(download.suggestedFilename()).toContain('.png');
  });

  test('should download png and svg', async ({ editPage, page }) => {
    const firstPngSize = await editPage.checkAndDownloadPNG(20_000);
    const firstSvgSize = await editPage.downloadSVG(10_000);

    // Verify downloaded file is different for different diagrams
    await closeExport(page);
    await editPage.loadSampleDiagram('Entity Relationship');

    const secondPngSize = await editPage.checkAndDownloadPNG(20_000);
    const secondSvgSize = await editPage.downloadSVG(10_000);

    // Verify files are actually different
    expect(firstPngSize).not.toBe(secondPngSize);
    expect(firstSvgSize).not.toBe(secondSvgSize);
  });

  // R10: the button reports the outcome of the whole copy, not its start.
  test('copies the PNG to the clipboard and shows the tick only then', async ({ page }) => {
    const copy = page.getByTestId(TID.exportDlgSave);
    await page.getByTestId(`${TID.exportDlgFormat}-copy`).click();
    await expect(copy).toHaveText(t('exportDlg.copy'));
    await expect(page.getByTestId(TID.exportDlgFileName)).toHaveCount(0);
    await copy.click();
    await expect(copy).toHaveAttribute('data-export-state', 'busy');
    await expect(copy).toHaveAttribute('data-export-state', 'done', { timeout: 15_000 });
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
    expect(await copyExport(page, 'copy')).toBe('failed');
    await expect(page.getByText(t('notify.copyFailed'))).toBeVisible();
    // Pan/zoom, paused for the capture, is back on afterwards.
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('codeStore') ?? '{}').panZoom)
      )
      .toBe(true);
  });
});
