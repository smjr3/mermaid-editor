import { TID } from '$/constants';
import { expect, t, test } from './test';

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
const stored = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
  );

test.describe('Add card', () => {
  const field = (action: string, key: string) => `${TID.addAction}-${action}-${key}`;

  test('adds a lane, then a node in it joined from another node', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.addCard).click();

    await page.getByTestId(TID.addLaneName).fill('Delivery');
    await page.getByTestId(TID.addLaneButton).click();
    await expect.poll(() => stored(page)).toContain('subgraph Lane1 ["Delivery"]');
    await editPage.checkTextInView('Delivery');
    // The new lane is chosen for the next node.
    await expect(page.getByTestId(TID.addNodeLane)).toHaveValue('Lane1');

    await page.getByTestId(TID.addNodeName).fill('Pack');
    await page.getByTestId(TID.addNodeFrom).selectOption('C');
    await page.getByTestId(TID.addNodeName).press('Enter');
    await expect.poll(() => stored(page)).toContain('C --> n1');
    expect(await stored(page)).toContain('subgraph Lane1 ["Delivery"]\n    n1["Pack"]\n  end');
    await editPage.checkTextInView('Pack');
    await expect(page.getByTestId(TID.addMessage)).toHaveText(t('add.done', { name: 'Pack' }));
    // The next node follows the new one.
    await expect(page.getByTestId(TID.addNodeFrom)).toHaveValue('n1');
  });

  test('adds a decision node and connects two existing nodes', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.addCard).click();

    await page.getByTestId(TID.addNodeName).fill('In stock?');
    await page.getByTestId(TID.addNodeShape).selectOption('diamond');
    await page.getByTestId(TID.addNodeLane).selectOption('Shop');
    await page.getByTestId(TID.addNodeFrom).selectOption('C');
    await page.getByTestId(TID.addNodeButton).click();
    await expect.poll(() => stored(page)).toContain('n1{"In stock?"}');
    await editPage.checkTextInView('In stock?');

    await page.getByTestId(TID.addEdgeFrom).selectOption('n1');
    await page.getByTestId(TID.addEdgeTo).selectOption('A');
    await page.getByTestId(TID.addEdgeLabel).fill('No');
    await page.getByTestId(TID.addEdgeButton).click();
    await expect.poll(() => stored(page)).toContain('n1 -->|No| A');
    await editPage.checkTextInView('No');
  });

  test('keeps a # in a sequence message', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  participant A as Alice\n  A->>A: hi'));
    await editPage.checkTextInView('Alice');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('message', 'from')).selectOption('A');
    await page.getByTestId(field('message', 'to')).selectOption('A');
    await page.getByTestId(field('message', 'text')).fill('Ticket #12 done');
    await page.getByTestId(field('message', 'button')).click();
    await expect.poll(() => stored(page)).toContain('A->>A: Ticket #35;12 done');
    await editPage.checkTextInView('Ticket #12 done');
  });

  test('builds an architecture diagram: group, service joined below, connection', async ({
    editPage,
    page
  }) => {
    const arch =
      'architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service web(server)[Web] in api\n  db:R --> L:web';
    await editPage.start(urlFor(arch));
    await editPage.checkTextInView('Database');
    await page.getByTestId(TID.addCard).click();

    await page.getByTestId(TID.addArchGroupName).fill('Back office');
    await page.getByTestId(TID.addArchGroupButton).click();
    await expect.poll(() => stored(page)).toContain('group grp1(cloud)[Back office]');
    await editPage.checkTextInView('Back office');
    // The new group is chosen for the next service.
    await expect(page.getByTestId(TID.addArchServiceGroup)).toHaveValue('grp1');

    await page.getByTestId(TID.addArchServiceName).fill('ストレージ');
    // The icon choices are the icons' own names, not translations of them.
    const optionTexts = await page
      .getByTestId(TID.addArchServiceIcon)
      .locator('option')
      .allTextContents();
    expect(optionTexts.slice(0, 5)).toEqual(['server', 'database', 'disk', 'internet', 'cloud']);
    await page.getByTestId(TID.addArchServiceIcon).selectOption('disk');
    await page.getByTestId(TID.addArchServiceFrom).selectOption('web');
    await page.getByTestId(TID.addArchServicePlace).selectOption('down');
    await page.getByTestId(TID.addArchServiceButton).click();
    await expect.poll(() => stored(page)).toContain('web:B --> T:svc1');
    expect(await stored(page)).toContain('service svc1(disk)[ストレージ] in grp1');
    await editPage.checkTextInView('ストレージ');

    await page.getByTestId(TID.addArchEdgeFrom).selectOption('db');
    await page.getByTestId(TID.addArchEdgeTo).selectOption('svc1');
    await page.getByTestId(TID.addArchEdgePlace).selectOption('down');
    await page.getByTestId(TID.addArchArrow).uncheck();
    await page.getByTestId(TID.addArchEdgeButton).click();
    await expect.poll(() => stored(page)).toContain('db:B -- T:svc1');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('adds a participant and a message to a sequence diagram', async ({ editPage, page }) => {
    await editPage.start(urlFor('sequenceDiagram\n  participant A as Alice\n  A->>A: hi'));
    await editPage.checkTextInView('Alice');
    await page.getByTestId(TID.addCard).click();

    await page.getByTestId(field('participant', 'name')).fill('顧客');
    await page.getByTestId(field('participant', 'kind')).selectOption('actor');
    await page.getByTestId(field('participant', 'button')).click();
    await expect.poll(() => stored(page)).toContain('actor p1 as 顧客');
    await editPage.checkTextInView('顧客');
    // The new participant is chosen as the next message's receiver.
    await expect(page.getByTestId(field('message', 'to'))).toHaveValue('p1');

    await page.getByTestId(field('message', 'from')).selectOption('A');
    await page.getByTestId(field('message', 'text')).fill('ご注文を受け付けました');
    await page.getByTestId(field('message', 'button')).click();
    await expect.poll(() => stored(page)).toContain('A->>p1: ご注文を受け付けました');
    await editPage.checkTextInView('ご注文を受け付けました');
  });

  test('adds a task to a gantt section and a topic to a mindmap', async ({ editPage, page }) => {
    const gantt =
      'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec :a1, 2024-01-01, 3d\n  section Build\n    Code : 5d';
    await editPage.start(urlFor(gantt));
    await editPage.checkTextInView('Spec');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('task', 'name')).fill('Review');
    await page.getByTestId(field('task', 'section')).selectOption('Plan');
    await page.getByTestId(field('task', 'days')).fill('2');
    await page.getByTestId(field('task', 'button')).click();
    await expect.poll(() => stored(page)).toContain('3d\n    Review : 2d\n  section Build');
    await editPage.checkTextInView('Review');

    await editPage.start(urlFor('mindmap\n  root((Centre))\n    A\n    B'));
    await editPage.checkTextInView('Centre');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('topic', 'parent')).selectOption('2');
    await page.getByTestId(field('topic', 'name')).fill('A1');
    await page.getByTestId(field('topic', 'button')).click();
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
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('element', 'name')).fill('Orders DB');
    await page.getByTestId(field('element', 'kind')).selectOption('SystemDb');
    await page.getByTestId(field('element', 'boundary')).selectOption('b1');
    await page.getByTestId(field('element', 'from')).selectOption('s');
    await page.getByTestId(field('element', 'text')).fill('writes');
    await page.getByTestId(field('element', 'button')).click();
    await expect.poll(() => stored(page)).toContain('    SystemDb(el1, "Orders DB")\n  }');
    expect(await stored(page)).toContain('Rel(s, el1, "writes")');
    await editPage.checkTextInView('Orders DB');
  });

  test('adds an attribute and a method to a class', async ({ editPage, page }) => {
    await editPage.start(urlFor('classDiagram\n  class Order {\n    +id: int\n  }\n  class Item'));
    await editPage.checkTextInView('Order');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('member', 'class')).selectOption('Order');
    await page.getByTestId(field('member', 'visibility')).selectOption('private');
    await page.getByTestId(field('member', 'name')).fill('合計');
    await page.getByTestId(field('member', 'type')).fill('Money');
    await page.getByTestId(field('member', 'button')).click();
    await expect.poll(() => stored(page)).toContain('    +id: int\n    -合計: Money\n  }');
    await editPage.checkTextInView('合計');

    await page.getByTestId(field('member', 'class')).selectOption('Item');
    await page.getByTestId(field('member', 'kind')).selectOption('method');
    await page.getByTestId(field('member', 'visibility')).selectOption('public');
    await page.getByTestId(field('member', 'name')).fill('price');
    await page.getByTestId(field('member', 'type')).fill('int');
    await page.getByTestId(field('member', 'button')).click();
    await expect.poll(() => stored(page)).toContain('  Item : +price() int');
    await editPage.checkTextInView('price()');
  });

  test('adds an attribute with a key to an ER entity', async ({ editPage, page }) => {
    await editPage.start(urlFor('erDiagram\n  e1["注文"]\n  e1 ||--o{ e2 : has'));
    await editPage.checkTextInView('注文');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('attribute', 'entity')).selectOption('e1');
    await page.getByTestId(field('attribute', 'type')).fill('int');
    await page.getByTestId(field('attribute', 'name')).fill('注文番号');
    await page.getByTestId(field('attribute', 'key')).selectOption('PK');
    await page.getByTestId(field('attribute', 'comment')).fill('連番');
    await page.getByTestId(field('attribute', 'button')).click();
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
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('task', 'name')).fill('Review');
    await page.getByTestId(field('task', 'after')).selectOption('3');
    await page.getByTestId(field('task', 'status')).selectOption('active');
    await page.getByTestId(field('task', 'crit')).selectOption('yes');
    await page.getByTestId(field('task', 'button')).click();
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
    await page.getByTestId(TID.addCard).click();
    await expect(page.getByTestId(field('topic', 'button'))).toHaveCount(0);
    await page.getByTestId(field('root', 'name')).fill('新しい計画');
    await page.getByTestId(field('root', 'button')).click();
    await expect.poll(() => stored(page)).toBe('mindmap\n  新しい計画');
    await editPage.checkTextInView('新しい計画');
    // Now there is a parent to choose.
    await page.getByTestId(field('topic', 'parent')).selectOption('1');
    await page.getByTestId(field('topic', 'name')).fill('目的');
    await page.getByTestId(field('topic', 'button')).click();
    await expect.poll(() => stored(page)).toBe('mindmap\n  新しい計画\n    目的');
    await editPage.checkTextInView('目的');
  });

  test('adds a composite state around a state, and a state inside it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done'));
    await editPage.checkTextInView('Idle');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('composite', 'name')).fill('作業中');
    await page.getByTestId(field('composite', 'inside')).selectOption('Done');
    await page.getByTestId(field('composite', 'button')).click();
    await expect
      .poll(() => stored(page))
      .toContain('  Idle --> Done\n  state "作業中" as g1 {\n    Done\n  }');
    await editPage.checkTextInView('作業中');
    // The new composite state is chosen for the next state.
    await expect(page.getByTestId(field('state', 'parent'))).toHaveValue('g1');
    await page.getByTestId(field('state', 'name')).fill('Check');
    await page.getByTestId(field('state', 'button')).click();
    await expect.poll(() => stored(page)).toContain('    Done\n    state "Check" as s1\n  }');
    await editPage.checkTextInView('Check');
  });

  test('draws a C4 boundary around an element', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('C4Context\n  Person(a, "Alice")\n  System(s, "Web")\n  Rel(a, s, "uses")')
    );
    await editPage.checkTextInView('Web');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('boundary', 'name')).fill('社内');
    await page.getByTestId(field('boundary', 'kind')).selectOption('Enterprise_Boundary');
    await page.getByTestId(field('boundary', 'element')).selectOption('s');
    await page.getByTestId(field('boundary', 'button')).click();
    await expect
      .poll(() => stored(page))
      .toContain('  Enterprise_Boundary(b1, "社内") {\n    System(s, "Web")\n  }');
    await editPage.checkTextInView('社内');
  });

  test('shows the values of a pie chart in its legend', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie\n  "Dogs" : 386\n  "Cats" : 85'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('display', 'button')).click();
    await expect.poll(() => stored(page)).toContain('pie showData\n');
    await editPage.checkTextInView('[386]');
  });

  test('builds a requirement diagram: requirement, element, relationship', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('requirementDiagram\n  requirement login {\n    id: 1\n  }'));
    await editPage.checkTextInView('login');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('requirement', 'name')).fill('応答速度');
    await page.getByTestId(field('requirement', 'kind')).selectOption('performanceRequirement');
    await page.getByTestId(field('requirement', 'text')).fill('2秒以内');
    await page.getByTestId(field('requirement', 'button')).click();
    await expect.poll(() => stored(page)).toContain('  performanceRequirement "応答速度" {');
    await editPage.checkTextInView('応答速度');

    await page.getByTestId(field('element', 'name')).fill('web_app');
    await page.getByTestId(field('element', 'button')).click();
    await expect.poll(() => stored(page)).toContain('  element web_app {\n  }');
    // The new element and requirement are chosen as the relationship's ends.
    await expect(page.getByTestId(field('relationship', 'from'))).toHaveValue('web_app');
    await expect(page.getByTestId(field('relationship', 'to'))).toHaveValue('応答速度');
    await page.getByTestId(field('relationship', 'button')).click();
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
    await page.getByTestId(TID.addCard).click();
    await expect(page.getByText(t('add.unsupported'))).toBeVisible();
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
      await page.getByTestId(TID.addCard).click();
      await page.getByTestId(field(action, 'button')).click();
      await expect(page.getByTestId(TID.addMessage)).toHaveText(t(key as Parameters<typeof t>[0]));
    }
  });
});
