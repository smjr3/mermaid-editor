import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { editableObjects, renameObject, type EditObject } from './diagramModify';
import {
  diagramOptions,
  objectOptions,
  optionType,
  setDiagramOption,
  setObjectOption
} from './diagramOptions';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;
const values = (code: string, config = '{}') =>
  Object.fromEntries(diagramOptions(code, config).map(({ key, value }) => [key, value]));
const code = (from: string, key: string, value: string) => {
  const result = setDiagramOption(from, '{}', key, value);
  if (!result || !('code' in result)) throw new Error(`no code change for ${key}`);
  return result.code;
};
const config = (from: string, key: string, value: string, current = '{}') => {
  const result = setDiagramOption('', current, key, value);
  if (!result || !('config' in result)) throw new Error(`no config change for ${key}`);
  return JSON.parse(result.config) as Record<string, unknown>;
};

describe('diagramOptions', () => {
  it('lists only what the type can express', () => {
    expect(Object.keys(values('flowchart LR\n  A --> B'))).toEqual([
      'curve',
      'look',
      'accTitle',
      'accDescr'
    ]);
    expect(Object.keys(values('mindmap\n  root'))).toEqual(['mindmapLayout']);
    expect(Object.keys(values('kanban\n  todo[Todo]'))).toEqual([]);
    expect(optionType('---\ntitle: x\n---\nsequenceDiagram\n  A->>B: x')).toBe('sequence');
  });

  it('turns sequence numbers on and off', async () => {
    const start = 'sequenceDiagram\n  A->>B: hi';
    expect(values(start).autonumber).toBe('off');
    const numbered = code(start, 'autonumber', 'on');
    expect(numbered).toBe('sequenceDiagram\n  autonumber\n  A->>B: hi');
    expect(values(numbered).autonumber).toBe('on');
    expect(await typeOf(numbered)).toBe('sequence');
    expect(code(numbered, 'autonumber', 'off')).toBe(start);
  });

  it('sets a gantt chart’s weekends, today marker, axis format and tick interval', async () => {
    const start = 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n  a :2024-01-01, 3d';
    expect(values(start)).toMatchObject({
      axisFormat: 'default',
      tick: 'default',
      today: 'on',
      weekends: 'off'
    });
    let next = code(start, 'weekends', 'on');
    next = code(next, 'today', 'off');
    next = code(next, 'axisFormat', 'md');
    next = code(next, 'tick', '1week');
    expect(values(next)).toMatchObject({
      axisFormat: 'md',
      tick: '1week',
      today: 'off',
      weekends: 'on'
    });
    expect(next).toContain('  excludes weekends');
    expect(next).toContain('  todayMarker off');
    expect(next).toContain('  axisFormat %m/%d');
    expect(next).toContain('  tickInterval 1week');
    expect(await typeOf(next)).toBe('gantt');
    // Other excluded days stay.
    const holidays = 'gantt\n  excludes weekends, 2024-01-02\n  section S\n  a :2024-01-01, 3d';
    expect(code(holidays, 'weekends', 'off')).toContain('  excludes 2024-01-02');
    // A format typed by hand is shown as it is.
    expect(values('gantt\n  axisFormat %d\n  section S\n  a :2024-01-01, 3d').axisFormat).toBe(
      '%d'
    );
    let back = code(next, 'weekends', 'off');
    back = code(back, 'today', 'on');
    back = code(back, 'axisFormat', 'default');
    expect(code(back, 'tick', 'default')).toBe(start);
  });

  it('writes pie showData, a horizontal XY chart, a git graph direction and block columns', async () => {
    const pie = code('pie\n  "a" : 1', 'showData', 'on');
    expect(pie).toBe('pie showData\n  "a" : 1');
    expect(code(pie, 'showData', 'off')).toBe('pie\n  "a" : 1');
    const xy = code('xychart-beta\n  bar [1, 2]', 'horizontal', 'on');
    expect(xy).toBe('xychart-beta horizontal\n  bar [1, 2]');
    expect(await typeOf(xy)).toBe('xychart');
    expect(values(xy).horizontal).toBe('on');
    const git = code('gitGraph\n  commit', 'gitDirection', 'TB');
    expect(git).toBe('gitGraph TB:\n  commit');
    expect(values(git).gitDirection).toBe('TB');
    expect(await typeOf(git)).toBe('gitGraph');
    expect(code(git, 'gitDirection', 'LR')).toBe('gitGraph\n  commit');
    const block = code('block-beta\n  a b c', 'columns', '2');
    expect(block).toBe('block-beta\n  columns 2\n  a b c');
    expect(code(block, 'columns', '3')).toBe('block-beta\n  columns 3\n  a b c');
    expect(code(block, 'columns', '')).toBe('block-beta\n  a b c');
    expect(setDiagramOption(block, '{}', 'columns', 'many')).toBeUndefined();
    // A group's own columns are not the diagram's.
    expect(values('block-beta\n  block:g\n    columns 2\n    a b\n  end').columns).toBe('');
  });

  it('writes the accessible title and description', async () => {
    const start = 'flowchart LR\n  A --> B';
    const titled = code(code(start, 'accTitle', 'Order flow'), 'accDescr', 'How an order goes');
    expect(titled).toBe(
      'flowchart LR\n  accDescr: How an order goes\n  accTitle: Order flow\n  A --> B'
    );
    expect(await typeOf(titled)).toBe('flowchart-v2');
    expect(values(titled)).toMatchObject({ accDescr: 'How an order goes', accTitle: 'Order flow' });
    const block = 'flowchart LR\n  accDescr {\n    two\n    lines\n  }\n  A --> B';
    expect(values(block).accDescr).toBe('two lines');
    expect(code(block, 'accDescr', 'one')).toBe('flowchart LR\n  accDescr: one\n  A --> B');
    expect(code(code(titled, 'accTitle', ''), 'accDescr', '')).toBe(start);
  });

  it('writes config options and drops them at their default', () => {
    expect(config('', 'curve', 'step')).toEqual({ flowchart: { curve: 'step' } });
    expect(config('', 'curve', 'default', '{"flowchart":{"curve":"step"}}')).toEqual({});
    expect(config('', 'look', 'handDrawn')).toEqual({ look: 'handDrawn' });
    expect(config('', 'mindmapLayout', 'tidy-tree')).toEqual({ layout: 'tidy-tree' });
    expect(config('', 'sankeyValues', 'off')).toEqual({ sankey: { showValues: false } });
    expect(config('', 'sankeyLinkColor', 'source')).toEqual({ sankey: { linkColor: 'source' } });
    expect(config('', 'sankeyAlign', 'left')).toEqual({ sankey: { nodeAlignment: 'left' } });
    expect(config('', 'bitsPerRow', '16')).toEqual({ packet: { bitsPerRow: 16 } });
    expect(config('', 'showBits', 'off')).toEqual({ packet: { showBits: false } });
    expect(config('', 'multicolor', 'off')).toEqual({ timeline: { disableMulticolor: true } });
    expect(
      values('flowchart LR\n  A', '{"flowchart":{"curve":"step"},"look":"neo"}')
    ).toMatchObject({ curve: 'step', look: 'neo' });
    expect(values('sankey-beta\n  a,b,1', '{"sankey":{"showValues":false}}').sankeyValues).toBe(
      'off'
    );
    expect(setDiagramOption('', '{}', 'curve', 'wobbly')).toBeUndefined();
    expect(setDiagramOption('', 'not json', 'curve', 'step')).toBeUndefined();
  });
});

describe('objectOptions', () => {
  const find = async (code: string, id: string): Promise<EditObject> => {
    const found = (await editableObjects(code))?.items.find((item) => item.id === id);
    if (!found) throw new Error(`no object ${id}`);
    return found;
  };
  const options = async (code: string, kind: string, id: string) =>
    Object.fromEntries(
      objectOptions(code, kind, await find(code, id)).map(({ key, value }) => [key, value])
    );
  const set = async (code: string, kind: string, id: string, key: string, value: string) => {
    const next = setObjectOption(code, kind, await find(code, id), key, value);
    if (next === undefined) throw new Error(`refused ${key}=${value}`);
    return next;
  };

  it('sets a subgraph’s own direction', async () => {
    const code = 'flowchart LR\n  subgraph S\n    a --> b\n  end';
    expect(await options(code, 'flowchart', 'S')).toEqual({ laneDirection: 'inherit' });
    const down = await set(code, 'flowchart', 'S', 'laneDirection', 'TB');
    expect(down).toBe('flowchart LR\n  subgraph S\n    direction TB\n    a --> b\n  end');
    expect(await typeOf(down)).toBe('flowchart-v2');
    expect(await options(down, 'flowchart', 'S')).toEqual({ laneDirection: 'TB' });
    expect(await set(down, 'flowchart', 'S', 'laneDirection', 'RL')).toContain('    direction RL');
    expect(await set(down, 'flowchart', 'S', 'laneDirection', 'inherit')).toBe(code);
    // A swimlane's lanes follow the diagram.
    const lanes = 'swimlane-beta LR\n  subgraph S\n    a --> b\n  end';
    expect(await options(lanes, 'flowchart', 'S')).toEqual({});
  });

  it('sets a participant’s symbol, declaring it when needed', async () => {
    const code = 'sequenceDiagram\n  participant A as Shop\n  A->>B: hi';
    expect(await options(code, 'sequence', 'A')).toEqual({ participantType: 'participant' });
    const boundary = await set(code, 'sequence', 'A', 'participantType', 'boundary');
    expect(boundary).toContain('  participant A@{ "type": "boundary" } as Shop');
    expect(await typeOf(boundary)).toBe('sequence');
    expect(await options(boundary, 'sequence', 'A')).toEqual({ participantType: 'boundary' });
    // Renaming keeps the symbol.
    const renamed = renameObject(boundary, 'sequence', await find(boundary, 'A'), 'Store') ?? '';
    expect(renamed).toContain('  participant A@{ "type": "boundary" } as Store');
    expect(await set(boundary, 'sequence', 'A', 'participantType', 'actor')).toContain(
      '  actor A as Shop'
    );
    const declared = await set(code, 'sequence', 'B', 'participantType', 'database');
    expect(declared).toContain('  participant A as Shop\n  participant B@{ "type": "database" }');
    expect(await typeOf(declared)).toBe('sequence');
  });

  it('sets a mindmap topic’s shape', async () => {
    const code = 'mindmap\n  root((Plan))\n    Idea\n    b[Box]';
    const idea = (await editableObjects(code))?.items[1];
    if (!idea) throw new Error('no topic');
    expect(objectOptions(code, 'mindmap', idea)[0].value).toBe('default');
    const cloud = setObjectOption(code, 'mindmap', idea, 'topicShape', 'cloud') ?? '';
    expect(cloud).toBe('mindmap\n  root((Plan))\n    n1)Idea(\n    b[Box]');
    expect(await typeOf(cloud)).toBe('mindmap');
    const box = (await editableObjects(code))?.items[2];
    if (!box) throw new Error('no topic');
    expect(objectOptions(code, 'mindmap', box)[0].value).toBe('square');
    expect(setObjectOption(code, 'mindmap', box, 'topicShape', 'hexagon')).toContain(
      '    b{{Box}}'
    );
    expect(setObjectOption(code, 'mindmap', box, 'topicShape', 'default')).toContain('    Box');
  });

  it('sets a class’s annotation and type parameter', async () => {
    const code = 'classDiagram\n  class Shape["Shape"]\n  Shape <|-- Circle';
    expect(await options(code, 'class', 'Shape')).toEqual({ annotation: 'none', generic: '' });
    const annotated = await set(code, 'class', 'Shape', 'annotation', 'interface');
    expect(annotated).toContain('  class Shape["Shape"]\n  <<interface>> Shape');
    const generic = await set(annotated, 'class', 'Shape', 'generic', 'T');
    expect(generic).toContain('  class Shape~T~["Shape"]');
    expect(await typeOf(generic)).toBe('classDiagram');
    expect(await options(generic, 'class', 'Shape')).toEqual({
      annotation: 'interface',
      generic: 'T'
    });
    const plain = await set(
      await set(generic, 'class', 'Shape', 'generic', ''),
      'class',
      'Shape',
      'annotation',
      'none'
    );
    expect(plain).toBe(code);
    // An undeclared class is declared for its parameter.
    expect(await set(code, 'class', 'Circle', 'generic', 'K, V')).toContain('  class Circle~K, V~');
  });

  it('sets a kanban card’s assignee, ticket and priority', async () => {
    const code = 'kanban\n  todo[Todo]\n    t1[Write docs]';
    const card = (await editableObjects(code))?.items[1];
    const column = (await editableObjects(code))?.items[0];
    if (!card || !column) throw new Error('no card');
    expect(objectOptions(code, 'kanban', column)).toEqual([]);
    let next = setObjectOption(code, 'kanban', card, 'assigned', 'Sato') ?? '';
    next = setObjectOption(next, 'kanban', card, 'priority', 'veryHigh') ?? '';
    next = setObjectOption(next, 'kanban', card, 'ticket', 'T-1') ?? '';
    expect(next).toContain(
      "    t1[Write docs]@{ assigned: 'Sato', priority: 'Very High', ticket: 'T-1' }"
    );
    expect(await typeOf(next)).toBe('kanban');
    expect(
      Object.fromEntries(objectOptions(next, 'kanban', card).map(({ key, value }) => [key, value]))
    ).toEqual({ assigned: 'Sato', priority: 'veryHigh', ticket: 'T-1' });
    let back = setObjectOption(next, 'kanban', card, 'assigned', '') ?? '';
    back = setObjectOption(back, 'kanban', card, 'priority', 'none') ?? '';
    expect(setObjectOption(back, 'kanban', card, 'ticket', '')).toBe(code);
  });

  it('sets a requirement’s kind, id, text, risk and verification, and an element’s type', async () => {
    const code =
      'requirementDiagram\n  requirement r1 {\n    id: 1\n    text: Works\n  }\n  element e1 {\n    type: code\n  }\n  e1 - satisfies -> r1';
    expect(await options(code, 'requirement', 'r1')).toEqual({
      reqId: '1',
      reqText: 'Works',
      requirementType: 'requirement',
      risk: 'none',
      verifyMethod: 'none'
    });
    let next = await set(code, 'requirement', 'r1', 'risk', 'high');
    next = await set(next, 'requirement', 'r1', 'verifyMethod', 'test');
    next = await set(next, 'requirement', 'r1', 'requirementType', 'functionalRequirement');
    next = await set(next, 'requirement', 'r1', 'reqText', 'Works fast');
    expect(next).toContain(
      '  functionalRequirement r1 {\n    id: 1\n    text: Works fast\n    risk: high\n    verifymethod: test\n  }'
    );
    expect(await typeOf(next)).toBe('requirement');
    expect(await options(code, 'requirement', 'e1')).toEqual({ docRef: '', elementType: 'code' });
    const doc = await set(code, 'requirement', 'e1', 'docRef', 'docs/spec.md');
    expect(doc).toContain('    type: code\n    docref: docs/spec.md');
    expect(await typeOf(doc)).toBe('requirement');
  });

  it('sets a block’s width', async () => {
    const code = 'block-beta\n  columns 3\n  a["A"] b c';
    expect(await options(code, 'block', 'a')).toEqual({ blockWidth: '' });
    const wide = await set(code, 'block', 'a', 'blockWidth', '2');
    expect(wide).toBe('block-beta\n  columns 3\n  a["A"]:2 b c');
    expect(await typeOf(wide)).toBe('block');
    expect(await options(wide, 'block', 'a')).toEqual({ blockWidth: '2' });
    expect(await set(wide, 'block', 'a', 'blockWidth', '')).toBe(code);
  });
});
