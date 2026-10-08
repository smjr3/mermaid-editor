import { TID } from '$/constants';
import { readFile } from 'node:fs/promises';
import { expect, test } from './test';

// MERMAID_OFFLINE (on by default here): the site asks nothing outside itself.
// Font Awesome and an icon pack are in the diagram so the paths that used to
// reach out (the FA stylesheet, the config schema, the renderer) are exercised.
const code = `flowchart LR
  A[fa:fa-car Car] --> B@{ icon: "tabler:server", form: "square", label: "Web" }`;
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

test.describe('Offline build', () => {
  test('loads, renders, edits the config and exports without an external request', async ({
    editPage,
    page
  }) => {
    const external = new Set<string>();
    page.on('request', (request) => {
      const host = new URL(request.url()).host;
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) external.add(request.url());
    });

    await editPage.start(url);
    await editPage.checkTextInView('Car');
    // The config tab is where the schema used to be downloaded from.
    await editPage.setEditorMode('Config');
    await editPage.setEditorMode('Code');
    await page.getByTestId(TID.actionsCard).click();

    const download = page.waitForEvent('download');
    await page.getByTestId(TID.downloadSVG).click();
    const svg = await readFile(await (await download).path(), 'utf8');
    expect(svg).not.toContain('cdnjs');
    expect(svg).not.toContain('xml-stylesheet');

    // Loading a gist is not offered.
    await expect(page.getByPlaceholder(/gist/i)).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect([...external]).toEqual([]);
  });

  test('refuses a ?code= URL on another site, and still loads a data: one', async ({
    editPage,
    page
  }) => {
    const external = new Set<string>();
    page.on('request', (request) => {
      const host = new URL(request.url()).host;
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) external.add(request.url());
    });
    await editPage.start('/edit?code=https://example.invalid/diagram.mmd');
    await expect(editPage.view.locator('svg').first()).toBeVisible({ timeout: 15_000 });
    expect([...external]).toEqual([]);

    const data = `data:application/vnd.mermaid,${encodeURIComponent('flowchart TD\n  Hello-->World')}`;
    await editPage.start(`/edit?code=${encodeURIComponent(data)}`);
    await editPage.checkTextInView('Hello');
    expect([...external]).toEqual([]);
  });

  // R04: an imported icon that points outside itself (an <image>, a url() paint) is
  // drawn without the browser fetching anything, in the diagram and in the picker.
  test('draws an imported icon with external references without requesting them', async ({
    editPage,
    page
  }) => {
    const external = new Set<string>();
    page.on('request', (request) => {
      const host = new URL(request.url()).host;
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) external.add(request.url());
    });
    const tracker = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
  <image href="https://tracker.example.com/pixel.png" width="24" height="24"/>
  <image xlink:href="https://tracker.example.com/pixel2.png" width="24" height="24"/>
  <rect width="24" height="24" fill="#123456" style="stroke:url(https://tracker.example.com/paint.svg#p)"/>
  <circle r="4" cx="12" cy="12" fill="url(https://tracker.example.com/fill.svg#f)"/>
</svg>`;
    const architecture = `architecture-beta\n  service fw(corp:tracker)[Firewall]`;
    await editPage.start(
      `/edit#base64:${Buffer.from(JSON.stringify({ code: architecture, mermaid: '{}' })).toString('base64')}`
    );
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPackPrefix).fill('corp');
    await page.getByTestId(TID.iconPackFiles).setInputFiles({
      buffer: Buffer.from(tracker),
      mimeType: 'image/svg+xml',
      name: 'Tracker.svg'
    });
    await page.getByTestId(TID.iconPackImport).click();
    await expect(page.getByTestId(TID.iconPackList)).toContainText('corp');

    const icon = editPage.view.locator('rect[fill="#123456"]');
    await expect(icon.first()).toBeAttached({ timeout: 15_000 });
    await expect(page.locator('#view image')).toHaveCount(0);
    expect(await page.locator('#view').innerHTML()).not.toContain('tracker.example.com');

    // The picker previews the icon too.
    await page.getByTestId(TID.iconPickerSearch).fill('tracker');
    await expect(page.getByTestId(TID.iconPickerResults).locator('svg').first()).toBeAttached();
    expect(await page.content()).not.toContain('tracker.example.com');

    await page.waitForTimeout(1000);
    expect([...external]).toEqual([]);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId(TID.iconPackList).getByRole('button').first().click();
  });
});
