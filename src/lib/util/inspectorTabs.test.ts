import { describe, expect, it } from 'vitest';
import type { EditObject } from './diagramModify';
import { inspectorTabs, objectsOfTab, tabOfObject, tabOfSelection } from './inspectorTabs';

const ids = (code: string, objects?: EditObject[]) =>
  inspectorTabs(code, objects).map(({ id }) => id);
const labels = (code: string, objects?: EditObject[]) =>
  inspectorTabs(code, objects).map(({ label }) => label);

describe('inspectorTabs', () => {
  it('gives every diagram type the add bar’s words, 図全体 first', () => {
    expect(labels('flowchart LR\n  A --> B')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.node',
      'insp.tab.group',
      'insp.tab.edge'
    ]);
    expect(labels('graph TD')).toEqual(labels('flowchart LR'));
    expect(labels('flowchart-elk LR')).toEqual(labels('flowchart LR'));
    expect(labels('swimlane-beta LR\n  subgraph S\n    A\n  end')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.node',
      'insp.tab.lane',
      'insp.tab.edge'
    ]);
    expect(labels('sequenceDiagram\n  A->>B: hi')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.participant',
      'insp.tab.message'
    ]);
    expect(labels('stateDiagram-v2\n  [*] --> A')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.state',
      'insp.tab.transition'
    ]);
    expect(labels('classDiagram\n  A <|-- B')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.class',
      'insp.tab.relation'
    ]);
    expect(labels('erDiagram\n  A ||--o{ B : has')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.entity',
      'insp.tab.relation'
    ]);
    expect(labels('mindmap\n  root')).toEqual(['ws.inspectorRoot', 'insp.tab.topic']);
    expect(labels('kanban\n  todo')).toEqual(['ws.inspectorRoot', 'insp.tab.card']);
    expect(labels('timeline\n  2024 : a')).toEqual(['ws.inspectorRoot', 'insp.tab.item']);
    expect(labels('architecture-beta\n  service a')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.service',
      'insp.tab.group',
      'insp.tab.connection'
    ]);
    expect(labels('block-beta\n  a b')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.block',
      'insp.tab.edge'
    ]);
    expect(labels('C4Context\n  Person(a, "A")')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.element',
      'insp.tab.boundary',
      'insp.tab.relation'
    ]);
    expect(labels('requirementDiagram')).toEqual([
      'ws.inspectorRoot',
      'insp.tab.requirement',
      'insp.tab.element',
      'insp.tab.relation'
    ]);
    expect(labels('pie\n  "A" : 1')).toEqual(['ws.inspectorRoot', 'insp.tab.item']);
  });

  it('gives the chart types their items and nothing else, and other types only 図全体', () => {
    for (const header of [
      'journey',
      'xychart-beta',
      'quadrantChart',
      'sankey-beta',
      'gitGraph',
      'packet-beta',
      'zenuml'
    ])
      expect(ids(header), header).toEqual(['all', 'object']);
    expect(ids('radar-beta\n  axis a')).toEqual(['all']);
    expect(ids('')).toEqual(['all']);
    expect(ids('nonsense')).toEqual(['all']);
  });

  it('reads the header after front matter', () => {
    expect(ids('---\ntitle: T\n---\nsequenceDiagram\n  A->>B: hi')).toEqual([
      'all',
      'object',
      'edge'
    ]);
  });

  it('shows a gantt’s 区分 only with a section', () => {
    const gantt = 'gantt\n  dateFormat YYYY-MM-DD\n  Spec : 2024-01-01, 3d';
    expect(ids(gantt)).toEqual(['all', 'object']);
    expect(ids(gantt, [{ id: 'L2', label: 'Spec' }])).toEqual(['all', 'object']);
    expect(ids(gantt, [{ group: true, id: 'L2', label: 'Plan', members: [] }])).toEqual([
      'all',
      'object',
      'group'
    ]);
    expect(labels(gantt, [{ group: true, id: 'L2', label: 'Plan' }])).toContain('insp.tab.section');
  });

  it('keeps the arrow tab in an empty flowchart (the type has arrows)', () => {
    expect(ids('flowchart TD')).toContain('edge');
  });
});

describe('tabOfObject / tabOfSelection / objectsOfTab', () => {
  const flow = 'swimlane-beta LR\n  subgraph S\n    A --> B\n  end';
  const objects: EditObject[] = [
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
    { group: true, id: 'S', label: 'S', members: ['A', 'B'] }
  ];

  it('puts a group in the group tab where the type has one', () => {
    expect(tabOfObject(flow, objects[0])).toBe('object');
    expect(tabOfObject(flow, objects[2])).toBe('group');
    // A mindmap's topics with children stay topics: it has no group tab.
    expect(tabOfObject('mindmap\n  root\n    a', { group: true, id: 'L1', label: 'root' })).toBe(
      'object'
    );
    // Nor does a state diagram's composite state leave 状態.
    expect(
      tabOfObject('stateDiagram-v2\n  state S {\n    A\n  }', { group: true, id: 'S', label: 'S' })
    ).toBe('object');
  });

  it('tells a requirement diagram’s elements from its requirements by the code', () => {
    const code =
      'requirementDiagram\n  requirement r1 {\n    id: 1\n  }\n  element e1 {\n    type: test\n  }\n  element "e 2" {\n  }';
    expect(tabOfObject(code, { id: 'r1', label: 'r1' })).toBe('object');
    expect(tabOfObject(code, { id: 'e1', label: 'e1' })).toBe('element');
    expect(tabOfObject(code, { id: 'e 2', label: 'e 2' })).toBe('element');
  });

  it('names the selection’s tab, 図全体 with nothing selected', () => {
    expect(tabOfSelection(flow, undefined, objects)).toBe('all');
    expect(tabOfSelection(flow, { index: 0, type: 'edge' }, objects)).toBe('edge');
    expect(tabOfSelection(flow, { id: 'A', type: 'node' }, objects)).toBe('object');
    expect(tabOfSelection(flow, { id: 'S', type: 'node' }, objects)).toBe('group');
    // An object the list does not know yet (just added) counts as an object.
    expect(tabOfSelection(flow, { id: 'Z', type: 'node' }, objects)).toBe('object');
  });

  it('lists a tab’s objects', () => {
    expect(objectsOfTab(flow, 'object', objects).map(({ id }) => id)).toEqual(['A', 'B']);
    expect(objectsOfTab(flow, 'group', objects).map(({ id }) => id)).toEqual(['S']);
    expect(objectsOfTab(flow, 'edge', objects)).toEqual([]);
    expect(objectsOfTab(flow, 'all', objects)).toEqual([]);
  });
});
