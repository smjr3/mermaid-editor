import { describe, expect, it } from 'vitest';
import type { EditEdge, EditKind, EditObject } from './diagramModify';
import { pickTarget, type PickElement } from './diagramPick';

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
