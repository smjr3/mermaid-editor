import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// R01 (ported from the Edit card's test): a rename typed into the inspector's 名前 field,
// computed from one code, must not be written after the code changed while mermaid was
// checking it. `checkEdit` is held pending so the test can type "into the editor"
// (updateCode) in the meantime.
const pending = vi.hoisted(() => ({ resolve: undefined as ((ok: boolean) => void) | undefined }));
vi.mock('$/util/diagramModify', async (original) => ({
  ...(await original<typeof import('$/util/diagramModify')>()),
  checkEdit: () =>
    new Promise<boolean>((resolve) => {
      pending.resolve = resolve;
    })
}));
vi.mock('$/util/notify', () => ({ notify: () => undefined, prompt: () => true }));

const { default: Inspector } = await import('./Inspector.svelte');
const { TID } = await import('$/constants');
const { inputState, updateCode, validatedState } = await import('$/util/state.svelte');
const { clearSelection, select, selection } = await import('$/util/selection.svelte');
const { selectionModel } = await import('$/util/selectionModel.svelte');

const flow = 'flowchart TD\n  A[Alpha] --> B[Beta]';
const typed = 'flowchart TD\n  A[Alpha] --> B[Beta]\n  B --> C[Gamma]';

const settled = () =>
  vi.waitFor(() => expect(validatedState.current.code).toBe(inputState.code), {
    timeout: 10_000
  });

const find = <T extends HTMLElement>(testId: string, check?: (element: T) => void) =>
  vi.waitFor(
    () => {
      flushSync();
      const found = document.querySelector<T>(`[data-testid="${testId}"]`);
      expect(found).toBeTruthy();
      check?.(found as T);
      return found as T;
    },
    { timeout: 10_000 }
  );

/** Renames the selected node (A, "Alpha") through the 名前 field, then presses Enter. */
const rename = async (name: string) => {
  const input = await find<HTMLInputElement>(TID.inspName, (element) =>
    expect(element.value).toBe('Alpha')
  );
  // A click into the field opens the rename (the selection's draft).
  input.focus();
  flushSync();
  await vi.waitFor(() => expect(selection.renaming).toBe(true));
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
  flushSync();
  await vi.waitFor(() => expect(pending.resolve).toBeDefined());
};

let component: ReturnType<typeof mount> | undefined;
beforeEach(async () => {
  pending.resolve = undefined;
  clearSelection();
  updateCode(flow);
  await settled();
  await selectionModel.sync(flow);
  select({ id: 'A', type: 'node' });
});
afterEach(() => {
  if (component) void unmount(component);
  component = undefined;
  clearSelection();
  document.body.innerHTML = '';
});

describe('Inspector rename (R01)', () => {
  it('drops a rename when the code changed while it was being checked', async () => {
    component = mount(Inspector, { props: { oncollapse: () => undefined }, target: document.body });
    await rename('Renamed');
    // A keystroke arrives while mermaid checks the edit.
    updateCode(typed);
    pending.resolve?.(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(inputState.code).toBe(typed);
  }, 20_000);

  it('applies the rename when the code did not change meanwhile', async () => {
    component = mount(Inspector, { props: { oncollapse: () => undefined }, target: document.body });
    await rename('Renamed');
    pending.resolve?.(true);
    await vi.waitFor(() => expect(inputState.code).toContain('A["Renamed"]'));
    expect(selection.renaming).toBe(false);
  }, 20_000);
});
