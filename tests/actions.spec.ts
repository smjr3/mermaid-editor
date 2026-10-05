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
});
