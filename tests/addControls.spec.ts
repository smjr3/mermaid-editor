import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import {
  addForm,
  barItems,
  closeForm,
  formField,
  formMessage,
  insert,
  insertBar,
  openForm,
  selectByText,
  submitForm
} from './helpers/canvas';
import { expect, t, test } from './test';

// The add bar over the diagram: what it offers follows the diagram's type. Flowcharts and
// swimlanes add a shape or a lane in one click (selected afterwards); every other type
// has one button per add action, each opening the action's form in a popover.

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
// Monaco may write CRLF line endings; compare the lines, not the separator.
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));
const outline = (page: Page) => page.getByTestId(TID.selectionOutline);

test.describe('Add bar: flowcharts and swimlanes', () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test('one click adds a shape after the selection, in its lane, and selects it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    expect(await barItems(page)).toEqual(['rect', 'diamond', 'stadium', 'lane', 'connect']);
    await expect(insertBar(page).getByTestId(TID.canvasInsertMore)).toBeVisible();

    await selectByText(page, 'Accept order');
    await insert(page, 'rect');
    await expect.poll(() => stored(page)).toContain('C --> n1');
    expect(await stored(page)).toContain(
      `subgraph Shop\n    C[Accept order]\n    n1["${t('canvas.defaultProcess')}"]\n  end`
    );
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
    await editPage.checkTextInView(t('canvas.defaultProcess'));

    // 分岐 after the new one; its rename is open, Escape keeps the default name.
    await page.keyboard.press('Escape');
    await selectByText(page, t('canvas.defaultProcess'));
    await insert(page, 'diamond');
    await expect.poll(() => stored(page)).toContain('n1 --> n2');
    expect(await stored(page)).toContain(`n2{"${t('canvas.defaultDecision')}"}`);
    await expect(outline(page)).toHaveAttribute('data-selected', 'n2');
  });

  test('with nothing selected a shape stands alone; a lane is added empty', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await insert(page, 'stadium');
    await expect.poll(() => stored(page)).toContain(`n1(["${t('canvas.defaultStart')}"])`);
    expect(await stored(page)).not.toContain('--> n1');
    await expect(outline(page)).toHaveAttribute('data-selected', 'n1');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await insert(page, 'lane');
    await expect
      .poll(() => stored(page))
      .toContain(`subgraph Lane1 ["${t('add.laneDefault')}"]\n  end`);
    await expect(outline(page)).toHaveAttribute('data-selected', 'Lane1');
    // With the lane selected, the next shape goes into it.
    await insert(page, 'circle');
    await expect
      .poll(() => stored(page))
      .toContain(
        `subgraph Lane1 ["${t('add.laneDefault')}"]\n    n2(("${t('canvas.defaultProcess')}"))\n  end`
      );
  });

  test('a flowchart calls it a group, and offers the other shapes under その他', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[Middle]'));
    await editPage.checkTextInView('Middle');
    await expect(insertBar(page).locator('[data-insert="lane"]')).toHaveText(t('canvas.group'));
    await insertBar(page).getByTestId(TID.canvasInsertMore).click();
    const menu = page.getByTestId(TID.canvasInsertMenu);
    await expect(menu.getByTestId(TID.canvasInsertItem)).toHaveText([
      t('add.shape.rounded'),
      t('add.shape.circle'),
      t('canvas.nodeForm'),
      t('canvas.groupForm'),
      t('canvas.edgeForm')
    ]);
    await menu.locator('[data-insert="rounded"]').click();
    await expect(menu).toBeHidden();
    await expect.poll(() => stored(page)).toContain(`n1("${t('canvas.defaultProcess')}")`);
  });

  test('adds a lane, then a node in it joined from another node, from the forms', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await openForm(page, 'laneForm');
    await formField(page, 'name').fill('Delivery');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('subgraph Lane1 ["Delivery"]');
    await editPage.checkTextInView('Delivery');
    await expect(formMessage(page)).toHaveText(t('add.done', { name: 'Delivery' }));
    await closeForm(page);

    // The new lane is chosen for the next node.
    await openForm(page, 'node');
    await expect(formField(page, 'lane')).toHaveValue('Lane1');
    await formField(page, 'name').fill('Pack');
    await formField(page, 'from').selectOption('C');
    await formField(page, 'name').press('Enter');
    await expect.poll(() => stored(page)).toContain('C --> n1');
    expect(await stored(page)).toContain('subgraph Lane1 ["Delivery"]\n    n1["Pack"]\n  end');
    await editPage.checkTextInView('Pack');
    await expect(formMessage(page)).toHaveText(t('add.done', { name: 'Pack' }));
    // The form stays open, and the next node follows the new one.
    await expect(formField(page, 'from')).toHaveValue('n1');
  });

  test('adds a decision node and connects two existing nodes', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await openForm(page, 'node');
    await formField(page, 'name').fill('In stock?');
    await formField(page, 'shape').selectOption('diamond');
    await formField(page, 'lane').selectOption('Shop');
    await formField(page, 'from').selectOption('C');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('n1{"In stock?"}');
    await editPage.checkTextInView('In stock?');
    await closeForm(page);

    await openForm(page, 'edge');
    await formField(page, 'from').selectOption('n1');
    await formField(page, 'to').selectOption('A');
    await formField(page, 'label').fill('No');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('n1 -->|No| A');
    await editPage.checkTextInView('No');
    // The same arrow again is refused, and says which.
    await formField(page, 'label').fill('No');
    await submitForm(page);
    await expect(formMessage(page)).toHaveText(
      t('sel.alreadyConnected', { from: 'In stock?', to: 'Place order' })
    );
  });

  test('矢印 joins the next two shapes clicked, and やめる stops it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[Middle]\n  B --> C[End]'));
    await editPage.checkTextInView('Middle');
    const banner = page.getByTestId(TID.canvasConnectBanner);
    const node = (text: string) => page.locator('#view .node', { hasText: text }).first();

    await insert(page, 'connect');
    await expect(banner).toHaveAttribute('data-step', 'start');
    await expect(banner).toContainText(t('canvas.connectStart'));
    await expect(insertBar(page).locator('[data-insert="connect"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await node('End').click();
    await expect(banner).toHaveAttribute('data-step', 'target');
    await expect(banner).toContainText(t('canvas.connectTarget'));
    await node('Start').click();
    await expect.poll(() => stored(page)).toContain('C --> A');
    await expect(banner).toBeHidden();
    await expect(outline(page)).toHaveAttribute('data-selected', 'A');

    // With a shape selected, 矢印 starts from it.
    await insert(page, 'connect');
    await expect(banner).toHaveAttribute('data-step', 'target');
    await page.getByTestId(TID.canvasConnectCancel).click();
    await expect(banner).toBeHidden();
    await insert(page, 'connect');
    await page.keyboard.press('Escape');
    await expect(banner).toBeHidden();
  });
});

test.describe('Add bar: architecture', () => {
  test('builds an architecture diagram: group, service joined below, connection', async ({
    editPage,
    page
  }) => {
    const arch =
      'architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service web(server)[Web] in api\n  db:R --> L:web';
    await editPage.start(urlFor(arch));
    await editPage.checkTextInView('Database');
    expect(await barItems(page)).toEqual(['group', 'service', 'edge']);

    await openForm(page, 'group');
    await formField(page, 'name').fill('Back office');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('group grp1(cloud)[Back office]');
    await editPage.checkTextInView('Back office');
    await closeForm(page);

    await openForm(page, 'service');
    // The new group is chosen for the next service.
    await expect(formField(page, 'group')).toHaveValue('grp1');
    await formField(page, 'name').fill('ストレージ');
    // The icon choices are the icons' own names, not translations of them.
    const optionTexts = await formField(page, 'icon').locator('option').allTextContents();
    expect(optionTexts.slice(0, 5)).toEqual(['server', 'database', 'disk', 'internet', 'cloud']);
    await formField(page, 'icon').selectOption('disk');
    await expect(formField(page, 'place')).toHaveCount(0);
    await formField(page, 'from').selectOption('web');
    await formField(page, 'place').selectOption('down');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('web:B --> T:svc1');
    expect(await stored(page)).toContain('service svc1(disk)[ストレージ] in grp1');
    await editPage.checkTextInView('ストレージ');
    // Another icon from the packs.
    await formField(page, 'icon').selectOption('other');
    await expect(formField(page, 'otherIcon')).toHaveAttribute(
      'placeholder',
      t('add.arch.iconOtherHint')
    );
    await closeForm(page);

    await openForm(page, 'edge');
    await submitForm(page);
    await expect(formMessage(page)).toHaveText(t('add.arch.edgeChoose'));
    await formField(page, 'from').selectOption('db');
    await formField(page, 'to').selectOption('svc1');
    await formField(page, 'place').selectOption('down');
    await formField(page, 'arrow').uncheck();
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('db:B -- T:svc1');
    await expect(formMessage(page)).toHaveText(t('add.arch.edgeDone'));
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });
});

test.describe('Add bar: the other types', () => {
  const cases: [string, string, string[]][] = [
    ['sequenceDiagram\n  A->>B: hi', 'hi', ['participant', 'message', 'note', 'block']],
    [
      'stateDiagram-v2\n  [*] --> Idle',
      'Idle',
      ['state', 'transition', 'composite', 'pseudo', 'note']
    ],
    ['classDiagram\n  class Order', 'Order', ['class', 'relation', 'member']],
    ['erDiagram\n  A ||--o{ B : has', 'has', ['entity', 'relationship', 'attribute']],
    ['mindmap\n  root((Centre))', 'Centre', ['topic']],
    ['gantt\n  dateFormat YYYY-MM-DD\n  Plan :2024-01-01, 3d', 'Plan', ['task', 'section']],
    ['pie\n  "Dogs" : 3', 'Dogs', ['slice', 'display']],
    ['kanban\n  todo[Todo]\n    a[Card]', 'Card', ['card', 'column']],
    ['timeline\n  2024 : Start', 'Start', ['event', 'period']],
    ['C4Context\n  Person(a, "Alice")', 'Alice', ['element', 'rel', 'boundary']],
    ['block-beta\n  a["Box"]', 'Box', ['block', 'link']],
    [
      'requirementDiagram\n  requirement login {\n    id: 1\n  }',
      'login',
      ['requirement', 'element', 'relationship']
    ],
    ['journey\n  section Day\n    Wake: 3: Me', 'Wake', ['task', 'section']],
    ['xychart-beta\n  x-axis [a, b]\n  bar [1, 2]', 'a', ['axes', 'series']],
    ['quadrantChart\n  Point A: [0.3, 0.6]', 'Point A', ['point', 'axes']],
    ['sankey-beta\n  A,B,10', 'A', ['flow']],
    ['gitGraph\n  commit id: "c1"', 'c1', ['commit', 'branch', 'merge', 'checkout']],
    ['packet-beta\n  0-15: "Port"', 'Port', ['field']]
  ];
  // One test per type: rendering all of them in one test outran its time limit in CI.
  for (const [code, text, actions] of cases) {
    test(`every type shows one button per add action: ${code.split('\n')[0]}`, async ({
      editPage,
      page
    }) => {
      await editPage.start(urlFor(code));
      await editPage.checkTextInView(text);
      await expect.poll(() => barItems(page)).toEqual(actions);
    });
  }
  test('every type shows one button per add action: zenuml', async ({ editPage, page }) => {
    // ZenUML draws outside the SVG, so wait for the bar alone.
    await editPage.start(urlFor('zenuml\n  A.call()'));
    await expect.poll(() => barItems(page)).toEqual(['participant', 'message']);
  });

  test('keeps a # in a sequence message', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  participant A as Alice\n  A->>A: hi'));
    await editPage.checkTextInView('Alice');
    await openForm(page, 'message');
    await formField(page, 'from').selectOption('A');
    await formField(page, 'to').selectOption('A');
    await formField(page, 'text').fill('Ticket #12 done');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('A->>A: Ticket #35;12 done');
    await editPage.checkTextInView('Ticket #12 done');
  });

  test('adds a participant and a message to a sequence diagram', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  participant A as Alice\n  A->>A: hi'));
    await editPage.checkTextInView('Alice');
    // The bar shows the short title; the form, the whole one.
    await expect(insertBar(page).locator('[data-insert="block"]')).toHaveText('枠');
    await openForm(page, 'participant');
    await formField(page, 'name').fill('顧客');
    await formField(page, 'kind').selectOption('actor');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('actor p1 as 顧客');
    await editPage.checkTextInView('顧客');
    await closeForm(page);

    // The new participant is chosen as the next message's receiver.
    await openForm(page, 'message');
    await expect(formField(page, 'to')).toHaveValue('p1');
    await formField(page, 'from').selectOption('A');
    await formField(page, 'text').fill('ご注文を受け付けました');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('A->>p1: ご注文を受け付けました');
    await editPage.checkTextInView('ご注文を受け付けました');
  });

  test('adds a task to a gantt section and a topic to a mindmap', async ({ editPage, page }) => {
    const gantt =
      'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec :a1, 2024-01-01, 3d\n  section Build\n    Code : 5d';
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('Spec');
    await openForm(page, 'task');
    await formField(page, 'name').fill('Review');
    await formField(page, 'section').selectOption('Plan');
    await formField(page, 'days').fill('2');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('3d\n    Review : 2d\n  section Build');
    await editPage.checkTextInView('Review');

    await editPage.start(urlFor('mindmap\n  root((Centre))\n    A\n    B'));
    await editPage.checkTextInView('Centre');
    await openForm(page, 'topic');
    await formField(page, 'parent').selectOption('2');
    await formField(page, 'name').fill('A1');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('    A\n      A1\n    B');
    await editPage.checkTextInView('A1');
  });

  test('adds a C4 element inside a boundary, joined from another', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'C4Context\n  Person(a, "Alice")\n  System_Boundary(b1, "Shop") {\n    System(s, "Web")\n  }'
      )
    );
    await editPage.checkTextInView('Alice');
    await openForm(page, 'element');
    await formField(page, 'name').fill('Orders DB');
    await formField(page, 'kind').selectOption('SystemDb');
    await formField(page, 'boundary').selectOption('b1');
    await formField(page, 'from').selectOption('s');
    await formField(page, 'text').fill('writes');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('    SystemDb(el1, "Orders DB")\n  }');
    expect(await stored(page)).toContain('Rel(s, el1, "writes")');
    await editPage.checkTextInView('Orders DB');
  });

  test('adds an attribute and a method to a class', async ({ editPage, page }) => {
    await editPage.start(urlFor('classDiagram\n  class Order {\n    +id: int\n  }\n  class Item'));
    await editPage.checkTextInView('Order');
    await openForm(page, 'member');
    await formField(page, 'class').selectOption('Order');
    await formField(page, 'visibility').selectOption('private');
    await formField(page, 'name').fill('合計');
    await formField(page, 'type').fill('Money');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('    +id: int\n    -合計: Money\n  }');
    await editPage.checkTextInView('合計');

    await formField(page, 'class').selectOption('Item');
    await formField(page, 'kind').selectOption('method');
    await formField(page, 'visibility').selectOption('public');
    await formField(page, 'name').fill('price');
    await formField(page, 'type').fill('int');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  Item : +price() int');
    await editPage.checkTextInView('price()');
  });

  test('adds an attribute with a key to an ER entity', async ({ editPage, page }) => {
    await editPage.start(urlFor('erDiagram\n  e1["注文"]\n  e1 ||--o{ e2 : has'));
    await editPage.checkTextInView('注文');
    await openForm(page, 'attribute');
    await formField(page, 'entity').selectOption('e1');
    await formField(page, 'type').fill('int');
    await formField(page, 'name').fill('注文番号');
    await formField(page, 'key').selectOption('PK');
    await formField(page, 'comment').fill('連番');
    await submitForm(page);
    await expect
      .poll(() => stored(page))
      .toContain('  e1["注文"] {\n    int 注文番号 PK "連番"\n  }');
    await editPage.checkTextInView('注文番号');
  });

  test('adds a gantt task that follows another, with a status and marks', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Spec');
    await openForm(page, 'task');
    await formField(page, 'name').fill('Review');
    await formField(page, 'after').selectOption('3');
    await formField(page, 'status').selectOption('active');
    await formField(page, 'crit').selectOption('yes');
    await submitForm(page);
    await expect
      .poll(() => stored(page))
      .toContain('    Spec : t1, 2024-01-01, 3d\n    Review : active, crit, after t1, 3d');
    await editPage.checkTextInView('Review');
  });

  test('starts an empty mindmap with its first topic, then adds under it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('mindmap'));
    // An empty mindmap does not parse yet, but the bar stays open for its first topic.
    await expect.poll(() => barItems(page)).toEqual(['root']);
    await page.waitForTimeout(1200);
    await expect(page.getByTestId(TID.canvasInsertBlocked)).toHaveCount(0);
    await openForm(page, 'root');
    await formField(page, 'name').fill('新しい計画');
    await submitForm(page);
    await expect.poll(() => stored(page)).toBe('mindmap\n  新しい計画');
    await editPage.checkTextInView('新しい計画');
    // Now there is a parent to choose.
    await expect.poll(() => barItems(page)).toEqual(['topic']);
    await openForm(page, 'topic');
    await formField(page, 'parent').selectOption('1');
    await formField(page, 'name').fill('目的');
    await submitForm(page);
    await expect.poll(() => stored(page)).toBe('mindmap\n  新しい計画\n    目的');
    await editPage.checkTextInView('目的');
  });

  test('adds a database participant, a lost message and a background block', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('sequenceDiagram\n  participant A as Alice\n  A->>A: hi'));
    await editPage.checkTextInView('Alice');
    await openForm(page, 'participant');
    await formField(page, 'name').fill('台帳');
    await formField(page, 'kind').selectOption('database');
    await submitForm(page);
    await expect
      .poll(() => stored(page))
      .toContain('participant p1@{ "type": "database" } as 台帳');
    await editPage.checkTextInView('台帳');
    await closeForm(page);
    await openForm(page, 'message');
    await formField(page, 'from').selectOption('A');
    await formField(page, 'to').selectOption('p1');
    await formField(page, 'kind').selectOption('cross');
    await formField(page, 'text').fill('lost');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('A-xp1: lost');
    await closeForm(page);
    await openForm(page, 'block');
    await formField(page, 'kind').selectOption('rect');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('rect rgb(235, 242, 255)');
    await editPage.checkTextInView('lost');
  });

  test('adds a choice to a state diagram and a note beside a state', async ({ editPage, page }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> Idle'));
    await editPage.checkTextInView('Idle');
    await openForm(page, 'pseudo');
    await formField(page, 'from').selectOption('Idle');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  state c1 <<choice>>\n  Idle --> c1');
    await closeForm(page);
    await openForm(page, 'note');
    await formField(page, 'at').selectOption('Idle');
    await formField(page, 'text').fill('待機中');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  note right of Idle : 待機中');
    await editPage.checkTextInView('待機中');
  });

  test('adds a composite state around a state, and a state inside it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done'));
    await editPage.checkTextInView('Idle');
    await openForm(page, 'composite');
    await formField(page, 'name').fill('作業中');
    await formField(page, 'inside').selectOption('Done');
    await submitForm(page);
    await expect
      .poll(() => stored(page))
      .toContain('  Idle --> Done\n  state "作業中" as g1 {\n    Done\n  }');
    await editPage.checkTextInView('作業中');
    await closeForm(page);
    // The new composite state is chosen for the next state.
    await openForm(page, 'state');
    await expect(formField(page, 'parent')).toHaveValue('g1');
    await formField(page, 'name').fill('Check');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('    Done\n    state "Check" as s1\n  }');
    await editPage.checkTextInView('Check');
  });

  test('draws a C4 boundary around an element', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('C4Context\n  Person(a, "Alice")\n  System(s, "Web")\n  Rel(a, s, "uses")')
    );
    await editPage.checkTextInView('Web');
    await openForm(page, 'boundary');
    await formField(page, 'name').fill('社内');
    await formField(page, 'kind').selectOption('Enterprise_Boundary');
    await formField(page, 'element').selectOption('s');
    await submitForm(page);
    await expect
      .poll(() => stored(page))
      .toContain('  Enterprise_Boundary(b1, "社内") {\n    System(s, "Web")\n  }');
    await editPage.checkTextInView('社内');
  });

  test('shows the values of a pie chart in its legend', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie\n  "Dogs" : 386\n  "Cats" : 85'));
    await editPage.checkTextInView('Dogs');
    await openForm(page, 'display');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('pie showData\n');
    await editPage.checkTextInView('[386]');
  });

  test('builds a requirement diagram: requirement, element, relationship', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('requirementDiagram\n  requirement login {\n    id: 1\n  }'));
    await editPage.checkTextInView('login');
    await openForm(page, 'requirement');
    await formField(page, 'name').fill('応答速度');
    await formField(page, 'kind').selectOption('performanceRequirement');
    await formField(page, 'text').fill('2秒以内');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  performanceRequirement "応答速度" {');
    await editPage.checkTextInView('応答速度');
    await closeForm(page);

    await openForm(page, 'element');
    await formField(page, 'name').fill('web_app');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  element web_app {\n  }');
    await closeForm(page);
    // The new element and requirement are chosen as the relationship's ends.
    await openForm(page, 'relationship');
    await expect(formField(page, 'from')).toHaveValue('web_app');
    await expect(formField(page, 'to')).toHaveValue('応答速度');
    await submitForm(page);
    await expect.poll(() => stored(page)).toContain('  web_app - satisfies -> "応答速度"');
    await editPage.checkTextInView('satisfies');
  });

  test('explains when a diagram has nothing to add from here', async ({ editPage, page }) => {
    // Quadrant charts have forms now (chartEdit.ts); a radar chart still has none.
    await editPage.start(
      urlFor(
        'radar-beta\n  axis m["Math"], s["Science"], e["English"]\n  curve a["Reach"]{85, 90, 80}'
      )
    );
    await editPage.checkTextInView('Math');
    await expect(page.getByTestId(TID.canvasInsertUnsupported)).toHaveText(t('add.unsupported'));
    expect(await barItems(page)).toEqual([]);
  });

  test('says what is missing, not "both ends", when nothing is chosen', async ({
    editPage,
    page
  }) => {
    const cases: [string, string, string, string][] = [
      ['mindmap\n  Centre', 'topic', 'Centre', 'add.chooseParent'],
      ['kanban', 'card', '', 'add.chooseColumn'],
      ['timeline\n  title History', 'event', 'History', 'add.choosePeriod']
    ];
    for (const [code, action, text, key] of cases) {
      await editPage.start(urlFor(code));
      if (text) await editPage.checkTextInView(text);
      await openForm(page, action);
      // A needed choice says so (the add itself reports it, not the browser).
      await submitForm(page);
      await expect(formMessage(page)).toHaveText(t(key as Parameters<typeof t>[0]));
      await expect(addForm(page)).toBeVisible();
    }
  });
});
