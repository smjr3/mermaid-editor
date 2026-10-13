import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { nodeByText, selectByText } from './helpers/canvas';
import {
  backToRoot,
  closeSelection,
  crumb,
  field,
  panel,
  pickEdge,
  pickObject,
  renameTo
} from './helpers/inspector';
import { expect, t, test } from './test';

// The inspector itself: 図全体 and the breadcrumb, the node / arrow / lane / task views,
// the inline rename that the 名前 field takes over, the blocked state, the focus requests
// of the right-click menu, and folding the column.
const flow = `swimlane-beta LR
  subgraph Sales
    A[Order] --> B[Check]
  end
  subgraph Stock
    C[Pick]
  end
  B --> C`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Inspector', () => {
  test('shows 図全体, then the breadcrumb of what is selected, and goes back', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await expect(page.getByTestId(TID.inspCrumbRoot)).toHaveText(t('ws.inspectorRoot'));
    await expect(page.getByTestId(TID.inspTip)).toHaveText(t('insp.tip'));
    await expect(page.getByTestId(TID.inspClose)).toHaveCount(0);

    await selectByText(page, 'Check');
    await expect(crumb(page)).toHaveText(t('insp.crumb.node'));
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Check');
    await closeSelection(page);
    await expect(page.getByTestId(TID.selectionOutline)).toBeHidden();
    await expect(page.getByTestId(TID.inspTip)).toBeVisible();

    // A lane.
    await pickObject(page, 'Stock');
    await expect(crumb(page)).toHaveText(t('insp.crumb.lane'));
    await expect(page.getByTestId(TID.inspLaneCount)).toHaveText(
      t('insp.laneCount', { count: '1' })
    );
    // The breadcrumb's 図全体 goes back too.
    await backToRoot(page);
    await expect(page.getByTestId(TID.inspClose)).toHaveCount(0);

    // An arrow, from the node's list of connections.
    await pickObject(page, 'B');
    await page.getByTestId(TID.inspLink).filter({ hasText: 'Pick' }).click();
    await expect(crumb(page)).toHaveText(t('insp.crumb.edge'));
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Check');
    await expect(page.getByTestId(TID.inspEdgeEnds)).toContainText('Pick');
  });

  test('shows a gantt task with its own rows', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : a1, 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Spec');
    await expect(page.getByTestId(TID.inspTip)).toHaveText(t('insp.tipGantt'));
    await pickObject(page, 'L3');
    await expect(crumb(page)).toHaveText(t('insp.crumb.task'));
    for (const key of ['start', 'after', 'days', 'status', 'crit', 'milestone']) {
      await expect(
        panel(page).locator(`[data-testid="${TID.inspField}"][data-key="${key}"]`)
      ).toBeVisible();
    }
    // A task has no shape or colour: their block is not left as an empty band.
    const emptyBands = await panel(page)
      .locator('section')
      .evaluateAll(
        (sections) =>
          sections.filter(
            (section) => section.children.length === 0 && section.getBoundingClientRect().height > 0
          ).length
      );
    expect(emptyBands).toBe(0);
  });

  test('renames in the 名前 field on a double click, and applies it on Enter', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await nodeByText(page, 'Order').dblclick();
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    // The old name is selected, so typing replaces it.
    await page.keyboard.type('受注');
    await expect(name).toHaveValue('受注');
    await page.keyboard.press('Enter');
    await expect.poll(() => stored(page)).toContain('A["受注"] --> B[Check]');
    await editPage.checkTextInView('受注');
  });

  test('F2 opens the rename, Escape drops it, a click on the diagram applies it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await selectByText(page, 'Pick');
    await page.keyboard.press('F2');
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    await page.keyboard.type('捨てる名前');
    await page.keyboard.press('Escape');
    await expect(name).toHaveValue('Pick');
    expect(await stored(page)).toBe(flow);

    await page.keyboard.press('F2');
    await expect(name).toBeFocused();
    await page.keyboard.type('出庫');
    // A click elsewhere in the diagram applies what was typed to the node it was for.
    await nodeByText(page, 'Order').click();
    await expect.poll(() => stored(page)).toContain('C["出庫"]');
  });

  test('＋次 adds a node after the selection and opens its rename', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'C');
    await page.getByTestId(TID.inspAddNext).click();
    const name = page.getByTestId(TID.inspName);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue(t('sel.newNode'));
    await page.keyboard.type('出荷');
    await page.keyboard.press('Enter');
    await expect.poll(() => stored(page)).toContain('"出荷"');
    expect(await stored(page)).toMatch(/C --> n\d/);
    await editPage.checkTextInView('出荷');
  });

  test('＋追加 in a lane adds a node inside it', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'Stock');
    await page.getByTestId(TID.inspLaneAdd).click();
    await expect(page.getByTestId(TID.inspName)).toBeFocused();
    await page.keyboard.type('梱包');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => stored(page))
      .toMatch(/subgraph Stock\n {4}C\[Pick\]\n {4}n\d\["梱包"\]\n {2}end/);
  });

  test('矢印 joins the selection to the next node clicked', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'A');
    await page.getByTestId(TID.inspConnect).click();
    await expect(page.getByTestId(TID.inspConnect)).toHaveAttribute('aria-pressed', 'true');
    await nodeByText(page, 'Pick').click();
    await expect.poll(() => stored(page)).toContain('A --> C');
  });

  test('stops editing while the code is broken, keeping the settings', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await pickObject(page, 'C');
    await editPage.typeInEditor('\n  X -->');
    const blocked = page.getByTestId(TID.inspBlocked);
    await expect(blocked).toBeVisible({ timeout: 10_000 });
    await expect(blocked).toContainText(t('insp.blocked'));
    await expect(page.getByTestId(TID.inspName)).toBeDisabled();
    await expect(page.getByTestId(TID.inspDelete)).toBeDisabled();
  });

  test('folds to its rail and comes back', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await page.getByTestId(TID.inspCollapse).click();
    await expect(page.getByTestId(TID.wsInspectorRail)).toBeVisible();
    await page.getByTestId(TID.wsInspectorExpand).click();
    await expect(page.getByTestId(TID.inspPanel)).toBeVisible();
  });

  test('the right-click menu’s 色を変える focuses the colour row', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await nodeByText(page, 'Pick').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuItem}-color`).click();
    await expect(page.getByTestId(`${TID.inspColorTarget}-fill`)).toBeFocused();
  });

  test('the right-click menu’s other items focus their rows', async ({ editPage, page }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await nodeByText(page, 'Pick').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuItem}-shape`).click();
    await expect(page.getByTestId(TID.inspShape)).toBeFocused();
    await nodeByText(page, 'Pick').click({ button: 'right' });
    await page.getByTestId(`${TID.contextMenuItem}-rename`).click();
    await expect(page.getByTestId(TID.inspName)).toBeFocused();
    await page.keyboard.press('Escape');
    expect(await stored(page)).toBe(flow);
  });

  test('矢じり puts the head at the end, at both ends, or takes it off', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart LR\n  A[Order] -.-> B[Check]\n  B ==> C[Pick]'));
    await editPage.checkTextInView('Pick');
    await pickEdge(page, 0);
    const head = (value: string) => page.getByTestId(`${TID.inspEdgeHead}-${value}`);
    await expect(head('end')).toHaveAttribute('aria-pressed', 'true');
    await head('both').click();
    await expect.poll(() => stored(page)).toContain('  A[Order] <-.-> B[Check]');
    await expect(head('both')).toHaveAttribute('aria-pressed', 'true');
    await head('none').click();
    await expect.poll(() => stored(page)).toContain('  A[Order] -.- B[Check]');
    await head('end').click();
    await expect.poll(() => stored(page)).toContain('  A[Order] -.-> B[Check]');
    // A thick arrow, both ways.
    await pickEdge(page, 1);
    await head('both').click();
    await expect.poll(() => stored(page)).toContain('  B <==> C');
    await editPage.checkTextInView('Pick');

    // A block diagram cannot draw a head at each end: 両方 is not offered there.
    await editPage.start(urlFor('block-beta\n  a b\n  a --> b'));
    await expect(page.locator('#view svg').first()).toBeVisible({ timeout: 15_000 });
    await pickEdge(page, 0);
    await expect(head('end')).toBeVisible();
    await expect(head('both')).toHaveCount(0);
  });

  test('colours a node and makes its text bold from the 色 and 文字 rows', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Pick');
    await selectByText(page, 'Check');
    await page.getByTestId(`${TID.inspColor}-blue`).click();
    await expect.poll(() => stored(page)).toContain('style B fill:#dde9fb');
    await page.getByTestId(TID.inspTextBold).click();
    await expect.poll(() => stored(page)).toContain('font-weight:bold');
    await page.getByTestId(TID.inspTextReset).click();
    await expect.poll(() => stored(page)).not.toContain('font-weight:bold');
  });

  test('renames a mindmap topic chosen from 図全体’s 要素 list', async ({ editPage, page }) => {
    await editPage.start(urlFor('mindmap\n  root((Centre))\n    A\n    B'));
    await editPage.checkTextInView('Centre');
    const select = page.getByTestId(TID.inspObjectSelect);
    const value = await select.locator('option', { hasText: 'B' }).first().getAttribute('value');
    await select.selectOption(value ?? '');
    await expect(page.getByTestId(TID.inspClose)).toBeVisible();
    await renameTo(page, TID.inspName, '予算');
    await expect.poll(() => stored(page)).toContain('    予算');
    await editPage.checkTextInView('予算');
  });

  test('offers every mermaid shape, all four directions and ELK’s options', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Order] --> B[Check]'));
    await editPage.checkTextInView('Check');
    await selectByText(page, 'Order');
    const shape = page.getByTestId(TID.inspShape);
    expect(await shape.locator('option').count()).toBeGreaterThanOrEqual(53);
    await shape.selectOption('cyl');
    await expect.poll(() => stored(page)).toContain('A@{ shape: cyl, label: "Order" }');
    await expect(shape).toHaveValue('cyl');
    await shape.selectOption('diam');
    await expect.poll(() => stored(page)).toContain('A@{ shape: diam, label: "Order" }');

    await closeSelection(page);
    await page.getByTestId(`${TID.inspDirection}-BT`).click();
    await expect.poll(() => stored(page)).toMatch(/^flowchart BT/);
    await page.getByTestId(`${TID.inspDirection}-RL`).click();
    await expect.poll(() => stored(page)).toMatch(/^flowchart RL/);
    await editPage.checkTextInView('Check');

    // ELK is mermaid 12's default engine: its placement and merged arrows go into the config.
    await page.getByTestId(TID.inspElkPlacement).selectOption('LINEAR_SEGMENTS');
    await page.getByTestId(TID.inspElkMerge).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { mermaid?: string }).mermaid
        )
      )
      .toMatch(
        /"nodePlacementStrategy": "LINEAR_SEGMENTS"[\s\S]*"mergeEdges": true|"mergeEdges": true[\s\S]*"nodePlacementStrategy": "LINEAR_SEGMENTS"/
      );
    await page.getByTestId(`${TID.inspEngine}-dagre`).click();
    await expect(page.getByTestId(TID.inspElkPlacement)).toHaveCount(0);
  });
});

// Local: what else mermaid offers per type, as rows of 図全体, of the selection and of
// an arrow (diagramOptions.ts, edgeFields in diagramModify.ts).
test.describe('Inspector: mermaid’s other options', () => {
  const config = (page: Page) =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { mermaid?: string }).mermaid ??
        ''
    );
  const option = (page: Page, key: string) => page.getByTestId(`${TID.inspOption}-${key}`);
  const edgeField = (page: Page, key: string) =>
    panel(page).locator(`[data-testid="${TID.inspEdgeField}"][data-key="${key}"]`);

  test('a flowchart arrow: invisible, head shape, length, animation and curve', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart LR\n  A[Order] --> B[Check]\n  B --> C[Pick]'));
    await editPage.checkTextInView('Pick');
    await pickEdge(page, 0);
    await edgeField(page, 'mark').selectOption('circle');
    await expect.poll(() => stored(page)).toContain('  A[Order] --o B[Check]');
    await edgeField(page, 'length').selectOption('3');
    await expect.poll(() => stored(page)).toContain('  A[Order] ----o B[Check]');
    await edgeField(page, 'animation').selectOption('fast');
    await expect.poll(() => stored(page)).toContain('  e1@{ animation: fast }');
    await edgeField(page, 'curve').selectOption('step');
    await expect.poll(() => stored(page)).toContain('  e1@{ animation: fast, curve: step }');
    await editPage.checkTextInView('Pick');

    await pickEdge(page, 1);
    await page.getByTestId(`${TID.inspEdgeStyle}-invisible`).click();
    await expect.poll(() => stored(page)).toContain('  B ~~~ C[Pick]');
    await expect(page.getByTestId(TID.inspEdgeHead)).toHaveCount(0);
    await expect(edgeField(page, 'animation')).toHaveCount(0);
    await editPage.checkTextInView('Pick');
  });

  test('図全体: the curve, the look, the built-in dark theme and the accessible title', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart LR\n  A[Order] --> B[Check]'));
    await editPage.checkTextInView('Check');
    await option(page, 'curve').selectOption('linear');
    await expect.poll(() => config(page)).toContain('"curve": "linear"');
    await option(page, 'look').selectOption('neo');
    await expect.poll(() => config(page)).toContain('"look": "neo"');
    await page.getByTestId(TID.inspBuiltinTheme).selectOption('dark');
    await expect.poll(() => config(page)).toContain('"theme": "dark"');
    // The dark theme is the user's: the next validation leaves it.
    await editPage.checkTextInView('Check');
    await expect(page.getByTestId(TID.inspBuiltinTheme)).toHaveValue('dark');
    const title = option(page, 'accTitle');
    await title.fill('Order flow');
    await title.press('Enter');
    await expect.poll(() => stored(page)).toContain('  accTitle: Order flow');
    await expect(page.locator('#container svg title').first()).toHaveText('Order flow');
  });

  test('a sequence diagram: numbering, a participant’s symbol, a message’s end and activation', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('sequenceDiagram\n  participant A as Shop\n  A->>B: hi\n  B-->>A: back')
    );
    await editPage.checkTextInView('Shop');
    await option(page, 'autonumber').click();
    await expect.poll(() => stored(page)).toContain('  autonumber');
    await pickObject(page, 'A');
    await field(page, 'participantType').selectOption('database');
    await expect.poll(() => stored(page)).toContain('participant A@{ "type": "database" } as Shop');
    await pickEdge(page, 0);
    await edgeField(page, 'mark').selectOption('cross');
    await expect.poll(() => stored(page)).toContain('  A-xB: hi');
    await edgeField(page, 'activation').selectOption('activate');
    await expect.poll(() => stored(page)).toContain('  A-x+B: hi');
    await editPage.checkTextInView('Shop');
  });

  test('a class relation’s kind and multiplicity, an ER cardinality', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('classDiagram\n  Animal <|-- Dog'));
    await editPage.checkTextInView('Dog');
    await pickEdge(page, 0);
    await edgeField(page, 'relation').selectOption('composition');
    await expect.poll(() => stored(page)).toContain('  Animal *-- Dog');
    const to = edgeField(page, 'cardTo');
    await to.fill('many');
    await to.press('Enter');
    await expect.poll(() => stored(page)).toContain('  Animal *-- "many" Dog');

    await editPage.start(urlFor('erDiagram\n  CUSTOMER ||--o{ ORDER : places'));
    await editPage.checkTextInView('CUSTOMER');
    await pickEdge(page, 0);
    await edgeField(page, 'cardTo').selectOption('many');
    await expect.poll(() => stored(page)).toContain('  CUSTOMER ||--|{ ORDER : "places"');
  });

  test('a gantt chart’s weekends and today line, a pie’s values, a subgraph’s direction', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Work\n  Plan :a1, 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Plan');
    await option(page, 'weekends').click();
    await expect.poll(() => stored(page)).toContain('  excludes weekends');
    await option(page, 'today').click();
    await expect.poll(() => stored(page)).toContain('  todayMarker off');
    await option(page, 'tick').selectOption('1week');
    await expect.poll(() => stored(page)).toContain('  tickInterval 1week');

    await editPage.start(urlFor('pie\n  "Dogs" : 3\n  "Cats" : 2'));
    await editPage.checkTextInView('Dogs');
    await option(page, 'showData').click();
    await expect.poll(() => stored(page)).toMatch(/^pie showData/);

    await editPage.start(urlFor('flowchart LR\n  subgraph S [Team]\n    a[One] --> b[Two]\n  end'));
    await editPage.checkTextInView('Two');
    await pickObject(page, 'S');
    await field(page, 'laneDirection').selectOption('TB');
    await expect.poll(() => stored(page)).toContain('  subgraph S [Team]\n    direction TB');
    await editPage.checkTextInView('Two');
  });

  test('an icon shape’s backdrop and label position', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('flowchart LR\n  A@{ icon: "tabler:user", label: "User" } --> B[Box]')
    );
    await editPage.checkTextInView('Box');
    await pickObject(page, 'A');
    await page.getByTestId(`${TID.inspIconForm}-circle`).click();
    await expect.poll(() => stored(page)).toContain('form: "circle"');
    await page.getByTestId(`${TID.inspIconPos}-t`).click();
    await expect.poll(() => stored(page)).toContain('pos: "t"');
    await editPage.checkTextInView('Box');
  });
});
