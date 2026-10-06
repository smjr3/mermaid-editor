import { TID } from '$/constants';
import { expect, type Page } from '@playwright/test';

// What must hold after every user action, whatever order the actions came in:
// the code parses and the diagram is drawn, nothing logged an error, at most one
// dialog is open, focus is not lost in a removed element, the tools pane has no
// empty dropdown, the tools left nothing dangling in the code, and the undo button
// steps back to exactly the code before the action (and redo forward again).
// Shared by tests/contradictions.spec.ts and tests/monkey.spec.ts.

export const urlFor = (code: string) =>
  `/edit#base64:${Buffer.from(JSON.stringify({ code, mermaid: '{}' })).toString('base64')}`;

export const readCode = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('codeStore') ?? '{}') as { code: string }).code
  );

/** Collects console errors and unhandled rejections from the moment it is called. */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    // The fixture's init script runs on about:blank too, which has no storage.
    if (page.url() === 'about:blank') return;
    errors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // A failed resource load is the network's, not the app's (e.g. favicon in preview).
    if (/Failed to load resource/.test(text)) return;
    // mermaid logs every parse of half-typed code; the error banner check covers real breakage.
    if (/Parse error|Lexical error|Syntax error|No diagram type detected/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
};

/** Ids a flowchart's `style` / `class` / `click` lines name that no other line mentions. */
export const danglingReferences = (code: string): string[] => {
  const lines = code.split('\n');
  const dangling: string[] = [];
  for (const [index, line] of lines.entries()) {
    const match = /^\s*(?:style|click)\s+([^\s,]+)/.exec(line);
    if (!match) continue;
    const id = match[1];
    const escaped = id.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
    const used = new RegExp(String.raw`(^|[^\w])${escaped}([^\w]|$)`);
    const elsewhere = lines.some(
      (other, at) => at !== index && !/^\s*(?:style|click)\s/.test(other) && used.test(other)
    );
    if (!elsewhere) dangling.push(line.trim());
  }
  return dangling;
};

/** Lines that appear twice (block ends, directions and comments aside). */
export const duplicatedLines = (code: string): string[] => {
  const seen = new Set<string>();
  const duplicated: string[] = [];
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    // Block ends and directions repeat legitimately.
    if (!line || /^(?:end|}|---|direction\s+\w+|%%.*)$/.test(line)) continue;
    if (seen.has(line)) duplicated.push(line);
    seen.add(line);
  }
  return duplicated;
};

export interface InvariantOptions {
  /** The code before the action, to check that undo restores it (skipped when undefined). */
  before?: string;
  /** False for an action that was itself an undo or redo, which the check would step past. */
  checkUndo?: boolean;
  /**
   * How many undo steps the action may take back: 2 when it also applied a rename
   * left open (a click elsewhere applies the typed name, then does its own edit).
   */
  undoSteps?: number;
  /** Skip the "at least one node" check (an action that legitimately empties the diagram). */
  allowEmpty?: boolean;
  /** Whether to check duplicated lines (only meaningful for flowcharts built by the tools). */
  duplicates?: boolean;
  /**
   * Count only the duplicated and dangling lines the action added, compared with
   * `before` (a loaded sample may have its own).
   */
  baseline?: boolean;
  label?: string;
}

const settle = async (page: Page) => {
  // The view renders after a debounce and an async parse.
  await page.waitForTimeout(300);
};

/** Asserts every invariant; returns the code it saw. */
export const assertInvariants = async (
  page: Page,
  errors: string[],
  {
    before,
    allowEmpty = false,
    baseline = false,
    checkUndo = true,
    duplicates = true,
    undoSteps = 1,
    label = ''
  }: InvariantOptions = {}
): Promise<string> => {
  const where = label ? ` [${label}]` : '';
  await settle(page);
  const code = await readCode(page);

  await expect(page.getByTestId(TID.errorContainer), `error banner${where}`).toBeHidden({
    timeout: 8000
  });
  if (!allowEmpty) {
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const svg = document.querySelector('#view svg');
            if (!svg) return 0;
            // Hand-drawn mode redraws everything as paths, without the classes.
            return svg.querySelectorAll('g.node, text, path, rect').length;
          }),
        { intervals: [50, 100, 250], message: `drawn nodes${where}`, timeout: 8000 }
      )
      .toBeGreaterThan(0);
  }
  expect(errors, `console errors${where}`).toEqual([]);

  const state = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(
      visible
    ).length;
    const active = document.activeElement;
    const focusOk = !active || active.isConnected;
    const emptySelects = [...document.querySelectorAll('.tools-pane select')]
      .filter(visible)
      .filter((select) => (select as HTMLSelectElement).options.length === 0)
      .map((select) => (select as HTMLElement).dataset.testid ?? select.id ?? 'select');
    return { dialogs, emptySelects, focusOk };
  });
  expect(state.dialogs, `open dialogs${where}`).toBeLessThanOrEqual(1);
  expect(state.focusOk, `focus in a removed element${where}`).toBe(true);
  expect(state.emptySelects, `empty dropdowns${where}`).toEqual([]);

  const added = (found: (code: string) => string[]) => {
    const old = baseline && before !== undefined ? found(before) : [];
    return found(code).filter((line) => !old.includes(line));
  };
  expect(added(danglingReferences), `dangling style/click lines${where}`).toEqual([]);
  if (duplicates) expect(added(duplicatedLines), `duplicated lines${where}`).toEqual([]);

  if (checkUndo && before !== undefined && before !== code) {
    const undo = page.getByTestId(TID.undoButton);
    if (await undo.isVisible()) {
      const fast = { intervals: [50, 100, 250] };
      let steps = 0;
      for (; steps < undoSteps; steps++) {
        await expect(undo, `undo offered${where}`).toBeEnabled({ timeout: 2000 });
        const was = await readCode(page);
        await undo.click();
        await expect.poll(() => readCode(page), fast).not.toBe(was);
        if ((await readCode(page)) === before) break;
      }
      await expect.poll(() => readCode(page), { ...fast, message: `undo${where}` }).toBe(before);
      for (let step = 0; step <= Math.min(steps, undoSteps - 1); step++) {
        await expect(page.getByTestId(TID.redoButton), `redo offered${where}`).toBeEnabled({
          timeout: 2000
        });
        await page.getByTestId(TID.redoButton).click();
        await page.waitForTimeout(100);
      }
      await expect.poll(() => readCode(page), { ...fast, message: `redo${where}` }).toBe(code);
      await settle(page);
    }
  }
  return code;
};
