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
});
