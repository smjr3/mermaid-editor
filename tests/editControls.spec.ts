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

  test('explains when a diagram cannot be edited from here', async ({ editPage, page }) => {
    await editPage.start(urlFor('pie\n  "Dogs" : 3\n  "Cats" : 2'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.editCard).click();
    await expect(page.getByText(t('edit.unsupported'))).toBeVisible();
    await expect(page.getByTestId(TID.editObjectSelect)).toHaveCount(0);
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
