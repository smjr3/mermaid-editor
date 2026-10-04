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

  test('explains when a diagram has nothing to add from here', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  A: [0.3, 0.6]'
      )
    );
    await editPage.checkTextInView('Reach');
    await page.getByTestId(TID.addCard).click();
    await expect(page.getByText(t('add.unsupported'))).toBeVisible();
  });
});
