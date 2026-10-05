import { describe, expect, it } from 'vitest';
import {
  addRecent,
  colorAll,
  colorAllGroups,
  getObjectColor,
  getStyleColor,
  getEdgeColor,
  getLineColor,
  getTextColor,
  getTextStyle,
  pickedEdge,
  resetTextStyle,
  setEdgeColor,
  getTheme,
  laneText,
  listGroups,
  parsePresets,
  pickedObject,
  setObjectColor,
  setStyleColor,
  setLineColor,
  setTextColor,
  setTextStyle,
  setTheme,
  swatches,
  tint
} from './colors';

describe('getTheme / setTheme', () => {
  it('reports an editor-managed theme as automatic', () => {
    expect(getTheme('{}')).toBe('auto');
    expect(getTheme('{"theme":"redux-color"}')).toBe('auto');
    expect(getTheme('{"theme":"redux-dark-color"}')).toBe('auto');
    expect(getTheme('{"theme":"forest"}')).toBe('forest');
  });

  it('sets a theme of the user’s own, and returns to automatic by dropping it', () => {
    const forest = setTheme('{"theme":"redux-color","look":"neo"}', 'forest');
    expect(JSON.parse(forest)).toEqual({ look: 'neo', theme: 'forest' });
    expect(JSON.parse(setTheme(forest, 'auto'))).toEqual({ look: 'neo' });
  });

  it('leaves an unparsable config alone', () => {
    expect(setTheme('{oops', 'forest')).toBe('{oops');
    expect(getTheme('{oops')).toBe('auto');
  });
});

describe('getLineColor / setLineColor', () => {
  it('sets and clears the line colour, keeping other theme variables', () => {
    const red = setLineColor('{"themeVariables":{"fontSize":"18px"}}', '#d64545');
    expect(JSON.parse(red)).toEqual({ themeVariables: { fontSize: '18px', lineColor: '#d64545' } });
    expect(getLineColor(red)).toBe('#d64545');
    expect(JSON.parse(setLineColor(red, undefined))).toEqual({
      themeVariables: { fontSize: '18px' }
    });
  });

  it('drops theme variables left empty', () => {
    expect(JSON.parse(setLineColor(setLineColor('{}', '#000000'), undefined))).toEqual({});
    expect(getLineColor('{}')).toBeUndefined();
  });

  it('refuses a value that is not a colour', () => {
    expect(setLineColor('{}', 'red;}')).toBe('{}');
  });
});

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph shop [Online shop]
    C[Accept order]
  end
  %% subgraph Commented
  subgraph wh["Warehouse"]
    subgraph pick
      G[Pick]
    end
  end
  A --> C`;

describe('listGroups', () => {
  it('lists the lanes of a swimlane diagram with their titles', () => {
    expect(listGroups(lanes)).toEqual([
      { id: 'Customer', label: 'Customer' },
      { id: 'shop', label: 'Online shop' },
      { id: 'wh', label: 'Warehouse' },
      { id: 'pick', label: 'pick' }
    ]);
  });

  it('lists flowchart subgraphs too, and nothing for other diagrams', () => {
    expect(listGroups('flowchart TD\r\n  subgraph one\r\n    a\r\n  end')).toEqual([
      { id: 'one', label: 'one' }
    ]);
    expect(listGroups('sequenceDiagram\n  A->>B: subgraph x')).toEqual([]);
  });

  it('skips groups whose title has no id a style statement could name', () => {
    expect(listGroups('flowchart TD\n  subgraph "Two words"\n    a\n  end')).toEqual([]);
  });

  it('lists lanes with Japanese ids, which style statements accept', () => {
    const code = 'swimlane-beta LR\n  subgraph 営業[営業部]\n    申請[申請する]\n  end';
    expect(listGroups(code)).toEqual([{ id: '営業', label: '営業部' }]);
    expect(setStyleColor(code, '営業', swatches[0])).toContain('style 営業 fill:');
  });
});

describe('getStyleColor / setStyleColor', () => {
  const blue = swatches[0];

  it('adds a style statement for the lane', () => {
    const code = setStyleColor(lanes, 'shop', blue);
    expect(code).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
    expect(getStyleColor(code, 'shop')).toEqual({ fill: blue.fill, stroke: blue.stroke });
    expect(getStyleColor(code, 'Customer')).toBeUndefined();
  });

  it('replaces the colours of an existing style statement, keeping its other properties', () => {
    const code = `${lanes}\n  style shop fill:#fff,stroke:#000,stroke-width:3px`;
    expect(setStyleColor(code, 'shop', blue)).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText},stroke-width:3px`
    );
  });

  it('keeps the lane title readable on the light fill, also in dark mode', () => {
    expect(setStyleColor(lanes, 'shop', blue)).toContain(`color:${laneText}`);
  });

  it('removes the colours, and the statement once nothing is left', () => {
    const colored = setStyleColor(lanes, 'shop', blue);
    expect(setStyleColor(colored, 'shop', undefined)).toBe(lanes);
    const wide = `${lanes}\n  style shop fill:#fff,color:#000,stroke-width:3px`;
    expect(setStyleColor(wide, 'shop', undefined)).toBe(`${lanes}\n  style shop stroke-width:3px`);
  });

  it('does not touch the style of a node or lane with a longer name', () => {
    const code = `${lanes}\n  style shopper fill:#fff`;
    expect(setStyleColor(code, 'shop', blue)).toBe(
      `${code}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
  });

  it('keeps a trailing newline at the end', () => {
    expect(setStyleColor(`${lanes}\n`, 'shop', blue)).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}\n`
    );
  });

  it('keeps Windows line endings', () => {
    const code = 'swimlane-beta LR\r\n  subgraph a\r\n    x\r\n  end';
    expect(setStyleColor(code, 'a', blue)).toBe(
      `${code}\r\n  style a fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
  });

  it('builds a light fill from a custom colour', () => {
    const code = setStyleColor(lanes, 'Customer', { fill: tint('#3366cc'), stroke: '#3366cc' });
    expect(code).toContain(
      `style Customer fill:${tint('#3366cc')},stroke:#3366cc,color:${laneText}`
    );
    expect(tint('#000000')).toBe('#d6d6d6');
    expect(tint('#ffffff')).toBe('#ffffff');
  });
});

describe('colorAllGroups', () => {
  it('gives every lane its own swatch, in order', () => {
    const code = colorAllGroups(lanes);
    listGroups(lanes).forEach(({ id }, index) => {
      expect(getStyleColor(code, id)?.stroke).toBe(swatches[index % swatches.length].stroke);
    });
  });

  it('clears every lane colour', () => {
    expect(colorAllGroups(colorAllGroups(lanes), true)).toBe(lanes);
  });
});

const c4 = 'C4Context\n  Person(a, "Alice")\n  System(s, "Sys")';

describe('getObjectColor / setObjectColor (C4)', () => {
  const blue = swatches[0];

  it('adds an UpdateElementStyle statement', () => {
    const code = setObjectColor(c4, 'a', blue, 'c4');
    expect(code).toBe(
      `${c4}\n  UpdateElementStyle(a, $bgColor="${blue.fill}", $borderColor="${blue.stroke}", $fontColor="${laneText}")`
    );
    expect(getObjectColor(code, 'a', 'c4')).toEqual({ fill: blue.fill, stroke: blue.stroke });
    expect(getObjectColor(code, 's', 'c4')).toBeUndefined();
  });

  it('replaces the colours of an existing statement, keeping its other settings', () => {
    const code = `${c4}\n  UpdateElementStyle(a, $bgColor="grey", $shape="RoundedBoxShape()")`;
    expect(setObjectColor(code, 'a', blue, 'c4')).toBe(
      `${c4}\n  UpdateElementStyle(a, $bgColor="${blue.fill}", $borderColor="${blue.stroke}", $fontColor="${laneText}", $shape="RoundedBoxShape()")`
    );
    expect(setObjectColor(code, 'a', undefined, 'c4')).toBe(
      `${c4}\n  UpdateElementStyle(a, $shape="RoundedBoxShape()")`
    );
  });

  it('removes the statement once nothing is left', () => {
    expect(setObjectColor(setObjectColor(c4, 'a', blue, 'c4'), 'a', undefined, 'c4')).toBe(c4);
  });

  it('uses style statements for every other diagram', () => {
    expect(setObjectColor(lanes, 'shop', blue, 'style')).toBe(setStyleColor(lanes, 'shop', blue));
    expect(getObjectColor(setStyleColor(lanes, 'A', blue), 'A', 'style')).toEqual({
      fill: blue.fill,
      stroke: blue.stroke
    });
  });
});

describe('colorAll', () => {
  it('gives each object its own swatch, and clears them again', () => {
    const colored = colorAll(c4, ['a', 's'], 'c4');
    expect(getObjectColor(colored, 'a', 'c4')?.stroke).toBe(swatches[0].stroke);
    expect(getObjectColor(colored, 's', 'c4')?.stroke).toBe(swatches[1].stroke);
    expect(colorAll(colored, ['a', 's'], 'c4', true)).toBe(c4);
  });
});

describe('pickedObject', () => {
  const ids = ['A', 'Idle', 'Animal', 'CUSTOMER', 'r1', 'a', 'my-node'];
  it.each([
    ['graph-2-flowchart-A-0', 'A'],
    ['graph-2-flowchart-my-node-3', 'my-node'],
    ['graph-2-state-Idle-1', 'Idle'],
    ['graph-4-classId-Animal-34', 'Animal'],
    ['graph-6-entity-CUSTOMER-0', 'CUSTOMER'],
    ['graph-8-r1', 'r1'],
    ['graph-14-a', 'a']
  ])('finds the object behind the element %s', (domId, id) => {
    expect(pickedObject(domId, domId.split('-').slice(0, 2).join('-'), ids)).toBe(id);
  });

  it('finds nothing for other elements', () => {
    expect(pickedObject('graph-2-flowchart-Z-0', 'graph-2', ids)).toBeUndefined();
    expect(pickedObject('other-a', 'graph-2', ids)).toBeUndefined();
  });
});

const flow = 'flowchart LR\n  A --> B\n  B --> C\n  C --> D';

describe('getEdgeColor / setEdgeColor', () => {
  it('adds a linkStyle statement for the edge', () => {
    const code = setEdgeColor(flow, 1, '#d64545');
    expect(code).toBe(`${flow}\n  linkStyle 1 stroke:#d64545`);
    expect(getEdgeColor(code, 1)).toBe('#d64545');
    expect(getEdgeColor(code, 0)).toBeUndefined();
  });

  it('changes the colour of an existing statement, keeping its other properties', () => {
    const code = `${flow}\n  linkStyle 2 stroke:#000,stroke-width:4px`;
    expect(setEdgeColor(code, 2, '#3b73c9')).toBe(
      `${flow}\n  linkStyle 2 stroke:#3b73c9,stroke-width:4px`
    );
    expect(setEdgeColor(code, 2, undefined)).toBe(`${flow}\n  linkStyle 2 stroke-width:4px`);
    expect(setEdgeColor(setEdgeColor(flow, 0, '#3b73c9'), 0, undefined)).toBe(flow);
  });

  it('takes an edge out of a statement shared with other edges', () => {
    const code = `${flow}\n  linkStyle 0,2 stroke:#000,stroke-width:4px`;
    expect(getEdgeColor(code, 2)).toBe('#000');
    expect(setEdgeColor(code, 2, '#d64545')).toBe(
      `${flow}\n  linkStyle 0 stroke:#000,stroke-width:4px\n  linkStyle 2 stroke:#d64545,stroke-width:4px`
    );
  });

  it('leaves linkStyle default alone and refuses a value that is not a colour', () => {
    const code = `${flow}\n  linkStyle default stroke:#999`;
    expect(getEdgeColor(code, 0)).toBeUndefined();
    expect(setEdgeColor(code, 0, '#d64545')).toBe(`${code}\n  linkStyle 0 stroke:#d64545`);
    expect(setEdgeColor(flow, 0, 'red;}')).toBe(flow);
  });
});

describe('pickedEdge', () => {
  const ids = ['L_A_B_0', 'L_B_C_0', 'e2'];
  it('finds the edge behind a path or a label', () => {
    expect(pickedEdge({ dataId: 'L_B_C_0', id: 'graph-2-L_B_C_0' }, ids)).toBe(1);
    expect(pickedEdge({ dataId: null, id: 'edge-label-C-A-e2' }, ids)).toBe(2);
    expect(pickedEdge({ dataId: null, id: 'graph-2-flowchart-A-0' }, ids)).toBeUndefined();
  });
});

describe('parsePresets', () => {
  it('reads a deployment palette of border colours, with light fills to match', () => {
    expect(parsePresets('#003366, #E60012 #00a040')).toEqual([
      { fill: tint('#003366'), stroke: '#003366' },
      { fill: tint('#e60012'), stroke: '#e60012' },
      { fill: tint('#00a040'), stroke: '#00a040' }
    ]);
  });

  it('skips what is not a colour, and gives nothing for an empty setting', () => {
    expect(parsePresets('#003366,red,#12345,url(x)')).toEqual([
      { fill: tint('#003366'), stroke: '#003366' }
    ]);
    expect(parsePresets('')).toBeUndefined();
    expect(parsePresets('nope')).toBeUndefined();
  });
});

describe('addRecent', () => {
  it('keeps the latest colours first, without repeats, at most eight', () => {
    expect(addRecent(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111']);
    expect(addRecent([], '#ABCDEF')).toEqual(['#abcdef']);
    const many = [
      '#000001',
      '#000002',
      '#000003',
      '#000004',
      '#000005',
      '#000006',
      '#000007',
      '#000008'
    ];
    expect(addRecent(many, '#000009')).toEqual(['#000009', ...many.slice(0, 7)]);
    expect(addRecent(many, 'red')).toEqual(many);
  });
});

describe('colorAll with a deployment palette', () => {
  it('uses the given palette', () => {
    const palette = parsePresets('#003366,#e60012') ?? [];
    const colored = colorAll(c4, ['a', 's'], 'c4', false, palette);
    expect(getObjectColor(colored, 's', 'c4')?.stroke).toBe('#e60012');
    expect(getStyleColor(colorAllGroups(lanes, false, palette), 'shop')?.stroke).toBe('#e60012');
  });
});

describe('listGroups with front matter', () => {
  it('lists the lanes of a swimlane diagram that starts with front matter', () => {
    expect(listGroups('---\ntitle: T\n---\nswimlane-beta LR\n  subgraph L\n    a\n  end')).toEqual([
      { id: 'L', label: 'L' }
    ]);
  });
});

const boxes = 'flowchart TD\n  A[Alpha] --> B[Beta]';

describe('getTextStyle / setTextStyle', () => {
  const blue = swatches[0];

  it('adds bold and a size to one style statement, and reads them back', () => {
    const bold = setTextStyle(boxes, 'A', { bold: true }, 'style');
    expect(bold).toBe(`${boxes}\n  style A font-weight:bold`);
    const sized = setTextStyle(bold, 'A', { size: 'large' }, 'style');
    expect(sized).toBe(`${boxes}\n  style A font-weight:bold,font-size:18px`);
    expect(getTextStyle(sized, 'A', 'style')).toEqual({ bold: true, size: 'large' });
    expect(getTextStyle(sized, 'B', 'style')).toEqual({ bold: false, size: 'normal' });
    expect(sized.match(/style A/g)).toHaveLength(1);
  });

  it('shares the statement with the colours, and removes the properties on normal', () => {
    const colored = setStyleColor(boxes, 'A', blue);
    const styled = setTextStyle(colored, 'A', { bold: true, size: 'xlarge' }, 'style');
    expect(styled).toBe(
      `${boxes}\n  style A fill:${blue.fill},stroke:${blue.stroke},color:${laneText},font-weight:bold,font-size:24px`
    );
    expect(setTextStyle(styled, 'A', { bold: false, size: 'normal' }, 'style')).toBe(colored);
    const plain = setTextStyle(boxes, 'A', { bold: true }, 'style');
    expect(setTextStyle(plain, 'A', { bold: false }, 'style')).toBe(boxes);
  });

  it('replaces a size written by hand, and reads a numeric weight as bold', () => {
    const code = `${boxes}\n  style A font-size:30px,font-weight:700`;
    expect(getTextStyle(code, 'A', 'style')).toEqual({ bold: true, size: 'normal' });
    expect(setTextStyle(code, 'A', { size: 'small' }, 'style')).toBe(
      `${boxes}\n  style A font-weight:bold,font-size:12px`
    );
  });

  it('leads with a harmless property in class diagrams, whose grammar rejects a leading font-size', () => {
    const cls = 'classDiagram\n  class Animal';
    const bold = setTextStyle(cls, 'Animal', { bold: true }, 'class');
    expect(bold).toBe(`${cls}\n  style Animal opacity:1,font-weight:bold`);
    expect(getTextStyle(bold, 'Animal', 'class')).toEqual({ bold: true, size: 'normal' });
    // A colour in front makes it unnecessary; clearing the colour brings it back.
    const colored = setObjectColor(bold, 'Animal', blue, 'class');
    expect(colored).toBe(
      `${cls}\n  style Animal fill:${blue.fill},stroke:${blue.stroke},color:${laneText},font-weight:bold`
    );
    expect(setObjectColor(colored, 'Animal', undefined, 'class')).toBe(bold);
    expect(setTextStyle(bold, 'Animal', { bold: false }, 'class')).toBe(cls);
  });

  it('leaves C4 alone: UpdateElementStyle has no font weight or size', () => {
    expect(setTextStyle(c4, 'a', { bold: true, size: 'large' }, 'c4')).toBe(c4);
    expect(getTextStyle(c4, 'a', 'c4')).toEqual({ bold: false, size: 'normal' });
  });
});

describe('getTextColor / setTextColor / resetTextStyle', () => {
  const blue = swatches[0];

  it('sets the text colour after the fill and border, and clears it', () => {
    const red = setTextColor(boxes, 'A', '#d64545', 'style');
    expect(red).toBe(`${boxes}\n  style A color:#d64545`);
    expect(getTextColor(red, 'A', 'style')).toBe('#d64545');
    expect(getTextColor(red, 'B', 'style')).toBeUndefined();
    expect(setTextColor(red, 'A', undefined, 'style')).toBe(boxes);
    expect(setTextColor(setStyleColor(boxes, 'A', blue), 'A', '#d64545', 'style')).toBe(
      `${boxes}\n  style A fill:${blue.fill},stroke:${blue.stroke},color:#d64545`
    );
  });

  it('keeps a chosen text colour when the fill changes', () => {
    const red = setTextColor(boxes, 'A', '#d64545', 'style');
    expect(setStyleColor(red, 'A', blue)).toBe(
      `${boxes}\n  style A fill:${blue.fill},stroke:${blue.stroke},color:#d64545`
    );
  });

  it('uses $fontColor for C4, and keeps it when the fill changes', () => {
    const red = setTextColor(c4, 'a', '#d64545', 'c4');
    expect(red).toBe(`${c4}\n  UpdateElementStyle(a, $fontColor="#d64545")`);
    expect(getTextColor(red, 'a', 'c4')).toBe('#d64545');
    expect(setObjectColor(red, 'a', blue, 'c4')).toBe(
      `${c4}\n  UpdateElementStyle(a, $bgColor="${blue.fill}", $borderColor="${blue.stroke}", $fontColor="#d64545")`
    );
    expect(setTextColor(red, 'a', undefined, 'c4')).toBe(c4);
  });

  it('refuses a value that is not a colour', () => {
    expect(setTextColor(boxes, 'A', 'red;}', 'style')).toBe(boxes);
    expect(setTextColor(c4, 'a', 'red"', 'c4')).toBe(c4);
  });

  it('resets bold, size and text colour, leaving the fill and other properties', () => {
    const code = `${boxes}\n  style A fill:#fff,stroke:#000,color:#d64545,font-weight:bold,font-size:18px,stroke-width:3px`;
    expect(resetTextStyle(code, 'A', 'style')).toBe(
      `${boxes}\n  style A fill:#fff,stroke:#000,stroke-width:3px`
    );
    expect(resetTextStyle(`${boxes}\n  style A font-weight:bold`, 'A', 'style')).toBe(boxes);
    expect(resetTextStyle(boxes, 'A', 'style')).toBe(boxes);
    expect(resetTextStyle(setTextColor(c4, 'a', '#d64545', 'c4'), 'a', 'c4')).toBe(c4);
  });
});
