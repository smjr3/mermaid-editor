import { diagramData } from '@mermaid-js/examples';
import mermaid from 'mermaid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { headerLine } from './diagramEdit';
import { checkEdit } from './diagramModify';
import { localExamples, localSamples } from './localSamples';
import { diagramEdges, diagramObjects } from './mermaid';
import { canMove, moveNode, siblings } from './reorder';

const fanOut = `flowchart TD
  C{Decide}
  C -->|One| D[Dee]
  C -->|Two| E[Eee]
  C -->|Three| F[Eff]`;

const lines = (code: string) => code.split('\n');

describe('siblings', () => {
  it('finds none but the node itself in a chain', async () => {
    const code = 'flowchart TD\n  A --> B --> C';
    expect(await siblings(code, 'flowchart', 'B')).toEqual(['B']);
    expect(await siblings(code, 'flowchart', 'A')).toEqual(['A']);
  });

  it('lists a fan-out in the order of the arrows', async () => {
    expect(await siblings(fanOut, 'flowchart', 'E')).toEqual(['D', 'E', 'F']);
  });

  it('orders a fan-out by its arrows, not by where the nodes were defined', async () => {
    const code = 'flowchart TD\n  D[Dee]\n  E[Eee]\n  C --> E\n  C --> D';
    expect(await siblings(code, 'flowchart', 'D')).toEqual(['E', 'D']);
  });

  it('keeps siblings inside their subgraph', async () => {
    const code = 'flowchart TD\n  subgraph s\n    C --> D\n    C --> E\n  end\n  C --> F';
    expect(await siblings(code, 'flowchart', 'D')).toEqual(['D', 'E']);
    expect(await siblings(code, 'flowchart', 'F')).toEqual(['F']);
  });

  it('lists roots together, in the order of their first mentions', async () => {
    expect(await siblings('flowchart TD\n  A --> B\n  C --> D', 'flowchart', 'C')).toEqual([
      'A',
      'C'
    ]);
    expect(
      await siblings('flowchart TD\n  B\n  A\n  A --> X\n  B --> X', 'flowchart', 'A')
    ).toEqual(['B', 'A']);
  });

  it('does not pair a root with one drawn deeper down', async () => {
    // R has no arrows in, but its only target is in rank 2: it is drawn beside B.
    const code = 'flowchart TD\n  A --> B --> X\n  R --> X';
    expect(await siblings(code, 'flowchart', 'A')).toEqual(['A']);
    expect(await siblings(code, 'flowchart', 'R')).toEqual(['R']);
  });

  it('treats the ends of parallel branches as different ranks', async () => {
    const code = 'flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> E';
    expect(await siblings(code, 'flowchart', 'B')).toEqual(['B', 'C']);
    expect(await siblings(code, 'flowchart', 'D')).toEqual(['D']);
  });

  it('pairs nodes that share several predecessors', async () => {
    const code = 'flowchart TD\n  A --> D\n  B --> D\n  A --> E\n  B --> E';
    expect(await siblings(code, 'flowchart', 'E')).toEqual(['D', 'E']);
  });

  it('ignores a self loop', async () => {
    const code = 'flowchart TD\n  C --> D\n  D --> D\n  C --> E';
    expect(await siblings(code, 'flowchart', 'D')).toEqual(['D', 'E']);
  });

  it('is undefined for an unknown node, a lane, another kind, a swimlane or broken code', async () => {
    expect(await siblings(fanOut, 'flowchart', 'Z')).toBeUndefined();
    const lanes = 'flowchart TD\n  subgraph s\n    C --> D\n  end';
    expect(await siblings(lanes, 'flowchart', 's')).toBeUndefined();
    expect(await siblings('stateDiagram-v2\n  A --> B\n  A --> C', 'state', 'B')).toBeUndefined();
    const swim = 'swimlane-beta LR\n  subgraph a\n    C --> D\n    C --> E\n  end';
    expect(await siblings(swim, 'flowchart', 'D')).toBeUndefined();
    expect(await siblings('flowchart TD\n  A -->', 'flowchart', 'A')).toBeUndefined();
  });
});

describe('canMove', () => {
  it('is false in a chain and at the ends of a rank', async () => {
    expect(await canMove('flowchart TD\n  A --> B --> C', 'flowchart', 'B', 'left')).toBe(false);
    expect(await canMove('flowchart TD\n  A --> B --> C', 'flowchart', 'B', 'right')).toBe(false);
    expect(await canMove(fanOut, 'flowchart', 'D', 'left')).toBe(false);
    expect(await canMove(fanOut, 'flowchart', 'F', 'right')).toBe(false);
  });

  it('is true inside a rank, both ways', async () => {
    expect(await canMove(fanOut, 'flowchart', 'E', 'left')).toBe(true);
    expect(await canMove(fanOut, 'flowchart', 'E', 'right')).toBe(true);
    expect(await canMove(fanOut, 'flowchart', 'D', 'right')).toBe(true);
    expect(await canMove(fanOut, 'flowchart', 'F', 'left')).toBe(true);
  });

  it('is false when both statements share one line', async () => {
    expect(await canMove('flowchart TD\n  C --> D & E', 'flowchart', 'E', 'left')).toBe(false);
    expect(await canMove('flowchart TD\n  C --> D; C --> E', 'flowchart', 'E', 'left')).toBe(false);
  });

  it('is false when the two lines are in different subgraphs', async () => {
    const code =
      'flowchart TD\n  subgraph s\n    D\n    E\n  end\n  subgraph t\n    C --> D\n  end\n  C --> E';
    expect(await siblings(code, 'flowchart', 'E')).toEqual(['D', 'E']);
    expect(await canMove(code, 'flowchart', 'E', 'left')).toBe(false);
  });

  it('is false for a swimlane, whose layout does not follow the code order', async () => {
    const swim =
      'swimlane-beta LR\n  subgraph a\n    C\n  end\n  subgraph b\n    D\n    E\n  end\n  C --> D\n  C --> E';
    expect(await canMove(swim, 'flowchart', 'E', 'left')).toBe(false);
    expect(await moveNode(swim, 'flowchart', 'E', 'left')).toBeUndefined();
  });
});

describe('moveNode', () => {
  it('swaps the two arrow lines of a fan-out, labels and all', async () => {
    const moved = await moveNode(fanOut, 'flowchart', 'E', 'left');
    expect(moved).toBe(`flowchart TD
  C{Decide}
  C -->|Two| E[Eee]
  C -->|One| D[Dee]
  C -->|Three| F[Eff]`);
  });

  it('moves right by swapping with the next line', async () => {
    const moved = await moveNode(fanOut, 'flowchart', 'E', 'right');
    expect(lines(moved ?? '').slice(2)).toEqual([
      '  C -->|One| D[Dee]',
      '  C -->|Three| F[Eff]',
      '  C -->|Two| E[Eee]'
    ]);
    expect(await siblings(moved ?? '', 'flowchart', 'E')).toEqual(['D', 'F', 'E']);
  });

  it('is undefined at the boundary and in a chain', async () => {
    expect(await moveNode(fanOut, 'flowchart', 'D', 'left')).toBeUndefined();
    expect(await moveNode(fanOut, 'flowchart', 'F', 'right')).toBeUndefined();
    expect(
      await moveNode('flowchart TD\n  A --> B --> C', 'flowchart', 'B', 'left')
    ).toBeUndefined();
  });

  it('comes back to the original text: left then right, right then left', async () => {
    const left = await moveNode(fanOut, 'flowchart', 'E', 'left');
    expect(await moveNode(left ?? '', 'flowchart', 'E', 'right')).toBe(fanOut);
    const right = await moveNode(fanOut, 'flowchart', 'E', 'right');
    expect(await moveNode(right ?? '', 'flowchart', 'E', 'left')).toBe(fanOut);
  });

  it('swaps only the arrow lines when the nodes are defined on their own lines first', async () => {
    const code = 'flowchart TD\n  D[Dee]\n  E[Eee]\n  C --> D\n  C --> E';
    expect(await moveNode(code, 'flowchart', 'E', 'left')).toBe(
      'flowchart TD\n  D[Dee]\n  E[Eee]\n  C --> E\n  C --> D'
    );
  });

  it('handles a node defined on its own line while its sibling is first named in an arrow', async () => {
    const code = 'flowchart TD\n  D[Dee]\n  C --> E\n  C --> D';
    expect(await siblings(code, 'flowchart', 'D')).toEqual(['E', 'D']);
    expect(await moveNode(code, 'flowchart', 'D', 'left')).toBe(
      'flowchart TD\n  D[Dee]\n  C --> D\n  C --> E'
    );
  });

  it('moves a node first mentioned inside a longer chain, taking its branch along', async () => {
    const code = 'flowchart TD\n  C --> D --> G\n  C --> E --> H';
    expect(await moveNode(code, 'flowchart', 'E', 'left')).toBe(
      'flowchart TD\n  C --> E --> H\n  C --> D --> G'
    );
    expect(await siblings(code, 'flowchart', 'G')).toEqual(['G']);
  });

  it('moves inside a subgraph only', async () => {
    const code =
      'flowchart TD\n  subgraph s[Step]\n    direction LR\n    C --> D\n    C --> E\n  end\n  C --> F';
    const moved = await moveNode(code, 'flowchart', 'E', 'left');
    expect(moved).toBe(
      'flowchart TD\n  subgraph s[Step]\n    direction LR\n    C --> E\n    C --> D\n  end\n  C --> F'
    );
    expect(await moveNode(code, 'flowchart', 'F', 'left')).toBeUndefined();
  });

  it('leaves direction statements and comments where they are', async () => {
    const code = `flowchart TD
  %% the decision
  C --> D
  %% between
  C --> E
  subgraph s
    direction RL
    X --> Y
  end`;
    const moved = lines((await moveNode(code, 'flowchart', 'E', 'left')) ?? '');
    expect(moved[1]).toBe('  %% the decision');
    expect(moved[2]).toBe('  C --> E');
    expect(moved[3]).toBe('  %% between');
    expect(moved[4]).toBe('  C --> D');
    expect(moved[6]).toBe('    direction RL');
    expect(moved.filter((line) => line.trim().startsWith('%%'))).toEqual(
      lines(code).filter((line) => line.trim().startsWith('%%'))
    );
  });

  it('keeps the header, front matter and a directive first', async () => {
    const code = `---
title: Flow
---
%%{init: {"flowchart": {"curve": "linear"}}}%%
flowchart TD
  C --> D
  C --> E`;
    const moved = lines((await moveNode(code, 'flowchart', 'E', 'left')) ?? '');
    expect(moved.slice(0, 5)).toEqual(lines(code).slice(0, 5));
    expect(moved.slice(5)).toEqual(['  C --> E', '  C --> D']);
  });

  it('renumbers linkStyle with the arrows and leaves style lines alone', async () => {
    const code = `flowchart TD
  C --> D
  C --> E
  C --> F
  style D fill:#f00
  linkStyle 0 stroke:red
  linkStyle 1 stroke:blue
  linkStyle 2 stroke:green`;
    const moved = await moveNode(code, 'flowchart', 'E', 'left');
    expect(moved).toBe(`flowchart TD
  C --> E
  C --> D
  C --> F
  style D fill:#f00
  linkStyle 1 stroke:red
  linkStyle 0 stroke:blue
  linkStyle 2 stroke:green`);
    expect(await moveNode(moved ?? '', 'flowchart', 'E', 'right')).toBe(code);
  });

  it('renumbers a linkStyle list and leaves linkStyle default alone', async () => {
    const code = `flowchart TD
  C --> D
  C --> E
  C --> F
  linkStyle default stroke:grey
  linkStyle 0,2 stroke:red`;
    const moved = await moveNode(code, 'flowchart', 'F', 'left');
    expect(lines(moved ?? '').slice(4)).toEqual([
      '  linkStyle default stroke:grey',
      '  linkStyle 0,1 stroke:red'
    ]);
  });

  it('keeps every line as it was: only the order changes', async () => {
    const code = `flowchart LR
  A[Start] --> C{Decide}
  C -->|yes| D[/Dee/]:::hot
  C -->|no| E((Eee))
  classDef hot fill:#f96
  class E hot
  click D "https://example.invalid"`;
    const moved = await moveNode(code, 'flowchart', 'E', 'left');
    expect(lines(moved ?? '').toSorted()).toEqual(lines(code).toSorted());
    expect(lines(moved ?? '').slice(2, 4)).toEqual([
      '  C -->|no| E((Eee))',
      '  C -->|yes| D[/Dee/]:::hot'
    ]);
  });

  it('reorders roots by their first mentions', async () => {
    expect(await moveNode('flowchart TD\n  A --> B\n  C --> D', 'flowchart', 'C', 'left')).toBe(
      'flowchart TD\n  C --> D\n  A --> B'
    );
    expect(
      await moveNode('flowchart TD\n  B\n  A\n  A --> X\n  B --> X', 'flowchart', 'A', 'left')
    ).toBe('flowchart TD\n  A\n  B\n  A --> X\n  B --> X');
  });

  it('moves a node with several predecessors by its first incoming arrow', async () => {
    const code = 'flowchart TD\n  A --> D\n  B --> D\n  A --> E\n  B --> E';
    expect(await moveNode(code, 'flowchart', 'E', 'left')).toBe(
      'flowchart TD\n  A --> E\n  B --> D\n  A --> D\n  B --> E'
    );
  });

  it('supports graph and flowchart-elk headers, keeps CRLF, and refuses other kinds', async () => {
    expect(await moveNode('graph TD\r\n  C --> D\r\n  C --> E', 'flowchart', 'E', 'left')).toBe(
      'graph TD\r\n  C --> E\r\n  C --> D'
    );
    expect(await moveNode('flowchart-elk TD\n  C --> D\n  C --> E', 'flowchart', 'E', 'left')).toBe(
      'flowchart-elk TD\n  C --> E\n  C --> D'
    );
    expect(
      await moveNode('stateDiagram-v2\n  A --> B\n  A --> C', 'state', 'C', 'left')
    ).toBeUndefined();
    expect(
      await moveNode('classDiagram\n  A <|-- B\n  A <|-- C', 'class', 'C', 'left')
    ).toBeUndefined();
  });

  it('passes checkEdit and keeps the node and arrow sets', async () => {
    const moved = (await moveNode(fanOut, 'flowchart', 'F', 'left')) ?? '';
    expect(await checkEdit(fanOut, moved)).toBe(true);
    const ids = async (code: string) =>
      (await diagramObjects(code))?.items.map(({ id }) => id).toSorted();
    expect(await ids(moved)).toEqual(await ids(fanOut));
    const arrows = async (code: string) =>
      (await diagramEdges(code)).map(({ label }) => label).toSorted();
    expect(await arrows(moved)).toEqual(await arrows(fanOut));
  });
});

// mermaid draws in jsdom once text has a size: every box is as wide as its text.
const jsdomRect = Element.prototype.getBoundingClientRect;
const measured = () => {
  const proto = SVGElement.prototype as unknown as Record<string, unknown>;
  const box = (text: string) => ({ height: 16, width: Math.max(10, text.length * 8), x: 0, y: 0 });
  proto.getBBox = function (this: SVGElement) {
    return box(this.textContent ?? '');
  };
  proto.getComputedTextLength = function (this: SVGElement) {
    return (this.textContent ?? '').length * 8;
  };
  (Element.prototype as unknown as Record<string, unknown>).getBoundingClientRect = function (
    this: Element
  ) {
    const { height, width } = box(this.textContent ?? '');
    return { bottom: height, height, left: 0, right: width, top: 0, width, x: 0, y: 0 };
  };
};
const unmeasured = () => {
  delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
  delete (SVGElement.prototype as { getComputedTextLength?: unknown }).getComputedTextLength;
  Element.prototype.getBoundingClientRect = jsdomRect;
};

let renders = 0;
/** The centre of each drawn node, by id. */
const drawn = async (code: string): Promise<Map<string, { x: number; y: number }>> => {
  const { svg } = await mermaid.render(`reorder${renders++}`, code);
  const doc = new DOMParser().parseFromString(svg, 'text/html');
  const found = new Map<string, { x: number; y: number }>();
  for (const node of doc.querySelectorAll('g.node')) {
    const id = /-flowchart-(.+)-\d+$/.exec(node.id)?.[1];
    const at = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(node.getAttribute('transform') ?? '');
    if (id && at) found.set(id, { x: Number(at[1]), y: Number(at[2]) });
  }
  return found;
};

describe('the drawing follows the move', () => {
  beforeAll(() => {
    measured();
    document.body.innerHTML = '<div id="container"></div>';
    mermaid.initialize({ startOnLoad: false });
  });
  afterAll(unmeasured);

  const cases: {
    axis: 'x' | 'y';
    code: string;
    direction: 'left' | 'right';
    name: string;
    node: string;
    other: string;
  }[] = [
    {
      axis: 'x',
      code: fanOut,
      direction: 'left',
      name: 'dagre, top-down fan-out: x flips',
      node: 'E',
      other: 'D'
    },
    {
      axis: 'y',
      code: fanOut.replace('flowchart TD', 'flowchart LR'),
      direction: 'right',
      name: 'dagre, left-right fan-out: y flips',
      node: 'E',
      other: 'F'
    },
    {
      axis: 'x',
      code: fanOut.replace('flowchart TD', 'flowchart-elk TD'),
      direction: 'left',
      name: 'flowchart-elk header, top-down: x flips',
      node: 'E',
      other: 'D'
    },
    {
      axis: 'x',
      code: 'flowchart TD\n  D[Dee]\n  E[Eee]\n  C --> E\n  C --> D',
      direction: 'left',
      name: 'nodes defined first: the arrows decide',
      node: 'D',
      other: 'E'
    },
    {
      axis: 'x',
      code: 'flowchart TD\n  subgraph s[Step]\n    C --> D\n    C --> E\n  end\n  Z --> C',
      direction: 'left',
      name: 'inside a subgraph',
      node: 'E',
      other: 'D'
    },
    {
      axis: 'x',
      code: 'flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> E',
      direction: 'right',
      name: 'parallel branches: the branch head moves',
      node: 'B',
      other: 'C'
    },
    {
      axis: 'x',
      code: 'flowchart TD\n  A --> X\n  B --> X',
      direction: 'left',
      name: 'two roots',
      node: 'B',
      other: 'A'
    }
  ];

  it.each(cases)(
    '$name',
    async ({ axis, code, direction, node, other }) => {
      const before = await drawn(code);
      const moved = await moveNode(code, 'flowchart', node, direction);
      expect(moved).toBeDefined();
      const after = await drawn(moved ?? '');
      const sign = (map: Map<string, { x: number; y: number }>) =>
        Math.sign((map.get(node)?.[axis] ?? 0) - (map.get(other)?.[axis] ?? 0));
      expect(sign(before)).toBe(direction === 'left' ? 1 : -1);
      expect(sign(after)).toBe(direction === 'left' ? -1 : 1);
      // The other axis (the rank) does not change for either node.
      const rank = axis === 'x' ? 'y' : 'x';
      expect(after.get(node)?.[rank]).toBe(before.get(node)?.[rank]);
      expect(after.get(other)?.[rank]).toBe(before.get(other)?.[rank]);
    },
    30_000
  );

  it('a branch follows its head: parallel branches', async () => {
    const code = 'flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> E';
    const moved = (await moveNode(code, 'flowchart', 'B', 'right')) ?? '';
    const after = await drawn(moved);
    expect((after.get('D')?.x ?? 0) > (after.get('E')?.x ?? 0)).toBe(true);
  }, 30_000);
});

const flowchartHeader = /^\s*(?:flowchart-elk|flowchart|graph)\b/;
const samples = [
  ...diagramData.flatMap((diagram) =>
    diagram.examples.map((example) => ({
      code: example.code,
      name: `${diagram.name}: ${example.title}`
    }))
  ),
  ...Object.entries({ ...localSamples, ...localExamples }).flatMap(([name, list]) =>
    list.map((example) => ({ code: example.code, name: `${name}: ${example.title}` }))
  )
].filter(({ code }) => flowchartHeader.test(headerLine(code)));

describe('every flowchart sample', () => {
  it('has flowchart samples to try, and some node of them can move', async () => {
    expect(samples.length).toBeGreaterThan(3);
    let movable = 0;
    for (const { code } of samples) {
      const ids = (await diagramObjects(code))?.items.map(({ id }) => id) ?? [];
      for (const id of ids) if (await canMove(code, 'flowchart', id, 'right')) movable++;
    }
    expect(movable).toBeGreaterThan(3);
  }, 60_000);

  it.each(samples)(
    '$name: every move keeps the diagram',
    async ({ code }) => {
      const objects = await diagramObjects(code);
      const ids = objects?.items.map(({ id }) => id) ?? [];
      const edges = (await diagramEdges(code)).map(({ label }) => label).toSorted();
      let moves = 0;
      for (const id of ids) {
        for (const direction of ['left', 'right'] as const) {
          if (!(await canMove(code, 'flowchart', id, direction))) continue;
          const moved = await moveNode(code, 'flowchart', id, direction);
          expect(moved, `${id} ${direction}`).toBeDefined();
          expect(moved).not.toBe(code);
          expect(lines(moved ?? '').length).toBe(lines(code).length);
          expect(await checkEdit(code, moved ?? '')).toBe(true);
          expect(
            (await diagramObjects(moved ?? ''))?.items.map(({ id: n }) => n).toSorted()
          ).toEqual(ids.toSorted());
          expect((await diagramEdges(moved ?? '')).map(({ label }) => label).toSorted()).toEqual(
            edges
          );
          // The way back is the original text.
          const back = await moveNode(
            moved ?? '',
            'flowchart',
            id,
            direction === 'left' ? 'right' : 'left'
          );
          expect(back).toBe(code);
          moves++;
        }
      }
      expect(moves).toBeGreaterThanOrEqual(0);
    },
    60_000
  );
});
