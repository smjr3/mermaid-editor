import { beforeEach, describe, expect, it, vi } from 'vitest';

// The command registry (selectionCommands.ts) over a flowchart, a swimlane diagram and a
// state diagram: which commands fit a selection, the value the items agree on (or MIXED),
// and what each run writes — through the model, on the real state and mermaid's check.
vi.mock('./notify', () => ({ notify: () => undefined, prompt: () => true }));

const { t } = await import('$/i18n');
const {
  allSelectable,
  availableCommands,
  commandByKey,
  downstream,
  MIXED,
  sameAs,
  selectionCommands
} = await import('./selectionCommands');
const { selectionModel: model } = await import('./selectionModel.svelte');
const { clearSelection, select, selection, selectMany } = await import('./selection.svelte');
const { inputState, updateCode, updateConfig, validatedState } = await import('./state.svelte');

const flow = `flowchart TD
  A[Start] --> B[Middle]
  B --> C[End]
  B --> D{Pick}
  style A fill:#dde9fb,stroke:#3b73c9`;

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
    D{In stock?}
  end
  A --> C
  C -->|yes| D
  D -- no --> A
  D ==> B`;

const states = 'stateDiagram-v2\n  [*] --> s1\n  s1 --> s2\n  s2 --> s3';

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
const keys = () => availableCommands(model).map(({ key }) => key);
// After a run the lists are read again, as the layer does once valid code settles.
const run = async (key: Parameters<typeof commandByKey>[0], value?: string) => {
  await commandByKey(key).run(model, value);
  if (!validatedState.current.errorKind) await model.sync(inputState.code);
};
const current = (key: Parameters<typeof commandByKey>[0]) => commandByKey(key).current?.(model);
const choices = (key: Parameters<typeof commandByKey>[0]) =>
  commandByKey(key).choices?.(model) ?? [];

beforeEach(async () => {
  clearSelection();
  updateConfig('{}');
  await load(flow);
});

describe('the registry', () => {
  it('has every key once, with a label and a kind', () => {
    const all = selectionCommands.map(({ key }) => key);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([
      'addNext',
      'addBranch',
      'connectFrom',
      'rename',
      'fillColor',
      'strokeColor',
      'textColor',
      'shape',
      'textSize',
      'bold',
      'lineStyle',
      'arrowHead',
      'edgeLength',
      'reverse',
      'moveToLane',
      'moveLeft',
      'moveRight',
      'delete',
      'selectSame'
    ]);
    for (const command of selectionCommands) {
      expect(t(command.label)).not.toBe(command.label);
      expect(['action', 'choice']).toContain(command.kind);
      if (command.kind === 'choice') expect(command.choices).toBeDefined();
    }
    expect(commandByKey('delete').shortcut).toBe('Del');
  });

  it('offers nothing with no selection, and never the reserved reorder keys', () => {
    expect(keys()).toEqual([]);
    selectMany([node('A'), node('B'), edge(0)]);
    expect(keys()).not.toContain('moveLeft');
    expect(keys()).not.toContain('moveRight');
  });
});

describe('on a flowchart', () => {
  it('fits one node: the single-only commands too', () => {
    select(node('B'));
    expect(keys()).toEqual([
      'addNext',
      'addBranch',
      'connectFrom',
      'rename',
      'fillColor',
      'strokeColor',
      'textColor',
      'shape',
      'textSize',
      'bold',
      'delete',
      'selectSame'
    ]);
  });

  it('fits several nodes without the single-only ones', () => {
    selectMany([node('A'), node('C')]);
    expect(keys()).toEqual([
      'fillColor',
      'strokeColor',
      'textColor',
      'shape',
      'textSize',
      'bold',
      'delete',
      'selectSame'
    ]);
  });

  it('fits arrows: line, head, length, colour, reverse, delete', () => {
    select(edge(1));
    expect(keys()).toEqual([
      'rename',
      'strokeColor',
      'lineStyle',
      'arrowHead',
      'edgeLength',
      'reverse',
      'delete',
      'selectSame'
    ]);
    selectMany([edge(0), edge(2)]);
    expect(keys()).not.toContain('rename');
    expect(keys()).toContain('lineStyle');
  });

  it('shape: the shared value, MIXED, and one write for all', slow, async () => {
    selectMany([node('A'), node('C')]);
    expect(current('shape')).toBe('rect');
    expect(
      choices('shape')
        .slice(0, 5)
        .map(({ value }) => value)
    ).toEqual(['rect', 'rounded', 'diam', 'circle', 'stadium']);
    expect(choices('shape').length).toBeGreaterThan(50);
    await run('shape', 'hex');
    expect(inputState.code).toContain('A@{ shape: hex, label: "Start" }');
    expect(inputState.code).toContain('C@{ shape: hex, label: "End" }');
    expect(current('shape')).toBe('hex');
    selectMany([node('A'), node('D')]);
    expect(current('shape')).toBe(MIXED);
    await run('shape', 'nonsense');
    expect(inputState.code).not.toContain('nonsense');
  });

  it('fill colour: a swatch for every node, テーマ標準 clears', slow, async () => {
    selectMany([node('A'), node('B')]);
    expect(current('fillColor')).toBe(MIXED);
    expect(choices('fillColor')[0]).toEqual({ label: 'colors.lineDefault', value: 'none' });
    await run('fillColor', 'green');
    expect(inputState.code).toContain('style A fill:#def5e1,stroke:#3f9b52');
    expect(inputState.code).toContain('style B fill:#def5e1,stroke:#3f9b52');
    expect(current('fillColor')).toBe('green');
    await run('fillColor', 'none');
    expect(inputState.code).not.toContain('style A');
    expect(inputState.code).not.toContain('style B');
    expect(current('fillColor')).toBe('none');
  });

  it('stroke colour: a node border and a flowchart arrow in one go', slow, async () => {
    selectMany([node('B'), edge(1)]);
    expect(current('strokeColor')).toBe('none');
    await run('strokeColor', '#d64545');
    expect(inputState.code).toContain('style B stroke:#d64545');
    expect(inputState.code).toContain('linkStyle 1 stroke:#d64545');
    expect(current('strokeColor')).toBe('#d64545');
    select(node('A'));
    expect(current('strokeColor')).toBe('#3b73c9');
  });

  it('text colour, size and bold over several nodes', slow, async () => {
    selectMany([node('B'), node('C')]);
    expect(current('textSize')).toBe('normal');
    expect(current('bold')).toBe('false');
    await run('textColor', '#3f9b52');
    expect(inputState.code).toContain('style B color:#3f9b52');
    expect(inputState.code).toContain('style C color:#3f9b52');
    await run('textSize', 'large');
    expect(current('textSize')).toBe('large');
    expect(inputState.code).toMatch(/style B [^\n]*font-size:18px/);
    expect(inputState.code).toMatch(/style C [^\n]*font-size:18px/);
    await run('bold');
    expect(current('bold')).toBe('true');
    expect(inputState.code).toMatch(/style C [^\n]*font-weight:bold/);
    // One bold, one not: pressing makes both bold; all bold: pressing clears both.
    select(node('B'));
    await run('bold');
    selectMany([node('B'), node('C')]);
    expect(current('bold')).toBe(MIXED);
    await run('bold');
    expect(current('bold')).toBe('true');
    await run('bold');
    expect(current('bold')).toBe('false');
    expect(inputState.code).not.toContain('font-weight');
  });

  it('line style, arrowhead and length over several arrows', slow, async () => {
    selectMany([edge(0), edge(2)]);
    expect(current('lineStyle')).toBe('solid');
    expect(choices('lineStyle').map(({ value }) => value)).toEqual([
      'solid',
      'dotted',
      'thick',
      'invisible'
    ]);
    await run('lineStyle', 'dotted');
    expect(inputState.code).toContain('A[Start] -.-> B[Middle]');
    expect(inputState.code).toContain('B -.-> D{Pick}');
    expect(current('lineStyle')).toBe('dotted');
    expect(choices('arrowHead').map(({ value }) => value)).toEqual(['end', 'both', 'none']);
    await run('arrowHead', 'both');
    expect(inputState.code).toContain('A[Start] <-.-> B[Middle]');
    expect(inputState.code).toContain('B <-.-> D{Pick}');
    expect(current('arrowHead')).toBe('both');
    expect(choices('edgeLength').map(({ value }) => value)).toEqual(['1', '2', '3', '4']);
    expect(current('edgeLength')).toBe('1');
    await run('edgeLength', '3');
    expect(inputState.code).toContain('A[Start] <-...-> B[Middle]');
    expect(current('edgeLength')).toBe('3');
    selectMany([edge(0), edge(1)]);
    expect(current('lineStyle')).toBe(MIXED);
    expect(current('arrowHead')).toBe(MIXED);
    expect(current('edgeLength')).toBe(MIXED);
  });

  it('an invisible arrow among the selection takes 矢じり away', slow, async () => {
    select(edge(1));
    await run('lineStyle', 'invisible');
    expect(inputState.code).toContain('B ~~~ C[End]');
    selectMany([edge(0), edge(1)]);
    expect(keys()).not.toContain('arrowHead');
    expect(keys()).toContain('lineStyle');
  });

  it(
    'reverse turns every selected arrow round, skipping one whose opposite exists',
    slow,
    async () => {
      selectMany([edge(1), edge(2)]);
      await run('reverse');
      expect(inputState.code).toContain('C[End] --> B');
      expect(inputState.code).toContain('D{Pick} --> B');
      // The single case is the model's own (with its duplicate check).
      await load('flowchart TD\n  A --> B\n  B --> A\n  B --> C');
      select(edge(0));
      await run('reverse');
      expect(model.warning).toBe(t('sel.reverseDuplicate'));
      expect(inputState.code).toBe('flowchart TD\n  A --> B\n  B --> A\n  B --> C');
      selectMany([edge(0), edge(2)]);
      await run('reverse');
      expect(inputState.code).toBe('flowchart TD\n  A --> B\n  B --> A\n  C --> B');
      selectMany([edge(0), edge(1)]);
      await run('reverse');
      expect(model.warning).toBe(t('sel.reverseDuplicate'));
    }
  );

  it('delete removes every selected item at once', slow, async () => {
    selectMany([node('C'), edge(2), node('D')]);
    await run('delete');
    expect(inputState.code).toBe(
      'flowchart TD\n  A[Start] --> B[Middle]\n  style A fill:#dde9fb,stroke:#3b73c9'
    );
    expect(selection.items).toEqual([]);
  });

  it('the single-only commands act on the one selection', slow, async () => {
    select(node('C'));
    await run('rename');
    expect(selection.renaming).toBe(true);
    await run('connectFrom');
    expect(selection.connectFrom).toBe('C');
    await run('addNext');
    await vi.waitFor(() => expect(inputState.code).toContain('C --> n1'), { timeout: 10_000 });
    await vi.waitFor(() => expect(selection.current).toEqual(node('n1')));
    await run('addBranch');
    await vi.waitFor(() => expect(inputState.code).toContain('C --> n2'), { timeout: 10_000 });
  });

  it('refuses every edit while the code is broken', slow, async () => {
    selectMany([node('A'), node('B'), edge(0)]);
    const broken = `${flow}\n  B -->`;
    updateCode(broken);
    await vi.waitFor(() => expect(validatedState.current.code).toBe(broken), { timeout: 10_000 });
    for (const [key, value] of [
      ['shape', 'hex'],
      ['fillColor', 'red'],
      ['strokeColor', '#d64545'],
      ['textColor', '#d64545'],
      ['textSize', 'small'],
      ['bold', undefined],
      ['lineStyle', 'dotted'],
      ['arrowHead', 'none'],
      ['edgeLength', '2'],
      ['reverse', undefined],
      ['delete', undefined]
    ] as const) {
      model.warning = '';
      await run(key, value);
      expect(inputState.code, key).toBe(broken);
      expect(model.warning, key).toBe(t('recover.blocked'));
    }
  });

  it('selects the same shape, the same colour, every arrow and everything downstream', async () => {
    select(node('A'));
    expect(choices('selectSame').map(({ value }) => value)).toEqual([
      'shape',
      'color',
      'lane',
      'edges',
      'downstream'
    ]);
    expect(sameAs(model, 'shape')).toEqual([node('A'), node('B'), node('C')]);
    expect(sameAs(model, 'color')).toEqual([node('A')]);
    // No lanes: every node is in "no lane".
    expect(sameAs(model, 'lane')).toEqual([node('A'), node('B'), node('C'), node('D')]);
    expect(sameAs(model, 'edges')).toEqual([edge(0), edge(1), edge(2)]);
    expect(sameAs(model, 'downstream')).toEqual([
      node('A'),
      edge(0),
      node('B'),
      edge(1),
      node('C'),
      edge(2),
      node('D')
    ]);
    select(node('B'));
    expect(sameAs(model, 'color')).toEqual([node('B'), node('C'), node('D')]);
    expect(sameAs(model, 'downstream')).toEqual([
      node('B'),
      edge(1),
      node('C'),
      edge(2),
      node('D')
    ]);
    await run('selectSame', 'shape');
    expect(selection.items).toEqual([node('A'), node('B'), node('C')]);
    expect(selection.current).toEqual(node('C'));
    await run('selectSame', 'nothing');
    expect(selection.items).toEqual([node('A'), node('B'), node('C')]);
    // On an arrow: only every arrow.
    select(edge(0));
    expect(choices('selectSame').map(({ value }) => value)).toEqual(['edges']);
  });

  it('downstream follows the arrows once round a cycle', () => {
    const edges = [
      { from: 'A', head: 'end', index: 0, label: '', style: 'solid', title: '', to: 'B' },
      { from: 'B', head: 'end', index: 1, label: '', style: 'solid', title: '', to: 'A' },
      { from: 'X', head: 'end', index: 2, label: '', style: 'solid', title: '', to: 'A' }
    ] as const;
    expect(downstream([...edges], 'A')).toEqual([node('A'), edge(0), node('B'), edge(1)]);
  });

  it('allSelectable is every object and arrow', () => {
    expect(allSelectable(model)).toEqual([
      node('A'),
      node('B'),
      node('C'),
      node('D'),
      edge(0),
      edge(1),
      edge(2)
    ]);
  });
});

describe('on a swimlane diagram', () => {
  beforeEach(() => load(lanes));

  it('moves several nodes to a lane, and shows the lane they share', slow, async () => {
    selectMany([node('A'), node('B')]);
    expect(keys()).toContain('moveToLane');
    expect(current('moveToLane')).toBe('Customer');
    expect(choices('moveToLane')).toEqual([
      { label: 'edit.noLane', value: '' },
      { text: 'Customer', value: 'Customer' },
      { text: 'Shop', value: 'Shop' }
    ]);
    await run('moveToLane', 'Shop');
    expect(inputState.code).toContain(
      '  subgraph Shop\n    C[Accept order]\n    D{In stock?}\n    A[Place order]\n    B[Receive goods]\n  end'
    );
    expect(current('moveToLane')).toBe('Shop');
    selectMany([node('A'), node('C')]);
    expect(current('moveToLane')).toBe('Shop');
    await run('moveToLane', '');
    expect(current('moveToLane')).toBe('');
    selectMany([node('A'), node('D')]);
    expect(current('moveToLane')).toBe(MIXED);
  });

  it('a lane is not moved, but can be coloured and deleted', () => {
    select(node('Shop'));
    expect(keys()).not.toContain('moveToLane');
    expect(keys()).not.toContain('shape');
    expect(keys()).toContain('fillColor');
    expect(keys()).toContain('delete');
    selectMany([node('Shop'), node('A')]);
    expect(keys()).not.toContain('moveToLane');
  });

  it('selects the same lane: the nodes of a lane, or a lane with its members', () => {
    select(node('A'));
    expect(sameAs(model, 'lane')).toEqual([node('A'), node('B')]);
    select(node('Shop'));
    expect(choices('selectSame').map(({ value }) => value)).toContain('lane');
    expect(sameAs(model, 'lane')).toEqual([node('Shop'), node('C'), node('D')]);
    expect(sameAs(model, 'shape')).toEqual([]);
    expect(sameAs(model, 'downstream')).toEqual([]);
    select(node('D'));
    expect(sameAs(model, 'shape')).toEqual([node('D')]);
  });
});

describe('on a state diagram', () => {
  beforeEach(() => load(states));

  it('offers what the type can write, and nothing of a flowchart’s', () => {
    select(node('s1'));
    expect(keys()).toContain('addNext');
    expect(keys()).toContain('rename');
    expect(keys()).toContain('delete');
    expect(keys()).toContain('fillColor');
    expect(keys()).not.toContain('shape');
    expect(keys()).not.toContain('moveToLane');
    expect(keys()).not.toContain('edgeLength');
    select(edge(1));
    expect(keys()).toContain('reverse');
    expect(keys()).toContain('delete');
    expect(keys()).not.toContain('lineStyle');
    expect(keys()).not.toContain('arrowHead');
    expect(keys()).not.toContain('strokeColor');
    expect(keys()).not.toContain('edgeLength');
  });

  it('colours and deletes several states in one step', slow, async () => {
    selectMany([node('s1'), node('s2')]);
    await run('fillColor', 'purple');
    expect(inputState.code).toContain('style s1 fill:#ece2fb,stroke:#7d55c7');
    expect(inputState.code).toContain('style s2 fill:#ece2fb,stroke:#7d55c7');
    expect(current('fillColor')).toBe('purple');
    selectMany([edge(1), node('s3')]);
    await run('delete');
    expect(inputState.code).toBe(
      'stateDiagram-v2\n  [*] --> s1\n  style s1 fill:#ece2fb,stroke:#7d55c7,color:#1f2329\n  style s2 fill:#ece2fb,stroke:#7d55c7,color:#1f2329'
    );
  });

  it('selects everything downstream of a state', () => {
    select(node('s1'));
    expect(sameAs(model, 'downstream')).toEqual([
      node('s1'),
      edge(1),
      node('s2'),
      edge(2),
      node('s3')
    ]);
    expect(sameAs(model, 'edges')).toEqual([edge(0), edge(1), edge(2)]);
  });
});
