import { TID } from '$/constants';
import { chooseExport, copyExport, readDownload, saveExport } from './helpers/exportDlg';
import { expect, t, test } from './test';

const code = 'architecture-beta\n  service db(logos:postgresql)[Orders DB]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('HTML export', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Orders DB');
  });

  test('downloads a standalone page with the diagram, its icons and its source', async ({
    page
  }) => {
    const download = await saveExport(page, 'html', { htmlMode: 'file' });
    expect(download.suggestedFilename()).toBe('diagram.html');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('actions.htmlHint'));
    const html = (await readDownload(download)).toString('utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<svg');
    expect(html).toContain('Orders DB');
    // The postgresql logo is drawn inline, not fetched.
    expect(html).toContain('#336791');
    expect(html).toContain('service db(logos:postgresql)[Orders DB]');
  });

  test('copies one self-contained img tag', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    expect(await copyExport(page, 'html')).toBe('done');
    await expect(page.getByTestId(TID.exportDlgNote)).toHaveText(t('exportDlg.noteHtmlTag'));
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/^<img alt="[^"]*" src="data:image\/svg\+xml;base64,/);
  });

  test('exports for Markdown: an SVG file and Markdown that shows it', async ({
    page,
    context,
    browserName
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const download = await saveExport(page, 'md', { background: 'white' });
    const fileName = download.suggestedFilename();
    expect(fileName).toBe('diagram.svg');
    const svg = (await readDownload(download)).toString('utf8');
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('#336791');
    expect(svg).toContain('background-color: #ffffff');

    await expect(page.getByTestId(TID.exportDlgMessage)).toContainText(fileName);
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain(`](${fileName})`);
    expect(markdown).toMatch(/\]\(http[^)]*\/edit#pako:/);
    expect(markdown).toContain('service db(logos:postgresql)[Orders DB]');

    // Transparent: the file has no background.
    const clear = await saveExport(page, 'md', { background: 'transparent', name: 'clear' });
    expect(clear.suggestedFilename()).toBe('clear.svg');
    expect((await readDownload(clear)).toString('utf8')).not.toContain('background-color');
    await expect(page.getByTestId(TID.exportDlgMessage)).toContainText('clear.svg');
  });

  test('reports a diagram that does not render instead of exporting it', async ({
    editPage,
    page
  }) => {
    await editPage.typeInEditor('\n  service ((');
    let downloads = 0;
    page.on('download', () => downloads++);
    for (const format of ['html', 'md'] as const) {
      await chooseExport(page, format, format === 'html' ? { htmlMode: 'file' } : {});
      await page.getByTestId(TID.exportDlgSave).click();
      await expect(page.getByTestId(TID.exportDlgMessage)).toHaveText(t('actions.exportFailed'));
      await expect(page.getByTestId(TID.exportDlgSave)).toHaveAttribute(
        'data-export-state',
        'failed'
      );
    }
    expect(downloads).toBe(0);
  });
});
