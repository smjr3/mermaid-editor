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
    await page.getByTestId(TID.layoutEngineElk).click();
    await page.getByTestId(`${TID.layoutSpacing}-compact`).click();
    await expect
      .poll(async () => JSON.parse((await stored(page)).mermaid ?? '{}') as Record<string, unknown>)
      .toMatchObject({ flowchart: { nodeSpacing: 25, rankSpacing: 30 }, layout: 'elk' });
    await editPage.checkTextInView('Ship');
  });

  test('explains when a diagram has no direction', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service a(tabler:server)[Server]'));
    await editPage.checkTextInView('Server');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByText(t('layout.directionUnsupported'))).toBeVisible();
    await expect(page.getByTestId(TID.layoutDirectionLR)).toHaveCount(0);
  });

  test('gives each diagram type its own reason, not the architecture one', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('pie title Pets\n  "Dogs": 3\n  "Cats": 2'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByText(t('layout.directionUnsupported.pie'))).toBeVisible();
    await expect(page.getByText(t('layout.directionUnsupported.architecture'))).toHaveCount(0);

    await editPage.start(urlFor('kanban\n  todo[Todo]\n    t1[Write]\n  done[Done]'));
    await editPage.checkTextInView('Write');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByText(t('layout.directionUnsupported.kanban'))).toBeVisible();
    await expect(page.getByText(t('layout.directionUnsupported.pie'))).toHaveCount(0);
  });
});
