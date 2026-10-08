import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// R01: an Edit card change computed from one code must not be written after the
// code changed while mermaid was checking it. `checkEdit` is held pending so the
// test can type "into the editor" (updateCode) in the meantime.
const pending = vi.hoisted(() => ({ resolve: undefined as ((ok: boolean) => void) | undefined }));
vi.mock('$/util/diagramModify', async (original) => ({
  ...(await original<typeof import('$/util/diagramModify')>()),
  checkEdit: () =>
    new Promise<boolean>((resolve) => {
      pending.resolve = resolve;
    })
}));
vi.mock('$/util/notify', () => ({ notify: () => undefined, prompt: () => true }));

const { default: EditControls } = await import('./EditControls.svelte');
const { TID } = await import('$/constants');
const { inputState, updateCode, validatedState } = await import('$/util/state.svelte');

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

/** Renames the first object (A, "Alpha") through the card. */
const rename = async (name: string) => {
  (await find<HTMLElement>(TID.editCard)).click();
  // The card follows the settled code, which may still be the previous test's.
  const input = await find<HTMLInputElement>(TID.editRenameInput, (element) =>
    expect(element.value).toBe('Alpha')
  );
  input.value = name;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  (await find<HTMLButtonElement>(TID.editRenameButton)).click();
  await vi.waitFor(() => expect(pending.resolve).toBeDefined());
};

let component: ReturnType<typeof mount> | undefined;
beforeEach(async () => {
  pending.resolve = undefined;
  updateCode(flow);
  await settled();
});
afterEach(() => {
  if (component) void unmount(component);
  component = undefined;
  document.body.innerHTML = '';
});

describe('EditControls (R01)', () => {
  it('drops a rename when the code changed while it was being checked', async () => {
    component = mount(EditControls, { target: document.body });
    await rename('Renamed');
    // A keystroke arrives while mermaid checks the edit.
    updateCode(typed);
    pending.resolve?.(true);
    await find(TID.editMessage);
    expect(inputState.code).toBe(typed);
  }, 20_000);

  it('applies the rename when the code did not change meanwhile', async () => {
    component = mount(EditControls, { target: document.body });
    await rename('Renamed');
    pending.resolve?.(true);
    await vi.waitFor(() => expect(inputState.code).toContain('A["Renamed"]'));
  }, 20_000);
});
