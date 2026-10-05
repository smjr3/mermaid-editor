import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { expect, t, test } from './test';

// Regressions from an exploratory pass as someone who only uses the tools pane and
// never types code: each test is one thing that used to get a person stuck.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
const field = (action: string, key: string) => `${TID.addAction}-${action}-${key}`;

test.describe('QA findings', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test('a name typed after "この後に追加" replaces the placeholder instead of joining it', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('End');
    await node(page, 'Start').click();
    await page.getByTestId(TID.selectionAddAfter).click();
    const input = page.getByTestId(TID.selectionRename);
    await expect(input).toBeFocused();
    // The whole placeholder is selected, so typing replaces it.
    await expect
      .poll(() => input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]))
      .toEqual([0, t('sel.newNode').length]);
    await page.keyboard.type('Review');
    await page.keyboard.press('Enter');
    await expect.poll(() => stored(page)).toMatch(/\["Review"\]/);
    expect(await stored(page)).not.toContain(t('sel.newNode'));
  });

  test('the toolbar rename button selects the current name too', async ({ editPage, page }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('End');
    await node(page, 'End').click();
    await page.getByTestId('selection-toolbar-rename').click();
    const input = page.getByTestId(TID.selectionRename);
    await expect
      .poll(() => input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]))
      .toEqual([0, 3]);
  });

  test('the Layout card offers engine and spacing only where they change the picture', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('pie title Pets\n  "Dogs": 3\n  "Cats": 2'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByTestId(TID.layoutNoEngine)).toHaveText(t('layout.noEngine'));
    await expect(page.getByTestId(TID.layoutEngineElk)).toHaveCount(0);
    await expect(page.getByTestId(`${TID.layoutSpacing}-wide`)).toHaveCount(0);

    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('End');
    await page.getByTestId(TID.layoutCard).click();
    await expect(page.getByTestId(TID.layoutEngineElk)).toBeVisible();
    await expect(page.getByTestId(`${TID.layoutSpacing}-wide`)).toBeVisible();
    await expect(page.getByTestId(TID.layoutNoEngine)).toHaveCount(0);
  });

  test('a clicked icon goes on the selected shape, not into the code at the cursor', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await editPage.checkTextInView('End');
    await node(page, 'Start').click();
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('tabler');
    await page.getByTestId(TID.iconPickerSearch).fill('server');
    const first = page.getByTestId(TID.iconPickerResults).getByRole('button').first();
    await expect(first).toHaveAttribute('title', /^tabler:/, { timeout: 30_000 });
    await first.click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toContainText('Start');
    await expect.poll(() => stored(page)).toMatch(/A@\{ icon: "tabler:[\w-]+", label: "Start" \}/);
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
  });

  test('an icon that would break the diagram at the cursor is taken back, with an explanation', async ({
    editPage,
    page
  }) => {
    const code = 'flowchart TD\n  A[Start] --> B[End]';
    await editPage.start(urlFor(code));
    await editPage.checkTextInView('End');
    await page.getByTestId(TID.iconPacksCard).click();
    await page.getByTestId(TID.iconPickerPack).selectOption('tabler');
    await page.getByTestId(TID.iconPickerSearch).fill('server');
    const first = page.getByTestId(TID.iconPickerResults).getByRole('button').first();
    await expect(first).toHaveAttribute('title', /^tabler:/, { timeout: 30_000 });
    // The cursor goes to the end of the last line: a name written there is a syntax error.
    await editPage.editor.getByText('B[End]').click();
    await page.keyboard.press('End');
    await first.click();
    await expect(page.getByTestId(TID.iconPickerMessage)).toHaveText(t('icons.pickBroke'));
    await expect.poll(() => stored(page)).toBe(code);
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    await editPage.checkTextInView('End');
  });

  test('a sequence frame is wrapped around the last message by default, never drawn empty', async ({
    editPage,
    page
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await editPage.start(
      urlFor('sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n  B-->>A: hello')
    );
    await editPage.checkTextInView('hello');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('block', 'text')).fill('stock');
    await page.getByTestId(field('block', 'button')).click();
    await expect
      .poll(() => stored(page))
      .toContain('  A->>B: hi\n  alt stock\n    B-->>A: hello\n  end');
    await editPage.checkTextInView('stock');
    await expect(page.getByTestId(TID.errorContainer)).toHaveCount(0);
    // An empty frame made mermaid draw NaN coordinates.
    expect(errors.filter((text) => text.includes('NaN'))).toEqual([]);
  });

  test('a connection is reported by the names on screen, not by internal ids', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('classDiagram\n  class c1["Customer"]\n  class c2["Order"]'));
    await editPage.checkTextInView('Order');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('relation', 'from')).selectOption('c1');
    await page.getByTestId(field('relation', 'to')).selectOption('c2');
    await page.getByTestId(field('relation', 'button')).click();
    await expect(page.getByTestId(TID.addMessage)).toHaveText(
      t('add.done', { name: 'Customer → Order' })
    );
  });

  test('the next gantt task does not inherit "done" and "critical" from the last one', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor('gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec : 2024-01-01, 3d')
    );
    await editPage.checkTextInView('Spec');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('task', 'name')).fill('Review');
    await page.getByTestId(field('task', 'status')).selectOption('done');
    await page.getByTestId(field('task', 'crit')).selectOption('yes');
    await page.getByTestId(field('task', 'button')).click();
    await expect.poll(() => stored(page)).toContain('Review : done, crit,');
    // The text was cleared; these choices go back to their start, too.
    await expect(page.getByTestId(field('task', 'status'))).toHaveValue('none');
    await expect(page.getByTestId(field('task', 'crit'))).toHaveValue('no');
    await page.getByTestId(field('task', 'name')).fill('Ship');
    await page.getByTestId(field('task', 'button')).click();
    await expect.poll(() => stored(page)).toMatch(/\n\s+Ship : (?!done|crit)/);
  });

  test('a task added to a chart with task1, task2… ids does not draw NaN', async ({
    editPage,
    page
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await editPage.start(
      urlFor(
        'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec :task1, 2024-01-01, 3d\n    Build :task2, after task1, 5d'
      )
    );
    await editPage.checkTextInView('Build');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('task', 'name')).fill('Ship');
    await page.getByTestId(field('task', 'button')).click();
    await expect.poll(() => stored(page)).toContain('Ship : t1, after task2, 3d');
    await editPage.checkTextInView('Ship');
    await page.waitForTimeout(500);
    expect(errors.filter((text) => text.includes('NaN'))).toEqual([]);
  });

  test('the 作成 button of the new-diagram form stays in reach without scrolling', async ({
    page
  }) => {
    await page.goto('/edit');
    await page.getByTestId(TID.newDiagramToggle).click();
    const create = page.getByTestId(TID.newDiagramCreate);
    await expect(create).toBeVisible();
    const pane = await page.getByTestId(TID.toolsPane).boundingBox();
    const button = await create.boundingBox();
    if (!pane || !button) throw new Error('boxes missing');
    expect(button.y + button.height).toBeLessThanOrEqual(pane.y + pane.height);
    expect(button.y).toBeGreaterThanOrEqual(pane.y);
  });

  test('an unnamed slice and the pie value toggle use words a person would read', async ({
    editPage,
    page
  }) => {
    await editPage.start(urlFor('pie title Pets\n  "Dogs": 3\n  "Cats": 2'));
    await editPage.checkTextInView('Dogs');
    await page.getByTestId(TID.addCard).click();
    await page.getByTestId(field('slice', 'button')).click();
    await expect.poll(() => stored(page)).toContain('"項目" : 10');
    await page.getByTestId(field('display', 'button')).click();
    await expect(page.getByTestId(TID.addMessage)).toHaveText(t('add.pie.shownDone'));
  });
});

test.describe('QA findings on a phone', () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test('"ツール欄で詳しく" leaves the diagram view for the tools', async ({ page }) => {
    await page.goto(urlFor('flowchart TD\n  A[Start] --> B[End]'));
    await expect(page.locator('#view')).toContainText('End', { timeout: 15_000 });
    const mode = page.locator('#editorMode');
    await expect(mode).toHaveAttribute('aria-checked', 'true');
    await node(page, 'End').click();
    await page.getByTestId(TID.selectionToolbar).getByTestId('selection-toolbar-more').click();
    await expect(mode).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId(TID.editObjectSelect)).toBeVisible();
  });
});
