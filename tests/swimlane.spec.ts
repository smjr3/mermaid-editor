import { TID } from '$/constants';
import type { Page } from '@playwright/test';
import { barItems, insert, insertBar } from './helpers/canvas';
import { expect, t, test } from './test';

// Swimlane support is the reason this fork exists, so its samples are checked
// in every engine the suite runs, not only Chromium.
test.describe('Swimlane samples', () => {
  test.beforeEach(async ({ editPage }) => {
    await editPage.toggleSampleDiagrams();
  });

  test('render their lanes', { tag: '@smoke' }, async ({ editPage }) => {
    await editPage.loadSampleDiagram('Swimlane');
    for (const text of ['Customer', 'Shop', 'Warehouse', 'Pick and pack']) {
      await editPage.checkTextInView(text);
    }
  });
});

const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;
const stored = async (page: Page) =>
  page
    .evaluate(
      () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code?: string }).code ?? ''
    )
    .then((code) => code.replaceAll('\r\n', '\n'));

test.describe('Swimlane: building one from the add bar', () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test('a lane is clicked to select it, and a step added goes into it', async ({
    editPage,
    page
  }) => {
    await editPage.start(
      urlFor(
        'swimlane-beta LR\n  subgraph 営業\n    A[受注]\n  end\n  subgraph 経理\n    B[請求]\n  end'
      )
    );
    await editPage.checkTextInView('受注');
    expect(await barItems(page)).toEqual(['rect', 'diamond', 'stadium', 'lane', 'connect']);
    await expect(insertBar(page).locator('[data-insert="lane"]')).toHaveText(t('canvas.lane'));

    // A lane is picked by clicking inside it, away from its steps.
    const lane = page.locator('#view g.cluster').filter({ hasText: '経理' }).last();
    const box = await lane.boundingBox();
    if (!box) throw new Error('lane missing');
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 8);
    await expect(page.getByTestId(TID.selectionOutline)).toHaveAttribute('data-selected', '経理');

    await insert(page, 'rect');
    await expect
      .poll(() => stored(page))
      .toContain(`subgraph 経理\n    B[請求]\n    n1["${t('canvas.defaultProcess')}"]\n  end`);
    await editPage.checkTextInView(t('canvas.defaultProcess'));

    // Joined after the step selected, in that step's lane.
    await page.locator('#view .node', { hasText: '受注' }).first().click();
    await insert(page, 'diamond');
    await expect
      .poll(() => stored(page))
      .toContain(`A[受注]\n    n2{"${t('canvas.defaultDecision')}"}\n  end`);
    expect(await stored(page)).toContain('A --> n2');
    await editPage.checkTextInView(t('canvas.defaultDecision'));
  });
});
