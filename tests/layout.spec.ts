import { TID } from '$/constants';
import { expect, t, test } from './test';

const chain =
  'flowchart TD\n  A[Start] --> B[Check] --> C[Approve] --> D[Order] --> E[Ship] --> F[Done]';
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

const stored = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string; mermaid?: string }
  );

// Where the last node sits relative to the first: below it top-to-bottom, beside it left-to-right.
const flowAxis = async (page: import('@playwright/test').Page) => {
  const start = await page.locator('#view .nodeLabel', { hasText: /^Start$/ }).boundingBox();
  const done = await page.locator('#view .nodeLabel', { hasText: /^Done$/ }).boundingBox();
  if (!start || !done) return 'none';
  return Math.abs(done.x - start.x) > Math.abs(done.y - start.y) ? 'horizontal' : 'vertical';
};

test.describe('Layout card', () => {
  test('switches the direction in the code', async ({ editPage, page }) => {
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    await page.getByTestId(TID.layoutCard).click();
    expect(await flowAxis(page)).toBe('vertical');

    await page.getByTestId(TID.layoutDirectionLR).click();
    await expect.poll(async () => (await stored(page)).code?.split('\n')[0]).toBe('flowchart LR');
    await expect.poll(() => flowAxis(page)).toBe('horizontal');
  });

  test('fits the diagram to the view', async ({ editPage, page }) => {
    // Eight branches side by side: far wider than the view top-to-bottom.
    const fan = `flowchart TD\n${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `  R[Request] --> T${n}[Team number ${n}]`).join('\n')}`;
    await editPage.start(urlFor(fan));
    await editPage.checkTextInView('Team number 8');
    await page.getByTestId(TID.layoutCard).click();
    await page.getByTestId(TID.layoutFit).click();
    await expect(page.getByTestId(TID.layoutMessage)).toHaveText(t('layout.fitChoseLR'));
    await expect.poll(async () => (await stored(page)).code?.split('\n')[0]).toBe('flowchart LR');
  });

  test('sets the layout engine and spacing in the config', async ({ editPage, page }) => {
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    await page.getByTestId(TID.layoutCard).click();
    await page.getByTestId(TID.layoutEngineDagre).click();
    await page.getByTestId(`${TID.layoutSpacing}-compact`).click();
    await expect
      .poll(async () => JSON.parse((await stored(page)).mermaid ?? '{}') as Record<string, unknown>)
      .toMatchObject({ flowchart: { nodeSpacing: 25, rankSpacing: 30 }, layout: 'dagre' });
    await editPage.checkTextInView('Ship');
  });

  // The extent of the node positions in the diagram's own coordinates (unaffected by pan/zoom).
  const extent = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const points = [...document.querySelectorAll('#view .node')].map((node) => {
        const match = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(
          node.getAttribute('transform') ?? ''
        );
        const [x, y] = [Number(match?.[1]), Number(match?.[2])];
        return { x, y };
      });
      const span = (key: 'x' | 'y') =>
        Math.max(...points.map((p) => p[key])) - Math.min(...points.map((p) => p[key]));
      return { count: points.length, height: span('y'), width: span('x') };
    });

  const branching =
    'A[Start] --> B{Check}\n  B --> C[Approve]\n  B --> D[Reject]\n  C --> E[Order] --> F[Ship]\n  D --> G[Notify]\n  G --> F';
  for (const [name, code] of [
    ['flowchart', `flowchart TD\n  ${branching}`],
    [
      'state diagram',
      'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Draft --> Hold\n  Review --> Approved\n  Hold --> Approved\n  Approved --> Closed\n  Closed --> [*]'
    ]
  ] as const) {
    test(`the engine and spacing change the ${name} picture`, async ({ editPage, page }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(name === 'flowchart' ? 'Notify' : 'Closed');
      await expect.poll(async () => (await extent(page)).count).toBeGreaterThan(5);
      await page.getByTestId(TID.layoutCard).click();
      const elk = await extent(page);

      await page.getByTestId(TID.layoutEngineDagre).click();
      await expect
        .poll(async () => JSON.stringify(await extent(page)))
        .not.toBe(JSON.stringify(elk));
      const standard = await extent(page);
      await page.getByTestId(`${TID.layoutSpacing}-wide`).click();
      await expect
        .poll(async () => (await extent(page)).height)
        .toBeGreaterThan(standard.height + 40);
      await page.getByTestId(`${TID.layoutSpacing}-compact`).click();
      await expect.poll(async () => (await extent(page)).height).toBeLessThan(standard.height);

      await page.getByTestId(TID.layoutEngineElk).click();
      await expect.poll(async () => JSON.stringify(await extent(page))).toBe(JSON.stringify(elk));
    });
  }

  test('explains when a diagram has no direction', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service a(tabler:server)[Server]'));
    await editPage.checkTextInView('Server');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByText(t('layout.directionUnsupported'))).toBeVisible();
    await expect(page.getByTestId(TID.layoutDirectionLR)).toHaveCount(0);
  });
});
