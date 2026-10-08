import { TID } from '$/constants';
import { readFileSync } from 'node:fs';
import { expect, t, test } from './test';

const code = 'architecture-beta\n  service db(logos:postgresql)[Orders DB]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('HTML export', () => {
  test('downloads a standalone page with the diagram, its icons and its source', async ({
    editPage,
    page
  }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Orders DB');
    await page.getByTestId(TID.actionsCard).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(TID.downloadHTML).click()
    ]);
    expect(download.suggestedFilename()).toBe('diagram.html');
    const html = readFileSync((await download.path()) ?? '', 'utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<svg');
    expect(html).toContain('Orders DB');
    // The postgresql logo is drawn inline, not fetched.
    expect(html).toContain('#336791');
    expect(html).toContain('service db(logos:postgresql)[Orders DB]');
  });

  test('copies one self-contained img tag', async ({ editPage, page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await editPage.start(url);
    await editPage.checkTextInView('Orders DB');
    await page.getByTestId(TID.actionsCard).click();
    await page.getByRole('button', { name: t('actions.copyHtmlTag') }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/^<img alt="[^"]*" src="data:image\/svg\+xml;base64,/);
  });

  test('exports for GitLab: an SVG file and Markdown that shows it', async ({
    editPage,
    page,
    context,
    browserName
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await editPage.start(url);
    await editPage.checkTextInView('Orders DB');
    await page.getByTestId(TID.actionsCard).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(TID.exportGitLab).click()
    ]);
    const fileName = download.suggestedFilename();
    expect(fileName).toBe('diagram.svg');
    const svg = readFileSync((await download.path()) ?? '', 'utf8');
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('#336791');
    expect(svg).toContain('background-color');

    await expect(page.getByTestId(TID.exportMessage)).toContainText(fileName);
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain(`](${fileName})`);
    expect(markdown).toMatch(/\]\(http[^)]*\/edit#pako:/);
    expect(markdown).toContain('service db(logos:postgresql)[Orders DB]');
  });
});
