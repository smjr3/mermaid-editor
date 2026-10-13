import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { headerOnly, insertLane, insertPlace, insertShape, isDecision } from './insertActions';

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C
  style Shop fill:#dde9fb,stroke:#3b73c9,color:#1f2329`;
const flow = 'flowchart TD\n  A[Start] --> B[Middle]';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

describe('insertPlace', () => {
  it('joins from a selected node, in its lane', () => {
    expect(insertPlace(lanes, { id: 'C', label: 'Accept order' })).toEqual({
      from: 'C',
      kind: 'after',
      lane: 'Shop'
    });
    expect(insertPlace(flow, { id: 'B', label: 'Middle' })).toEqual({ from: 'B', kind: 'after' });
  });

  it('goes into a selected lane, and stands alone without a selection', () => {
    expect(insertPlace(lanes, { group: true, id: 'Customer', label: 'Customer' })).toEqual({
      kind: 'in',
      lane: 'Customer'
    });
    expect(insertPlace(lanes, undefined)).toEqual({ kind: 'alone' });
  });
});

describe('insertShape', () => {
  it('adds a decision after the selected node, in the same lane, before the styles', async () => {
    const added = insertShape(lanes, 'diamond', '在庫あり?', { id: 'C', label: 'Accept order' });
    expect(added.id).toBe('n1');
    expect(added.name).toBe('在庫あり?');
    expect(added.code).toContain(
      '  subgraph Shop\n    C[Accept order]\n    n1{"在庫あり?"}\n  end'
    );
    expect(added.code).toContain('  A --> C\n  C --> n1\n  style Shop');
    expect(await typeOf(added.code)).toBe(await typeOf(lanes));
  });

  it('adds a shape into a selected lane, joined to nothing', async () => {
    const added = insertShape(lanes, 'stadium', '開始', {
      group: true,
      id: 'Customer',
      label: 'Customer'
    });
    expect(added.code).toContain(
      '  subgraph Customer\n    A[Place order]\n    n1(["開始"])\n  end'
    );
    expect(added.code).not.toContain('--> n1');
    expect(await typeOf(added.code)).toBe(await typeOf(lanes));
  });

  it('adds a standalone shape when nothing is selected', async () => {
    const added = insertShape(flow, 'rect', '新しい処理');
    expect(added.code).toBe('flowchart TD\n  A[Start] --> B[Middle]\n  n1["新しい処理"]');
    expect(await typeOf(added.code)).toBe('flowchart-v2');
    const circle = insertShape(flow, 'circle', 'x', { id: 'A', label: 'Start' });
    expect(circle.code).toContain('A --> n1');
    expect(circle.code).toContain('n1(("x"))');
  });
});

describe('insertLane', () => {
  it('adds an empty lane that the new shape can then go into', async () => {
    const lane = insertLane(lanes, '配送');
    expect(lane).toMatchObject({ id: 'Lane1', name: '配送' });
    expect(lane.code).toContain('  subgraph Lane1 ["配送"]\n  end\n  style Shop');
    expect(await typeOf(lane.code)).toBe(await typeOf(lanes));
    const node = insertShape(lane.code, 'rect', '梱包', {
      group: true,
      id: 'Lane1',
      label: '配送'
    });
    expect(node.code).toContain('  subgraph Lane1 ["配送"]\n    n1["梱包"]\n  end');
  });
});

describe('isDecision', () => {
  it('knows a flowchart diamond under any of its names, and a state choice', () => {
    const code = `flowchart TD
  A[Start] --> B{OK?}
  C@{ shape: decision, label: "Again?" }
  D@{ shape: rect }`;
    expect(isDecision(code, 'flowchart', { id: 'B', label: 'OK?' })).toBe(true);
    expect(isDecision(code, 'flowchart', { id: 'C', label: 'Again?' })).toBe(true);
    expect(isDecision(code, 'flowchart', { id: 'A', label: 'Start' })).toBe(false);
    expect(isDecision(code, 'flowchart', { id: 'D', label: 'D' })).toBe(false);
    expect(isDecision(code, 'flowchart', { group: true, id: 'B', label: 'OK?' })).toBe(false);
    expect(isDecision(code, 'flowchart', undefined)).toBe(false);
    const states = 'stateDiagram-v2\n  state check <<choice>>\n  [*] --> check\n  check --> s1';
    expect(isDecision(states, 'state', { id: 'check', label: 'check' })).toBe(true);
    expect(isDecision(states, 'state', { id: 's1', label: 's1' })).toBe(false);
    expect(isDecision(states, 'class', { id: 'check', label: 'check' })).toBe(false);
  });
});

describe('headerOnly', () => {
  it('is true for a header with nothing after it', () => {
    expect(headerOnly('mindmap')).toBe(true);
    expect(headerOnly('---\ntitle: x\n---\nkanban\n\n  %% later\n')).toBe(true);
    expect(headerOnly('mindmap\n  root')).toBe(false);
    expect(headerOnly('')).toBe(false);
  });
});
