import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { crumb, field, panel, pickEdge, pickObject, renameTo, segment } from './helpers/inspector';
import { expect, t, test } from './test';

// Editing every diagram type from the inspector (the old Edit card's cases): the 要素 and
// 矢印 lists of 図全体 select what the diagram cannot click, the selection's rows edit it.
const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
    D{In stock?}
  end
  A --> C
  C -->|yes| D
  D -- no --> A
  D ==> B
  linkStyle 1 stroke:#d64545
  linkStyle 3,4 stroke:#3f9b52`;
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
// Monaco may write CRLF line endings; compare the lines, not the separator.
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));
const status = (page: Page) => page.getByTestId(TID.inspStatus);

test.describe('Editing in the inspector', () => {
  test('renames a node chosen from the list, and one clicked in the diagram', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await pickObject(page, 'C');
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.node');
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Accept order');
    await renameTo(page, TID.inspName, 'Confirm order');
    await expect.poll(() => stored(page)).toContain('    C["Confirm order"]\n');
    await editPage.checkTextInView('Confirm order');
    await expect(status(page)).toHaveText(t('edit.renamed', { name: 'Confirm order' }));

    // Clicking a node in the diagram selects it; Enter renames.
    await page.locator('#view .node', { hasText: 'Place order' }).click();
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Place order');
    await renameTo(page, TID.inspName, '注文する');
    await expect.poll(() => stored(page)).toContain('    A["注文する"] --> B[Receive goods]');
    await editPage.checkTextInView('注文する');
  });

  test('renames a node’s id everywhere, as F2 does', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await pickObject(page, 'C');
    await expect(page.getByTestId(TID.inspId)).toHaveValue('C');
    await page.getByTestId(TID.inspId).fill('confirm');
    await page.getByTestId(TID.inspId).press('Enter');
    await expect.poll(() => stored(page)).toContain('    confirm[Accept order]\n');
    const code = await stored(page);
    expect(code).toContain('  A --> confirm\n  confirm -->|yes| D\n');
    // Still selected, under its new id.
    await expect(page.getByTestId(TID.inspId)).toHaveValue('confirm');
    await expect(page.getByTestId(TID.inspName)).toHaveValue('Accept order');

    // An id another node has is refused.
    await page.getByTestId(TID.inspId).fill('D');
    await page.getByTestId(TID.inspId).press('Enter');
    await expect(status(page)).toHaveText(t('editor.renameTaken', { name: 'D' }));
    expect(await stored(page)).toBe(code);
  });

  test('deletes a node with its arrows, renumbering the coloured arrows', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');

    await pickObject(page, 'D');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C
  linkStyle 1 stroke:#d64545`);
    await editPage.checkTextNotInView('In stock?');
    await editPage.checkTextNotInView('yes');
    await expect(page.locator('#view .flowchart-link')).toHaveCount(2);
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    // The selection went with it: back at 図全体.
    await expect(page.getByTestId(TID.inspClose)).toBeHidden();
  });

  test('deletes a lane keeping what is inside', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');

    await pickObject(page, 'Shop');
    await expect(page.getByTestId(TID.inspLaneCount)).toHaveText(
      t('insp.laneCount', { count: '2' })
    );
    await page.getByTestId(TID.inspDeleteKeep).click();
    await expect.poll(() => stored(page)).not.toContain('subgraph Shop');
    expect(await stored(page)).toContain('\n  C[Accept order]\n  D{In stock?}\n  A --> C\n');
    await editPage.checkTextInView('In stock?');
    await editPage.checkTextNotInView('Shop');
  });

  test('reverses an arrow picked by its label, and changes its line and arrowhead', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('yes');

    await page.locator('#view .edgeLabel', { hasText: 'yes' }).click();
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
    await expect(page.getByTestId(TID.inspEdgeLabel)).toHaveValue('yes');
    await page.getByTestId(TID.inspEdgeReverse).click();
    await expect.poll(() => stored(page)).toContain('\n  D -->|yes| C\n');
    await expect(page.locator('#view path[data-id="L_D_C_0"]')).toHaveCount(1);

    await segment(page, TID.inspEdgeStyle, 'dotted');
    await expect.poll(() => stored(page)).toContain('\n  D -.->|yes| C\n');
    await segment(page, TID.inspEdgeHead, 'off');
    await expect.poll(() => stored(page)).toContain('\n  D -.-|yes| C\n');
    await segment(page, TID.inspEdgeStyle, 'thick');
    await expect.poll(() => stored(page)).toContain('\n  D ===|yes| C\n');

    await renameTo(page, TID.inspEdgeLabel, '在庫あり');
    await expect.poll(() => stored(page)).toContain('\n  D ===|在庫あり| C\n');
    await editPage.checkTextInView('在庫あり');
    // The coloured arrows kept their numbers throughout.
    expect(await stored(page)).toContain(
      '\n  linkStyle 1 stroke:#d64545\n  linkStyle 3,4 stroke:#3f9b52'
    );
  });

  test('deletes an arrow and renumbers the linkStyle statements after it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('yes');

    await pickEdge(page, 1);
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
    D{In stock?}
  end
  C -->|yes| D
  D -- no --> A
  D ==> B
  linkStyle 2,3 stroke:#3f9b52`);
    await expect(page.locator('#view .flowchart-link')).toHaveCount(4);
    // The green arrows are still the ones from D.
    const green = page.locator('#view path[data-id="L_D_A_0"]');
    await expect
      .poll(() => green.evaluate((path) => getComputedStyle(path).stroke))
      .toBe('rgb(63, 155, 82)');
  });

  test('lists a node’s arrows and selects one from the list', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('yes');
    await pickObject(page, 'D');
    const links = page.getByTestId(TID.inspLinks).getByTestId(TID.inspLink);
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toContainText('← Accept order');
    await expect(links.nth(0)).toContainText('yes');
    await expect(links.nth(1)).toContainText('→ Place order');
    await links.nth(1).click();
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.edge');
    await expect(page.getByTestId(TID.inspEdgeLabel)).toHaveValue('no');
  });

  test('renames a participant in its place, restyles a message and deletes a participant', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('sequenceDiagram\n  participant A as Alice\n  A->>B: hi\n  B-->>A: hello')
    );
    await editPage.checkTextInView('hello');

    await pickObject(page, 'B');
    await renameTo(page, TID.inspName, 'Bob');
    await expect.poll(() => stored(page)).toContain('\n  participant B as Bob\n  A->>B: hi');
    await editPage.checkTextInView('Bob');

    await pickEdge(page, 1);
    await segment(page, TID.inspEdgeStyle, 'solid');
    await expect.poll(() => stored(page)).toContain('\n  B->>A: hello');

    await pickObject(page, 'A');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).toBe('sequenceDiagram\n  participant B as Bob');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('changes a node’s shape and moves it to another lane, keeping its arrows', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');

    await pickObject(page, 'D');
    await expect(page.getByTestId(TID.inspShape)).toHaveValue('diamond');
    await page.getByTestId(TID.inspShape).selectOption('stadium');
    await expect.poll(() => stored(page)).toContain('    D([In stock?])\n');
    await expect(status(page)).toHaveText(t('edit.changed', { name: 'In stock?' }));

    await pickObject(page, 'C');
    await expect(page.getByTestId(TID.inspLane)).toHaveValue('Shop');
    await page.getByTestId(TID.inspLane).selectOption('Customer');
    await expect
      .poll(() => stored(page))
      .toContain(
        '  subgraph Customer\n    A[Place order] --> B[Receive goods]\n    C[Accept order]\n  end\n  subgraph Shop\n    D([In stock?])\n  end'
      );
    // Drawn inside the Customer lane now, with every arrow still there.
    const inside = async () => {
      const lane = await page.locator('#view .cluster', { hasText: 'Customer' }).boundingBox();
      const box = await page.locator('#view .node', { hasText: 'Accept order' }).boundingBox();
      return (
        !!lane &&
        !!box &&
        box.x >= lane.x &&
        box.y >= lane.y &&
        box.x + box.width <= lane.x + lane.width &&
        box.y + box.height <= lane.y + lane.height
      );
    };
    await expect.poll(inside).toBe(true);
    await expect(page.locator('#view .flowchart-link')).toHaveCount(5);

    // And out of every lane.
    await expect(page.getByTestId(TID.inspLane)).toHaveValue('Customer');
    await page.getByTestId(TID.inspLane).selectOption('');
    await expect.poll(() => stored(page)).toContain('  D ==> B\n  C[Accept order]\n  linkStyle 1');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('gives a node an icon found by search, and takes it away again', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');

    await pickObject(page, 'C');
    await expect(page.getByTestId(TID.inspIconCurrent)).toHaveCount(0);
    await page.getByTestId(TID.inspIcon).fill('user-circle');
    const result = page.locator(
      `[data-testid="${TID.inspIconResult}"][data-icon="tabler:user-circle"]`
    );
    await result.click({ timeout: 30_000 });
    await expect
      .poll(() => stored(page))
      .toContain('    C@{ icon: "tabler:user-circle", label: "Accept order" }\n');
    await editPage.checkTextInView('Accept order');
    // mermaid draws an icon node with its own shape.
    await expect(page.locator('#view .icon-shape', { hasText: 'Accept order' })).toHaveCount(1);
    await expect(page.getByTestId(TID.inspIconCurrent)).toHaveText('tabler:user-circle');
    await expect(panel(page)).toContainText(t('edit.shapeIcon'));

    await page.getByTestId(TID.inspIconClear).click();
    await expect.poll(() => stored(page)).toContain('    C["Accept order"]\n');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('changes a service’s icon and moves it into another group', async ({ editPage, page }) => {
    const arch = `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service dns(internet)[DNS]
  db:R --> L:dns`;
    await editPage.start(urlFor(arch));
    await editPage.checkTextInView('DNS');

    await pickObject(page, 'dns');
    await expect(page.getByTestId(TID.inspLane)).toHaveValue('');
    await page.getByTestId(TID.inspLane).selectOption('api');
    await expect.poll(() => stored(page)).toContain('  service dns(internet)[DNS] in api\n');

    await expect(page.getByTestId(TID.inspIconCurrent)).toHaveText('internet');
    await page.getByRole('button', { name: t('insp.iconChange') }).click();
    await page.getByTestId(TID.inspIcon).fill('server');
    // mermaid's standard icons come first and are written without a prefix.
    await page
      .locator(`[data-testid="${TID.inspIconResult}"][data-icon="mermaid:server"]`)
      .click({ timeout: 30_000 });
    await expect.poll(() => stored(page)).toContain('  service dns(server)[DNS] in api\n');
    await editPage.checkTextInView('DNS');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('deletes an alt block of a sequence, keeping its messages', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'sequenceDiagram\n  participant A as 申請者\n  participant B as 上長\n  A->>B: 申請\n  alt 承認する\n    B-->>A: 差戻し\n  end\n  B-->>A: 回答'
      )
    );
    await editPage.checkTextInView('[承認する]');
    await pickObject(page, 'line:4');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).not.toContain('alt');
    expect(await stored(page)).toContain('\n  A->>B: 申請\n  B-->>A: 差戻し\n  B-->>A: 回答');
    await editPage.checkTextNotInView('[承認する]');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('explains when a diagram cannot be edited from here', async ({ editPage, page }) => {
    // Quadrant charts are edited here now (chartEdit.ts); a radar chart is not.
    await editPage.start(
      urlFor(
        'radar-beta\n  axis m["Math"], s["Science"], e["English"]\n  curve a["Reach"]{85, 90, 80}'
      )
    );
    await editPage.checkTextInView('Math');
    await expect(panel(page)).toContainText(t('edit.unsupported'));
    await expect(page.getByTestId(TID.inspObjectSelect)).toHaveCount(0);
  });

  test('changes, adds and deletes a class member', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'classDiagram\n  class Order {\n    +int id\n    -total: Money\n  }\n  Order : +pay() bool'
      )
    );
    await editPage.checkTextInView('total');
    await pickObject(page, 'Order');
    const options = await page.getByTestId(TID.inspMember).locator('option').allInnerTexts();
    expect(options).toEqual(['+int id', '-total: Money', '+pay() bool']);
    await page.getByTestId(TID.inspMember).selectOption('L3');
    await expect(field(page, 'member-name')).toHaveValue('total');
    await field(page, 'member-name').fill('合計');
    await field(page, 'member-name').press('Enter');
    await expect.poll(() => stored(page)).toContain('    -合計: Money\n');
    await field(page, 'member-visibility').selectOption('protected');
    await expect.poll(() => stored(page)).toContain('    #合計: Money\n');
    await editPage.checkTextInView('合計');

    await page.getByTestId(TID.inspMember).selectOption('L5');
    await page.getByTestId(TID.inspMemberDelete).click();
    await expect.poll(() => stored(page)).not.toContain('pay()');
    await editPage.checkTextNotInView('pay()');

    await page.getByTestId(TID.inspMemberAdd).click();
    await expect(page.getByTestId(TID.inspMember).locator('option')).toHaveCount(3);
  });

  test('changes and deletes an ER attribute', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('erDiagram\n  ORDER {\n    int id PK\n    string note\n  }\n  ORDER ||--o{ LINE : has')
    );
    await editPage.checkTextInView('note');
    await pickObject(page, 'ORDER');
    await page.getByTestId(TID.inspMember).selectOption('L3');
    await field(page, 'member-name').fill('備考');
    await field(page, 'member-name').press('Enter');
    await expect.poll(() => stored(page)).toContain('    string 備考\n');
    await field(page, 'member-key').selectOption('UK');
    await expect.poll(() => stored(page)).toContain('    string 備考 UK\n');
    await field(page, 'member-comment').fill('自由記入');
    await field(page, 'member-comment').press('Enter');
    await expect.poll(() => stored(page)).toContain('    string 備考 UK "自由記入"\n');
    await editPage.checkTextInView('自由記入');
    await page.getByTestId(TID.inspMember).selectOption('L2');
    await page.getByTestId(TID.inspMemberDelete).click();
    await expect.poll(() => stored(page)).not.toContain('int id PK');
  });

  test('changes a gantt task’s length and status, renames a section, deletes a task', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor(
        'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : a1, 2024-01-01, 3d\n    Review : 2d\n  section Build\n    Code : after a1, 5d'
      )
    );
    await editPage.checkTextInView('Review');
    await pickObject(page, 'L4');
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.task');
    await expect(field(page, 'days')).toHaveValue('2');
    await field(page, 'days').fill('4');
    await field(page, 'days').press('Enter');
    await expect.poll(() => stored(page)).toContain('    Review : 4d\n');
    await field(page, 'status').selectOption('done');
    await expect.poll(() => stored(page)).toContain('    Review : done, 4d\n');

    await pickObject(page, 'L5');
    await expect(crumb(page)).toHaveAttribute('data-crumb', 'insp.crumb.section');
    await renameTo(page, TID.inspName, '開発');
    await expect.poll(() => stored(page)).toContain('  section 開発\n');
    await editPage.checkTextInView('開発');

    await pickObject(page, 'L3');
    await page.getByTestId(TID.inspDelete).click();
    // The tasks that followed it start where it started.
    await expect
      .poll(() => stored(page))
      .toBe(
        'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Review : done, 2024-01-01, 4d\n  section 開発\n    Code : 2024-01-01, 5d'
      );
    await editPage.checkTextNotInView('Spec');
  });

  test('edits a composite state and the arrows inside it', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'stateDiagram-v2\n  [*] --> Paid\n  Paid --> Fulfilment\n  state Fulfilment {\n    [*] --> Packing\n    Packing --> Shipped\n  }\n  Fulfilment --> Done'
      )
    );
    await editPage.checkTextInView('Packing');
    // Arrows are editable even with a composite state in the diagram.
    await expect(
      page.getByTestId(TID.inspEdgeSelect).locator('option:not([disabled])')
    ).toHaveCount(5);
    await pickEdge(page, 3);
    await renameTo(page, TID.inspEdgeLabel, '梱包済み');
    await expect.poll(() => stored(page)).toContain('    Packing --> Shipped : 梱包済み\n');
    await editPage.checkTextInView('梱包済み');

    await pickObject(page, 'Fulfilment');
    await renameTo(page, TID.inspName, '出荷');
    await expect.poll(() => stored(page)).toContain('  state "出荷" as Fulfilment {\n');
    await editPage.checkTextInView('出荷');

    await page.getByTestId(TID.inspDeleteKeep).click();
    await expect.poll(() => stored(page)).not.toContain('Fulfilment');
    expect(await stored(page)).toContain('\n  [*] --> Packing\n  Packing --> Shipped : 梱包済み');
    await editPage.checkTextInView('Shipped');
  });

  test('renames a C4 boundary and deletes it, keeping what is inside', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor(
        'C4Context\n  Person(a, "Alice")\n  System_Boundary(b1, "Shop") {\n    System(s, "Web")\n  }\n  Rel(a, s, "uses")'
      )
    );
    await editPage.checkTextInView('Shop');
    await pickObject(page, 'b1');
    await renameTo(page, TID.inspName, '店舗');
    await expect.poll(() => stored(page)).toContain('  System_Boundary(b1, "店舗") {\n');
    await editPage.checkTextInView('店舗');
    await page.getByTestId(TID.inspDeleteKeep).click();
    await expect
      .poll(() => stored(page))
      .toBe('C4Context\n  Person(a, "Alice")\n  System(s, "Web")\n  Rel(a, s, "uses")');
    await editPage.checkTextNotInView('店舗');
    await editPage.checkTextInView('Web');
  });

  test('changes a pie slice’s value, renames and deletes one', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie showData\n  "Dogs" : 3\n  "Cats" : 2'));
    await editPage.checkTextInView('Dogs');
    await pickObject(page, 'L1');
    await expect(field(page, 'value')).toHaveValue('3');
    await field(page, 'value').fill('12');
    await field(page, 'value').press('Enter');
    await expect.poll(() => stored(page)).toContain('  "Dogs" : 12\n');
    await editPage.checkTextInView('[12]');
    await renameTo(page, TID.inspName, '犬');
    await expect.poll(() => stored(page)).toContain('  "犬" : 12\n');
    await pickObject(page, 'L2');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).toBe('pie showData\n  "犬" : 12');
    await editPage.checkTextNotInView('Cats');
  });

  test('renames and deletes a requirement', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'requirementDiagram\n  requirement login {\n    id: 1\n  }\n  element web {\n  }\n  web - satisfies -> login'
      )
    );
    await editPage.checkTextInView('login');
    await pickObject(page, 'login');
    await renameTo(page, TID.inspName, 'ログイン');
    await expect.poll(() => stored(page)).toContain('  web - satisfies -> "ログイン"');
    await editPage.checkTextInView('ログイン');
    await pickObject(page, 'web');
    await page.getByTestId(TID.inspDelete).click();
    await expect
      .poll(() => stored(page))
      .toBe('requirementDiagram\n  requirement "ログイン" {\n    id: 1\n  }');
    await editPage.checkTextNotInView('satisfies');
  });

  test('renames and deletes a block', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('block-beta\n  columns 2\n  blk1["ブロック1"] blk2["ブロック2"]\n  blk1 --> blk2')
    );
    await editPage.checkTextInView('ブロック1');
    await pickObject(page, 'blk1');
    await renameTo(page, TID.inspName, '受付');
    await expect.poll(() => stored(page)).toContain('  blk1["受付"] blk2["ブロック2"]');
    await editPage.checkTextInView('受付');
    await pickObject(page, 'blk2');
    await page.getByTestId(TID.inspDelete).click();
    await expect.poll(() => stored(page)).toBe('block-beta\n  columns 2\n  blk1["受付"]');
    await editPage.checkTextNotInView('ブロック2');
  });

  test('renames a kanban card with metadata and keeps its id and attributes', async ({
    editPage,
    page
  }) => {
    const meta = "@{ priority: 'Low', assigned: 'x' }";
    await editPage.start(urlFor(`kanban\n  todo[To do]\n    t1[Write blog]${meta}\n    t2[Test]`));
    await editPage.checkTextInView('Write blog');
    // The list shows the card's text only, not the brackets or the metadata.
    const options = await page.getByTestId(TID.inspObjectSelect).locator('option').allInnerTexts();
    expect(options.map((option) => option.replaceAll(/\s+/g, ' ').trim())).toContain('Write blog');
    expect(options.join('')).not.toContain('@{');

    await pickObject(page, 'L2');
    await renameTo(page, TID.inspName, 'Draft post');
    await expect.poll(() => stored(page)).toContain(`    t1[Draft post]${meta}\n`);
  });
});
