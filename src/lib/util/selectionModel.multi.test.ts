import { beforeEach, describe, expect, it, vi } from 'vitest';

// The selection model's many-item side (selectionModel.svelte.ts): the lists of what is
// selected, `commonValue`, `applyToAll` (one write for every item) and `removeAll`, on the
// real state and mermaid's own check.
vi.mock('./notify', () => ({ notify: () => undefined, prompt: () => true }));

const { t } = await import('$/i18n');
const { MIXED, isMixed, selectionModel: model } = await import('./selectionModel.svelte');
const { clearSelection, select, selection, selectMany, toggleSelect } =
  await import('./selection.svelte');
const { inputState, updateCode, updateConfig, validatedState } = await import('./state.svelte');
const { setObjectColor } = await import('./colors');
const { swatches } = await import('./colors');

const flow = 'flowchart TD\n  A[Start] --> B[Middle]\n  B --> C[End]\n  B --> D{Pick}';
const broken = 'flowchart TD\n  A[Start] --> B[Middle]\n  B -->';

const settled = () =>
  vi.waitFor(
    () => {
      expect(validatedState.current.code).toBe(inputState.code);
      expect(model.code).toBe(inputState.code);
    },
    { timeout: 10_000 }
  );
const slow = { timeout: 20_000 };

const load = async (code: string) => {
  updateCode(code);
  await model.sync(code);
  await settled();
};

const node = (id: string) => ({ id, type: 'node' }) as const;
const edge = (index: number) => ({ index, type: 'edge' }) as const;

beforeEach(async () => {
  clearSelection();
  updateConfig('{}');
  await load(flow);
});

describe('the selected lists', () => {
  it('lists the selected objects and arrows in the order chosen, the primary last', () => {
    selectMany([node('C'), edge(0), node('A')]);
    expect(model.targets.map(({ selected }) => selected)).toEqual([node('C'), edge(0), node('A')]);
    expect(model.selectedObjects.map(({ id }) => id)).toEqual(['C', 'A']);
    expect(model.selectedEdges.map(({ index }) => index)).toEqual([0]);
    expect(model.object?.id).toBe('A');
    expect(model.edge).toBeUndefined();
    expect(model.multiple).toBe(true);
    select(node('B'));
    expect(model.multiple).toBe(false);
    expect(model.selectedObjects.map(({ id }) => id)).toEqual(['B']);
  });

  it('leaves out an item the lists do not have', () => {
    selectMany([node('ZZZ'), edge(9), node('A')]);
    expect(model.targets).toHaveLength(1);
    expect(model.selectedObjects[0].id).toBe('A');
  });

  it('drops the items the code no longer has after a sync, keeping the rest', slow, async () => {
    selectMany([node('A'), node('D'), edge(2)]);
    await load('flowchart TD\n  A[Start] --> B[Middle]\n  B --> C[End]');
    expect(selection.items).toEqual([node('A')]);
    await load('flowchart TD\n  X[Other]');
    expect(selection.items).toEqual([]);
  });
});

describe('commonValue', () => {
  it('is the value all agree on, MIXED when they differ, undefined with nothing', () => {
    selectMany([node('A'), node('B')]);
    expect(model.commonValue(({ object }) => object && 'same')).toBe('same');
    expect(model.commonValue(({ object }) => object?.id)).toBe(MIXED);
    expect(isMixed(model.commonValue(({ object }) => object?.id))).toBe(true);
    expect(model.commonValue(() => undefined)).toBeUndefined();
    // Items without a value are skipped, not counted as different.
    expect(model.commonValue(({ object }) => (object?.id === 'A' ? 'x' : undefined))).toBe('x');
    // Objects compare by their entries.
    expect(model.commonValue(() => ({ fill: '#fff', stroke: '#000' }))).toEqual({
      fill: '#fff',
      stroke: '#000'
    });
    clearSelection();
    expect(model.commonValue(() => 'x')).toBeUndefined();
  });
});

describe('applyToAll', () => {
  it('runs the rewrite over every item and writes once', slow, async () => {
    selectMany([node('A'), node('C')]);
    const calls: string[] = [];
    const done = await model.applyToAll((code, { object }) => {
      if (!object) return undefined;
      calls.push(object.id);
      return setObjectColor(code, object.id, swatches[0], 'style');
    }, 'ok');
    expect(done).toBe(true);
    expect(calls).toEqual(['A', 'C']);
    expect(inputState.code).toContain('style A fill:#dde9fb');
    expect(inputState.code).toContain('style C fill:#dde9fb');
    expect(model.message).toBe('ok');
    // The code in between: each call sees the one before.
    expect(inputState.code.split('\n').filter((line) => line.includes('style ')).length).toBe(2);
  });

  it('does nothing when every rewrite leaves the code alone', slow, async () => {
    selectMany([node('A'), node('C')]);
    const before = inputState.code;
    expect(await model.applyToAll(() => undefined)).toBe(false);
    expect(await model.applyToAll((code) => code)).toBe(false);
    expect(inputState.code).toBe(before);
  });

  it('refuses a result mermaid no longer reads as the same diagram', slow, async () => {
    selectMany([node('A'), node('C')]);
    expect(await model.applyToAll(() => 'pie\n  "a": 1')).toBe(false);
    expect(inputState.code).toBe(flow);
    expect(model.warning).toBe(t('edit.breaks'));
  });

  it('refuses while the code is broken, and says so over the diagram', slow, async () => {
    selectMany([node('A'), node('C')]);
    updateCode(broken);
    await vi.waitFor(() => expect(validatedState.current.code).toBe(broken), { timeout: 10_000 });
    expect(await model.applyToAll((code) => `${code}\n  %% x`)).toBe(false);
    expect(inputState.code).toBe(broken);
    expect(model.warning).toBe(t('recover.blocked'));
  });
});

describe('removeAll', () => {
  it(
    'deletes every selected arrow and object in one write and clears the selection',
    slow,
    async () => {
      // Two arrows (indices 0 and 2) and two nodes; the arrows go first, highest index down.
      selectMany([edge(0), node('C'), edge(2), node('D')]);
      await model.removeAll();
      expect(inputState.code).toBe('flowchart TD\n  A[Start]\n  B[Middle]');
      expect(selection.items).toEqual([]);
      expect(model.message).toBe(t('sel.deletedMany', { count: '4' }));
    }
  );

  it('is what Delete does with several items selected', slow, async () => {
    select(node('C'));
    toggleSelect(node('D'));
    await model.remove();
    expect(inputState.code).toBe('flowchart TD\n  A[Start] --> B[Middle]');
    expect(selection.items).toEqual([]);
  });

  it('skips what cannot go, and refuses while the code is broken', slow, async () => {
    await load('mindmap\n  root((Root))\n    A\n    B');
    const items = model.objects?.items ?? [];
    expect(items[0].noDelete).toBe(true);
    selectMany(items.map(({ id }) => node(id)));
    await model.removeAll();
    expect(inputState.code).toBe('mindmap\n  root((Root))');

    await load(flow);
    selectMany([node('C'), node('D')]);
    updateCode(broken);
    await vi.waitFor(() => expect(validatedState.current.code).toBe(broken), { timeout: 10_000 });
    await model.removeAll();
    expect(inputState.code).toBe(broken);
    expect(model.warning).toBe(t('recover.blocked'));
  });
});
