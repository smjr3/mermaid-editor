import { describe, expect, it } from 'vitest';
import type { EditEdge, EditKind, EditObject } from './diagramModify';
import { containing, pickTarget, type PickElement } from './diagramPick';

const el = (fields: Partial<PickElement>): PickElement => ({
  cls: '',
  dataId: null,
  id: '',
  text: '',
  ...fields
});
const edge = (
  index: number,
  from: string,
  to: string,
  extra: Partial<EditEdge> = {}
): EditEdge => ({
  from,
  head: true,
  index,
  label: '',
  style: 'solid',
  title: '',
  to,
  ...extra
});
const context = (kind: EditKind, objects: EditObject[], edges: EditEdge[] = [], code = '') => ({
  code,
  edges,
  kind,
  objects,
  svgId: 'graph-2'
});

describe('pickTarget', () => {
  it('finds flowchart nodes, lanes and arrows', () => {
    const ctx = context(
      'flowchart',
      [
        { id: 'A', label: 'Start' },
        { group: true, id: 'L1', label: 'Lane' }
      ],
      [edge(0, 'A', 'B', { id: 'L_A_B_0' })]
    );
    expect(pickTarget([el({ id: 'x' }), el({ id: 'graph-2-flowchart-A-0' })], ctx)).toEqual({
      id: 'A',
      type: 'node'
    });
    expect(pickTarget([el({ id: 'graph-2-L1' })], ctx)).toEqual({ id: 'L1', type: 'node' });
    expect(pickTarget([el({ dataId: 'L_A_B_0', id: 'graph-2-L_A_B_0' })], ctx)).toEqual({
      index: 0,
      type: 'edge'
    });
    expect(pickTarget([el({ id: 'nothing' })], ctx)).toBeUndefined();
  });

  it('takes the innermost match', () => {
    const ctx = context('flowchart', [
      { id: 'A', label: 'A' },
      { group: true, id: 'L1', label: 'Lane' }
    ]);
    expect(
      pickTarget([el({ id: 'graph-2-flowchart-A-0' }), el({ id: 'graph-2-L1' })], ctx)
    ).toEqual({ id: 'A', type: 'node' });
  });

  it('finds architecture services, groups and arrows', () => {
    const ctx = context(
      'architecture',
      [
        { id: 'db', label: 'Database' },
        { group: true, id: 'api', label: 'API' }
      ],
      [edge(0, 'db', 'server')]
    );
    expect(pickTarget([el({ id: 'graph-2-service-db' })], ctx)).toEqual({ id: 'db', type: 'node' });
    expect(pickTarget([el({ id: 'graph-2-group-api' })], ctx)).toEqual({ id: 'api', type: 'node' });
    expect(pickTarget([el({ id: 'graph-2-L_db_server_0' })], ctx)).toEqual({
      index: 0,
      type: 'edge'
    });
  });

  it('finds class, ER, requirement, block and state arrows', () => {
    expect(
      pickTarget(
        [el({ dataId: 'id_A_B_1' })],
        context('class', [], [edge(0, 'B', 'A'), edge(1, 'A', 'B')])
      )
    ).toEqual({ index: 1, type: 'edge' });
    expect(
      pickTarget(
        [el({ dataId: 'id_entity-A-0_entity-B-1_0' })],
        context('er', [], [edge(0, 'A', 'B')])
      )
    ).toEqual({ index: 0, type: 'edge' });
    expect(
      pickTarget([el({ dataId: 'e1-r1-0' })], context('requirement', [], [edge(0, 'e1', 'r1')]))
    ).toEqual({ index: 0, type: 'edge' });
    expect(
      pickTarget([el({ dataId: 'graph-2-1-a-b' })], context('block', [], [edge(0, 'a', 'b')]))
    ).toEqual({ index: 0, type: 'edge' });
    expect(
      pickTarget(
        [el({ dataId: 'edge1' })],
        context('state', [], [edge(0, '[*]', 's1'), edge(1, 's1', 's2')])
      )
    ).toEqual({ index: 1, type: 'edge' });
    expect(
      pickTarget([el({ dataId: 'edge5' })], context('state', [], [edge(0, '[*]', 's1')]))
    ).toBeUndefined();
  });

  it('finds an arrow by its label when the label is unique', () => {
    const edges = [edge(0, 'A', 'B', { label: 'hello' }), edge(1, 'B', 'A', { label: 'hi' })];
    expect(
      pickTarget([el({ cls: 'messageText', text: ' hi ' })], context('sequence', [], edges))
    ).toEqual({ index: 1, type: 'edge' });
    const same = [edge(0, 'A', 'B', { label: 'x' }), edge(1, 'B', 'A', { label: 'x' })];
    expect(
      pickTarget([el({ cls: 'messageText', text: 'x' })], context('sequence', [], same))
    ).toBeUndefined();
  });

  it('finds sequence participants but not notes', () => {
    const ctx = context('sequence', [
      { after: [], id: 'A', label: 'Alice' },
      { id: 'note-3', label: 'Note', line: 3 }
    ]);
    expect(pickTarget([el({ dataId: 'A' })], ctx)).toEqual({ id: 'A', type: 'node' });
    expect(pickTarget([el({ dataId: 'note-3' })], ctx)).toBeUndefined();
    // An actor box without a data-id: by the name it shows.
    expect(pickTarget([el({ cls: 'actor actor-box', text: 'Alice' })], ctx)).toEqual({
      id: 'A',
      type: 'node'
    });
    expect(pickTarget([el({ cls: 'actor actor-box', text: 'Bob' })], ctx)).toBeUndefined();
  });

  it('finds mindmap topics and timeline items by position', () => {
    const topics = context('mindmap', [
      { id: 'L1', label: 'Root', line: 1 },
      { id: 'L2', label: 'One', line: 2 }
    ]);
    expect(pickTarget([el({ id: 'graph-2-node_1' })], topics)).toEqual({
      id: 'L2',
      type: 'node'
    });
    const periods = context('timeline', [
      { id: 'L2', label: '2020', line: 2 },
      { id: 'L2E0', label: 'a', line: 2, part: 0 }
    ]);
    expect(
      pickTarget([el({ cls: 'timeline-node section--1', childId: 'graph-2-node-1' })], periods)
    ).toEqual({ id: 'L2E0', type: 'node' });
    expect(pickTarget([el({ cls: 'node-bkg', id: 'graph-2-node-0' })], periods)).toEqual({
      id: 'L2',
      type: 'node'
    });
  });

  it('finds kanban cards by their id and gantt tasks by their name', () => {
    const code = 'kanban\n  todo[Todo]\n    t1[Task one]';
    const board = context(
      'kanban',
      [
        { id: 'L1', label: 'Todo', line: 1 },
        { id: 'L2', label: '  Task one', line: 2 }
      ],
      [],
      code
    );
    expect(pickTarget([el({ id: 'graph-2-t1' })], board)).toEqual({ id: 'L2', type: 'node' });
    expect(pickTarget([el({ id: 'graph-2-todo' })], board)).toEqual({ id: 'L1', type: 'node' });
    const chart = context('gantt', [
      { group: true, id: 'S1', label: 'Section' },
      { id: 'T3', label: 'Task A' }
    ]);
    expect(pickTarget([el({ id: 'graph-2-a1', text: 'Task A' })], chart)).toEqual({
      id: 'T3',
      type: 'node'
    });
  });
});

describe('lanes, groups, messages and relationships', () => {
  it('finds a swimlane lane by its own unprefixed id', () => {
    const ctx = context('flowchart', [
      { id: 'n1', label: '作業1' },
      { group: true, id: 'Lane1', label: '担当者' }
    ]);
    expect(
      pickTarget(
        [
          el({ cls: 'swimlane-body' }),
          el({ cls: 'cluster swimlane', dataId: 'Lane1', id: 'Lane1' })
        ],
        ctx
      )
    ).toEqual({ id: 'Lane1', type: 'node' });
    // An unprefixed id that is not a lane is not picked by the lane rule.
    expect(pickTarget([el({ cls: 'cluster', id: 'n1' })], ctx)).toEqual({ id: 'n1', type: 'node' });
    expect(pickTarget([el({ cls: 'cluster', id: 'other' })], ctx)).toBeUndefined();
  });

  it('finds a sequence message by the text beside its line, or by the line order', () => {
    const ctx = context(
      'sequence',
      [
        { id: 'p1', label: '利用者' },
        { id: 'p2', label: 'システム' }
      ],
      [
        edge(0, 'p1', 'p2', { label: '依頼' }),
        edge(1, 'p2', 'p1', { label: 'OK' }),
        edge(2, 'p1', 'p2', { label: 'OK' })
      ]
    );
    expect(pickTarget([el({ cls: 'messageLine0', edgeText: '依頼' })], ctx)).toEqual({
      index: 0,
      type: 'edge'
    });
    expect(pickTarget([el({ cls: 'messageLine1', edgeText: 'OK', order: 2 })], ctx)).toEqual({
      index: 2,
      type: 'edge'
    });
    expect(pickTarget([el({ cls: 'messageLine1', edgeText: 'OK' })], ctx)).toBeUndefined();
  });

  it('finds an ER relationship by its path and a C4 relationship by its text', () => {
    const er = context('er', [], [edge(0, 'e1', 'e2')]);
    expect(
      pickTarget([el({ cls: 'relationshipLine', dataId: 'id_entity-e1-0_entity-e2-1_0' })], er)
    ).toEqual({ index: 0, type: 'edge' });
    const c4 = context(
      'c4',
      [
        { id: 'el1', label: '利用者' },
        { id: 'el2', label: 'システム' }
      ],
      [edge(0, 'el1', 'el2', { label: '使う' })]
    );
    expect(pickTarget([el({ edgeText: '使う' })], c4)).toEqual({ index: 0, type: 'edge' });
  });

  it('orders the boxes around a point from the smallest', () => {
    const boxes = [
      { height: 100, left: 0, top: 0, width: 100 },
      { height: 20, left: 10, top: 10, width: 20 },
      { height: 10, left: 200, top: 200, width: 10 }
    ];
    expect(containing(boxes, 15, 15)).toEqual([1, 0]);
    expect(containing(boxes, 50, 50)).toEqual([0]);
    expect(containing(boxes, 500, 5)).toEqual([]);
  });
});
