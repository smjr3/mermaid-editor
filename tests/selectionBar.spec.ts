import { TID } from '$/constants';
import type { Locator, Page } from '@playwright/test';
import { barItems } from './helpers/canvas';
import { expect, t, test } from './test';

// The bar over the diagram while something is selected (SelectionBar.svelte): the add
// buttons give way to the selection's commands from the registry (selectionCommands.ts),
// one row with その他 ▾ for what does not fit; colours, shapes and line styles are chosen
// in popovers and apply to every selected item; 左へ / 右へ reorder siblings; ✕ clears.
const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const flow = `flowchart TD
  A[Start] -->|go| B{Pick}
  B -->|one| C[Left]
  B -->|two| D[Right]
  E{Other}`;
const lanes = `swimlane-beta LR
  subgraph a
    C[Shop]
  end
  subgraph b
    D[Pack]
    E[Ship]
  end
  C --> D
  C --> E`;

const code = (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
    )
    .then((text) => text.replaceAll('\r\n', '\n'));
const node = (page: Page, text: string) => page.locator('#view .node', { hasText: text }).first();
const edge = (page: Page, label: string) =>
  page.locator('#view g.edgeLabel', { hasText: label }).first();
const outlines = (page: Page) => page.getByTestId(TID.selectionOutline);
const selectedKeys = (page: Page) =>
  outlines(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-selected')).sort()
  );
const addBar = (page: Page) => page.getByTestId(TID.canvasInsertBar);
const bar = (page: Page) => page.getByTestId(TID.selectionBar);
const cmds = (scope: Locator) =>
  scope
    .getByTestId(TID.selectionBarItem)
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-cmd') ?? ''));
/** The command keys on the bar itself, in order. */
const barCmds = (page: Page) => cmds(bar(page));
const moreButton = (page: Page) => bar(page).getByTestId(TID.selectionBarMore);
const moreMenu = (page: Page) =>
  page.locator(`[data-testid="${TID.selectionBarMenu}"][data-cmd="more"]`);
/** Every command the bar offers: on the bar, then the ones under その他 ▾ (opened and closed again). */
const allCmds = async (page: Page): Promise<string[]> => {
  const onBar = await barCmds(page);
  if ((await moreButton(page).count()) === 0) return onBar;
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeVisible();
  const hidden = await cmds(moreMenu(page));
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeHidden();
  return [...onBar, ...hidden];
};
/** Presses a command: on the bar, or under その他 ▾ when the bar does not show it. */
const cmd = async (page: Page, key: string, force = false): Promise<void> => {
  const onBar = bar(page).locator(`[data-testid="${TID.selectionBarItem}"][data-cmd="${key}"]`);
  if ((await onBar.count()) > 0) {
    await onBar.click({ force });
    return;
  }
  if (!(await moreMenu(page).isVisible())) await moreButton(page).click();
  await moreMenu(page).locator(`[data-cmd="${key}"]`).click({ force });
};
/** The open popover's content for a command or group (rows, or a menu of values). */
const popover = (page: Page, key: string) =>
  page.locator(`[data-state="open"] [data-testid="${TID.selectionBarMenu}"][data-cmd="${key}"]`);
const row = (page: Page, key: string) =>
  page.locator(`[data-testid="${TID.selectionBarRow}"][data-cmd="${key}"]`);
const choice = (scope: Locator, value: string) =>
  scope.locator(`[data-testid="${TID.selectionBarChoice}"][data-value="${value}"]`);
const x = async (locator: Locator) => (await locator.boundingBox())?.x ?? Number.NaN;

test.describe('Selection bar', () => {
  test.use({ viewport: { height: 900, width: 1400 } });

  test.beforeEach(async ({ editPage }) => {
    await editPage.start(urlFor(flow));
    await editPage.checkTextInView('Right');
  });

  test('switches from the add buttons to the selection’s commands, and back with ✕', async ({
    page
  }) => {
    await expect(addBar(page)).toHaveAttribute('data-mode', 'add');
    expect(await barItems(page)).toEqual(['rect', 'diamond', 'stadium', 'lane', 'connect']);

    // A node: every command of a single node, in the bar's order; 左へ once it is known.
    await node(page, 'Right').click();
    await expect(addBar(page)).toHaveAttribute('data-mode', 'selection');
    await expect(bar(page).getByTestId(TID.selectionBarCount)).toHaveText(
      t('sel.cmd.count', { count: '1' })
    );
    await expect
      .poll(() => allCmds(page))
      .toEqual([
        'addNext',
        'addBranch',
        'color',
        'shape',
        'text',
        'selectSame',
        'moveLeft',
        'connectFrom',
        'delete'
      ]);
    // The same words as the registry, with the key in the title.
    const first = bar(page).locator(`[data-testid="${TID.selectionBarItem}"]`).first();
    await expect(first).toHaveText(t('insp.addNext'));
    await expect(first).toHaveAttribute('title', `${t('insp.addNext')} (Enter)`);
    // Reachable with Tab: from ✕ the next stop is the first command.
    await bar(page).getByTestId(TID.selectionBarClear).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-cmd'))).toBe(
      'addNext'
    );

    // An arrow: its colour, line, the same arrows, turning it round, delete.
    await edge(page, 'go').click();
    await expect(outlines(page)).toHaveAttribute('data-selected', 'edge-0');
    await expect
      .poll(() => allCmds(page))
      .toEqual(['color', 'line', 'selectSame', 'reverse', 'delete']);

    // Several: only what applies to all of them.
    await node(page, 'Left').click();
    await node(page, 'Right').click({ modifiers: ['Control'] });
    await expect(bar(page).getByTestId(TID.selectionBarCount)).toHaveText(
      t('sel.cmd.count', { count: '2' })
    );
    await expect
      .poll(() => allCmds(page))
      .toEqual(['color', 'shape', 'text', 'selectSame', 'delete']);

    // ✕ clears the selection: the add buttons are back.
    await bar(page).getByTestId(TID.selectionBarClear).click();
    await expect(outlines(page)).toHaveCount(0);
    await expect(addBar(page)).toHaveAttribute('data-mode', 'add');
    expect(await barItems(page)).toEqual(['rect', 'diamond', 'stadium', 'lane', 'connect']);
  });

  test('the colour popover recolours every selected node, and says まちまち when they differ', async ({
    page
  }) => {
    await node(page, 'Left').click();
    await node(page, 'Right').click({ modifiers: ['Control'] });
    await cmd(page, 'color');
    const rows = popover(page, 'color');
    await expect(rows).toBeVisible();
    await expect(rows.getByTestId(TID.selectionBarRow)).toHaveCount(3);
    await expect(row(page, 'fillColor')).toHaveAttribute('data-current', 'none');
    await expect(choice(row(page, 'fillColor'), 'none')).toHaveAttribute('aria-pressed', 'true');
    await choice(row(page, 'fillColor'), 'green').click();
    await expect.poll(() => code(page)).toContain('style C fill:#def5e1,stroke:#3f9b52');
    expect(await code(page)).toContain('style D fill:#def5e1,stroke:#3f9b52');
    await expect(row(page, 'fillColor')).toHaveAttribute('data-current', 'green');
    // The text colour of both, in the same popover.
    await choice(row(page, 'textColor'), '#d64545').click();
    await expect.poll(() => code(page)).toMatch(/style C [^\n]*color:#d64545/);
    expect(await code(page)).toMatch(/style D [^\n]*color:#d64545/);
    await cmd(page, 'color');
    await expect(rows).toBeHidden();

    // One green, one not: まちまち, and a pick applies to both.
    await node(page, 'Start').click();
    await node(page, 'Left').click({ modifiers: ['Control'] });
    await cmd(page, 'color');
    await expect(row(page, 'fillColor')).toHaveAttribute('data-current', 'mixed');
    await expect(row(page, 'fillColor').getByTestId(TID.selectionBarMixed)).toHaveText(
      t('sel.cmd.mixed')
    );
    await choice(row(page, 'fillColor'), 'blue').click();
    await expect.poll(() => code(page)).toContain('style A fill:#dde9fb,stroke:#3b73c9');
    expect(await code(page)).toContain('style C fill:#dde9fb,stroke:#3b73c9');
    await expect(row(page, 'fillColor')).toHaveAttribute('data-current', 'blue');
  });

  test('the shape menu changes a node, marks the current shape, まちまち for several', async ({
    page
  }) => {
    await node(page, 'Left').click();
    await cmd(page, 'shape');
    const menu = popover(page, 'shape');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('data-current', 'rect');
    await expect(choice(menu, 'rect')).toHaveAttribute('aria-checked', 'true');
    await expect(choice(menu, 'diam')).toHaveText(t('add.shape.diamond'));
    await choice(menu, 'diam').click();
    await expect(menu).toBeHidden();
    await expect.poll(() => code(page)).toContain('C{Left}');

    await node(page, 'Right').click({ modifiers: ['Control'] });
    await cmd(page, 'shape');
    await expect(popover(page, 'shape')).toHaveAttribute('data-current', 'mixed');
    await expect(popover(page, 'shape').getByTestId(TID.selectionBarMixed)).toBeVisible();
    await choice(popover(page, 'shape'), 'stadium').click();
    await expect.poll(() => code(page)).toContain('C([Left])');
    expect(await code(page)).toContain('D([Right])');
  });

  test('線 makes an arrow dotted, and its rows are 線の種類 / 矢じり / 長さ', async ({ page }) => {
    await edge(page, 'go').click();
    await cmd(page, 'line');
    const rows = popover(page, 'line');
    await expect(rows.getByTestId(TID.selectionBarRow)).toHaveCount(3);
    expect(
      await rows
        .getByTestId(TID.selectionBarRow)
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-cmd')))
    ).toEqual(['lineStyle', 'arrowHead', 'edgeLength']);
    await expect(row(page, 'lineStyle')).toHaveAttribute('data-current', 'solid');
    await choice(row(page, 'lineStyle'), 'dotted').click();
    await expect.poll(() => code(page)).toContain('A[Start] -.->|go| B{Pick}');
    await expect(row(page, 'lineStyle')).toHaveAttribute('data-current', 'dotted');
    await choice(row(page, 'arrowHead'), 'both').click();
    await expect.poll(() => code(page)).toContain('A[Start] <-.->|go| B{Pick}');
  });

  test('同じものを選ぶ → 同じ形 selects every diamond', async ({ page }) => {
    await node(page, 'Pick').click();
    await cmd(page, 'selectSame');
    const menu = popover(page, 'selectSame');
    await expect(choice(menu, 'shape')).toHaveText(t('sel.cmd.sameShape'));
    await choice(menu, 'shape').click();
    await expect(outlines(page)).toHaveCount(2);
    expect(await selectedKeys(page)).toEqual(['B', 'E']);
    await expect(bar(page).getByTestId(TID.selectionBarCount)).toHaveText(
      t('sel.cmd.count', { count: '2' })
    );
  });

  test('左へ / 右へ swap two siblings, and are absent on a swimlane', async ({
    editPage,
    page
  }) => {
    expect(await x(node(page, 'Left'))).toBeLessThan(await x(node(page, 'Right')));
    await node(page, 'Left').click();
    await expect.poll(() => allCmds(page)).toContain('moveRight');
    expect(await allCmds(page)).not.toContain('moveLeft');
    await cmd(page, 'moveRight');
    await expect
      .poll(() => code(page))
      .toBe(
        'flowchart TD\n  A[Start] -->|go| B{Pick}\n  B -->|two| D[Right]\n  B -->|one| C[Left]\n  E{Other}'
      );
    await expect.poll(() => x(node(page, 'Left'))).toBeGreaterThan(await x(node(page, 'Right')));
    // Still selected, now on the right: only 左へ.
    await expect(outlines(page)).toHaveAttribute('data-selected', 'C');
    await expect.poll(() => allCmds(page)).toContain('moveLeft');
    expect(await allCmds(page)).not.toContain('moveRight');
    await cmd(page, 'moveLeft');
    await expect.poll(() => code(page)).toBe(flow);

    await editPage.start(urlFor(lanes));
    await editPage.checkTextInView('Ship');
    await node(page, 'Ship').click();
    await expect.poll(() => allCmds(page)).toContain('delete');
    // Give the (async) answer time to land: it stays no.
    await page.waitForTimeout(500);
    const offered = await allCmds(page);
    expect(offered).not.toContain('moveLeft');
    expect(offered).not.toContain('moveRight');
  });

  test('削除 removes every selected item; one Ctrl+Z brings them all back', async ({
    editPage,
    page
  }) => {
    await node(page, 'Left').click();
    await node(page, 'Right').click({ modifiers: ['Control'] });
    const remove = bar(page).locator(`[data-testid="${TID.selectionBarItem}"][data-cmd="delete"]`);
    if ((await remove.count()) > 0) {
      await expect(remove).toHaveAttribute('title', `${t('sel.delete')} (Del)`);
    }
    await cmd(page, 'delete');
    await expect
      .poll(() => code(page))
      .toBe('flowchart TD\n  A[Start] -->|go| B{Pick}\n  E{Other}');
    await expect(outlines(page)).toHaveCount(0);
    await editPage.checkTextNotInView('Left');
    await page.keyboard.press('Control+z');
    await expect.poll(() => code(page)).toBe(flow);
    await editPage.checkTextInView('Left');
  });

  test('while the code is broken the buttons are disabled, and refuse when pressed', async ({
    editPage,
    page
  }) => {
    await node(page, 'Right').click();
    await expect(bar(page)).not.toHaveAttribute('data-blocked', 'true');
    await editPage.typeInEditor('\n  X -->');
    await expect(page.getByTestId(TID.diagramErrorNotice)).toBeVisible({ timeout: 10_000 });
    const broken = await code(page);
    expect(broken).toContain('X -->');
    // The selection stays, the bar with it: dimmed.
    await expect(outlines(page)).toHaveCount(1);
    await expect(bar(page)).toHaveAttribute('data-blocked', 'true');
    for (const item of await bar(page).getByTestId(TID.selectionBarItem).all()) {
      await expect(item).toHaveAttribute('aria-disabled', 'true');
    }
    // Dimmed, not inert: pressing one still runs, and the model refuses and says why.
    await cmd(page, 'delete', true);
    await expect(page.getByTestId(TID.selectionWarning)).toHaveText(t('recover.blocked'));
    expect(await code(page)).toBe(broken);
    await expect(outlines(page)).toHaveCount(1);
  });

  test('a narrow window keeps one row and puts the rest under その他 ▾', async ({
    editPage,
    page
  }) => {
    await page.setViewportSize({ height: 700, width: 900 });
    // A link that carries no view keeps the stored one (the fixture's first visit, at the wide
    // size), which can leave Right off-screen in the small window; a null view asks for a fit.
    await editPage.start(
      `/edit#base64:${Buffer.from(
        JSON.stringify({ code: flow, mermaid: '{}', pan: null, zoom: null })
      ).toString('base64')}`
    );
    await editPage.checkTextInView('Right');
    await node(page, 'Right').click();
    await expect(moreButton(page)).toBeVisible();
    const onBar = await barCmds(page);
    const all = await allCmds(page);
    expect(all).toEqual([
      'addNext',
      'addBranch',
      'color',
      'shape',
      'text',
      'selectSame',
      'moveLeft',
      'connectFrom',
      'delete'
    ]);
    expect(onBar.length).toBeLessThan(all.length);
    // One row: every button and その他 share the top line, inside the bar.
    const box = await bar(page).boundingBox();
    const buttons = await bar(page)
      .locator(
        `[data-testid="${TID.selectionBarItem}"], [data-testid="${TID.selectionBarMore}"], [data-testid="${TID.selectionBarCount}"]`
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { middle: rect.top + rect.height / 2, right: rect.right };
        })
      );
    if (!box) throw new Error('no bar');
    for (const button of buttons) {
      expect(Math.abs(button.middle - buttons[0].middle)).toBeLessThan(4);
      expect(button.right).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    // A choice under その他 opens there, in place of the menu, and still works.
    const hidden = all.slice(onBar.length);
    if (hidden.includes('shape')) {
      await cmd(page, 'shape');
      await expect(popover(page, 'shape')).toBeVisible();
      await choice(popover(page, 'shape'), 'circle').click();
      await expect.poll(() => code(page)).toContain('D((Right))');
    }
    // Back at the wide window everything but perhaps the last few is on the bar.
    await page.setViewportSize({ height: 900, width: 1400 });
    await expect.poll(async () => (await barCmds(page)).length).toBeGreaterThan(onBar.length);
  });
});
