import { TID } from '$/constants';
import { localExamples, localSamples } from '$/util/localSamples';
import { diagramData } from '@mermaid-js/examples';
import { readFileSync } from 'node:fs';
import { expect, t, test } from './test';

// Every sample diagram the editor offers, through every feature that renders,
// rewrites or exports it: light and dark rendering, the layout card, the HTML,
// GitLab, PNG and SVG exports, and the view and embed pages.

const zenuml =
  'zenuml\n  title Order\n  Client->OrderService.create() {\n    OrderService->Db.save()\n  }';
const samples = [
  ...diagramData.flatMap((diagram) =>
    diagram.examples.map((example) => ({
      code: example.code,
      name: `${diagram.name}: ${example.title}`
    }))
  ),
  ...Object.entries(localSamples).flatMap(([name, list]) =>
    list.map((example) => ({ code: example.code, name: `${name}: ${example.title}` }))
  ),
  ...Object.entries(localExamples).flatMap(([name, list]) =>
    list.map((example) => ({ code: example.code, name: `${name}: ${example.title}` }))
  ),
  { code: zenuml, name: 'ZenUML: Order' }
];

const state = (code: string) =>
  Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64');

const rendered = async (page: import('@playwright/test').Page, view = '#view') => {
  await expect(page.locator(`${view} svg`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
};

test.describe('Every sample diagram', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const { code, name } of samples) {
    test(`${name}: renders, lays out and exports`, async ({
      editPage,
      page,
      context,
      browserName
    }) => {
      test.skip(browserName !== 'chromium', 'clipboard and downloads checked in Chromium');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await editPage.start(`/edit#base64:${state(code)}`);
      await rendered(page);

      // Layout card: each direction keeps the diagram rendering.
      await page.getByTestId(TID.layoutCard).click();
      if ((await page.getByTestId(TID.layoutDirectionLR).count()) > 0) {
        for (const direction of [TID.layoutDirectionLR, TID.layoutDirectionTB]) {
          await page.getByTestId(direction).click();
          await rendered(page);
        }
        await page.getByTestId(TID.layoutFit).click();
        await expect(page.getByTestId(TID.layoutMessage)).toHaveText(
          new RegExp(`${t('layout.fitChoseLR')}|${t('layout.fitChoseTB')}`)
        );
        await rendered(page);
      }
      await page.getByTestId(TID.layoutCard).click();

      // Exports.
      await page.getByTestId(TID.actionsCard).click();
      const download = async (testID: string) => {
        const [file] = await Promise.all([
          page.waitForEvent('download'),
          page.getByTestId(testID).click()
        ]);
        return readFileSync((await file.path()) ?? '');
      };
      // An SVG file must be well-formed XML, or nothing but a browser's HTML parser opens it.
      const isXml = (text: string) =>
        page.evaluate(
          (svg) =>
            !new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror'),
          text
        );
      expect((await download(TID.downloadHTML)).toString()).toContain('<svg');
      expect(await isXml((await download(TID.exportGitLab)).toString())).toBe(true);
      await expect(page.getByTestId(TID.exportMessage)).toContainText('.svg');
      expect(await isXml((await download(TID.downloadSVG)).toString())).toBe(true);
      const png = await download(TID.downloadPNG);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
    });

    test(`${name}: renders dark, and on the view and embed pages`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(`/edit#base64:${state(code)}`);
      await rendered(page);
      const hash = page.url().split('#')[1];
      await page.goto(`/view#${hash}`);
      await expect(page.locator('svg').first()).toBeVisible({ timeout: 20_000 });
      await page.goto(`/embed#${hash}`);
      await expect(page.locator('#embed-container svg').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId(TID.embedRenderError)).toHaveCount(0);
    });
  }
});
