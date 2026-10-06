import { describe, expect, it } from 'vitest';
import {
  checkEdit,
  editKind,
  editableEdges,
  editableObjects,
  type EditObject
} from './diagramModify';
import {
  addAfter,
  addedObject,
  addStandalone,
  branchSource,
  canAddAfter,
  canConnect,
  colorSyntaxFor,
  connect,
  neighbour,
  reverseDuplicates
} from './selectionActions';

const objectsOf = async (code: string) => (await editableObjects(code))?.items ?? [];
const object = async (code: string, id: string): Promise<EditObject> => {
  const found = (await objectsOf(code)).find((item) => item.id === id);
  if (!found) throw new Error(`no object ${id}`);
  return found;
};

const samples: [string, string, string][] = [
  ['flowchart', 'flowchart TD\n  A[Start] --> B[End]', 'B'],
  ['swimlane', 'swimlane-beta LR\n  subgraph L1 [Lane]\n    A[One]\n  end', 'A'],
  [
    'architecture',
    'architecture-beta\n  group api(cloud)[API]\n  service db(database)[DB] in api',
    'db'
  ],
  ['state', 'stateDiagram-v2\n  [*] --> s1\n  s1 --> s2', 's2'],
  ['class', 'classDiagram\n  class A', 'A'],
  ['er', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places', 'ORDER'],
  ['c4', 'C4Context\n  Person(p, "Person")', 'p'],
  ['block', 'block-beta\n  a["A"]', 'a'],
  ['sequence', 'sequenceDiagram\n  participant A as Alice', 'A']
];

describe('addAfter', () => {
  it.each(samples)('adds a joined object after one in a %s diagram', async (_, code, id) => {
    const kind = editKind(code);
    if (!kind) throw new Error('no kind');
    const selected = await object(code, id);
    expect(canAddAfter(kind, selected)).toBe(true);
    const added = addAfter(code, kind, selected, '次の工程');
    if (!added) throw new Error('nothing added');
    expect(await checkEdit(code, added.code)).toBe(true);
    const after = await objectsOf(added.code);
    expect(added.id).toBeDefined();
    expect(after.some((item) => item.id === added.id)).toBe(true);
    // Joined: an arrow from the selected object to the new one.
    const edges = (await editableEdges(added.code))?.items ?? [];
    // (C4 and block arrows are not in the Edit card's list: look in the code.)
    if (edges.length > 0) {
      expect(edges.some((edge) => edge.from === id && edge.to === added.id)).toBe(true);
    } else {
      expect(added.code).toMatch(new RegExp(`\\b${id}\\b.*\\b${added.id ?? ''}\\b`));
    }
  });

  it('keeps a flowchart node in the lane of the one it follows', () => {
    const code = 'swimlane-beta LR\n  subgraph L1 [Lane]\n    A[One]\n  end';
    const added = addAfter(code, 'flowchart', { id: 'A', label: 'One' }, 'Two');
    expect(added?.code).toBe(
      'swimlane-beta LR\n  subgraph L1 [Lane]\n    A[One]\n    n1["Two"]\n  end\n  A --> n1'
    );
  });

  it('adds into a lane, a group or a composite state instead of after it', async () => {
    const lane = 'flowchart TD\n  subgraph L1 [Lane]\n    A\n  end';
    const inLane = addAfter(lane, 'flowchart', await object(lane, 'L1'), 'New');
    expect(inLane?.code).toContain('    A\n    n1["New"]\n  end');
    expect(inLane?.code).not.toContain('-->');
  });

  it('adds a mindmap topic under the selected one; the caller finds it by name', async () => {
    const code = 'mindmap\n  root((Root))\n    One';
    const objects = await objectsOf(code);
    const added = addAfter(code, 'mindmap', objects[1], 'Child');
    if (!added) throw new Error('nothing added');
    expect(added.code).toBe('mindmap\n  root((Root))\n    One\n      Child');
    expect(addedObject(objects, await objectsOf(added.code), 'Child')?.line).toBe(3);
  });

  it('is not offered where the type has no such edit', async () => {
    expect(canAddAfter('pie', { id: 'L1', label: 'a', line: 1 })).toBe(false);
    expect(canAddAfter('sequence', { id: 'n', label: 'Note', line: 3 })).toBe(false);
    expect(canAddAfter(undefined, { id: 'A', label: 'A' })).toBe(false);
    expect(
      addAfter('pie\n  "a" : 1', 'pie', { id: 'L1', label: 'a', line: 1 }, 'b')
    ).toBeUndefined();
  });
});

describe('connect', () => {
  const pairs: [string, string, string, string][] = [
    ['flowchart TD\n  A\n  B', 'A', 'B', '  A --> B'],
    ['stateDiagram-v2\n  s1\n  s2', 's1', 's2', '  s1 --> s2'],
    ['classDiagram\n  class A\n  class B', 'A', 'B', '  A --> B'],
    ['sequenceDiagram\n  participant A\n  participant B', 'A', 'B', 'A->>B: ']
  ];
  it.each(pairs)('joins two objects (%s)', async (code, from, to, line) => {
    const kind = editKind(code);
    if (!kind) throw new Error('no kind');
    const next = connect(code, kind, from, to);
    expect(next).toContain(line);
    expect(await checkEdit(code, next ?? '')).toBe(true);
  });

  it('joins architecture services and refuses a loop to itself', () => {
    const code = 'architecture-beta\n  service a(server)[A]\n  service b(server)[B]';
    expect(connect(code, 'architecture', 'a', 'b')).toContain('a:R --> L:b');
    expect(connect(code, 'architecture', 'a', 'a')).toBeUndefined();
    expect(connect('mindmap\n  a', 'mindmap', 'L1', 'L2')).toBeUndefined();
  });

  it('is offered for objects, not groups, notes or line-based types', () => {
    expect(canConnect('flowchart', { id: 'A', label: 'A' })).toBe(true);
    expect(canConnect('flowchart', { group: true, id: 'L', label: 'L' })).toBe(false);
    expect(canConnect('sequence', { id: 'n', label: 'Note', line: 2 })).toBe(false);
    expect(canConnect('mindmap', { id: 'L1', label: 'a', line: 1 })).toBe(false);
    expect(canConnect('er', { id: 'A', label: 'A' })).toBe(true);
  });
});

describe('moving along the arrows', () => {
  const edges = [
    { from: 'A', head: true, index: 0, label: '', style: 'solid', title: '', to: 'B' },
    { from: 'B', head: true, index: 1, label: '', style: 'solid', title: '', to: 'C' }
  ] as const;
  it('finds the next and previous node', () => {
    expect(neighbour([...edges], 'B', 'next')).toBe('C');
    expect(neighbour([...edges], 'B', 'previous')).toBe('A');
    expect(neighbour([...edges], 'A', 'previous')).toBeUndefined();
  });

  it('branches from where the node comes from, or from itself', () => {
    const objects = [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' }
    ];
    expect(branchSource('', 'flowchart', objects, [...edges], objects[1]).id).toBe('A');
    expect(branchSource('', 'flowchart', objects, [...edges], objects[0]).id).toBe('A');
    const code = 'mindmap\n  root\n    One\n      Child';
    const topics = [
      { id: 'L1', label: 'root', line: 1 },
      { id: 'L2', label: 'One', line: 2 },
      { id: 'L3', label: 'Child', line: 3 }
    ];
    expect(branchSource(code, 'mindmap', topics, [], topics[2]).id).toBe('L2');
  });
});

describe('colorSyntaxFor', () => {
  it('follows the Colours card', () => {
    const node = { id: 'A', label: 'A' };
    expect(colorSyntaxFor('flowchart', node, ['A'])).toBe('style');
    expect(colorSyntaxFor('flowchart', { group: true, id: 'L', label: 'L' }, [])).toBe('style');
    expect(colorSyntaxFor('class', node, ['A'])).toBe('class');
    expect(colorSyntaxFor('c4', node, ['A'])).toBe('c4');
    expect(colorSyntaxFor('state', { group: true, id: 'g', label: 'g' }, ['A'])).toBeUndefined();
    expect(colorSyntaxFor('sequence', node, [])).toBeUndefined();
  });
});

describe('addStandalone', () => {
  const codes = [
    'flowchart TD\n  A',
    'architecture-beta\n  service a(server)[A]',
    'stateDiagram-v2\n  s1',
    'classDiagram\n  class A',
    'erDiagram\n  A',
    'C4Context\n  Person(p, "P")',
    'block-beta\n  a',
    'sequenceDiagram\n  participant A',
    'mindmap\n  root'
  ];
  it.each(codes)('adds an object joined to nothing (%s)', async (code) => {
    const kind = editKind(code);
    const before = await objectsOf(code);
    const added = addStandalone(code, kind, before, 'New');
    if (!added) throw new Error('nothing added');
    expect(await checkEdit(code, added.code)).toBe(true);
    const after = await objectsOf(added.code);
    const id = added.id ?? addedObject(before, after, added.name)?.id;
    expect(after.some((item) => item.id === id)).toBe(true);
  });

  it('has nothing for the types without one', () => {
    expect(addStandalone('pie\n  "a" : 1', 'pie', [], 'x')).toBeUndefined();
    expect(addStandalone('x', undefined, [], 'x')).toBeUndefined();
  });
});

describe('reverseDuplicates', () => {
  it('spots a reversal that would repeat an arrow the diagram already has', async () => {
    const code = 'flowchart TD\n  C --> D\n  D --> C\n  A -->|yes| B\n  B --> A';
    const edges = (await editableEdges(code))?.items ?? [];
    expect(edges).toHaveLength(4);
    // C → D turned round is D → C, which is there already.
    expect(reverseDuplicates(edges, edges[0])).toBe(true);
    // A -yes-> B turned round keeps its label, and B → A has none.
    expect(reverseDuplicates(edges, edges[2])).toBe(false);
  });
});
