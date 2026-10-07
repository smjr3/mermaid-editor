import { beforeEach, describe, expect, it, vi } from 'vitest';

const notified = vi.hoisted(() => [] as string[]);
vi.mock('./notify', () => ({
  notify: (message: string) => notified.push(message),
  prompt: () => true
}));

// R01: `checkEdit` can be held pending, so a test can change the code meanwhile.
const held = vi.hoisted(() => ({
  on: false,
  resolve: undefined as ((ok: boolean) => void) | undefined
}));
vi.mock('./diagramModify', async (original) => {
  const actual = await original<typeof import('./diagramModify')>();
  return {
    ...actual,
    checkEdit: (before: string, next: string) =>
      held.on
        ? new Promise<boolean>((resolve) => {
            held.resolve = resolve;
          })
        : actual.checkEdit(before, next)
  };
});

const {
  applyToolEdit,
  codeHealth,
  describe: describeError,
  editsBlocked,
  revertToLastValid
} = await import('./codeHealth.svelte');
const { defaultState, inputState, lastValid, updateCode, updateConfig, validatedState } =
  await import('./state.svelte');

const settled = () =>
  vi.waitFor(
    () => {
      expect(validatedState.current.code).toBe(inputState.code);
      expect(validatedState.current.mermaid).toBe(inputState.mermaid);
    },
    { timeout: 10_000 }
  );
const slow = { timeout: 15_000 };

const valid = 'flowchart TD\n  A[Start] --> B[End]';
const broken = 'flowchart TD\n  A[Start] --> B[End]\n  B -->';

beforeEach(async () => {
  held.on = false;
  held.resolve = undefined;
  notified.length = 0;
  updateConfig('{}');
  updateCode(valid);
  await settled();
});

describe('code health', () => {
  it('remembers the last code that parsed', slow, async () => {
    expect(lastValid.code).toBe(valid);
    expect(codeHealth.broken).toBe(false);
    updateCode(broken);
    await settled();
    expect(codeHealth.broken).toBe(true);
    expect(lastValid.code).toBe(valid);
    expect(codeHealth.canRevert).toBe(true);
  });

  it('describes the mistake with its line, in the UI language', slow, async () => {
    updateCode(broken);
    await settled();
    expect(codeHealth.description).toEqual({ key: 'recover.unfinished', line: 3 });
    expect(describeError(codeHealth.description ?? { key: 'recover.unknown' })).toContain('3');
  });

  it('treats a config error as the config, not the code', slow, async () => {
    updateConfig('{ not json');
    await settled();
    expect(codeHealth.broken).toBe(false);
    expect(codeHealth.configBroken).toBe(true);
    expect(lastValid.code).toBe(valid);
    expect(editsBlocked()).toBe(false);
  });

  it('blocks tool edits only while the code is broken, and says why', slow, async () => {
    expect(editsBlocked()).toBe(false);
    expect(notified).toEqual([]);
    updateCode(broken);
    await settled();
    expect(editsBlocked()).toBe(true);
    expect(notified).toHaveLength(1);
  });

  it('reverts to the last valid code as one step', slow, async () => {
    updateCode(broken);
    await settled();
    revertToLastValid();
    expect(inputState.code).toBe(valid);
    await settled();
    expect(codeHealth.broken).toBe(false);
    expect(codeHealth.canRevert).toBe(false);
    expect(notified).toHaveLength(1);
  });

  it('treats empty code as broken', slow, async () => {
    updateCode('');
    await settled();
    expect(codeHealth.broken).toBe(true);
    expect(codeHealth.description).toEqual({ key: 'recover.empty' });
  });

  it('keeps the newest result when validations finish out of order', slow, async () => {
    updateCode(broken);
    updateCode(valid);
    await settled();
    expect(codeHealth.broken).toBe(false);
    expect(defaultState.code).not.toBe(valid);
  });

  it('drops a tool edit when the code changed while it was checked (R01)', slow, async () => {
    held.on = true;
    const edited = `${valid}\n  B --> C[More]`;
    const typed = `${valid}\n  B --> D[Typed]`;
    const result = applyToolEdit(edited);
    await vi.waitFor(() => expect(held.resolve).toBeDefined());
    updateCode(typed);
    held.resolve?.(true);
    expect(await result).toBe('stale');
    expect(inputState.code).toBe(typed);
  });

  it('applies a tool edit when the code did not change meanwhile', slow, async () => {
    held.on = true;
    const edited = `${valid}\n  B --> C[More]`;
    const result = applyToolEdit(edited);
    await vi.waitFor(() => expect(held.resolve).toBeDefined());
    held.resolve?.(true);
    expect(await result).toBe('applied');
    expect(inputState.code).toBe(edited);
  });

  it('still refuses an edit mermaid rejects', slow, async () => {
    held.on = true;
    const result = applyToolEdit(`${valid}\n  B -->`);
    await vi.waitFor(() => expect(held.resolve).toBeDefined());
    held.resolve?.(false);
    expect(await result).toBe('refused');
    expect(inputState.code).toBe(valid);
  });
});
