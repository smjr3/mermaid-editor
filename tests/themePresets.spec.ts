import { C, TID } from '$/constants';
import { readFileSync } from 'node:fs';
import { EditorPage, expect, t, test } from './test';
import type { Page } from '@playwright/test';

const code = 'flowchart LR\n  A[Start] --> B[End]';
const url = `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

interface Config {
  theme?: string;
  themeCSS?: string;
  themeVariables?: Record<string, unknown>;
}
const config = async (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { mermaid?: string }).mermaid ??
          '{}'
      ) as Config
  );

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

// Neon's node fill and border, and its background (themePresets.ts).
const neon = { background: '#07070d', border: '#00e5ff', fill: '#0d0f1a' };

const nodeShape = (page: Page) =>
  page.locator('#view .node').first().locator('rect, path, polygon').first();
const styleOf = (page: Page) =>
  nodeShape(page).evaluate((element) => {
    const style = getComputedStyle(element);
    return { fill: style.fill, filter: style.filter, stroke: style.stroke };
  });

const pickNeon = async (page: Page) => {
  await page.getByTestId(TID.colorsCard).click();
  await page.getByTestId(`${TID.colorsThemePreset}-neon`).click();
  await expect(page.getByTestId(`${TID.colorsThemePreset}-neon`)).toHaveAttribute(
    'aria-pressed',
    'true'
  );
};

test.describe('Theme presets', () => {
  test('neon: colours and glow, SVG and PNG export, reload, shared link, back to standard', async ({
    browser,
    editPage,
    page
  }) => {
    test.slow();
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await pickNeon(page);

    await expect.poll(async () => (await config(page)).theme).toBe('base');
    await expect
      .poll(async () => (await styleOf(page)).stroke, { timeout: 10_000 })
      .toBe(rgb(neon.border));
    const drawn = await styleOf(page);
    expect(drawn.fill).toBe(rgb(neon.fill));
    expect(drawn.filter).toContain('drop-shadow');
    await expect
      .poll(() =>
        page
          .locator('#view svg')
          .first()
          .evaluate((svg) => getComputedStyle(svg).backgroundColor)
      )
      .toBe(rgb(neon.background));

    // SVG export: the preset's CSS is inside the file's own <style>.
    await page.getByTestId(TID.actionsCard).click();
    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-SVG').click()
    ]);
    const svg = readFileSync((await svgDownload.path()) ?? '', 'utf8');
    const styles = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
    expect(styles.some((css) => css.includes('drop-shadow'))).toBe(true);
    expect(styles.some((css) => css.includes(`background-color:${neon.background}`))).toBe(true);
    expect(svg).toContain(neon.border);

    // PNG export: the dark background fills the image instead of white.
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-PNG').click()
    ]);
    const png = readFileSync((await pngDownload.path()) ?? '');
    const corner = await page.evaluate(async (b64) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve);
        image.addEventListener('error', reject);
        image.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context?.drawImage(image, 0, 0);
      return [...(context?.getImageData(1, 1, 1, 1).data ?? [])];
    }, png.toString('base64'));
    // Near-black (a node's glow may tint the corner a little), never white.
    expect(corner[3]).toBe(255);
    for (const channel of corner.slice(0, 3)) expect(channel).toBeLessThan(40);

    // Reload: the preset persists.
    await page.reload();
    await editPage.checkTextInView('Start');
    await expect
      .poll(async () => (await styleOf(page)).stroke, { timeout: 10_000 })
      .toBe(rgb(neon.border));

    // The URL hash carries it to a fresh browser.
    const shared = page.url();
    expect(shared).toContain('#pako:');
    const other = await browser.newContext();
    await other.addInitScript(() => localStorage.setItem('mermaid-editor-guide-done', 'true'));
    const otherPage = await other.newPage();
    await otherPage.goto(shared);
    await expect
      .poll(async () => (await styleOf(otherPage)).stroke, { timeout: 15_000 })
      .toBe(rgb(neon.border));
    await other.close();

    // Standard: no variables or CSS left, and the theme follows dark mode again.
    if (!(await page.getByTestId(`${TID.colorsThemePreset}-standard`).isVisible())) {
      await page.getByTestId(TID.colorsCard).click();
    }
    await page.getByTestId(`${TID.colorsThemePreset}-standard`).click();
    await expect.poll(async () => (await config(page)).theme).toBe('redux-color');
    const standard = await config(page);
    expect(standard.themeVariables).toBeUndefined();
    expect(standard.themeCSS).toBeUndefined();
    // The site mode no longer changes the managed theme.
    await editPage.toggleTheme();
    await page.waitForTimeout(500);
    expect((await config(page)).theme).toBe('redux-color');
    await editPage.toggleTheme();
    await expect.poll(async () => (await config(page)).theme).toBe('redux-color');
  });

  test('a preset stays put when the site switches to dark mode', async ({ editPage, page }) => {
    await editPage.start(url);
    await editPage.checkTextInView('Start');
    await pickNeon(page);
    await expect.poll(async () => (await config(page)).theme).toBe('base');
    const before = await config(page);
    await editPage.toggleTheme();
    await page.waitForTimeout(500);
    expect(await config(page)).toEqual(before);
    await expect
      .poll(async () => (await styleOf(page)).stroke, { timeout: 10_000 })
      .toBe(rgb(neon.border));
  });
});

test.describe('Theme presets on a phone', () => {
  test.use({ viewport: { height: 800, width: 360 } });

  // Not the editPage fixture: on a phone the cards sit under the editor, off screen at first.
  test('the picker fits without scrolling sideways and works from the keyboard', async ({
    page
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, C.editorChooserDismissedKey);
    const editPage = new EditorPage(page);
    await editPage.start(url);
    await page.getByText(t('editor.mobileEdit')).first().click();
    await page.getByTestId(TID.colorsCard).scrollIntoViewIfNeeded();
    await page.getByTestId(TID.colorsCard).click();
    const grid = page.getByTestId(TID.colorsThemePreset);
    await grid.scrollIntoViewIfNeeded();
    const box = await grid.boundingBox();
    if (!box) throw new Error('picker missing');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await page.getByTestId(`${TID.colorsThemePreset}-wa`).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await config(page)).themeCSS ?? '')
      .toContain('theme-preset: wa');
    await expect(page.getByTestId(`${TID.colorsThemePreset}-wa`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
