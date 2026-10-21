import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import {
  crumb,
  expectSelected,
  openLook,
  pickEdge,
  pickObject,
  segment,
  toRoot
} from './helpers/inspector';
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

const stored = async (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string; mermaid?: string }
  );
const config = async (page: Page) =>
  JSON.parse((await stored(page)).mermaid ?? '{}') as {
    theme?: string;
    themeVariables?: { lineColor?: string };
  };

// The lane's drawn fill, as the browser computes it.
const laneFill = (page: Page, title: string) =>
  page
    .locator('#view .swimlane.cluster', { hasText: title })
    .locator('rect.swimlane-body')
    .first()
    .evaluate((rect) => getComputedStyle(rect).fill);

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;

test.describe('Colours in the inspector', () => {
  test('colours one lane, then clears it', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    // The first swatch in colors.ts (not imported: it pulls in mermaid).
    const blue = { fill: '#dde9fb', stroke: '#3b73c9' };

    await pickObject(page, 'Shop');
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.lane');
    await page.getByTestId(`${TID.inspColor}-blue`).click();
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain(`style Shop fill:${blue.fill},stroke:${blue.stroke},color:#1f2329`);
    await expect.poll(() => laneFill(page, 'Shop')).toBe(rgb(blue.fill));
    await expect(page.getByTestId(`${TID.inspColor}-blue`)).toHaveAttribute('aria-pressed', 'true');

    // The title stays dark on the light fill, also in dark mode.
    await editPage.toggleTheme();
    const title = page.locator('#view .swimlane.cluster', { hasText: 'Shop' }).locator('p', {
      hasText: /^Shop$/
    });
    await expect.poll(() => title.evaluate((p) => getComputedStyle(p).color)).toBe(rgb('#1f2329'));

    await page.getByTestId(`${TID.inspColor}-none`).click();
    await expect.poll(async () => (await stored(page)).code).toBe(lanes);
  });

  test('colours every lane at once, from any colour', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await page.getByTestId(TID.inspLanesAuto).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style Customer');
    expect((await stored(page)).code).toContain('style Shop');

    await pickObject(page, 'Customer');
    await page.getByTestId(`${TID.inspColor}-custom`).fill('#336699');
    await expect.poll(async () => (await stored(page)).code).toContain('stroke:#336699');

    await toRoot(page);
    await page.getByTestId(TID.inspLanesClear).click();
    await expect.poll(async () => (await stored(page)).code).toBe(lanes);
  });

  test('picks a built-in theme and returns to none', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await openLook(page);
    await expect(page.getByTestId(TID.inspBuiltinTheme)).toHaveValue('auto');

    await page.getByTestId(TID.inspBuiltinTheme).selectOption('forest');
    await expect.poll(async () => (await config(page)).theme).toBe('forest');
    await page.getByTestId(TID.inspBuiltinTheme).selectOption('auto');
    // The editor fills its own theme back in.
    await expect.poll(async () => (await config(page)).theme).toBe('redux-color');
  });

  test('sets the line colour, and keeps it in dark mode', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await openLook(page);
    await page.getByTestId(`${TID.inspLineColor}-#d64545`).click();
    await expect.poll(async () => (await config(page)).themeVariables?.lineColor).toBe('#d64545');
    const edge = page.locator('#view .flowchart-link').first();
    await expect
      .poll(() => edge.evaluate((path) => getComputedStyle(path).stroke))
      .toBe(rgb('#d64545'));
    await editPage.toggleTheme();
    await expect
      .poll(() => edge.evaluate((path) => getComputedStyle(path).stroke))
      .toBe(rgb('#d64545'));

    await page.getByTestId(`${TID.inspLineColor}-none`).click();
    await expect.poll(async () => (await config(page)).themeVariables).toBeUndefined();
  });

  test('colours a node chosen from the list or by clicking it in the diagram', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    const green = { fill: '#def5e1', stroke: '#3f9b52' };

    await pickObject(page, 'C');
    await page.getByTestId(`${TID.inspColor}-green`).click();
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

    // Clicking a node in the diagram selects it.
    await page.locator('#view .node', { hasText: 'Place order' }).click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Place order');
    await page.getByTestId(`${TID.inspColor}-custom`).fill('#aa3377');
    await expect.poll(async () => (await stored(page)).code).toContain('style A fill:');
    expect((await stored(page)).code).toContain('stroke:#aa3377');

    // Clearing node colours leaves lane colours alone.
    await pickObject(page, 'Shop');
    await page.getByTestId(`${TID.inspColor}-blue`).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style Shop');
    await toRoot(page);
    await page.getByTestId(TID.inspNodesClear).click();
    await expect.poll(async () => (await stored(page)).code).not.toContain('style C');
    const code = (await stored(page)).code ?? '';
    expect(code).not.toContain('style A');
    expect(code).toContain('style Shop');
  });

  test('colours a border alone, and the text', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await pickObject(page, 'C');

    await segment(page, TID.inspColorTarget, 'stroke');
    await page.getByTestId(`${TID.inspColor}-#d64545`).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style C stroke:#d64545');
    await expect(page.getByTestId(`${TID.inspColor}-#d64545`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await segment(page, TID.inspColorTarget, 'text');
    await page.getByTestId(`${TID.inspColor}-#3b73c9`).click();
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain('style C stroke:#d64545,color:#3b73c9');

    await segment(page, TID.inspColorTarget, 'stroke');
    await page.getByTestId(`${TID.inspColor}-none`).click();
    await expect.poll(async () => (await stored(page)).code).toContain('style C color:#3b73c9');
  });

  test('colours an arrow picked by its label, and resets every arrow', async ({
    editPage,
    page
  }) => {
    const code = `${lanes}\n  B -->|done| C`;
    await editPage.start(urlFor(code));
    await editPage.checkTextInView('done');

    await page.locator('#view .edgeLabel', { hasText: 'done' }).click();
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
    await page.getByTestId(`${TID.inspEdgeColor}-#d64545`).click();
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain('linkStyle 3 stroke:#d64545');
    const path = page.locator('#view path[data-id="L_B_C_0"]');
    await expect
      .poll(() => path.evaluate((el) => getComputedStyle(el).stroke))
      .toBe(rgb('#d64545'));

    await pickEdge(page, 0);
    await page.getByTestId(`${TID.inspEdgeColor}-custom`).fill('#22aa55');
    await expect
      .poll(async () => (await stored(page)).code)
      .toContain('linkStyle 0 stroke:#22aa55');

    await toRoot(page);
    await page.getByTestId(TID.inspEdgesReset).click();
    await expect.poll(async () => (await stored(page)).code).toBe(code);
  });

  test('offers a freely picked colour again, also after a reload', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await pickObject(page, 'Shop');
    await page.getByTestId(`${TID.inspColor}-custom`).fill('#336699');
    await expect.poll(async () => (await stored(page)).code).toContain('style Shop fill:');
    await pickObject(page, 'A');
    const recent = page.getByTestId(`${TID.inspColor}-recent-0`);
    await expect(recent).toHaveAttribute('data-color', '#336699');
    await recent.click();
    await expect.poll(async () => (await stored(page)).code).toContain('style A fill:');
    expect((await stored(page)).code).toMatch(/style A fill:#[\da-f]{6},stroke:#336699/);

    await page.reload();
    await editPage.checkTextInView('Accept order');
    await openLook(page);
    await expect(page.getByTestId(`${TID.inspLineColor}-recent-0`)).toHaveAttribute(
      'data-color',
      '#336699'
    );
    await page.keyboard.press('Escape');
    await pickObject(page, 'Customer');
    await expect(page.getByTestId(`${TID.inspColor}-recent-0`)).toHaveAttribute(
      'data-color',
      '#336699'
    );
  });

  test('explains when the diagram has nothing to colour one by one', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  A->>B: hi'));
    await editPage.checkTextInView('hi');
    await expect(page.getByTestId(TID.inspPanel)).toContainText(t('colors.objectsNone'));
    await expect(page.getByTestId(TID.inspNodesAuto)).toHaveCount(0);
    await pickObject(page, 'A');
    await expect(page.getByTestId(TID.inspColorTarget)).toHaveCount(0);
  });

  for (const { code, id, text } of [
    { code: 'classDiagram\n  class Animal\n  Animal <|-- Dog', id: 'Animal', text: 'Animal' },
    { code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy', id: 'Busy', text: 'Busy' },
    { code: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places', id: 'ORDER', text: 'ORDER' },
    // The left block: the one on the right can sit under the zoom buttons.
    { code: 'block-beta\n  columns 2\n  a["Alpha"] b["Beta"]', id: 'a', text: 'Alpha' },
    { code: 'C4Context\n  Person(a, "Alice")\n  System(s, "Shop")', id: 's', text: 'Shop' }
  ]) {
    test(`colours a ${code.split(/\s/)[0]} object picked in the diagram`, async ({
      editPage,
      page
    }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(text);

      await page.locator('#view svg').getByText(text, { exact: true }).first().click();
      await expectSelected(page);
      await page.getByTestId(`${TID.inspColor}-red`).click();
      const red = '#fde2e1';
      await expect
        .poll(async () => (await stored(page)).code)
        .toContain(
          code.startsWith('C4')
            ? `UpdateElementStyle(${id}, $bgColor="${red}"`
            : `style ${id} fill:${red}`
        );
      // The colour reaches the drawing.
      await expect
        .poll(() =>
          page.evaluate(
            (fill) =>
              [...document.querySelectorAll('#view svg *')].some(
                (element) => getComputedStyle(element).fill === fill
              ),
            rgb(red)
          )
        )
        .toBe(true);

      await toRoot(page);
      await page.getByTestId(TID.inspNodesClear).click();
      await expect.poll(async () => (await stored(page)).code).toBe(code);
    });
  }
});
