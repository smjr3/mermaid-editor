import { describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import {
  checkedRename,
  findOccurrences,
  identifierAt,
  isValidIdentifier,
  renameIn
} from './mermaidRename';
import { diagramIds } from './diagramIds';
import { diagramFromText } from './mermaid';

const flowchart = `flowchart TD
  A[Start A] --> B{Is A ok?}
  B -->|A path| C
  A --> C
  %% A in a comment
  click A "https://example.com/A"`;

describe('identifierAt', () => {
  it('finds the identifier under a 1-based column', () => {
    expect(identifierAt('  A[Start] --> Bee', 3)).toEqual({ name: 'A', start: 3, end: 4 });
    expect(identifierAt('  A[Start] --> Bee', 17)).toEqual({ name: 'Bee', start: 16, end: 19 });
  });

  it('returns undefined between identifiers', () => {
    expect(identifierAt('  A --> B', 5)).toBeUndefined();
  });

  it('accepts non-ASCII names', () => {
    expect(identifierAt('  受付 --> 発送', 3)?.name).toBe('受付');
  });
});

describe('findOccurrences', () => {
  it('finds node ids but not label text, edge labels, comments or strings', () => {
    const lines = findOccurrences(flowchart, 'A').map(({ line, start }) => [line, start]);
    expect(lines).toEqual([
      [2, 3],
      [4, 3],
      [6, 9]
    ]);
  });

  it('matches whole identifiers only', () => {
    expect(findOccurrences('graph TD\n  AB --> A\n  A_1 --> A', 'A')).toHaveLength(2);
  });

  it('skips message and description text after a spaced colon', () => {
    const seq = 'sequenceDiagram\n  Alice->>Bob: Hi Bob\n  Bob-->>Alice: Hi Alice';
    expect(findOccurrences(seq, 'Bob').map(({ line }) => line)).toEqual([2, 3]);
  });

  it('keeps architecture edge sides, which use an unspaced colon', () => {
    const arch =
      'architecture-beta\n  service db(database)[DB]\n  service api(server)[API]\n  db:R -- L:api';
    expect(findOccurrences(arch, 'db').map(({ line }) => line)).toEqual([2, 4]);
    expect(findOccurrences(arch, 'api').map(({ line }) => line)).toEqual([3, 4]);
  });

  it('ignores front matter', () => {
    expect(findOccurrences('---\ntitle: A\n---\ngraph TD\n  A --> B', 'A')).toHaveLength(1);
  });
});

describe('renameIn', () => {
  it('renames every occurrence and nothing else', () => {
    expect(renameIn(flowchart, 'A', 'Start')).toBe(`flowchart TD
  Start[Start A] --> B{Is A ok?}
  B -->|A path| C
  Start --> C
  %% A in a comment
  click Start "https://example.com/A"`);
  });
});

describe('isValidIdentifier', () => {
  it('accepts plain names and rejects keywords and punctuation', () => {
    expect(isValidIdentifier('order_2')).toBe(true);
    expect(isValidIdentifier('受付')).toBe(true);
    expect(isValidIdentifier('end')).toBe(false);
    expect(isValidIdentifier('subgraph')).toBe(false);
    expect(isValidIdentifier('a b')).toBe(false);
    expect(isValidIdentifier('')).toBe(false);
  });
});

describe('Windows line endings', () => {
  it('renames across CRLF lines and keeps the line endings', () => {
    const code = 'flowchart TD\r\n  order[Order] --> ship\r\n  order --> cancel';
    expect(renameIn(code, 'order', 'purchase')).toBe(
      'flowchart TD\r\n  purchase[Order] --> ship\r\n  purchase --> cancel'
    );
    expect(findOccurrences(code, 'order').map(({ line, start }) => [line, start])).toEqual([
      [2, 3],
      [3, 3]
    ]);
  });
});

describe('isValidIdentifier', () => {
  it('rejects plain numbers, which are values rather than names', () => {
    expect(isValidIdentifier('16')).toBe(false);
    expect(isValidIdentifier('node16')).toBe(true);
  });
});

describe('checkedRename', () => {
  const parse = async (code: string) => (await mermaid.parse(code)).diagramType;
  const code =
    'architecture-beta\n  service db(database)[DB]\n  service api(server)[API]\n  db:L -- R:api';

  it('returns the renamed code when it still parses as the same diagram', async () => {
    await expect(checkedRename(code, 'db', 'store', parse)).resolves.toEqual({
      code: code.replaceAll('db:', 'store:').replace('service db(', 'service store(')
    });
  });

  it('refuses a rename that breaks the diagram', async () => {
    // Architecture ids may not start with a capital R, L, T or B.
    await expect(checkedRename(code, 'db', 'Renamed', parse)).resolves.toEqual({
      reason: 'breaks'
    });
    await expect(checkedRename(code, 'R', 'X', parse)).resolves.toEqual({ reason: 'breaks' });
  });

  it('refuses an invalid new name', async () => {
    await expect(checkedRename(code, 'db', 'end', parse)).resolves.toEqual({ reason: 'invalid' });
  });
});

// R02: mermaid merges two objects that share an id without an error, so F2 onto an
// id another object already has must be refused.
describe('checkedRename refuses an id another object has (R02)', () => {
  const parse = async (code: string) => (await mermaid.parse(code)).diagramType;
  const rename = (code: string, from: string, to: string) =>
    checkedRename(code, from, to, parse, diagramIds);

  it('does not merge two flowchart nodes', async () => {
    const code = 'flowchart TD\n  A[Alpha] --> B[Beta]';
    // What mermaid does with the merged code: one vertex, B.
    const merged = await diagramFromText('flowchart TD\n  B[Alpha] --> B[Beta]');
    const vertices = (
      merged.db as unknown as { getVertices: () => Map<string, unknown> }
    ).getVertices();
    expect([...vertices.keys()]).toEqual(['B']);
    await expect(rename(code, 'A', 'B')).resolves.toEqual({ reason: 'taken' });
  });

  it('allows a free id and keeps every node and arrow', async () => {
    const code = 'flowchart TD\n  A[Alpha] --> B[Beta]\n  B --> C[Gamma]';
    const result = await rename(code, 'A', 'D');
    expect(result).toEqual({ code: 'flowchart TD\n  D[Alpha] --> B[Beta]\n  B --> C[Gamma]' });
    const diagram = await diagramFromText((result as { code: string }).code);
    const db = diagram.db as unknown as {
      getEdges: () => { start: string; end: string }[];
      getVertices: () => Map<string, unknown>;
    };
    expect([...db.getVertices().keys()].sort()).toEqual(['B', 'C', 'D']);
    expect(db.getEdges().map(({ end, start }) => `${start}>${end}`)).toEqual(['D>B', 'B>C']);
  });

  it('does not take a label with the same text for an id', async () => {
    await expect(rename('flowchart TD\n  A[B] --> C', 'C', 'B')).resolves.toEqual({
      code: 'flowchart TD\n  A[B] --> B'
    });
    // A sequence alias is a label too.
    const sequence = 'sequenceDiagram\n  participant A as Alice\n  A->>Bob: Hi';
    await expect(rename(sequence, 'Bob', 'Alice')).resolves.toHaveProperty('code');
  });

  it.each([
    ['swimlane lane', 'swimlane-beta\n  subgraph l1 [Lane]\n    A --> B\n  end', 'A', 'l1'],
    ['swimlane node', 'swimlane-beta\n  subgraph l1 [Lane]\n    A --> B\n  end', 'A', 'B'],
    ['flowchart subgraph', 'flowchart TD\n  subgraph g1\n    A\n  end\n  A --> B', 'B', 'g1'],
    ['state', 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy', 'Idle', 'Busy'],
    [
      'composite state',
      'stateDiagram-v2\n  state Comp {\n    Inner --> Two\n  }\n  Idle --> Comp',
      'Idle',
      'Inner'
    ],
    [
      'class',
      'classDiagram\n  class Animal\n  class Duck\n  Animal --> Duck\n  Animal : +age',
      'Duck',
      'Animal'
    ],
    [
      'ER',
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    string name\n  }',
      'ORDER',
      'CUSTOMER'
    ],
    [
      'architecture',
      'architecture-beta\n  group g(cloud)[G]\n  service db(database)[DB] in g\n  service api(server)[API]\n  db:L -- R:api',
      'db',
      'api'
    ],
    [
      'architecture group',
      'architecture-beta\n  group g(cloud)[G]\n  service db(database)[DB] in g\n  service api(server)[API]\n  db:L -- R:api',
      'api',
      'g'
    ],
    ['sequence', 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hello', 'Alice', 'Bob'],
    ['mindmap', 'mindmap\n  root((Root))\n    a1[Topic A]\n    a2[Topic B]', 'a1', 'a2'],
    ['kanban', 'kanban\n  todo[Todo]\n    t1[Write]\n    t2[Ship]', 't1', 't2'],
    ['block', 'block-beta\n  columns 2\n  a["A"] b["B"]\n  a --> b', 'a', 'b'],
    [
      'requirement',
      'requirementDiagram\n  requirement r1 {\n    id: 1\n  }\n  element e1 {\n    type: sim\n  }\n  e1 - satisfies -> r1',
      'e1',
      'r1'
    ]
  ])('%s: refuses the taken id and allows a free one', async (_name, code, from, taken) => {
    await expect(rename(code, from, taken)).resolves.toEqual({ reason: 'taken' });
    const free = await rename(code, from, 'zzfree');
    expect(free).toHaveProperty('code');
    const before = await diagramIds(code);
    const after = await diagramIds((free as { code: string }).code);
    expect(after?.size).toBe(before?.size);
    expect(after?.has('zzfree')).toBe(true);
  });

  it('falls back to the identifiers in the code for types without a reader', async () => {
    const pie = 'pie\n  "Dogs" : 386';
    await expect(diagramIds(pie)).resolves.toBeUndefined();
    // Without a model, an id the code already uses is refused.
    const code = 'flowchart TD\n  A[Alpha] --> B[Beta]';
    await expect(checkedRename(code, 'A', 'B', parse)).resolves.toEqual({ reason: 'taken' });
    await expect(checkedRename(code, 'A', 'C', parse)).resolves.toHaveProperty('code');
  });
});
