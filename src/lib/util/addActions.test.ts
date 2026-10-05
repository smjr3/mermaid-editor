import { messages } from '$/i18n/messages';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { addSpecs, initialValues, specFor, type Values } from './addActions';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

/** Runs an action of the code's spec and checks the result still parses as the same type. */
const run = async (code: string, actionId: string, values: Values) => {
  const spec = specFor(code);
  const action = spec?.actions.find(({ id }) => id === actionId);
  if (!action) throw new Error(`no action ${actionId}`);
  const result = action.apply(code, { ...initialValues(action), ...values });
  if ('error' in result) return result;
  await expect(typeOf(result.code)).resolves.toBe(await typeOf(code));
  return result;
};
const added = (before: string, after: string) => {
  const old = new Set(before.split('\n'));
  return after.split('\n').filter((line) => !old.has(line));
};

describe('every Add action', () => {
  it('has its labels in every language', () => {
    for (const spec of addSpecs) {
      for (const action of spec.actions) {
        const keys = [
          action.title,
          action.button,
          ...action.fields.flatMap((field) => [
            field.label,
            ...(field.options ?? []).map((option) => `${field.label}.${option}`)
          ])
        ];
        for (const catalogue of Object.values(messages)) {
          for (const key of keys) expect(catalogue, `${spec.kind}: ${key}`).toHaveProperty([key]);
        }
      }
    }
  });
});

describe('sequence', () => {
  const code = 'sequenceDiagram\n  participant A as Alice\n  A->>A: hi';
  it('lists participants', async () => {
    expect((await specFor(code)?.parts(code))?.participants).toEqual([{ id: 'A', label: 'Alice' }]);
  });
  it('adds a participant, then a reply message to it', async () => {
    const first = await run(code, 'participant', { kind: 'actor', name: '顧客 (VIP)' });
    if ('error' in first) throw new Error();
    expect(added(code, first.code)).toEqual(['  actor p1 as 顧客 (VIP)']);
    expect(first.follow).toEqual({ to: 'p1' });
    const second = await run(first.code, 'message', {
      from: 'A',
      kind: 'reply',
      text: 'ok; done',
      to: 'p1'
    });
    if ('error' in second) throw new Error();
    expect(added(first.code, second.code)).toEqual(['  A-->>p1: ok, done']);
  });
  it('asks for both ends of a message', async () => {
    expect(await run(code, 'message', { from: 'A' })).toEqual({ error: 'add.choose' });
  });
});

describe('sequence notes and blocks', () => {
  const code =
    'sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: hi\n  B-->>A: hello';
  it('lists the messages to place things after', async () => {
    expect((await specFor(code)?.parts(code))?.messages).toEqual([
      { id: '3', label: 'A → B: hi' },
      { id: '4', label: 'B → A: hello' }
    ]);
  });
  it('adds a note over two participants at the end', async () => {
    const result = await run(code, 'note', { at: 'A', place: 'over', text: '確認; 済み', to: 'B' });
    if ('error' in result) throw new Error();
    expect(result.code).toBe(`${code}\n  Note over A,B: 確認, 済み`);
  });
  it('adds a note beside one participant after a chosen message', async () => {
    const result = await run(code, 'note', { after: '3', at: 'B', place: 'right', text: '#1' });
    if ('error' in result) throw new Error();
    expect(added(code, result.code)).toEqual(['  Note right of B: #35;1']);
    expect(result.code.split('\n')[4]).toBe('  Note right of B: #35;1');
  });
  it('asks whom a note is about', async () => {
    expect(await run(code, 'note', { text: 'x' })).toEqual({ error: 'add.seq.noteChoose' });
  });
  it('adds an empty alt or loop block after a chosen message, or at the end', async () => {
    const alt = await run(code, 'block', { after: '3', kind: 'alt', text: '在庫あり' });
    if ('error' in alt) throw new Error();
    expect(alt.code.split('\n').slice(3, 6)).toEqual(['  A->>B: hi', '  alt 在庫あり', '  end']);
    const loop = await run(alt.code, 'block', { kind: 'loop', text: '' });
    if ('error' in loop) throw new Error();
    expect(loop.code.split('\n').slice(-2)).toEqual(['  loop 繰り返し', '  end']);
  });
  it('wraps a block around a chosen message, and puts a message first inside a block', async () => {
    const around = await run(code, 'block', {
      after: '4',
      kind: 'loop',
      text: '毎日',
      wrap: 'around'
    });
    if ('error' in around) throw new Error();
    expect(around.code.split('\n').slice(3)).toEqual([
      '  A->>B: hi',
      '  loop 毎日',
      '    B-->>A: hello',
      '  end'
    ]);
    const parts = await specFor(around.code)?.parts(around.code);
    expect(parts?.messages.map(({ label }) => label)).toEqual([
      'A → B: hi',
      'loop 毎日 ⋯',
      'B → A: hello'
    ]);
    const inside = await run(around.code, 'message', {
      after: '4',
      from: 'A',
      text: '確認',
      to: 'B'
    });
    if ('error' in inside) throw new Error();
    expect(inside.code.split('\n').slice(4, 7)).toEqual([
      '  loop 毎日',
      '    A->>B: 確認',
      '    B-->>A: hello'
    ]);
  });
});

describe('state', () => {
  const code = 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy';
  it('lists states with the start and end point', async () => {
    const states = (await specFor(code)?.parts(code))?.states.map(({ id }) => id);
    expect(states).toEqual(expect.arrayContaining(['[*]', 'Idle', 'Busy']));
  });
  it('adds a state joined from another, and a transition to the end', async () => {
    const first = await run(code, 'state', { from: 'Busy', name: 'Done "now"', text: 'finish' });
    if ('error' in first) throw new Error();
    expect(added(code, first.code)).toEqual([
      '  state "Done \'now\'" as s1',
      '  Busy --> s1 : finish'
    ]);
    const second = await run(first.code, 'transition', { from: 's1', to: '[*]' });
    if ('error' in second) throw new Error();
    expect(added(first.code, second.code)).toEqual(['  s1 --> [*]']);
  });
});

describe('class', () => {
  const code = 'classDiagram\n  class Animal';
  it('adds a class and each kind of relation', async () => {
    const first = await run(code, 'class', { name: 'Dog' });
    if ('error' in first) throw new Error();
    expect(added(code, first.code)).toEqual(['  class c1["Dog"]']);
    const expected: Record<string, string> = {
      aggregation: '  Animal o-- c1',
      association: '  c1 --> Animal : uses',
      composition: '  Animal *-- c1',
      dependency: '  c1 ..> Animal',
      inheritance: '  Animal <|-- c1'
    };
    for (const [kind, line] of Object.entries(expected)) {
      const result = await run(first.code, 'relation', {
        from: 'c1',
        kind,
        text: kind === 'association' ? 'uses' : '',
        to: 'Animal'
      });
      if ('error' in result) throw new Error();
      expect(added(first.code, result.code)).toEqual([line]);
    }
  });
});

describe('er', () => {
  const code = 'erDiagram\n  CUSTOMER ||--o{ ORDER : places';
  it('adds an entity and a relationship', async () => {
    const first = await run(code, 'entity', { name: '商品' });
    if ('error' in first) throw new Error();
    expect(added(code, first.code)).toEqual(['  e1["商品"]']);
    const second = await run(first.code, 'relationship', {
      from: 'ORDER',
      kind: 'manyToMany',
      text: 'contains',
      to: 'e1'
    });
    if ('error' in second) throw new Error();
    expect(added(first.code, second.code)).toEqual(['  ORDER }o--o{ e1 : "contains"']);
  });
});

describe('mindmap', () => {
  const code = 'mindmap\n  root((Centre))\n    A\n      A1\n    B';
  it('lists topics, indented like the map', async () => {
    const topics = (await specFor(code)?.parts(code))?.topics;
    expect(topics?.map(({ id }) => id)).toEqual(['1', '2', '3', '4']);
    expect(topics?.[0].label).toBe('Centre');
    expect(topics?.[2].label.trim()).toBe('A1');
  });
  it('adds a child after the last descendant of the parent', async () => {
    const result = await run(code, 'topic', { name: 'A2 (new)', parent: '2' });
    if ('error' in result) throw new Error();
    expect(result.code).toBe('mindmap\n  root((Centre))\n    A\n      A1\n      A2 new\n    B');
    const leaf = await run(code, 'topic', { name: 'B1', parent: '4' });
    if ('error' in leaf) throw new Error();
    expect(leaf.code).toBe(`${code}\n      B1`);
  });
});

describe('gantt', () => {
  const code =
    'gantt\n  dateFormat YYYY-MM-DD\n  section Plan\n    Spec :a1, 2024-01-01, 3d\n  section Build\n    Code : 5d';
  it('lists sections', async () => {
    expect((await specFor(code)?.parts(code))?.sections.map(({ id }) => id)).toEqual([
      'Plan',
      'Build'
    ]);
  });
  it('adds a task at the end of a section, after the previous task or on a date', async () => {
    const after = await run(code, 'task', { days: '2', name: 'Review: spec', section: 'Plan' });
    if ('error' in after) throw new Error();
    expect(after.code).toBe(code.replace('3d\n', '3d\n    Review  spec : 2d\n'));
    const dated = await run(code, 'task', { days: '4', name: 'Test', start: '2024-02-01' });
    if ('error' in dated) throw new Error();
    expect(added(code, dated.code)).toEqual(['    Test : 2024-02-01, 4d']);
  });
  it('writes the date in the chart’s own format, and adds a section', async () => {
    const dotted = code.replace('YYYY-MM-DD', 'DD.MM.YYYY').replace('2024-01-01', '01.01.2024');
    const result = await run(dotted, 'task', { name: 'T', start: '2024-02-01' });
    if ('error' in result) throw new Error();
    expect(added(dotted, result.code)).toEqual(['    T : 01.02.2024, 3d']);
    const section = await run(code, 'section', { name: 'Ship' });
    if ('error' in section) throw new Error();
    expect(added(code, section.code)).toEqual(['  section Ship']);
    expect(section.follow).toEqual({ section: 'Ship' });
  });
});

describe('pie', () => {
  const code = 'pie title Pets\n  "Dogs" : 386';
  it('adds a slice, and refuses a value that is not a number', async () => {
    const result = await run(code, 'slice', { name: 'Cats "x"', value: '85.5' });
    if ('error' in result) throw new Error();
    expect(added(code, result.code)).toEqual(['    "Cats \'x\'" : 85.5']);
    expect(await run(code, 'slice', { name: 'x', value: 'abc' })).toEqual({
      error: 'add.pie.badValue'
    });
  });
});

describe('kanban', () => {
  const code = 'kanban\n  todo[Todo]\n    t1[Write]\n  done[Done]';
  it('lists columns and adds a card to one, or a new column', async () => {
    expect((await specFor(code)?.parts(code))?.columns).toEqual([
      { id: '1', label: 'Todo' },
      { id: '3', label: 'Done' }
    ]);
    const card = await run(code, 'card', { column: '1', name: 'Review' });
    if ('error' in card) throw new Error();
    expect(card.code).toBe('kanban\n  todo[Todo]\n    t1[Write]\n    card1[Review]\n  done[Done]');
    const empty = await run(code, 'card', { column: '3', name: 'Ship' });
    if ('error' in empty) throw new Error();
    expect(empty.code).toBe(`${code}\n    card1[Ship]`);
    const column = await run(code, 'column', { name: 'Doing' });
    if ('error' in column) throw new Error();
    expect(added(code, column.code)).toEqual(['  col1[Doing]']);
    expect(column.follow).toEqual({ column: '4' });
  });
});

describe('timeline', () => {
  const code = 'timeline\n  title History\n  2021 : A\n       : B\n  2022 : C';
  it('lists periods and adds an event to one, or a new period', async () => {
    expect((await specFor(code)?.parts(code))?.periods).toEqual([
      { id: '2', label: '2021' },
      { id: '4', label: '2022' }
    ]);
    const event = await run(code, 'event', { period: '2', text: 'D: more' });
    if ('error' in event) throw new Error();
    expect(event.code).toBe(
      'timeline\n  title History\n  2021 : A\n       : B\n    : D： more\n  2022 : C'
    );
    const period = await run(code, 'period', { name: '2023', text: 'E' });
    if ('error' in period) throw new Error();
    expect(added(code, period.code)).toEqual(['    2023 : E']);
  });
});

describe('c4', () => {
  const code =
    'C4Context\n  Person(a, "Alice")\n  System_Boundary(b1, "Shop") {\n    System(s, "Web")\n  }\n  UpdateElementStyle(a, $bgColor="#fff")';
  it('lists elements and boundaries', async () => {
    const parts = await specFor(code)?.parts(code);
    expect(parts?.boundaries).toEqual([{ id: 'b1', label: 'Shop' }]);
    expect(parts?.elements.map(({ id }) => id)).toEqual(['a', 's']);
  });
  it('adds an element inside a boundary, joined from another, before style lines', async () => {
    const result = await run(code, 'element', {
      boundary: 'b1',
      description: 'Keeps "orders"',
      from: 'a',
      kind: 'SystemDb',
      name: 'DB',
      text: 'reads'
    });
    if ('error' in result) throw new Error();
    expect(result.code).toBe(
      'C4Context\n  Person(a, "Alice")\n  System_Boundary(b1, "Shop") {\n    System(s, "Web")\n    SystemDb(el1, "DB", "Keeps \'orders\'")\n  }\n  Rel(a, el1, "reads")\n  UpdateElementStyle(a, $bgColor="#fff")'
    );
    const relation = await run(code, 'rel', { from: 's', text: 'calls', to: 'a' });
    if ('error' in relation) throw new Error();
    expect(added(code, relation.code)).toEqual(['  Rel(s, a, "calls")']);
  });
});

describe('block', () => {
  const code = 'block-beta\n  columns 2\n  a b';
  it('adds a block joined from another, and a link', async () => {
    const result = await run(code, 'block', { from: 'a', name: 'C' });
    if ('error' in result) throw new Error();
    expect(added(code, result.code)).toEqual(['  blk1["C"]', '  a --> blk1']);
    const link = await run(code, 'link', { from: 'b', to: 'a' });
    if ('error' in link) throw new Error();
    expect(added(code, link.code)).toEqual(['  b --> a']);
  });
});

describe('specFor', () => {
  it('finds the type past front matter and comments, and nothing for other diagrams', () => {
    expect(specFor('---\ntitle: x\n---\n%% c\nsequenceDiagram\n  A->>B: hi')?.kind).toBe(
      'sequence'
    );
    expect(specFor('flowchart TD\n  A')).toBeUndefined();
    expect(specFor('architecture-beta\n  service a(server)[A]')).toBeUndefined();
  });
});

describe('found by the all-diagram check', () => {
  it('skips front matter when finding kanban columns and mindmap topics', async () => {
    const board =
      '---\nconfig:\n  kanban:\n    ticketBaseUrl: x\n---\nkanban\n  todo[Todo]\n    t1[Write]';
    expect((await specFor(board)?.parts(board))?.columns).toEqual([{ id: '6', label: 'Todo' }]);
    const card = await run(board, 'card', { column: '6', name: 'Ship' });
    if ('error' in card) throw new Error();
    expect(added(board, card.code)).toEqual(['    card1[Ship]']);
    const map = '---\ntitle: Map\n---\nmindmap\n  root((Centre))\n    A';
    expect((await specFor(map)?.parts(map))?.topics.map(({ id }) => id)).toEqual(['4', '5']);
  });

  it('keeps a class relation label from breaking the code', async () => {
    const code = 'classDiagram\n  class A\n  class B';
    const result = await run(code, 'relation', { from: 'A', text: 'has: "many" [1]', to: 'B' });
    if ('error' in result) throw new Error();
    expect(added(code, result.code)).toEqual(["  A --> B : has 'many' [1]"]);
  });
});

describe('found by the review', () => {
  it('keeps a semicolon from splitting a state or sequence statement', async () => {
    const state = await run('stateDiagram-v2\n  [*] --> A', 'state', {
      from: 'A',
      name: 'X; Y',
      text: 'go; now'
    });
    if ('error' in state) throw new Error();
    expect(added('stateDiagram-v2\n  [*] --> A', state.code)).toEqual([
      '  state "X, Y" as s1',
      '  A --> s1 : go, now'
    ]);
    const seq = await run('sequenceDiagram\n  A->>A: hi', 'participant', { name: 'X; Y' });
    if ('error' in seq) throw new Error();
    expect(added('sequenceDiagram\n  A->>A: hi', seq.code)).toEqual(['  participant p1 as X, Y']);
  });

  it('escapes # in sequence names and messages, which mermaid reads as an entity code', async () => {
    const code = 'sequenceDiagram\n  participant A\n  A->>A: hi';
    const name = await run(code, 'participant', { name: 'Ticket #12' });
    if ('error' in name) throw new Error();
    expect(added(code, name.code)).toEqual(['  participant p1 as Ticket #35;12']);
    const message = await run(code, 'message', { from: 'A', text: 'price #1', to: 'A' });
    if ('error' in message) throw new Error();
    expect(added(code, message.code)).toEqual(['  A->>A: price #35;1']);
  });

  it('lists a participant whose name holds an escaped # by its real name', async () => {
    const code = 'sequenceDiagram\n  participant p1 as Ticket #35;12\n  p1->>p1: hi';
    expect((await specFor(code)?.parts(code))?.participants).toEqual([
      { id: 'p1', label: 'Ticket #12' }
    ]);
  });

  it('drops HTML tags typed into a name, which an unclosed one could blank the diagram with', async () => {
    const code = 'kanban\n  todo[Todo]\n    t1[T]';
    const card = await run(code, 'card', { column: '1', name: 'A <b>bold</b> x < 10' });
    if ('error' in card) throw new Error();
    expect(added(code, card.code)).toEqual(['    card1[A bold x < 10]']);
  });

  it('strips tags that only appear once another tag is removed', async () => {
    const code = 'kanban\n  todo[Todo]\n    t1[T]';
    const card = await run(code, 'card', {
      column: '1',
      name: 'A <<script>script>alert(1)</script> B'
    });
    if ('error' in card) throw new Error();
    expect(added(code, card.code)).toEqual(['    card1[A alert1 B]']);
  });

  it('puts a C4 deployment element inside its node', async () => {
    const code = 'C4Deployment\n  Deployment_Node(dn, "Node") {\n    Container(c, "C")\n  }';
    expect((await specFor(code)?.parts(code))?.boundaries).toEqual([{ id: 'dn', label: 'Node' }]);
    const result = await run(code, 'element', { boundary: 'dn', kind: 'Container', name: 'X' });
    if ('error' in result) throw new Error();
    expect(result.code).toBe(
      'C4Deployment\n  Deployment_Node(dn, "Node") {\n    Container(c, "C")\n    Container(el1, "X")\n  }'
    );
  });

  it('writes a gantt date as a unix time when the chart counts in seconds or milliseconds', async () => {
    const seconds = 'gantt\n  dateFormat X\n  section S\n    T : 1700000000, 3d';
    const result = await run(seconds, 'task', { name: 'X', start: '2024-02-01' });
    if ('error' in result) throw new Error();
    expect(added(seconds, result.code)).toEqual([`    X : ${Date.UTC(2024, 1, 1) / 1000}, 3d`]);
    const millis = seconds.replace('dateFormat X', 'dateFormat x');
    const ms = await run(millis, 'task', { name: 'X', start: '2024-02-01' });
    if ('error' in ms) throw new Error();
    expect(added(millis, ms.code)).toEqual([`    X : ${Date.UTC(2024, 1, 1)}, 3d`]);
  });
});
