import { describe, expect, it } from 'vitest';
import {
  getDirection,
  getLayoutOptions,
  pickDirection,
  setDirection,
  setLayoutOptions,
  viewBoxSize
} from './layout';

describe('getDirection / setDirection', () => {
  it.each([
    ['flowchart TD\n  A --> B', 'TB', 'flowchart LR\n  A --> B'],
    ['graph LR\n  A --> B', 'LR', 'graph LR\n  A --> B'],
    ['flowchart\n  A --> B', 'TB', 'flowchart LR\n  A --> B'],
    ['swimlane-beta TB\n  subgraph X\n  end', 'TB', 'swimlane-beta LR\n  subgraph X\n  end']
  ])('rewrites the header of %j', (code, current, toLR) => {
    expect(getDirection(code)).toBe(current);
    expect(setDirection(code, 'LR')).toBe(toLR);
  });

  it('keeps front matter and comments in front of the header', () => {
    const code = '---\ntitle: T\n---\n%% note\nflowchart TB\n  A --> B';
    expect(getDirection(code)).toBe('TB');
    expect(setDirection(code, 'LR')).toBe('---\ntitle: T\n---\n%% note\nflowchart LR\n  A --> B');
  });

  it('adds a direction statement to diagrams that take one', () => {
    expect(getDirection('stateDiagram-v2\n  [*] --> A')).toBe('TB');
    expect(setDirection('stateDiagram-v2\n  [*] --> A', 'LR')).toBe(
      'stateDiagram-v2\n  direction LR\n  [*] --> A'
    );
    expect(getDirection('erDiagram\n  A ||--o{ B : has')).toBe('TB');
  });

  it('changes the top-level direction statement, not one inside a composite state', () => {
    const code =
      'stateDiagram-v2\n  state Busy {\n    direction LR\n    a --> b\n  }\n  direction TB\n  [*] --> Busy';
    expect(getDirection(code)).toBe('TB');
    expect(setDirection(code, 'LR')).toBe(code.replace('  direction TB', '  direction LR'));
  });

  it('reads and replaces a class diagram direction', () => {
    const code = 'classDiagram\n  direction RL\n  A <|-- B';
    expect(getDirection(code)).toBe('LR');
    expect(setDirection(code, 'TB')).toBe('classDiagram\n  direction TB\n  A <|-- B');
  });

  it('handles Windows line endings, which Monaco can write, and keeps them', () => {
    expect(getDirection('flowchart TD\r\n  A --> B')).toBe('TB');
    expect(setDirection('flowchart TD\r\n  A --> B', 'LR')).toBe('flowchart LR\r\n  A --> B');
    expect(getDirection('classDiagram\r\n  direction RL\r\n  A <|-- B')).toBe('LR');
    expect(setDirection('stateDiagram-v2\r\n  [*] --> A', 'LR')).toBe(
      'stateDiagram-v2\r\n  direction LR\r\n  [*] --> A'
    );
  });

  it('reports diagrams whose direction cannot be set', () => {
    expect(getDirection('architecture-beta\n  service a(server)[A]')).toBeUndefined();
    expect(getDirection('sequenceDiagram\n  A->>B: hi')).toBeUndefined();
    expect(setDirection('sequenceDiagram\n  A->>B: hi', 'LR')).toBe('sequenceDiagram\n  A->>B: hi');
  });
});

describe('pickDirection', () => {
  it('chooses the direction that shows the diagram largest in the view', () => {
    const sizes = { LR: { height: 200, width: 1200 }, TB: { height: 1500, width: 300 } };
    expect(pickDirection(sizes, { height: 900, width: 1600 })).toBe('LR');
    expect(pickDirection(sizes, { height: 1600, width: 900 })).toBe('TB');
  });

  it('prefers left to right for a long chain even though it is far wider than the view', () => {
    const sizes = { LR: { height: 60, width: 900 }, TB: { height: 620, width: 110 } };
    expect(pickDirection(sizes, { height: 639, width: 895 })).toBe('LR');
  });
});

describe('viewBoxSize', () => {
  it('reads the size from an SVG viewBox', () => {
    expect(viewBoxSize('<svg viewBox="-8 -8 316.5 1200" id="x">')).toEqual({
      height: 1200,
      width: 316.5
    });
    expect(viewBoxSize('<svg>')).toBeUndefined();
  });
});

describe('getLayoutOptions / setLayoutOptions', () => {
  it("defaults to ELK, which is mermaid 12's own default, and normal spacing", () => {
    expect(getLayoutOptions('{}')).toEqual({ engine: 'elk', spacing: 'normal' });
  });

  it('asks for the standard engine by name and ELK by leaving the key out', () => {
    const dagre = setLayoutOptions('{"theme":"dark"}', { engine: 'dagre', spacing: 'normal' });
    expect(JSON.parse(dagre)).toEqual({ layout: 'dagre', theme: 'dark' });
    expect(getLayoutOptions(dagre).engine).toBe('dagre');
    const elk = JSON.parse(setLayoutOptions(dagre, { engine: 'elk', spacing: 'normal' }));
    expect(elk).toEqual({ theme: 'dark' });
    expect(getLayoutOptions('{"layout":"elk"}').engine).toBe('elk');
  });

  it('sets node and rank spacing for the diagrams that use them', () => {
    const compact = setLayoutOptions('{"flowchart":{"curve":"basis"}}', {
      engine: 'dagre',
      spacing: 'compact'
    });
    const parsed = JSON.parse(compact);
    expect(parsed.flowchart).toEqual({ curve: 'basis', nodeSpacing: 25, rankSpacing: 30 });
    expect(parsed.state).toEqual({ nodeSpacing: 25, rankSpacing: 30 });
    expect(getLayoutOptions(compact).spacing).toBe('compact');
    const normal = JSON.parse(setLayoutOptions(compact, { engine: 'dagre', spacing: 'normal' }));
    expect(normal).toEqual({ flowchart: { curve: 'basis' }, layout: 'dagre' });
  });

  it('leaves an unparsable config alone', () => {
    expect(setLayoutOptions('{oops', { engine: 'elk', spacing: 'wide' })).toBe('{oops');
    expect(getLayoutOptions('{oops')).toEqual({ engine: 'elk', spacing: 'normal' });
  });
});
