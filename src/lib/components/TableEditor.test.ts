import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// R01: an edit computed from one code must not be written after the code changed
// while mermaid was checking it. `checkEdit` is held pending so the test can type
// "into the editor" (updateCode) in the meantime.
const pending = vi.hoisted(() => ({ resolve: undefined as ((ok: boolean) => void) | undefined }));
vi.mock('$/util/diagramModify', async (original) => ({
  ...(await original<typeof import('$/util/diagramModify')>()),
  checkEdit: () =>
    new Promise<boolean>((resolve) => {
      pending.resolve = resolve;
    })
}));
vi.mock('$/util/notify', () => ({ notify: () => undefined, prompt: () => true }));

const { default: TableEditor } = await import('./TableEditor.svelte');
const { inputState, updateCode, validatedState } = await import('$/util/state.svelte');

const pie = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';
const typed = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15';

const settled = () =>
  vi.waitFor(() => expect(validatedState.current.code).toBe(inputState.code), {
    timeout: 10_000
  });

const firstLabelCell = () =>
  vi.waitFor(
    () => {
      flushSync();
      const found = document.querySelector<HTMLInputElement>('input[data-testid$="-label"]');
      // The table follows the settled code, which may still be the previous test's.
      expect(found?.value).toBe('Dogs');
      return found as HTMLInputElement;
    },
    { timeout: 10_000 }
  );

let component: ReturnType<typeof mount> | undefined;
beforeEach(async () => {
  pending.resolve = undefined;
  updateCode(pie);
  await settled();
});
afterEach(() => {
  if (component) void unmount(component);
  component = undefined;
  document.body.innerHTML = '';
});

describe('TableEditor (R01)', () => {
  it('drops a cell change when the code changed while it was being checked', async () => {
    component = mount(TableEditor, { target: document.body });
    const cell = await firstLabelCell();
    cell.value = 'Wolves';
    cell.dispatchEvent(new FocusEvent('blur'));
    await vi.waitFor(() => expect(pending.resolve).toBeDefined());
    // A keystroke arrives while mermaid checks the edit.
    updateCode(typed);
    pending.resolve?.(true);
    await vi.waitFor(() => {
      flushSync();
      expect(document.querySelector('[role="status"]')?.textContent?.trim()).toBeTruthy();
    });
    expect(inputState.code).toBe(typed);
    expect(cell.value).toBe('Dogs');
  }, 20_000);

  it('applies the change when the code did not change meanwhile', async () => {
    component = mount(TableEditor, { target: document.body });
    const cell = await firstLabelCell();
    cell.value = 'Wolves';
    cell.dispatchEvent(new FocusEvent('blur'));
    await vi.waitFor(() => expect(pending.resolve).toBeDefined());
    pending.resolve?.(true);
    await vi.waitFor(() => expect(inputState.code).toContain('"Wolves" : 386'));
  }, 20_000);
});
