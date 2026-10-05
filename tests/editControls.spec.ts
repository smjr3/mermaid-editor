import { TID } from '$/constants';
import { expect, t, test } from './test';

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
const stored = async (page: import('@playwright/test').Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Edit card', () => {
  test('renames a node chosen from the list, and one clicked in the diagram', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('C');
    await expect(page.getByTestId(TID.editRenameInput)).toHaveValue('Accept order');
    await page.getByTestId(TID.editRenameInput).fill('Confirm order');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('    C["Confirm order"]\n');
    await editPage.checkTextInView('Confirm order');
    await expect(page.getByTestId(TID.editMessage)).toHaveText(
      t('edit.renamed', { name: 'Confirm order' })
    );

    // Clicking a node in the diagram picks it; Enter renames.
    await page.locator('#view .node', { hasText: 'Place order' }).click();
    await expect(page.getByTestId(TID.editObjectSelect)).toHaveValue('A');
    await page.getByTestId(TID.editRenameInput).fill('注文する');
    await page.getByTestId(TID.editRenameInput).press('Enter');
    await expect.poll(() => stored(page)).toContain('    A["注文する"] --> B[Receive goods]');
    await editPage.checkTextInView('注文する');
  });

  test('deletes a node with its arrows, renumbering the coloured arrows', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('D');
    await page.getByTestId(TID.editDeleteButton).click();
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
  });

  test('deletes a lane keeping what is inside', async ({ editPage, page }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('Shop');
    await page.getByTestId(TID.editDeleteKeepButton).click();
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
    await page.getByTestId(TID.editCard).click();

    await page.locator('#view .edgeLabel', { hasText: 'yes' }).click();
    await expect(page.getByTestId(TID.editEdgeSelect)).toHaveValue('2');
    await expect(page.getByTestId(TID.editEdgeLabel)).toHaveValue('yes');
    await page.getByTestId(TID.editEdgeReverse).click();
    await expect.poll(() => stored(page)).toContain('\n  D -->|yes| C\n');
    await expect(page.locator('#view path[data-id="L_D_C_0"]')).toHaveCount(1);

    await page.getByTestId(`${TID.editEdgeStyle}-dotted`).click();
    await expect.poll(() => stored(page)).toContain('\n  D -.->|yes| C\n');
    await page.getByTestId(`${TID.editEdgeHead}-off`).click();
    await expect.poll(() => stored(page)).toContain('\n  D -.-|yes| C\n');
    await page.getByTestId(`${TID.editEdgeStyle}-thick`).click();
    await expect.poll(() => stored(page)).toContain('\n  D ===|yes| C\n');

    await page.getByTestId(TID.editEdgeLabel).fill('在庫あり');
    await page.getByTestId(TID.editEdgeLabelButton).click();
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
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editEdgeSelect).selectOption('1');
    await page.getByTestId(TID.editEdgeDelete).click();
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

  test('renames a participant in its place, restyles a message and deletes a participant', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('sequenceDiagram\n  participant A as Alice\n  A->>B: hi\n  B-->>A: hello')
    );
    await editPage.checkTextInView('hello');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('B');
    await page.getByTestId(TID.editRenameInput).fill('Bob');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('\n  participant B as Bob\n  A->>B: hi');
    await editPage.checkTextInView('Bob');

    await page.getByTestId(TID.editEdgeSelect).selectOption('1');
    await page.getByTestId(`${TID.editEdgeStyle}-solid`).click();
    await expect.poll(() => stored(page)).toContain('\n  B->>A: hello');

    await page.getByTestId(TID.editObjectSelect).selectOption('A');
    await page.getByTestId(TID.editDeleteButton).click();
    await expect.poll(() => stored(page)).toBe('sequenceDiagram\n  participant B as Bob');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('changes a node’s shape and moves it to another lane, keeping its arrows', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('In stock?');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('D');
    await expect(page.getByTestId(TID.editShapeSelect)).toHaveValue('diamond');
    await page.getByTestId(TID.editShapeSelect).selectOption('stadium');
    await expect.poll(() => stored(page)).toContain('    D([In stock?])\n');
    await expect(page.getByTestId(TID.editMessage)).toHaveText(
      t('edit.changed', { name: 'In stock?' })
    );

    await page.getByTestId(TID.editObjectSelect).selectOption('C');
    await expect(page.getByTestId(TID.editMoveSelect)).toHaveValue('Shop');
    await page.getByTestId(TID.editMoveSelect).selectOption('Customer');
    await page.getByTestId(TID.editMoveButton).click();
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
    await page.getByTestId(TID.editMoveSelect).selectOption('');
    await page.getByTestId(TID.editMoveButton).click();
    await expect.poll(() => stored(page)).toContain('  D ==> B\n  C[Accept order]\n  linkStyle 1');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('gives a node an icon found by search, and takes it away again', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Accept order');
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('C');
    await expect(page.getByTestId(TID.editIconCurrent)).toHaveText(t('edit.iconNone'));
    await page.getByTestId(TID.editIconSearch).fill('user-circle');
    const result = page.locator(
      `[data-testid="${TID.editIconResult}"][data-icon="tabler:user-circle"]`
    );
    await result.click({ timeout: 30_000 });
    await expect
      .poll(() => stored(page))
      .toContain('    C@{ icon: "tabler:user-circle", label: "Accept order" }\n');
    await editPage.checkTextInView('Accept order');
    // mermaid draws an icon node with its own shape.
    await expect(page.locator('#view .icon-shape', { hasText: 'Accept order' })).toHaveCount(1);
    await expect(page.getByTestId(TID.editIconCurrent)).toHaveText(
      t('edit.iconCurrent', { icon: 'tabler:user-circle' })
    );
    await expect(page.getByText(t('edit.shapeIcon'))).toBeVisible();

    await page.getByTestId(TID.editIconClear).click();
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
    await page.getByTestId(TID.editCard).click();

    await page.getByTestId(TID.editObjectSelect).selectOption('dns');
    await expect(page.getByTestId(TID.editMoveSelect)).toHaveValue('');
    await page.getByTestId(TID.editMoveSelect).selectOption('api');
    await page.getByTestId(TID.editMoveButton).click();
    await expect.poll(() => stored(page)).toContain('  service dns(internet)[DNS] in api\n');

    await page.getByTestId(TID.editIconSearch).fill('server');
    // mermaid's standard icons come first and are written without a prefix.
    await page
      .locator(`[data-testid="${TID.editIconResult}"][data-icon="mermaid:server"]`)
      .click({ timeout: 30_000 });
    await expect.poll(() => stored(page)).toContain('  service dns(server)[DNS] in api\n');
    await editPage.checkTextInView('DNS');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('adds a note and an empty alt block to a sequence, then deletes the block', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor(
        'sequenceDiagram\n  participant A as 申請者\n  participant B as 上長\n  A->>B: 申請\n  B-->>A: 回答'
      )
    );
    await editPage.checkTextInView('回答');
    await page.getByTestId(TID.addCard).click();

    const field = (action: string, key: string) =>
      page.getByTestId(`${TID.addAction}-${action}-${key}`);
    await field('note', 'at').selectOption('A');
    await field('note', 'to').selectOption('B');
    await field('note', 'text').fill('書類を確認');
    await field('note', 'button').click();
    await expect
      .poll(() => stored(page))
      .toContain('\n  B-->>A: 回答\n  Note over A,B: 書類を確認');
    await editPage.checkTextInView('書類を確認');

    await field('block', 'kind').selectOption('alt');
    await field('block', 'text').fill('承認する');
    await field('block', 'after').selectOption({ label: 'A → B: 申請' });
    await field('block', 'button').click();
    await expect
      .poll(() => stored(page))
      .toContain('\n  A->>B: 申請\n  alt 承認する\n  end\n  B-->>A: 回答');

    // A message chosen to go "first inside" the block fills it.
    await field('message', 'from').selectOption('B');
    await field('message', 'to').selectOption('A');
    await field('message', 'text').fill('差戻し');
    await field('message', 'kind').selectOption('reply');
    await field('message', 'after').selectOption({ label: 'alt 承認する ⋯' });
    await field('message', 'button').click();
    await expect
      .poll(() => stored(page))
      .toContain('\n  alt 承認する\n    B-->>A: 差戻し\n  end\n');
    await editPage.checkTextInView('[承認する]');

    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('line:4');
    await page.getByTestId(TID.editDeleteButton).click();
    await expect.poll(() => stored(page)).not.toContain('alt');
    expect(await stored(page)).toContain('\n  A->>B: 申請\n  B-->>A: 差戻し\n  B-->>A: 回答');
    await editPage.checkTextNotInView('[承認する]');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('explains when a diagram cannot be edited from here', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  A: [0.3, 0.6]'
      )
    );
    await editPage.checkTextInView('Reach');
    await page.getByTestId(TID.editCard).click();
    await expect(page.getByText(t('edit.unsupported'))).toBeVisible();
    await expect(page.getByTestId(TID.editObjectSelect)).toHaveCount(0);
  });

  test('changes and deletes a class member', async ({ editPage, page }) => {
    await editPage.start(
      urlFor(
        'classDiagram\n  class Order {\n    +int id\n    -total: Money\n  }\n  Order : +pay() bool'
      )
    );
    await editPage.checkTextInView('total');
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('Order');
    const options = await page.getByTestId(TID.editMemberSelect).locator('option').allInnerTexts();
    expect(options).toEqual(['+int id', '-total: Money', '+pay() bool']);
    await page.getByTestId(TID.editMemberSelect).selectOption('L3');
    await expect(page.getByTestId(`${TID.editMember}-name`)).toHaveValue('total');
    await page.getByTestId(`${TID.editMember}-name`).fill('合計');
    await page.getByTestId(`${TID.editMember}-visibility`).selectOption('protected');
    await page.getByTestId(TID.editMemberButton).click();
    await expect.poll(() => stored(page)).toContain('    #合計: Money\n');
    await editPage.checkTextInView('合計');

    await page.getByTestId(TID.editMemberSelect).selectOption('L5');
    await page.getByTestId(TID.editMemberDelete).click();
    await expect.poll(() => stored(page)).not.toContain('pay()');
    await editPage.checkTextNotInView('pay()');
  });

  test('changes and deletes an ER attribute', async ({ editPage, page }) => {
    await editPage.start(
      urlFor('erDiagram\n  ORDER {\n    int id PK\n    string note\n  }\n  ORDER ||--o{ LINE : has')
    );
    await editPage.checkTextInView('note');
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('ORDER');
    await page.getByTestId(TID.editMemberSelect).selectOption('L3');
    await page.getByTestId(`${TID.editMember}-name`).fill('備考');
    await page.getByTestId(`${TID.editMember}-key`).selectOption('UK');
    await page.getByTestId(`${TID.editMember}-comment`).fill('自由記入');
    await page.getByTestId(TID.editMemberButton).click();
    await expect.poll(() => stored(page)).toContain('    string 備考 UK "自由記入"\n');
    await editPage.checkTextInView('自由記入');
    await page.getByTestId(TID.editMemberSelect).selectOption('L2');
    await page.getByTestId(TID.editMemberDelete).click();
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
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('L4');
    await expect(page.getByTestId(`${TID.editProp}-days`)).toHaveValue('2');
    await page.getByTestId(`${TID.editProp}-days`).fill('4');
    await page.getByTestId(`${TID.editProp}-status`).selectOption('done');
    await page.getByTestId(TID.editPropsButton).click();
    await expect.poll(() => stored(page)).toContain('    Review : done, 4d\n');

    await page.getByTestId(TID.editObjectSelect).selectOption('L5');
    await page.getByTestId(TID.editRenameInput).fill('開発');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  section 開発\n');
    await editPage.checkTextInView('開発');

    await page.getByTestId(TID.editObjectSelect).selectOption('L3');
    await page.getByTestId(TID.editDeleteButton).click();
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
    await page.getByTestId(TID.editCard).click();
    // Arrows are editable even with a composite state in the diagram.
    await expect(page.getByTestId(TID.editEdgeSelect).locator('option')).toHaveCount(5);
    await page.getByTestId(TID.editEdgeSelect).selectOption('3');
    await page.getByTestId(TID.editEdgeLabel).fill('梱包済み');
    await page.getByTestId(TID.editEdgeLabelButton).click();
    await expect.poll(() => stored(page)).toContain('    Packing --> Shipped : 梱包済み\n');
    await editPage.checkTextInView('梱包済み');

    await page.getByTestId(TID.editObjectSelect).selectOption('Fulfilment');
    await page.getByTestId(TID.editRenameInput).fill('出荷');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  state "出荷" as Fulfilment {\n');
    await editPage.checkTextInView('出荷');

    await page.getByTestId(TID.editDeleteKeepButton).click();
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
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('b1');
    await page.getByTestId(TID.editRenameInput).fill('店舗');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  System_Boundary(b1, "店舗") {\n');
    await editPage.checkTextInView('店舗');
    await page.getByTestId(TID.editDeleteKeepButton).click();
    await expect
      .poll(() => stored(page))
      .toBe('C4Context\n  Person(a, "Alice")\n  System(s, "Web")\n  Rel(a, s, "uses")');
    await editPage.checkTextNotInView('店舗');
    await editPage.checkTextInView('Web');
  });

  test('changes a pie slice’s value, renames and deletes one', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie showData\n  "Dogs" : 3\n  "Cats" : 2'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('L1');
    await expect(page.getByTestId(`${TID.editProp}-value`)).toHaveValue('3');
    await page.getByTestId(`${TID.editProp}-value`).fill('12');
    await page.getByTestId(TID.editPropsButton).click();
    await expect.poll(() => stored(page)).toContain('  "Dogs" : 12\n');
    await editPage.checkTextInView('[12]');
    await page.getByTestId(TID.editRenameInput).fill('犬');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  "犬" : 12\n');
    await page.getByTestId(TID.editObjectSelect).selectOption('L2');
    await page.getByTestId(TID.editDeleteButton).click();
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
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('login');
    await page.getByTestId(TID.editRenameInput).fill('ログイン');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  web - satisfies -> "ログイン"');
    await editPage.checkTextInView('ログイン');
    await page.getByTestId(TID.editObjectSelect).selectOption('web');
    await page.getByTestId(TID.editDeleteButton).click();
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
    await page.getByTestId(TID.editCard).click();
    await page.getByTestId(TID.editObjectSelect).selectOption('blk1');
    await page.getByTestId(TID.editRenameInput).fill('受付');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain('  blk1["受付"] blk2["ブロック2"]');
    await editPage.checkTextInView('受付');
    await page.getByTestId(TID.editObjectSelect).selectOption('blk2');
    await page.getByTestId(TID.editDeleteButton).click();
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
    await page.getByTestId(TID.editCard).click();
    // The list shows the card's text only, not the brackets or the metadata.
    const options = await page.getByTestId(TID.editObjectSelect).locator('option').allInnerTexts();
    expect(options.map((option) => option.replaceAll(/\s+/g, ' ').trim())).toContain('Write blog');
    expect(options.join('')).not.toContain('@{');

    await page.getByTestId(TID.editObjectSelect).selectOption('L2');
    await page.getByTestId(TID.editRenameInput).fill('Draft post');
    await page.getByTestId(TID.editRenameButton).click();
    await expect.poll(() => stored(page)).toContain(`    t1[Draft post]${meta}\n`);
  });
});
