import { TID } from '$/constants';
import { expect, t, test } from './test';

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C
  C --> B`;
const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

const stored = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string; mermaid?: string }
  );
const config = async (page: import('@playwright/test').Page) =>
  JSON.parse((await stored(page)).mermaid ?? '{}') as {
    theme?: string;
    themeVariables?: { lineColor?: string };
  };

// The lane's drawn fill, as the browser computes it.
const laneFill = (page: import('@playwright/test').Page, title: string) =>
  page
    .locator('#view .swimlane.cluster', { hasText: title })
    .locator('rect.swimlane-body')
    .first()
    .evaluate((rect) => getComputedStyle(rect).fill);

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

test.describe('Colours card', () => {
  test('colours one lane, then clears it', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.colorsCard).click();
    // The first swatch in colors.ts (not imported: it pulls in mermaid).
    const blue = { fill: '#dde9fb', stroke: '#3b73c9' };

    await page.getByTestId(`${TID.colorsGroup}-Shop-blue`).click();
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain(`style Shop fill:${blue.fill},stroke:${blue.stroke},color:#1f2329`);
    await expect.poll(() => laneFill(page, 'Shop')).toBe(rgb(blue.fill));

    // The title stays dark on the light fill, also in dark mode.
    await editPage.toggleTheme();
    const title = page.locator('#view .swimlane.cluster', { hasText: 'Shop' }).locator('p', {
      hasText: /^Shop$/
    });
    await expect.poll(() => title.evaluate((p) => getComputedStyle(p).color)).toBe(rgb('#1f2329'));

    await page.getByTestId(`${TID.colorsGroup}-Shop-none`).click();
    await expect.poll(async () => (await stored(page)).code).toBe(lanes);
  });

  test('colours every lane at once, from any colour', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.colorsCard).click();

    await page.getByTestId(TID.colorsGroupsAuto).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style Customer');
    expect((await stored(page)).code).toContain('style Shop');

    await page.getByTestId(`${TID.colorsGroup}-Customer-custom`).fill('#336699');
    await expect.poll(async () => (await stored(page)).code).toContain('stroke:#336699');

    await page.getByTestId(TID.colorsGroupsClear).click();
    await expect.poll(async () => (await stored(page)).code).toBe(lanes);
  });

  test('picks a theme and returns to the automatic one', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.colorsCard).click();

    await page.getByTestId(`${TID.colorsTheme}-forest`).click();
    await expect.poll(async () => (await config(page)).theme).toBe('forest');
    await page.getByTestId(`${TID.colorsTheme}-auto`).click();
    // The editor fills its own theme back in.
    await expect.poll(async () => (await config(page)).theme).toBe('redux-color');
  });

  test('sets the line colour, and keeps it in dark mode', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.colorsCard).click();

    await page.getByTestId(`${TID.colorsLine}-#d64545`).click();
    await expect.poll(async () => (await config(page)).themeVariables?.lineColor).toBe('#d64545');
    const edge = page.locator('#view .flowchart-link').first();
    await expect
      .poll(() => edge.evaluate((path) => getComputedStyle(path).stroke))
      .toBe(rgb('#d64545'));
    await editPage.toggleTheme();
    await expect
      .poll(() => edge.evaluate((path) => getComputedStyle(path).stroke))
      .toBe(rgb('#d64545'));

    await page.getByTestId(TID.colorsLineDefault).click();
    await expect.poll(async () => (await config(page)).themeVariables).toBeUndefined();
  });

  test('colours a node chosen from the list or by clicking it in the diagram', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.colorsCard).click();
    const green = { fill: '#def5e1', stroke: '#3f9b52' };

    await page.getByTestId(TID.colorsNodeSelect).selectOption('C');
    await page.getByTestId(`${TID.colorsNode}-green`).click();
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain(`style C fill:${green.fill},stroke:${green.stroke},color:#1f2329`);
    const shape = page
      .locator('#view .node[id*="-flowchart-C-"]')
      .locator('rect, path, polygon')
      .first();
    await expect
      .poll(() => shape.evaluate((el) => getComputedStyle(el).fill))
      .toBe(rgb(green.fill));

    // Clicking a node in the diagram picks it.
    await page.locator('#view .node', { hasText: 'Place order' }).click();
    await expect(page.getByTestId(TID.colorsNodeSelect)).toHaveValue('A');
    await page.getByTestId(`${TID.colorsNode}-custom`).fill('#aa3377');
    await expect.poll(async () => (await stored(page)).code).toContain('style A fill:');
    expect((await stored(page)).code).toContain('stroke:#aa3377');

    // Clearing node colours leaves lane colours alone.
    await page.getByTestId(`${TID.colorsGroup}-Shop-blue`).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style Shop');
    await page.getByTestId(TID.colorsNodesClear).click();
    await expect.poll(async () => (await stored(page)).code).not.toContain('style C');
    const code = (await stored(page)).code ?? '';
    expect(code).not.toContain('style A');
    expect(code).toContain('style Shop');
  });

  test('explains when the diagram has no lanes', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  A->>B: hi'));
    await editPage.checkTextInView('hi');
    await page.getByTestId(TID.colorsCard).click();
    await expect(page.getByText(t('colors.groupsNone'))).toBeVisible();
    await expect(page.getByTestId(TID.colorsNodeSelect)).toHaveCount(0);
  });
});
