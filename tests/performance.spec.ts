import { C, defaultState } from '$/constants';
import { serializeState } from '$/util/serde';
import type { Page } from '@playwright/test';
import { expect, test } from './test';

// Guards against the "rendering sometimes becomes extremely slow" regressions:
// every edit queuing a render of its own, a slow render deferring the next by a
// second, and an older render landing over a newer picture. Thresholds are loose
// (CI machines are slow); what they catch is the seconds-long backlog.

const flowchart = (nodes: number, marker = 'Node'): string => {
  const lines = ['flowchart TD'];
  for (let index = 0; index < nodes; index++) lines.push(`  n${index}[${marker} ${index}]`);
  for (let index = 1; index < nodes; index++) {
    lines.push(`  n${Math.floor((index - 1) / 2)} --> n${index}`);
  }
  return lines.join('\n');
};

const renderCount = async (page: Page): Promise<number> =>
  Number(await page.locator('#view').getAttribute('data-render-count'));

/** Waits until no new picture has been placed for `quiet` ms. */
const settled = async (page: Page, quiet = 1500): Promise<number> => {
  let count = await renderCount(page);
  let since = Date.now();
  while (Date.now() - since < quiet) {
    await page.waitForTimeout(100);
    const next = await renderCount(page);
    if (next !== count) {
      count = next;
      since = Date.now();
    }
  }
  return count;
};

const openWith = async (page: Page, code: string) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, 'true');
  }, C.editorChooserDismissedKey);
  await page.goto('about:blank');
  await page.goto(`/edit#${serializeState({ ...defaultState, code })}`);
  await expect(page.locator('#view svg').first()).toBeVisible({ timeout: 30_000 });
};

/** Puts the cursor at the end of the code, on a new comment line. */
const commentLine = async (page: Page) => {
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('%%');
};

test.describe('rendering performance', () => {
  test('typing into a 100-node flowchart updates the picture promptly', async ({ page }) => {
    test.slow();
    await openWith(page, flowchart(100));
    await settled(page);
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('  n99 --> Fresh[Typed]', { delay: 15 });
    const typed = Date.now();
    await expect(page.locator('#view svg')).toContainText('Typed', { timeout: 15_000 });
    // Generous for CI (a render of this diagram takes about a second); the backlog of
    // queued renders this guards against took over ten seconds.
    expect(Date.now() - typed).toBeLessThan(5000);
  });

  test('a burst of 20 keystrokes renders once', async ({ page }) => {
    test.slow();
    await openWith(page, flowchart(30));
    await commentLine(page);
    const before = await settled(page);
    // The picture count when each key arrived, read in the page (a key is only sent once
    // the page has handled the previous one, so a busy CI machine stretches the gaps).
    await page.evaluate(() => {
      const view = document.querySelector('#view');
      document.addEventListener(
        'keydown',
        () => {
          (window as unknown as { atKey: number }).atKey = Number(
            view?.getAttribute('data-render-count')
          );
        },
        true
      );
    });
    await page.keyboard.type('abcdefghijklmnopqrst', { delay: 10 });
    const after = await settled(page);
    const atLastKey = await page.evaluate(() => (window as unknown as { atKey: number }).atKey);
    // Exactly one picture after the last key: no queue of renders for the keys before it.
    expect(after - atLastKey).toBe(1);
    // Normally one in all; a loaded machine's gaps between keys may let one more through.
    expect(after - before).toBeLessThanOrEqual(2);
    await expect(page.locator('.monaco-editor .view-lines')).toContainText(
      '%%abcdefghijklmnopqrst'
    );
  });

  test('panning and zooming do not re-render the diagram', async ({ page }) => {
    await openWith(page, flowchart(30));
    const before = await settled(page);
    const box = await page.locator('#view').boundingBox();
    if (!box) throw new Error('no view');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let step = 0; step < 10; step++) {
      await page.mouse.move(box.x + box.width / 2 + step * 10, box.y + box.height / 2 + step * 5);
    }
    await page.mouse.up();
    await page.mouse.wheel(0, -200);
    expect(await settled(page)).toBe(before);
  });

  test('an older, slower render never replaces a newer picture', async ({ page }) => {
    test.slow();
    await openWith(page, flowchart(10, 'Start'));
    await settled(page);
    // Every picture placed from now on, in order.
    await page.evaluate(() => {
      const placed: string[] = [];
      (window as unknown as { placed: string[] }).placed = placed;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeName.toLowerCase() === 'svg') placed.push(node.textContent ?? '');
          }
        }
      }).observe(document.querySelector('#container') as Node, { childList: true });
    });
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();
    await page.keyboard.press('Control+A');
    // A large diagram that takes a while, then at once a small one.
    await page.keyboard.insertText(flowchart(150, 'Stale'));
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('flowchart LR\n  A[Fresh] --> B[Picture]');
    await expect(page.locator('#view svg')).toContainText('Fresh', { timeout: 20_000 });
    await settled(page, 2500);
    await expect(page.locator('#view svg')).toContainText('Fresh');
    const placed = await page.evaluate(() => (window as unknown as { placed: string[] }).placed);
    expect(placed.at(-1)).toContain('Fresh');
    const fresh = placed.findIndex((text) => text.includes('Fresh'));
    expect(placed.slice(fresh).some((text) => text.includes('Stale'))).toBe(false);
  });

  test('fast typing during a slow render is never undone in the editor', async ({ page }) => {
    test.slow();
    await openWith(page, flowchart(150));
    await settled(page);
    await commentLine(page);
    await page.keyboard.type(' the quick brown fox jumps', { delay: 5 });
    await settled(page);
    await expect(page.locator('.monaco-editor .view-lines')).toContainText(
      '%% the quick brown fox jumps'
    );
  });
});
