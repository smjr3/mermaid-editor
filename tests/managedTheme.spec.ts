import type { Page } from '@playwright/test';
import { TID } from '$/constants';
import { readFileSync } from 'node:fs';
import { expect, test } from './test';

const storedTheme = (page: Page) =>
  page.evaluate(() => {
    const { mermaid } = JSON.parse(localStorage.getItem('codeStore') ?? '{}') as {
      mermaid?: string;
    };
    return (JSON.parse(mermaid ?? '{}') as { theme?: string }).theme;
  });

test.describe('Managed theme', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleSampleDiagrams();
  });

  test('follows the diagram type', async ({ editPage, page }) => {
    await editPage.loadSampleDiagram('Pie');
    await expect.poll(() => storedTheme(page)).toBe('default');
    await editPage.loadSampleDiagram('Flowchart');
    await expect.poll(() => storedTheme(page)).toBe('redux-color');
  });

  test('the diagram looks the same in the site light and dark mode', async ({ editPage, page }) => {
    await editPage.loadSampleDiagram('Flowchart');
    await expect.poll(() => storedTheme(page)).toBe('redux-color');
    await page.emulateMedia({ colorScheme: 'light' });
    await editPage.checkTheme('light');

    const picture = () =>
      page.evaluate(() => {
        const svg = document.querySelector('#view svg') as SVGElement;
        const node = document.querySelector('#view .node') as Element;
        const shape = node.querySelector('rect, path, polygon') as Element;
        const view = document.querySelector('#view') as HTMLElement;
        return {
          nodeFill: getComputedStyle(shape).fill,
          svg: svg.outerHTML,
          svgBackground: getComputedStyle(svg).backgroundColor,
          text: getComputedStyle(node.querySelector('span, text, p') ?? node).color,
          viewBackground: getComputedStyle(view).backgroundColor
        };
      });
    const exported = async () => {
      await page.getByTestId(TID.actionsCard).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId(TID.downloadSVG).click()
      ]);
      await page.getByTestId(TID.actionsCard).click();
      return readFileSync((await download.path()) ?? '', 'utf8');
    };

    const light = await picture();
    const lightSvg = await exported();
    expect(light.viewBackground).toBe('rgb(255, 255, 255)');

    await editPage.toggleTheme();
    await editPage.checkTheme('dark');
    await expect.poll(() => storedTheme(page)).toBe('redux-color');
    const dark = await picture();
    expect(dark).toEqual(light);
    expect(await exported()).toBe(lightSvg);
  });
});
