import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { panel, pickEdge, segment } from './helpers/inspector';
import { expect, t, test } from './test';

const chain =
  'flowchart TD\n  A[Start] --> B[Check] --> C[Approve] --> D[Order] --> E[Ship] --> F[Done]';
const urlFor = (code: string, mermaid = '{}') =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid })).toString('base64')}`;

// Monaco may write CRLF line endings; compare the lines, not the separator.
const stored = async (page: Page) =>
  page
    .evaluate(
      () =>
        JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string; mermaid?: string }
    )
    .then(({ code, mermaid }) => ({ code: code?.replaceAll('\r\n', '\n'), mermaid }));

// Where the last node sits relative to the first: below it top-to-bottom, beside it left-to-right.
const flowAxis = async (page: Page) => {
  const start = await page.locator('#view .nodeLabel', { hasText: /^Start$/ }).boundingBox();
  const done = await page.locator('#view .nodeLabel', { hasText: /^Done$/ }).boundingBox();
  if (!start || !done) return 'none';
  return Math.abs(done.x - start.x) > Math.abs(done.y - start.y) ? 'horizontal' : 'vertical';
};

test.describe('Layout in the inspector', () => {
  test('switches the direction in the code', async ({ editPage, page }) => {
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    expect(await flowAxis(page)).toBe('vertical');
    await expect(page.getByTestId(`${TID.inspDirection}-TB`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await segment(page, TID.inspDirection, 'LR');
    await expect.poll(async () => (await stored(page)).code?.split('\n')[0]).toBe('flowchart LR');
    await expect.poll(() => flowAxis(page)).toBe('horizontal');
    await expect(page.getByTestId(`${TID.inspDirection}-LR`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('shows the direction and line labels whole in the default width at 1280px', async ({
    editPage,
    page
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    const clipped = (testID: string) =>
      page
        .getByTestId(testID)
        .locator('button')
        .evaluateAll((buttons) =>
          buttons
            .filter((button) => button.scrollWidth > button.clientWidth)
            .map((button) => button.dataset.testid)
        );
    expect(await clipped(TID.inspDirection)).toEqual([]);
    await pickEdge(page, 0);
    await expect(page.getByTestId(TID.inspEdgeStyle)).toBeVisible();
    expect(await clipped(TID.inspEdgeStyle)).toEqual([]);
  });

  test('fits the diagram to the view', async ({ editPage, page }) => {
    // Eight branches side by side: far wider than the view top-to-bottom.
    const fan = `flowchart TD\n${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `  R[Request] --> T${n}[Team number ${n}]`).join('\n')}`;
    await editPage.start(urlFor(fan));
    await editPage.checkTextInView('Team number 8');
    await segment(page, TID.inspDirection, 'fit');
    await expect(page.getByTestId(TID.inspMessage)).toHaveText(t('layout.fitChoseLR'));
    await expect.poll(async () => (await stored(page)).code?.split('\n')[0]).toBe('flowchart LR');
    // 自動 is an action: afterwards the chosen direction is the one shown.
    await expect(page.getByTestId(`${TID.inspDirection}-LR`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('sets the layout engine and spacing in the config', async ({ editPage, page }) => {
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    await segment(page, TID.inspEngine, 'dagre');
    await segment(page, TID.inspSpacing, 'compact');
    await expect
      .poll(async () => JSON.parse((await stored(page)).mermaid ?? '{}') as Record<string, unknown>)
      .toMatchObject({ flowchart: { nodeSpacing: 25, rankSpacing: 30 }, layout: 'dagre' });
    await editPage.checkTextInView('Ship');

    // ELK chooses its own spacing: the choice is shown, but cannot be changed.
    await segment(page, TID.inspEngine, 'elk');
    await expect(page.getByTestId(`${TID.inspSpacing}-wide`)).toBeDisabled();
    await expect(page.getByTestId(`${TID.inspSpacing}-wide`)).toHaveAttribute(
      'title',
      t('layout.spacingElkNote')
    );
  });

  // The extent of the node positions in the diagram's own coordinates (unaffected by pan/zoom).
  const extent = (page: Page) =>
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
      const elk = await extent(page);

      await segment(page, TID.inspEngine, 'dagre');
      await expect
        .poll(async () => JSON.stringify(await extent(page)))
        .not.toBe(JSON.stringify(elk));
      const standard = await extent(page);
      await segment(page, TID.inspSpacing, 'wide');
      await expect
        .poll(async () => (await extent(page)).height)
        .toBeGreaterThan(standard.height + 40);
      await segment(page, TID.inspSpacing, 'compact');
      await expect.poll(async () => (await extent(page)).height).toBeLessThan(standard.height);

      await segment(page, TID.inspEngine, 'elk');
      await expect.poll(async () => JSON.stringify(await extent(page))).toBe(JSON.stringify(elk));
    });
  }

  test('explains when a diagram has no direction', async ({ editPage, page }) => {
    await editPage.start(urlFor('architecture-beta\n  service a(tabler:server)[Server]'));
    await editPage.checkTextInView('Server');
    await expect(panel(page)).toContainText(t('layout.directionUnsupported'));
    await expect(page.getByTestId(TID.inspDirection)).toHaveCount(0);
    await expect(page.getByTestId(TID.inspEngine)).toHaveCount(0);
  });

  test('gives each diagram type its own reason, not the architecture one', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('pie title Pets\n  "Dogs": 3\n  "Cats": 2'));
    await editPage.checkTextInView('Dogs');
    await expect(panel(page)).toContainText(t('layout.directionUnsupported.pie'));
    await expect(panel(page)).not.toContainText(t('layout.directionUnsupported.architecture'));

    await editPage.start(urlFor('kanban\n  todo[Todo]\n    t1[Write]\n  done[Done]'));
    await editPage.checkTextInView('Write');
    await expect(panel(page)).toContainText(t('layout.directionUnsupported.kanban'));
    await expect(panel(page)).not.toContainText(t('layout.directionUnsupported.pie'));
  });

  test('keeps the direction rows usable from the keyboard while the code is fine, and blocks them while it is broken', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(chain));
    await editPage.checkTextInView('Ship');
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.inspBlocked)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId(`${TID.inspDirection}-LR`)).toBeDisabled();
    // The config rows stay available.
    await expect(page.getByTestId(`${TID.inspEngine}-dagre`)).toBeEnabled();
    await expect(page.getByTestId(`${TID.inspThemePreset}-neon`)).toBeEnabled();
  });
});

// The titles moved here from the old 新しい図 tests: set, change and remove the title
// where the type draws one; say so where it does not.
test.describe('Diagram title in the inspector', () => {
  const titled = [
    ['flowchart', 'flowchart LR\n  a[作業1] --> b[作業2]', 'front matter'],
    ['sequence', 'sequenceDiagram\n  A->>B: 依頼', 'front matter'],
    ['gantt', 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n    作業1 : 2024-01-01, 3d', 'gantt'],
    ['pie', 'pie\n  "項目A" : 1\n  "項目B" : 2', 'pie'],
    ['timeline', 'timeline\n  2024 : 出来事1', 'statement'],
    ['c4', 'C4Context\n  Person(a, "利用者")', 'statement']
  ] as const;
  for (const [kind, code] of titled) {
    test(`sets, changes and removes the ${kind} title`, async ({ editPage, page }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(kind === 'c4' ? '利用者' : kind === 'sequence' ? '依頼' : '1');
      const input = page.getByTestId(TID.inspTitle);
      await input.fill(`題名 ${kind}`);
      await input.press('Enter');
      // Front matter (`title: "…"`), or the title statement of timeline and C4.
      await expect
        .poll(async () => (await stored(page)).code)
        .toMatch(new RegExp(`title:? "?題名 ${kind}`));
      await expect(page.getByTestId(TID.inspMessage)).toHaveText(t('layout.titleDone'));
      // The title is drawn in the diagram, not only written in the code.
      await editPage.checkTextInView(`題名 ${kind}`);

      await input.fill(`新しい題名 ${kind}`);
      await input.blur();
      await expect
        .poll(async () => (await stored(page)).code)
        .toMatch(new RegExp(`title:? "?新しい題名 ${kind}`));

      await page.getByTestId(TID.inspTitleRemove).click();
      await expect.poll(async () => (await stored(page)).code).not.toMatch(/^\s*title\b/m);
      await expect(page.getByTestId(TID.inspMessage)).toHaveText(t('layout.titleRemoved'));
      await editPage.checkTextNotInView(`題名 ${kind}`);
    });
  }

  for (const [kind, code, text] of [
    ['mindmap', 'mindmap\n  root((中心))\n    アイデア1', 'アイデア1'],
    ['kanban', 'kanban\n  todo[ToDo]\n    t1[タスク1]', 'タスク1'],
    ['architecture', 'architecture-beta\n  service s(server)[サーバー]', 'サーバー'],
    ['block', 'block-beta\n  a["ブロック1"]', 'ブロック1']
  ] as const) {
    test(`says the ${kind} diagram shows no title`, async ({ editPage, page }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(text);
      await expect(panel(page)).toContainText(t('layout.titleUnsupported'));
      await expect(page.getByTestId(TID.inspTitle)).toHaveCount(0);
    });
  }
});
