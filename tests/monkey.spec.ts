import { TID } from '$/constants';
import type { Locator, Page } from '@playwright/test';
import { assertInvariants, readCode, urlFor, watchErrors } from './invariants';
import { test } from './test';

// A monkey test: random UI actions with a fixed seed, the shared invariants
// (tests/invariants.ts) after each one. CI runs a short pass; run it longer
// locally with, for example,
//   MONKEY_ACTIONS=300 MONKEY_SEEDS=1,2,3 pnpm exec playwright test tests/monkey.spec.ts
// A failure prints the seed and the last actions, which replay with the same seed;
// MONKEY_VERBOSE=1 logs every action with the code before it.
const actions = Number(process.env.MONKEY_ACTIONS ?? 60);
const seeds = (process.env.MONKEY_SEEDS ?? '1').split(',').map(Number);

const start = `flowchart TD
  A[Start] -->|yes| B[Middle]
  B --> C[End]
  subgraph lane1[Lane]
    D[Inside]
  end
  C --> D`;

/** mulberry32: small, fast and the same everywhere. */
const random = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const texts = [
  'Step',
  '承認する',
  '',
  '   ',
  'a --> b',
  '[x] (y) {z}',
  'say "hi" #1 ; end',
  '%% note',
  'end',
  'subgraph',
  '😀',
  'x'.repeat(80),
  'a | b & c'
];
const keys = [
  'Enter',
  'Tab',
  'Delete',
  'Backspace',
  'F2',
  'Escape',
  'ArrowDown',
  'ArrowUp',
  'ArrowRight',
  'Control+z',
  'Control+y'
];
const quick = { timeout: 1500 };

// Controls that leave the page, open the file picker or replace the whole state
// in ways that say nothing about the tools (language, share, pack import).
const excluded = [
  TID.toolsRailExpand,
  'icon-pack',
  'import',
  'reset-config',
  'share',
  'download',
  'copy',
  'gitlab',
  'html'
];

/** Visible, enabled elements of a locator, minus the excluded ones. */
const usable = async (locator: Locator) => {
  const found: Locator[] = [];
  for (const element of await locator.all()) {
    const ok = await element
      .evaluate((node, skip) => {
        const html = node as HTMLElement;
        const rect = html.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if ((html as HTMLButtonElement).disabled) return false;
        const id = html.dataset.testid ?? '';
        if (skip.some((part) => id.includes(part))) return false;
        if (html.closest('a, input[type="file"], label:has(input[type="file"])')) return false;
        return !(html as HTMLInputElement).type || (html as HTMLInputElement).type !== 'file';
      }, excluded)
      .catch(() => false);
    if (ok) found.push(element);
  }
  return found;
};

interface Action {
  name: string;
  run: (page: Page, pick: <T>(list: T[]) => T) => Promise<string>;
}

const monkeyActions: Action[] = [
  {
    name: 'click node',
    run: async (page, pick) => {
      const nodes = await usable(page.locator('#view g.node, #view g.cluster .cluster-label'));
      if (nodes.length === 0) return 'no nodes';
      const node = pick(nodes);
      await node.click(quick);
      return (await node.textContent())?.trim().slice(0, 20) ?? '';
    }
  },
  {
    name: 'click arrow label',
    run: async (page, pick) => {
      const labels = await usable(page.locator('#view g.edgeLabel'));
      if (labels.length === 0) return 'no labels';
      await pick(labels).click(quick);
      return '';
    }
  },
  {
    name: 'double-click node',
    run: async (page, pick) => {
      const nodes = await usable(page.locator('#view g.node'));
      if (nodes.length === 0) return 'no nodes';
      await pick(nodes).dblclick(quick);
      return '';
    }
  },
  {
    name: 'click canvas',
    run: async (page) => {
      const box = await page.locator('#view').boundingBox();
      if (!box) return 'no view';
      await page.mouse.click(box.x + 8, box.y + box.height - 8);
      return '';
    }
  },
  {
    name: 'press key',
    run: async (page, pick) => {
      const key = pick(keys);
      await page.keyboard.press(key);
      return key;
    }
  },
  {
    name: 'toolbar button',
    run: async (page, pick) => {
      const buttons = await usable(
        page.locator(`[data-testid="${TID.selectionToolbar}"] button:not([data-testid$="-more"])`)
      );
      if (buttons.length === 0) return 'no toolbar';
      const button = pick(buttons);
      const label = (await button.getAttribute('data-testid')) ?? '';
      await button.click(quick);
      return label;
    }
  },
  {
    name: 'choose option',
    run: async (page, pick) => {
      const selects = await usable(
        page.locator(`[data-testid="${TID.selectionToolbar}"] select, .tools-pane select`)
      );
      if (selects.length === 0) return 'no selects';
      const select = pick(selects);
      const values = await select
        .locator('option:not([disabled])')
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
      if (values.length === 0) return 'empty select';
      const value = pick(values);
      await select.selectOption(value, quick);
      return `${(await select.getAttribute('data-testid')) ?? ''}=${value}`;
    }
  },
  {
    name: 'type text',
    run: async (page, pick) => {
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active.closest('.monaco-editor, .cm-editor')) return false;
        return /^(input|textarea)$/i.test(active.tagName);
      });
      if (!focused) {
        const fields = await usable(
          page.locator(
            `[data-testid="${TID.selectionToolbar}"] input, .tools-pane input[type="text"], .tools-pane input:not([type])`
          )
        );
        if (fields.length === 0) return 'no field';
        await pick(fields).click(quick);
      }
      const text = pick(texts);
      await page.keyboard.press('Control+a');
      await page.keyboard.insertText(text);
      if (pick([true, false])) await page.keyboard.press('Enter');
      return JSON.stringify(text);
    }
  },
  {
    name: 'tools button',
    run: async (page, pick) => {
      const buttons = await usable(
        page.locator('.tools-pane [role="tabpanel"] button, .tools-pane [data-testid$="-card"]')
      );
      if (buttons.length === 0) return 'no buttons';
      const button = pick(buttons);
      const label =
        (await button.getAttribute('data-testid')) ?? (await button.textContent()) ?? '';
      await button.click(quick);
      return label.trim().slice(0, 30);
    }
  },
  {
    name: 'switch tab',
    run: async (page, pick) => {
      const tab = pick(['make', 'fix', 'out']);
      await page.getByTestId(`${TID.toolsTab}-${tab}`).click(quick);
      return tab;
    }
  },
  {
    name: 'undo or redo',
    run: async (page, pick) => {
      const id = pick([TID.undoButton, TID.undoButton, TID.redoButton]);
      const button = page.getByTestId(id);
      if (await button.isDisabled()) return `${id} disabled`;
      await button.click(quick);
      return id;
    }
  },
  {
    name: 'right-click menu',
    run: async (page, pick) => {
      const nodes = await usable(page.locator('#view g.node'));
      if (nodes.length === 0) return 'no nodes';
      await pick(nodes).click({ ...quick, button: 'right' });
      const items = await usable(page.locator(`[data-testid="${TID.contextMenu}"] button`));
      if (items.length === 0) return 'empty menu';
      const item = pick(items);
      const label = (await item.getAttribute('data-testid')) ?? '';
      await item.click(quick);
      return label;
    }
  }
];

for (const seed of seeds) {
  test(`monkey: ${actions} random actions, seed ${seed} @monkey`, async ({ editPage, page }) => {
    test.setTimeout(60_000 + actions * 8000);
    await editPage.start(urlFor(start));
    await editPage.checkTextInView('Middle');
    const errors = watchErrors(page);
    page.on('dialog', (dialog) => void dialog.accept());
    const next = random(seed);
    const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)];
    const log: string[] = [];
    let before = await readCode(page);
    for (let step = 1; step <= actions; step++) {
      const action = pick(monkeyActions);
      const started = Date.now();
      const renaming = await page.getByTestId(TID.selectionRename).isVisible();
      let detail: string;
      try {
        detail = await action.run(page, pick);
      } catch (error) {
        // A control that went away between finding and clicking it: a no-op.
        detail = `skipped (${String(error).split('\n')[0].slice(0, 60)})`;
      }
      log.push(`${step}. ${action.name} ${detail}`);
      if (process.env.MONKEY_VERBOSE) {
        console.log(log.at(-1), Date.now() - started, JSON.stringify(before));
      }
      try {
        before = await assertInvariants(page, errors, {
          baseline: true,
          before,
          checkUndo: !/undo|redo|Control\+[yz]/.test(`${action.name} ${detail}`),
          undoSteps: renaming ? 2 : 1,
          label: `seed ${seed}, step ${step}: ${action.name} ${detail}`
        });
      } catch (error) {
        console.log(`Seed ${seed} failed; the last actions:\n${log.slice(-15).join('\n')}`);
        console.log(`Code:\n${await readCode(page)}`);
        throw error;
      }
    }
  });
}
