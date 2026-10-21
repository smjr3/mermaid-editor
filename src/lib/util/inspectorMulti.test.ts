import { describe, expect, it } from 'vitest';
import type { EditObject } from './diagramModify';
import {
  fillSwatch,
  fillValue,
  lineCurrent,
  rowCommands,
  rowControl,
  SELECTION_TAB,
  tabOfItems
} from './inspectorMulti';
import { selectionCommands } from './selectionCommands';

// The rules of the inspector's multi view (inspectorMulti.ts): the tab that heads it,
// which registry commands become rows, and the colour rows' values.
const flow = 'flowchart TD\n  A[Start] --> B[End]\n  subgraph S [Stock]\n    B\n  end';
const object = (id: string, group = false): EditObject =>
  ({ group, id, label: id, title: id }) as unknown as EditObject;
const objects = [object('A'), object('B'), object('S', true)];
const node = (id: string) => ({ id, type: 'node' }) as const;
const edge = (index: number) => ({ index, type: 'edge' }) as const;

describe('tabOfItems', () => {
  it('is 図全体 for nothing, the kind for one kind, 選択 for a mix', () => {
    expect(tabOfItems(flow, [], objects)).toBe('all');
    expect(tabOfItems(flow, [node('A'), node('B')], objects)).toBe('object');
    expect(tabOfItems(flow, [edge(0), edge(1)], objects)).toBe('edge');
    expect(tabOfItems(flow, [node('S')], objects)).toBe('group');
    expect(tabOfItems(flow, [node('A'), edge(0)], objects)).toBe(SELECTION_TAB);
    expect(tabOfItems(flow, [node('A'), node('S')], objects)).toBe(SELECTION_TAB);
  });
});

describe('rowCommands', () => {
  it('keeps every choice command but 同じものを選ぶ, and 太字, in registry order', () => {
    const rows = rowCommands(selectionCommands).map(({ key }) => key);
    expect(rows).toEqual([
      'fillColor',
      'strokeColor',
      'textColor',
      'shape',
      'textSize',
      'bold',
      'lineStyle',
      'arrowHead',
      'edgeLength',
      'moveToLane'
    ]);
    for (const command of selectionCommands) {
      if (command.kind === 'choice' && command.key !== 'selectSame')
        expect(rowControl(command.key)).toBeDefined();
    }
    expect(rowControl('selectSame')).toBeUndefined();
    expect(rowControl('delete')).toBeUndefined();
    expect(rowControl('addNext')).toBeUndefined();
  });

  it('gives each row its control', () => {
    expect(rowControl('fillColor')).toBe('fill');
    expect(rowControl('strokeColor')).toBe('line');
    expect(rowControl('textColor')).toBe('line');
    expect(rowControl('shape')).toBe('select');
    expect(rowControl('moveToLane')).toBe('select');
    expect(rowControl('textSize')).toBe('segmented');
    expect(rowControl('lineStyle')).toBe('segmented');
    expect(rowControl('arrowHead')).toBe('segmented');
    expect(rowControl('edgeLength')).toBe('segmented');
    expect(rowControl('bold')).toBe('toggle');
  });
});

describe('the colour rows', () => {
  it('shows a named swatch, nothing for none, and no button for custom or mixed', () => {
    expect(fillSwatch('green')).toEqual({ fill: '#def5e1', name: 'green', stroke: '#3f9b52' });
    expect(fillSwatch('none')).toBeUndefined();
    expect(fillSwatch(undefined)).toBeUndefined();
    expect(fillSwatch('custom')).toEqual({ fill: 'mixed', stroke: 'mixed' });
  });

  it('turns a picked swatch into the command value, or undefined outside the palette', () => {
    expect(fillValue({ fill: '#DEF5E1', stroke: '#3F9B52' })).toBe('green');
    expect(fillValue(undefined)).toBe('none');
    expect(fillValue({ fill: '#ffffff', stroke: '#123456' })).toBeUndefined();
  });

  it('shows a line colour as itself, none as the theme, mixed as no button', () => {
    expect(lineCurrent('#3b73c9', false)).toBe('#3b73c9');
    expect(lineCurrent('none', false)).toBeUndefined();
    expect(lineCurrent(undefined, false)).toBeUndefined();
    expect(lineCurrent('#3b73c9', true)).toBe('mixed');
  });
});
