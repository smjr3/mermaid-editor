import { describe, expect, it } from 'vitest';
import {
  colorAllGroups,
  getGroupColor,
  getLineColor,
  getTheme,
  laneText,
  listGroups,
  setGroupColor,
  setLineColor,
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
});

describe('getGroupColor / setGroupColor', () => {
  const blue = swatches[0];

  it('adds a style statement for the lane', () => {
    const code = setGroupColor(lanes, 'shop', blue);
    expect(code).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
    expect(getGroupColor(code, 'shop')).toEqual({ fill: blue.fill, stroke: blue.stroke });
    expect(getGroupColor(code, 'Customer')).toBeUndefined();
  });

  it('replaces the colours of an existing style statement, keeping its other properties', () => {
    const code = `${lanes}\n  style shop fill:#fff,stroke:#000,stroke-width:3px`;
    expect(setGroupColor(code, 'shop', blue)).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText},stroke-width:3px`
    );
  });

  it('keeps the lane title readable on the light fill, also in dark mode', () => {
    expect(setGroupColor(lanes, 'shop', blue)).toContain(`color:${laneText}`);
  });

  it('removes the colours, and the statement once nothing is left', () => {
    const colored = setGroupColor(lanes, 'shop', blue);
    expect(setGroupColor(colored, 'shop', undefined)).toBe(lanes);
    const wide = `${lanes}\n  style shop fill:#fff,color:#000,stroke-width:3px`;
    expect(setGroupColor(wide, 'shop', undefined)).toBe(`${lanes}\n  style shop stroke-width:3px`);
  });

  it('does not touch the style of a node or lane with a longer name', () => {
    const code = `${lanes}\n  style shopper fill:#fff`;
    expect(setGroupColor(code, 'shop', blue)).toBe(
      `${code}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
  });

  it('keeps a trailing newline at the end', () => {
    expect(setGroupColor(`${lanes}\n`, 'shop', blue)).toBe(
      `${lanes}\n  style shop fill:${blue.fill},stroke:${blue.stroke},color:${laneText}\n`
    );
  });

  it('keeps Windows line endings', () => {
    const code = 'swimlane-beta LR\r\n  subgraph a\r\n    x\r\n  end';
    expect(setGroupColor(code, 'a', blue)).toBe(
      `${code}\r\n  style a fill:${blue.fill},stroke:${blue.stroke},color:${laneText}`
    );
  });

  it('builds a light fill from a custom colour', () => {
    const code = setGroupColor(lanes, 'Customer', { fill: tint('#3366cc'), stroke: '#3366cc' });
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
      expect(getGroupColor(code, id)?.stroke).toBe(swatches[index % swatches.length].stroke);
    });
  });

  it('clears every lane colour', () => {
    expect(colorAllGroups(colorAllGroups(lanes), true)).toBe(lanes);
  });
});
