import { describe, expect, it } from 'vitest';
import {
  darkVariantOf,
  architectureParts,
  diagramEdges,
  diagramObjects,
  getDefaultTheme,
  getSampleDiagrams,
  isManagedTheme
} from './mermaid';

describe('getDefaultTheme', () => {
  it.each([
    ['flowchart-v2', 'redux-color'],
    ['flowchart-elk', 'redux-color'],
    ['classDiagram', 'redux-color'],
    ['stateDiagram', 'redux-color'],
    ['sequence', 'redux-color'],
    ['pie', 'default'],
    ['xychart', 'default'],
    ['railroadAbnf', 'default'],
    ['wardley', 'default']
  ])('resolves %s to its config section default (%s)', (diagramType, theme) => {
    expect(getDefaultTheme(diagramType)).toBe(theme);
  });
});

describe('darkVariantOf', () => {
  it.each([
    ['redux-color', 'redux-dark-color'],
    ['redux', 'redux-dark'],
    ['redux-dark-color', 'redux-dark-color'],
    ['default', 'dark'],
    ['forest', 'dark']
  ])('%s → %s', (theme, dark) => {
    expect(darkVariantOf(theme)).toBe(dark);
  });
});

describe('isManagedTheme', () => {
  it('treats a missing theme and every derivable default as editor-managed', () => {
    for (const theme of [undefined, 'default', 'dark', 'redux-color', 'redux-dark-color']) {
      expect(isManagedTheme(theme), String(theme)).toBe(true);
    }
  });

  it('treats any other theme as the user’s choice', () => {
    for (const theme of ['forest', 'neutral', 'neo', 'base', 'redux', 42]) {
      expect(isManagedTheme(theme), String(theme)).toBe(false);
    }
  });
});

describe('getSampleDiagrams', () => {
  const samples = getSampleDiagrams();

  it('should return at least one example per diagram', () => {
    expect(Object.keys(samples).length).toBeGreaterThan(0);
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples.length, `${name} should have at least one example`).toBeGreaterThan(0);
      for (const example of examples) {
        expect(example.title, `${name} has an example without a title`).toBeTruthy();
        expect(example.code, `${name} example "${example.title}" has no code`).toBeTruthy();
      }
    }
  });

  it('should list the default example first', () => {
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples[0].isDefault, `${name} should have its default example first`).toBe(true);
    }
  });
});

const items = async (code: string) => (await diagramObjects(code))?.items ?? [];

describe('diagramObjects', () => {
  it('lists the nodes of a flowchart with plain-text labels', async () => {
    const code =
      'flowchart TD\n  A[Start here] --> B{Ok?}\n  B -->|y| C@{ shape: rounded, label: "Done **now**" }\n' +
      '  subgraph g1 [G]\n    D\n  end\n  E["<b>Bold</b>  text"]';
    expect(await diagramObjects(code)).toEqual({
      items: [
        { id: 'A', label: 'Start here' },
        { id: 'B', label: 'Ok?' },
        { id: 'C', label: 'Done now' },
        { id: 'D', label: 'D' },
        { id: 'E', label: 'Bold text' }
      ],
      kind: 'flowchart',
      syntax: 'style'
    });
  });

  it('shows entity codes as the characters they stand for', async () => {
    const code = 'flowchart TD\n  A["Say #quot;hi#quot; #35;1 #amp; more"]';
    expect(await items(code)).toEqual([{ id: 'A', label: 'Say "hi" #1 & more' }]);
  });

  it('lists the nodes of a swimlane diagram, not its lanes, even a styled one', async () => {
    expect(await items('swimlane-beta LR\n  subgraph L1\n    A[One]\n  end')).toEqual([
      { id: 'A', label: 'One' }
    ]);
    const styled = 'swimlane-beta LR\n  subgraph L1\n    A[One]\n  end\n  style L1 fill:#dde9fb';
    expect(await items(styled)).toEqual([{ id: 'A', label: 'One' }]);
  });

  it('lists the states of a state diagram, without start and end', async () => {
    const code =
      'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  Busy --> [*]\n  state "Long name" as LN\n' +
      '  state Comp {\n    a --> b\n  }';
    const found = await diagramObjects(code);
    expect(found?.kind).toBe('state');
    expect(found?.items).toEqual(
      expect.arrayContaining([
        { id: 'Idle', label: 'Idle' },
        { id: 'Busy', label: 'Busy' },
        { id: 'LN', label: 'Long name' },
        { id: 'a', label: 'a' }
      ])
    );
    expect(found?.items.some(({ id }) => /start|end|Comp/.test(id))).toBe(false);
  });

  it('leaves out the dividers of concurrent regions, and keeps underscores in labels', async () => {
    const code =
      'stateDiagram-v2\n  state battery_check <<choice>>\n  state Active {\n    [*] --> P\n    --\n    [*] --> S\n  }';
    expect(await items(code)).toEqual([
      { id: 'battery_check', label: 'battery_check' },
      { id: 'P', label: 'P' },
      { id: 'S', label: 'S' }
    ]);
  });

  it('leaves out composite states, which a style statement does not colour', async () => {
    const code = 'stateDiagram-v2\n  state Active {\n    [*] --> P\n  }\n  Active --> Done';
    expect(await items(code)).toEqual([
      { id: 'P', label: 'P' },
      { id: 'Done', label: 'Done' }
    ]);
  });

  it('lists classes, entities, requirements and blocks', async () => {
    expect(
      await items(
        'classDiagram\n  class Animal["Animal thing"]\n  Animal <|-- Dog\n  namespace N {\n    class Cat\n  }'
      )
    ).toEqual(
      expect.arrayContaining([
        { id: 'Animal', label: 'Animal thing' },
        { id: 'Dog', label: 'Dog' },
        { id: 'Cat', label: 'Cat' }
      ])
    );
    expect(
      await items(
        'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  p[Person] {\n    string name\n  }'
      )
    ).toEqual([
      { id: 'CUSTOMER', label: 'CUSTOMER' },
      { id: 'ORDER', label: 'ORDER' },
      { id: 'p', label: 'Person' }
    ]);
    expect(
      await items(
        'requirementDiagram\n  requirement r1 {\n    id: 1\n    text: t\n  }\n  element e1 {\n    type: sim\n  }\n  e1 - satisfies -> r1'
      )
    ).toEqual([
      { id: 'r1', label: 'r1' },
      { id: 'e1', label: 'e1' }
    ]);
    expect(
      await items('block-beta\n  columns 2\n  a["Alpha"] b\n  block:g\n    c\n  end\n  space')
    ).toEqual([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'b' },
      { id: 'g', label: 'g' },
      { id: 'c', label: 'c' }
    ]);
  });

  it('lists C4 elements, coloured with UpdateElementStyle', async () => {
    const found = await diagramObjects(
      'C4Context\n  Person(a, "Alice")\n  System(s, "Sys")\n  Boundary(bb, "B") {\n    System(x, "X")\n  }'
    );
    expect(found).toEqual({
      items: [
        { id: 'a', label: 'Alice' },
        { id: 's', label: 'Sys' },
        { id: 'x', label: 'X' }
      ],
      kind: 'c4',
      syntax: 'c4'
    });
  });

  it('is undefined for other diagrams and for code that does not parse', async () => {
    expect(await diagramObjects('sequenceDiagram\n  A->>B: hi')).toBeUndefined();
    expect(await diagramObjects('flowchart TD\n  A -->')).toBeUndefined();
  });
});

describe('diagramEdges', () => {
  it('lists the edges of a flowchart in linkStyle order, named by their ends and label', async () => {
    const code =
      'flowchart LR\n  A[Start] --> B\n  B -->|yes| C & D\n  C e2@--> A\n  linkStyle 1 stroke:#f00';
    expect(await diagramEdges(code)).toEqual([
      { id: 'L_A_B_0', index: 0, label: 'Start → B' },
      { id: 'L_B_C_0', index: 1, label: 'B → C (yes)' },
      { id: 'L_B_D_0', index: 2, label: 'B → D (yes)' },
      { id: 'e2', index: 3, label: 'C → Start' }
    ]);
  });

  it('lists the edges of a swimlane diagram, and none for other diagrams', async () => {
    expect(await diagramEdges('swimlane-beta LR\n  subgraph L1\n    A --> B\n  end')).toEqual([
      { id: 'L_A_B_0', index: 0, label: 'A → B' }
    ]);
    expect(await diagramEdges('stateDiagram-v2\n  A --> B')).toEqual([]);
    expect(await diagramEdges('flowchart LR\n  A -->')).toEqual([]);
  });
});

describe('architectureParts', () => {
  it('lists the groups and services of an architecture diagram', async () => {
    const code =
      'architecture-beta\n  group api(cloud)[API]\n  service db(database)[データベース] in api\n  service web(server)[Web] in api';
    expect(await architectureParts(code)).toEqual({
      groups: [{ id: 'api', label: 'API' }],
      services: [
        { id: 'db', label: 'データベース' },
        { id: 'web', label: 'Web' }
      ]
    });
  });

  it('is empty for other diagrams and for code that does not parse', async () => {
    expect(await architectureParts('flowchart TD\n  A')).toEqual({ groups: [], services: [] });
    expect(await architectureParts('architecture-beta\n  service')).toEqual({
      groups: [],
      services: []
    });
  });
});
