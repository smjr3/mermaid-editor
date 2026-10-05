import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import {
  checkEdit,
  deleteEdge,
  deleteObject,
  editKind,
  editableEdges,
  editableObjects,
  flowNodeDetails,
  moveNodeToLane,
  moveService,
  renameObject,
  reverseEdge,
  serviceDetails,
  setEdgeHead,
  setEdgeLabel,
  setEdgeStyle,
  setNodeIcon,
  setNodeShape,
  setServiceIcon,
  type EditEdge,
  type EditObject
} from './diagramModify';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
    D{In stock?}
  end
  A --> C
  C -->|yes| D
  D -- no --> A
  D ==> B
  style Shop fill:#dde9fb,stroke:#3b73c9,color:#1f2329
  style D fill:#fde2e1,stroke:#d64545,color:#1f2329
  linkStyle 1 stroke:#d64545
  linkStyle 3,4 stroke:#3f9b52`;

const object = async (code: string, id: string): Promise<EditObject> => {
  const found = (await editableObjects(code))?.items.find((item) => item.id === id);
  if (!found) throw new Error(`no object ${id}`);
  return found;
};
const edge = async (code: string, index: number): Promise<EditEdge> => {
  const found = (await editableEdges(code))?.items[index];
  if (!found) throw new Error(`no edge ${index}`);
  return found;
};

describe('editKind', () => {
  it('names the diagram types the Edit card handles', () => {
    expect(editKind(lanes)).toBe('flowchart');
    expect(editKind('---\ntitle: x\n---\nflowchart TD\n  A')).toBe('flowchart');
    expect(editKind('sequenceDiagram\n  A->>B: hi')).toBe('sequence');
    expect(editKind('pie\n  "a" : 1')).toBe('pie');
    expect(editKind('quadrantChart\n  A: [0.1, 0.2]')).toBeUndefined();
  });
});

describe('flowchart objects', () => {
  it('lists nodes and lanes, with the lane members', async () => {
    const objects = await editableObjects(lanes);
    expect(objects?.kind).toBe('flowchart');
    expect(objects?.items.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D', 'Customer', 'Shop']);
    const shop = objects?.items.find(({ id }) => id === 'Shop');
    expect(shop?.group).toBe(true);
    expect(shop?.members).toEqual(['C', 'D']);
  });

  it('renames a node label, keeping its shape, and a bare node gets a label', async () => {
    expect(renameObject(lanes, 'flowchart', await object(lanes, 'D'), 'Available?')).toContain(
      '    D{"Available?"}'
    );
    const bare = 'flowchart TD\n  A --> B\n  B --> C';
    const renamed = renameObject(bare, 'flowchart', await object(bare, 'B'), 'Ship "it"');
    expect(renamed).toBe('flowchart TD\n  A --> B["Ship #quot;it#quot;"]\n  B --> C');
    await expect(typeOf(renamed ?? '')).resolves.toBe('flowchart-v2');
  });

  it('renames a lane title', async () => {
    const renamed = renameObject(lanes, 'flowchart', await object(lanes, 'Shop'), 'Online shop');
    expect(renamed).toContain('  subgraph Shop ["Online shop"]');
  });

  it('deletes a node with its arrows and styles, and renumbers linkStyle', async () => {
    const result = deleteObject(lanes, 'flowchart', await object(lanes, 'D'));
    expect(result).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C
  style Shop fill:#dde9fb,stroke:#3b73c9,color:#1f2329
  linkStyle 1 stroke:#d64545`);
    await expect(typeOf(result)).resolves.toBe('swimlane');
  });

  it('deletes a node in the middle of a chain and keeps the other nodes', async () => {
    const chain =
      'flowchart LR\n  A[a] --> B[b] --> C[c]\n  A & B --> D\n  linkStyle 2,3 stroke:red';
    const result = deleteObject(chain, 'flowchart', await object(chain, 'B'));
    expect(result).toBe('flowchart LR\n  A[a]\n  C[c]\n  A --> D\n  linkStyle 0 stroke:red');
  });

  it('deletes a lane with its contents, or keeps them', async () => {
    const shop = await object(lanes, 'Shop');
    const gone = deleteObject(lanes, 'flowchart', shop);
    expect(gone).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end`);
    const kept = deleteObject(lanes, 'flowchart', shop, { keepContents: true });
    expect(kept).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  C[Accept order]
  D{In stock?}
  A --> C
  C -->|yes| D
  D -- no --> A
  D ==> B
  style D fill:#fde2e1,stroke:#d64545,color:#1f2329
  linkStyle 1 stroke:#d64545
  linkStyle 3,4 stroke:#3f9b52`);
    await expect(typeOf(kept)).resolves.toBe('swimlane');
  });
});

describe('flowchart edges', () => {
  it('lists the arrows in linkStyle order with their style', async () => {
    const edges = await editableEdges(lanes);
    expect(edges?.kind).toBe('flowchart');
    expect(edges?.items.map(({ from, to, label }) => `${from}>${to}:${label}`)).toEqual([
      'A>B:',
      'A>C:',
      'C>D:yes',
      'D>A:no',
      'D>B:'
    ]);
    expect(edges?.items.map(({ style, head }) => `${style}${head ? '>' : ''}`)).toEqual([
      'solid>',
      'solid>',
      'solid>',
      'solid>',
      'thick>'
    ]);
  });

  it('sets, changes and clears a label', async () => {
    expect(setEdgeLabel(lanes, 'flowchart', await edge(lanes, 1), 'order')).toContain(
      '  A -->|order| C'
    );
    expect(setEdgeLabel(lanes, 'flowchart', await edge(lanes, 3), 'nope')).toContain(
      '  D -->|nope| A'
    );
    expect(setEdgeLabel(lanes, 'flowchart', await edge(lanes, 2), '')).toContain('  C --> D');
  });

  it('reverses, restyles and removes the arrowhead', async () => {
    expect(reverseEdge(lanes, 'flowchart', await edge(lanes, 2))).toContain('  D -->|yes| C');
    expect(setEdgeStyle(lanes, 'flowchart', await edge(lanes, 2), 'dotted')).toContain(
      '  C -.->|yes| D'
    );
    expect(setEdgeStyle(lanes, 'flowchart', await edge(lanes, 4), 'solid')).toContain('  D --> B');
    expect(setEdgeHead(lanes, 'flowchart', await edge(lanes, 2), false)).toContain(
      '  C ---|yes| D'
    );
    const dotted = setEdgeStyle(lanes, 'flowchart', await edge(lanes, 2), 'dotted');
    expect(setEdgeHead(dotted, 'flowchart', await edge(dotted, 2), false)).toContain(
      '  C -.-|yes| D'
    );
  });

  it('edits one arrow of a chain by splitting the chain, keeping the numbering', async () => {
    const chain = 'flowchart LR\n  A[a] --> B[b] --> C[c]\n  linkStyle 1 stroke:red';
    const reversed = reverseEdge(chain, 'flowchart', await edge(chain, 1));
    expect(reversed).toBe('flowchart LR\n  A[a] --> B[b]\n  C[c] --> B\n  linkStyle 1 stroke:red');
    const edges = await editableEdges(reversed ?? '');
    expect(edges?.items.map(({ from, to }) => `${from}>${to}`)).toEqual(['A>B', 'C>B']);
  });

  it('deletes an arrow and renumbers the linkStyle statements', async () => {
    const result = deleteEdge(lanes, 'flowchart', await edge(lanes, 1));
    expect(result).toBe(`swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
    D{In stock?}
  end
  C -->|yes| D
  D -- no --> A
  D ==> B
  style Shop fill:#dde9fb,stroke:#3b73c9,color:#1f2329
  style D fill:#fde2e1,stroke:#d64545,color:#1f2329
  linkStyle 2,3 stroke:#3f9b52`);
    const inner = 'flowchart LR\n  A[a] --> B[b] --> C\n  linkStyle 0,1 stroke:red';
    expect(deleteEdge(inner, 'flowchart', await edge(inner, 0))).toBe(
      'flowchart LR\n  A[a]\n  B[b] --> C\n  linkStyle 0 stroke:red'
    );
  });

  it('counts the arrows of groups and chains like mermaid does', async () => {
    const odd = 'flowchart LR\n  A[a] --> B\n  A -- b --> C\n  B -.-> D';
    expect((await editableEdges(odd))?.items).toHaveLength(3);
    const groups = await editableEdges('flowchart LR\n  A["x"] --> B & C --> D');
    expect(groups?.items.map(({ from, to }) => `${from}>${to}`)).toEqual([
      'A>B',
      'A>C',
      'B>D',
      'C>D'
    ]);
  });
});

describe('state diagrams', () => {
  const code = `stateDiagram-v2
  [*] --> Idle
  Idle --> Busy : go
  Busy --> [*]
  state "Working" as Busy
  note right of Busy : hard at work
  Idle : waiting
  style Busy fill:#fde2e1`;

  it('renames through the description, and adds one when missing', async () => {
    expect(renameObject(code, 'state', await object(code, 'Busy'), 'Running')).toContain(
      '  state "Running" as Busy'
    );
    expect(renameObject(code, 'state', await object(code, 'Idle'), 'Resting')).toContain(
      '  Idle : Resting'
    );
    const bare = 'stateDiagram-v2\n  A --> B';
    expect(renameObject(bare, 'state', await object(bare, 'B'), 'Done')).toBe(
      'stateDiagram-v2\n  A --> B\n  B : Done'
    );
  });

  it('deletes a state with its transitions, description, note and style', async () => {
    const result = deleteObject(code, 'state', await object(code, 'Busy'));
    expect(result).toBe('stateDiagram-v2\n  [*] --> Idle\n  Idle : waiting');
    await expect(typeOf(result)).resolves.toBe('stateDiagram');
  });

  it('edits transitions', async () => {
    const edges = await editableEdges(code);
    expect(edges?.items.map(({ from, to, label }) => `${from}>${to}:${label}`)).toEqual([
      '[*]>Idle:',
      'Idle>Busy:go',
      'Busy>[*]:'
    ]);
    expect(setEdgeLabel(code, 'state', await edge(code, 0), 'start')).toContain(
      '  [*] --> Idle : start'
    );
    expect(reverseEdge(code, 'state', await edge(code, 1))).toContain('  Busy --> Idle : go');
    expect(deleteEdge(code, 'state', await edge(code, 1))).not.toContain('Idle --> Busy');
  });
});

describe('composite states', () => {
  const code = `stateDiagram-v2
    direction LR
    [*] --> Placed
    Placed --> Paid : payment received
    Paid --> Fulfilment

    state Fulfilment {
        [*] --> Packing
        Packing --> Shipped : handed to courier
        Shipped --> [*]
    }

    Fulfilment --> Delivered : courier confirms
    Delivered --> [*]

    note right of Paid
        Payment can be card
    end note`;

  it('edits every arrow, those inside the composite state too', async () => {
    const edges = await editableEdges(code);
    expect(edges?.unsure).toBeUndefined();
    expect(edges?.items.map(({ from, to }) => `${from}>${to}`)).toEqual([
      '[*]>Placed',
      'Placed>Paid',
      'Paid>Fulfilment',
      '[*]>Packing',
      'Packing>Shipped',
      'Shipped>[*]',
      'Fulfilment>Delivered',
      'Delivered>[*]'
    ]);
    const relabelled = setEdgeLabel(code, 'state', await edge(code, 4), '出荷');
    expect(relabelled).toContain('        Packing --> Shipped : 出荷\n');
    await expect(typeOf(relabelled)).resolves.toBe('stateDiagram');
  });

  it('lists the composite state as a group holding its states', async () => {
    const fulfilment = await object(code, 'Fulfilment');
    expect(fulfilment).toMatchObject({ group: true, members: ['Packing', 'Shipped'] });
  });

  it('renames a composite state', async () => {
    const renamed = renameObject(code, 'state', await object(code, 'Fulfilment'), '出荷 "準備"');
    expect(renamed).toContain(`    state "出荷 '準備'" as Fulfilment {\n`);
    await expect(typeOf(renamed ?? '')).resolves.toBe('stateDiagram');
  });

  it('deletes a composite state with what is inside, or keeps its states', async () => {
    const fulfilment = await object(code, 'Fulfilment');
    const gone = deleteObject(code, 'state', fulfilment);
    expect(gone).not.toMatch(/Fulfilment|Packing|Shipped/);
    await expect(typeOf(gone)).resolves.toBe('stateDiagram');
    const kept = deleteObject(code, 'state', fulfilment, { keepContents: true });
    expect(kept).not.toContain('Fulfilment');
    expect(kept).toContain('\n    [*] --> Packing\n    Packing --> Shipped : handed to courier\n');
    await expect(typeOf(kept)).resolves.toBe('stateDiagram');
  });
});

describe('class diagrams', () => {
  const code = `classDiagram
  class Animal["The Animal"] {
    +int age
  }
  Animal <|-- Dog : inherits
  Animal "1" --> "*" Cat
  Dog ..> Cat
  Dog : +bark()
  note for Dog "Woof"
  style Dog fill:#fde2e1`;

  it('renames a class label', async () => {
    expect(renameObject(code, 'class', await object(code, 'Animal'), 'Creature')).toContain(
      '  class Animal["Creature"] {'
    );
    const dog = renameObject(code, 'class', await object(code, 'Dog'), 'Doggo');
    expect(dog).toContain('  Animal <|-- Dog : inherits\n  class Dog["Doggo"]\n');
    await expect(typeOf(dog ?? '')).resolves.toBe('classDiagram');
  });

  it('deletes a class with its relations, members, note and style', async () => {
    const result = deleteObject(code, 'class', await object(code, 'Dog'));
    expect(result).toBe(
      'classDiagram\n  class Animal["The Animal"] {\n    +int age\n  }\n  Animal "1" --> "*" Cat'
    );
    const animal = deleteObject(code, 'class', await object(code, 'Animal'));
    expect(animal).not.toContain('Animal');
    await expect(typeOf(animal)).resolves.toBe('classDiagram');
  });

  it('edits relations', async () => {
    const edges = await editableEdges(code);
    expect(edges?.items.map(({ from, to, label }) => `${from}>${to}:${label}`)).toEqual([
      'Animal>Dog:inherits',
      'Animal>Cat:',
      'Dog>Cat:'
    ]);
    expect(reverseEdge(code, 'class', await edge(code, 0))).toContain(
      '  Dog <|-- Animal : inherits'
    );
    expect(reverseEdge(code, 'class', await edge(code, 1))).toContain('  Cat "*" --> "1" Animal');
    expect(setEdgeStyle(code, 'class', await edge(code, 2), 'solid')).toContain('  Dog --> Cat');
    expect(setEdgeHead(code, 'class', await edge(code, 1), false)).toContain(
      '  Animal "1" -- "*" Cat'
    );
    expect(setEdgeLabel(code, 'class', await edge(code, 2), 'uses')).toContain(
      '  Dog ..> Cat : uses'
    );
  });
});

describe('ER diagrams', () => {
  const code = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  p["Person"]
  p }o..o| ORDER : "owns"
  ORDER {
    string id
  }
  style ORDER fill:#fde2e1`;

  it('renames through the alias', async () => {
    expect(renameObject(code, 'er', await object(code, 'p'), 'People')).toContain(
      '  p["People"]\n  p }o..o| ORDER : "owns"'
    );
    const order = renameObject(code, 'er', await object(code, 'ORDER'), 'Orders');
    expect(order).toContain('  ORDER["Orders"] {');
    const customer = renameObject(code, 'er', await object(code, 'CUSTOMER'), 'Customer');
    expect(customer).toContain('\n  CUSTOMER["Customer"]');
    await expect(typeOf(customer ?? '')).resolves.toBe('er');
  });

  it('deletes an entity with its relationships, attributes and style', async () => {
    const result = deleteObject(code, 'er', await object(code, 'ORDER'));
    expect(result).toBe('erDiagram\n  p["Person"]');
    await expect(typeOf(result)).resolves.toBe('er');
  });

  it('edits relationships', async () => {
    expect((await editableEdges(code))?.items.map(({ label }) => label)).toEqual([
      'places',
      'contains',
      'owns'
    ]);
    expect(reverseEdge(code, 'er', await edge(code, 0))).toContain(
      '  ORDER ||--o{ CUSTOMER : "places"'
    );
    expect(setEdgeStyle(code, 'er', await edge(code, 0), 'dotted')).toContain(
      '  CUSTOMER ||..o{ ORDER : "places"'
    );
    expect(setEdgeLabel(code, 'er', await edge(code, 2), 'has')).toContain(
      '  p }o..o| ORDER : "has"'
    );
    expect(deleteEdge(code, 'er', await edge(code, 2))).toContain('\n  p["Person"]\n  ORDER {');
  });
});

describe('sequence diagrams', () => {
  const code = `sequenceDiagram
  participant A as Alice
  A->>B: hi
  activate B
  B-->>A: hello
  deactivate B
  Note over A,B: both
  Note right of B: alone
  C-)A: ping`;

  it('lists the participants in order and renames them', async () => {
    const objects = await editableObjects(code);
    expect(objects?.items.map(({ id, label }) => `${id}:${label}`)).toEqual([
      'A:Alice',
      'B:B',
      'C:C',
      // Notes follow, by line.
      'line:6:Note over A,B: both',
      'line:7:Note right of B: alone'
    ]);
    expect(renameObject(code, 'sequence', await object(code, 'A'), 'Alicia')).toContain(
      '  participant A as Alicia'
    );
    // An undeclared participant is declared in its place, so the order stays.
    const c = renameObject(code, 'sequence', await object(code, 'C'), 'Carol');
    expect(c).toContain('  participant A as Alice\n  participant B\n  participant C as Carol\n');
  });

  it('deletes a participant with its messages, activations and notes', async () => {
    const result = deleteObject(code, 'sequence', await object(code, 'B'));
    expect(result).toBe(
      'sequenceDiagram\n  participant A as Alice\n  Note over A: both\n  C-)A: ping'
    );
    await expect(typeOf(result)).resolves.toBe('sequence');
  });

  it('keeps activations paired when a message or participant goes', async () => {
    const active =
      'sequenceDiagram\n  A->>+B: hi\n  C->>B: x\n  B-->>-C: ok\n  B->>+A: y\n  A-->>-B: z';
    expect(deleteEdge(active, 'sequence', await edge(active, 0))).toBe(
      'sequenceDiagram\n  C->>B: x\n  B-->>C: ok\n  B->>+A: y\n  A-->>-B: z'
    );
    expect(reverseEdge(active, 'sequence', await edge(active, 4))).toContain(
      '  B->>A: y\n  B-->>A: z'
    );
    const gone = deleteObject(active, 'sequence', await object(active, 'A'));
    expect(gone).toBe('sequenceDiagram\n  C->>B: x\n  B-->>C: ok');
    await expect(typeOf(gone)).resolves.toBe('sequence');
  });

  it('edits messages', async () => {
    expect((await editableEdges(code))?.items.map(({ label }) => label)).toEqual([
      'hi',
      'hello',
      'ping'
    ]);
    expect(reverseEdge(code, 'sequence', await edge(code, 0))).toContain('  B->>A: hi');
    expect(setEdgeStyle(code, 'sequence', await edge(code, 0), 'dotted')).toContain('  A-->>B: hi');
    expect(setEdgeStyle(code, 'sequence', await edge(code, 1), 'solid')).toContain(
      '  B->>A: hello'
    );
    expect(setEdgeLabel(code, 'sequence', await edge(code, 2), 'Ticket #1; ok')).toContain(
      '  C-)A: Ticket #35;1, ok'
    );
  });
});

describe('architecture diagrams', () => {
  const code = `architecture-beta
  group api(cloud)[API]
  group inner(cloud)[Inner] in api
  service db(database)[Database] in inner
  service web(server)[Web] in api
  service dns(internet)[DNS]
  junction j
  db:R --> L:web
  web:T -- B:dns
  dns:R -- L:j`;

  it('lists services, groups and junctions', async () => {
    const objects = await editableObjects(code);
    expect(objects?.items.map(({ id }) => id)).toEqual(['db', 'web', 'dns', 'api', 'inner', 'j']);
    expect(objects?.items.find(({ id }) => id === 'api')?.members).toEqual(['inner', 'db', 'web']);
    expect(objects?.items.find(({ id }) => id === 'j')?.noRename).toBe(true);
  });

  it('renames a service and a group', async () => {
    expect(renameObject(code, 'architecture', await object(code, 'db'), 'Main [DB]')).toContain(
      '  service db(database)[Main (DB)] in inner'
    );
    expect(renameObject(code, 'architecture', await object(code, 'api'), 'Cloud')).toContain(
      '  group api(cloud)[Cloud]'
    );
  });

  it('deletes a service with its connections, and a group with or without its contents', async () => {
    const web = deleteObject(code, 'architecture', await object(code, 'web'));
    expect(web).not.toContain('web');
    await expect(typeOf(web)).resolves.toBe('architecture');
    const inner = await object(code, 'inner');
    expect(deleteObject(code, 'architecture', inner)).toBe(
      'architecture-beta\n  group api(cloud)[API]\n  service web(server)[Web] in api\n  service dns(internet)[DNS]\n  junction j\n  web:T -- B:dns\n  dns:R -- L:j'
    );
    expect(deleteObject(code, 'architecture', inner, { keepContents: true })).toContain(
      '  service db(database)[Database] in api\n'
    );
  });

  it('edits connections', async () => {
    expect((await editableEdges(code))?.items.map(({ head }) => head)).toEqual([
      true,
      false,
      false
    ]);
    expect(reverseEdge(code, 'architecture', await edge(code, 0))).toContain('  web:L --> R:db');
    expect(setEdgeHead(code, 'architecture', await edge(code, 1), true)).toContain(
      '  web:T --> B:dns'
    );
    expect(setEdgeHead(code, 'architecture', await edge(code, 0), false)).toContain(
      '  db:R -- L:web'
    );
    expect(deleteEdge(code, 'architecture', await edge(code, 2))).not.toContain('dns:R');
  });
});

describe('C4 diagrams', () => {
  const code = `C4Context
  Person(a, "Alice", "A user")
  System_Boundary(b1, "Shop") {
    System(s, "Web")
  }
  Rel(a, s, "uses")
  UpdateElementStyle(s, $bgColor="#fde2e1")`;

  it('renames an element', async () => {
    expect(renameObject(code, 'c4', await object(code, 'a'), 'Alicia')).toContain(
      '  Person(a, "Alicia", "A user")'
    );
  });

  it('deletes an element with its relationships and styles', async () => {
    const result = deleteObject(code, 'c4', await object(code, 's'));
    // The boundary left empty goes too: an empty one does not parse.
    expect(result).toBe('C4Context\n  Person(a, "Alice", "A user")');
    await expect(typeOf(result)).resolves.toBe('c4');
  });

  it('lists, renames and deletes a boundary, with what is inside or keeping it', async () => {
    const nested = `C4Context
  Person(a, "Alice")
  Enterprise_Boundary(e1, "会社") {
    System_Boundary(b1, "Shop") {
      System(s, "Web")
    }
    System(m, "Mail")
  }
  Rel(a, s, "uses")
  UpdateElementStyle(b1, $fontColor="red")`;
    const company = await object(nested, 'e1');
    expect(company).toMatchObject({ group: true, label: '会社', members: ['m', 'b1', 's'] });
    expect(renameObject(nested, 'c4', await object(nested, 'b1'), 'Store')).toContain(
      '    System_Boundary(b1, "Store") {\n'
    );
    const gone = deleteObject(nested, 'c4', company);
    // The relationship and the style of what was inside go too.
    expect(gone).toBe('C4Context\n  Person(a, "Alice")');
    await expect(typeOf(gone)).resolves.toBe('c4');
    const kept = deleteObject(nested, 'c4', await object(nested, 'b1'), { keepContents: true });
    expect(kept).toBe(
      'C4Context\n  Person(a, "Alice")\n  Enterprise_Boundary(e1, "会社") {\n    System(s, "Web")\n    System(m, "Mail")\n  }\n  Rel(a, s, "uses")'
    );
    await expect(typeOf(kept)).resolves.toBe('c4');
  });
});

describe('mindmap, kanban and timeline', () => {
  const mindmap = 'mindmap\n  root((Centre))\n    A[Alpha]\n      A1\n      A2\n    B';
  const kanban = 'kanban\n  todo[To do]\n    t1[Write]\n    t2[Test]\n  done[Done]';
  const timeline = 'timeline\n  title History\n  2020 : start : grow\n  2021 : ship\n       : sell';

  it('lists and renames topics, cards and periods', async () => {
    const topics = await editableObjects(mindmap);
    expect(topics?.items.map(({ label }) => label)).toEqual([
      'Centre',
      '  Alpha',
      '    A1',
      '    A2',
      '  B'
    ]);
    expect(topics?.items[1].group).toBe(true);
    expect(renameObject(mindmap, 'mindmap', await object(mindmap, 'L2'), 'First')).toContain(
      '    A[First]\n'
    );
    expect(renameObject(mindmap, 'mindmap', await object(mindmap, 'L3'), 'One')).toContain(
      '      One\n'
    );
    expect(renameObject(kanban, 'kanban', await object(kanban, 'L2'), 'Code')).toContain(
      '    t1[Code]\n'
    );
    const periods = await editableObjects(timeline);
    expect(periods?.items.map(({ label }) => label)).toEqual([
      '2020',
      '  start',
      '  grow',
      '2021',
      '  ship',
      '  sell'
    ]);
    expect(renameObject(timeline, 'timeline', await object(timeline, 'L2'), '2019')).toContain(
      '  2019 : start : grow'
    );
    expect(renameObject(timeline, 'timeline', await object(timeline, 'L2E1'), 'scale')).toContain(
      '  2020 : start : scale'
    );
  });

  it("keeps a kanban card's @{ … } metadata when renaming and shows only its text", async () => {
    const meta = [
      "kanban\n  todo[To do]\n    t1[Write blog]@{ priority: 'Low', assigned: 'x' }\n    t2[Test]",
      'kanban\n  todo[To do]\n    t1[Write blog]@{ priority: "Low", ticket: "a]b" }\n    t2[Test]'
    ];
    for (const code of meta) {
      const items = (await editableObjects(code))?.items ?? [];
      expect(items.map(({ label }) => label.trim())).toEqual(['To do', 'Write blog', 'Test']);
      const renamed = renameObject(code, 'kanban', await object(code, 'L2'), 'Rename');
      expect(renamed).toBe(code.replace('[Write blog]', '[Rename]'));
      await expect(typeOf(renamed ?? '')).resolves.toBe('kanban');
      expect(deleteObject(code, 'kanban', await object(code, 'L2'))).toBe(
        code
          .split('\n')
          .filter((line) => !line.includes('t1['))
          .join('\n')
      );
    }
  });

  it('deletes a topic with or without its children, a card and a period', async () => {
    const alpha = await object(mindmap, 'L2');
    expect(deleteObject(mindmap, 'mindmap', alpha)).toBe('mindmap\n  root((Centre))\n    B');
    expect(deleteObject(mindmap, 'mindmap', alpha, { keepContents: true })).toBe(
      'mindmap\n  root((Centre))\n    A1\n    A2\n    B'
    );
    expect(deleteObject(kanban, 'kanban', await object(kanban, 'L1'))).toBe('kanban\n  done[Done]');
    expect(deleteObject(timeline, 'timeline', await object(timeline, 'L3'))).toBe(
      'timeline\n  title History\n  2020 : start : grow'
    );
    expect(deleteObject(timeline, 'timeline', await object(timeline, 'L2E0'))).toContain(
      '  2020 : grow\n'
    );
  });
});

describe('gantt charts', () => {
  const code = `gantt
  dateFormat YYYY-MM-DD
  section Plan
    Spec : a1, 2024-01-01, 3d
    Review : 2d
  section Build
    Code : done, b1, after a1, 5d
    Test : after b1, 2d`;

  it('lists sections and the tasks under them', async () => {
    const items = (await editableObjects(code))?.items ?? [];
    expect(items.map(({ id, label, group }) => [id, label, group ?? false])).toEqual([
      ['L2', 'Plan', true],
      ['L3', '  Spec', false],
      ['L4', '  Review', false],
      ['L5', 'Build', true],
      ['L6', '  Code', false],
      ['L7', '  Test', false]
    ]);
    expect(items[3].members).toEqual(['L6', 'L7']);
  });

  it('renames a section and a task', async () => {
    expect(renameObject(code, 'gantt', await object(code, 'L5'), '開発: 本番')).toContain(
      '  section 開発 本番\n'
    );
    expect(renameObject(code, 'gantt', await object(code, 'L6'), 'Coding #1')).toContain(
      '    Coding 1 : done, b1, after a1, 5d\n'
    );
  });

  it('deletes a task, handing its start on to the tasks that followed it', async () => {
    const spec = deleteObject(code, 'gantt', await object(code, 'L3'));
    // Review started straight after Spec; Code started after a1.
    expect(spec.split('\n').slice(3)).toEqual([
      '    Review : 2024-01-01, 2d',
      '  section Build',
      '    Code : done, b1, 2024-01-01, 5d',
      '    Test : after b1, 2d'
    ]);
    await expect(typeOf(spec)).resolves.toBe('gantt');
    const coding = deleteObject(code, 'gantt', await object(code, 'L6'));
    expect(coding.split('\n').slice(5)).toEqual(['  section Build', '    Test : after a1, 2d']);
  });

  it('deletes a section with its tasks, or keeps them in the section before', async () => {
    const plan = await object(code, 'L2');
    const gone = deleteObject(code, 'gantt', plan);
    expect(gone).toBe(
      'gantt\n  dateFormat YYYY-MM-DD\n  section Build\n    Code : done, b1, 2024-01-01, 5d\n    Test : after b1, 2d'
    );
    await expect(typeOf(gone)).resolves.toBe('gantt');
    const build = await object(code, 'L5');
    expect(deleteObject(code, 'gantt', build, { keepContents: true })).toBe(
      code.replace('  section Build\n', '')
    );
  });
});

describe('pie charts', () => {
  const code = 'pie showData\n  title Pets\n  "Dogs" : 3\n  "Cats" : 2.5';
  it('lists, renames and deletes slices', async () => {
    expect((await editableObjects(code))?.items.map(({ id, label }) => [id, label])).toEqual([
      ['L2', 'Dogs'],
      ['L3', 'Cats']
    ]);
    const renamed = renameObject(code, 'pie', await object(code, 'L3'), '猫 "ねこ"');
    expect(renamed).toBe(code.replace('"Cats"', `"猫 'ねこ'"`));
    await expect(typeOf(renamed ?? '')).resolves.toBe('pie');
    expect(deleteObject(code, 'pie', await object(code, 'L2'))).toBe(
      'pie showData\n  title Pets\n  "Cats" : 2.5'
    );
  });
});

describe('requirement diagrams', () => {
  const code = `requirementDiagram
  requirement login {
    id: 1
    text: "Log in"
  }
  functionalRequirement "二段階 認証" {
    id: 2
  }
  element web {
    type: system
  }
  web - satisfies -> login
  "二段階 認証" <- refines - login
  style login fill:#fde2e1`;

  it('lists requirements and elements by name, Japanese ones too', async () => {
    expect((await editableObjects(code))?.items.map(({ id }) => id)).toEqual([
      'login',
      '二段階 認証',
      'web'
    ]);
  });

  it('renames one everywhere it is named', async () => {
    const renamed = renameObject(code, 'requirement', await object(code, 'login'), 'サインイン');
    expect(renamed).toBe(code.replaceAll('login', '"サインイン"'));
    await expect(typeOf(renamed ?? '')).resolves.toBe('requirement');
    const plain = renameObject(code, 'requirement', await object(code, '二段階 認証'), 'mfa');
    expect(plain).toContain('  functionalRequirement mfa {\n');
    expect(plain).toContain('  mfa <- refines - login\n');
  });

  it('deletes one with its relationships and style', async () => {
    const result = deleteObject(code, 'requirement', await object(code, 'login'));
    expect(result).toBe(
      'requirementDiagram\n  functionalRequirement "二段階 認証" {\n    id: 2\n  }\n  element web {\n    type: system\n  }'
    );
    await expect(typeOf(result)).resolves.toBe('requirement');
  });
});

describe('block diagrams', () => {
  const code = `block-beta
columns 1
  db(("DB"))
  arrow<["&nbsp;"]>(down)
  block:ID
    A
    B["Wide"]:2 C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#969`;

  it('lists blocks, a block holding others as a group', async () => {
    const items = (await editableObjects(code))?.items ?? [];
    expect(items.find(({ id }) => id === 'ID')).toMatchObject({
      group: true,
      members: ['A', 'B', 'C'],
      noRename: true
    });
  });

  it('renames a block whatever its shape, keeping its width', async () => {
    const rename = async (id: string, label: string) =>
      renameObject(code, 'block', await object(code, id), label) ?? '';
    expect(await rename('db', 'Store')).toContain('  db(("Store"))\n');
    expect(await rename('B', 'Narrow "x"')).toContain(`    B["Narrow 'x'"]:2 C\n`);
    expect(await rename('C', 'See')).toContain('    B["Wide"]:2 C["See"]\n');
    expect(await rename('arrow', 'Down')).toContain('  arrow<["Down"]>(down)\n');
    for (const id of ['db', 'B', 'C', 'arrow', 'D']) {
      await expect(typeOf(await rename(id, 'New'))).resolves.toBe('block');
    }
  });

  it('deletes a block from its line, with its arrows and style', async () => {
    const b = deleteObject(code, 'block', await object(code, 'B'));
    expect(b).toContain('\n    A\n    C\n  end\n');
    expect(b).not.toContain('style B');
    const d = deleteObject(code, 'block', await object(code, 'D'));
    expect(d).not.toMatch(/^\s*D$|--> D/m);
    for (const result of [b, d]) await expect(typeOf(result)).resolves.toBe('block');
  });

  it('deletes a block holding others, with them or keeping them', async () => {
    const group = await object(code, 'ID');
    const gone = deleteObject(code, 'block', group);
    expect(gone).not.toMatch(/\bID\b|\bA\b|Wide|C --> D/);
    await expect(typeOf(gone)).resolves.toBe('block');
    const kept = deleteObject(code, 'block', group, { keepContents: true });
    expect(kept).toContain('\n  A\n  B["Wide"]:2 C\n  space\n');
    expect(kept).not.toContain('ID --> D');
    await expect(typeOf(kept)).resolves.toBe('block');
  });
});

describe('checkEdit', () => {
  it('accepts a change that keeps the diagram type and refuses one that breaks it', async () => {
    await expect(checkEdit(lanes, lanes.replace('A --> C', 'A --> C2'))).resolves.toBe(true);
    await expect(checkEdit(lanes, lanes.replace('subgraph Shop', 'subgraph'))).resolves.toBe(false);
    await expect(checkEdit(lanes, 'sequenceDiagram\n  A->>B: hi')).resolves.toBe(false);
  });
});

describe('non-ASCII ids', () => {
  it('deletes a Japanese participant with its declaration, messages and notes', async () => {
    const code = `sequenceDiagram
  participant 各部門
  participant 経理
  各部門->>経理: 締め
  経理-->>各部門: 回答
  Note over 各部門,経理: 月次
  経理->>経理: 確認`;
    const result = deleteObject(code, 'sequence', await object(code, '各部門'));
    expect(result).toBe(`sequenceDiagram
  participant 経理
  Note over 経理: 月次
  経理->>経理: 確認`);
    await expect(typeOf(result)).resolves.toBe('sequence');
    expect((await editableObjects(result))?.items.map(({ id }) => id)).toEqual(['経理', 'line:2']);
  });

  it('deletes Japanese flowchart nodes, lanes and states', async () => {
    const flow = `flowchart LR
  subgraph 営業
    申請[申請する] --> 承認{承認?}
  end
  承認 -->|yes| 完了[完了]
  style 承認 fill:#fde2e1
  click 承認 href "https://example.com"`;
    const gone = deleteObject(flow, 'flowchart', await object(flow, '承認'));
    expect(gone).not.toMatch(/承認/);
    await expect(typeOf(gone)).resolves.toBe('flowchart-v2');
    const noLane = deleteObject(flow, 'flowchart', await object(flow, '営業'));
    expect(noLane).not.toMatch(/営業|申請/);
    await expect(typeOf(noLane)).resolves.toBe('flowchart-v2');
  });

  it('edits relationships between Japanese ER entities', async () => {
    const code = `erDiagram
  顧客 ||--o{ 注文 : 発注
  注文 ||--|{ 明細 : 含む`;
    const edges = await editableEdges(code);
    expect(edges?.items.map(({ from, to }) => `${from}>${to}`)).toEqual(['顧客>注文', '注文>明細']);
    const reversed = reverseEdge(code, 'er', await edge(code, 0));
    expect(reversed).toContain('注文 ||--o{ 顧客 : "発注"');
    await expect(typeOf(reversed)).resolves.toBe('er');
    const gone = deleteEdge(code, 'er', await edge(code, 1));
    expect(gone).not.toMatch(/明細/);
    await expect(typeOf(gone)).resolves.toBe('er');
  });
});

describe('flowchart node shape, lane and icon', () => {
  it('reads a node’s shape, lane and icon', () => {
    expect(flowNodeDetails(lanes, 'D')).toEqual({ icon: '', lane: 'Shop', shape: 'diamond' });
    expect(flowNodeDetails(lanes, 'A')).toEqual({ icon: '', lane: 'Customer', shape: 'rect' });
    const icon = 'flowchart LR\n  A@{ icon: "tabler:user", label: "利用者" } --> B';
    expect(flowNodeDetails(icon, 'A')).toEqual({ icon: 'tabler:user', lane: '', shape: undefined });
    expect(flowNodeDetails(icon, 'B')).toEqual({ icon: '', lane: '', shape: 'rect' });
    expect(flowNodeDetails('flowchart LR\n  A[[sub]]', 'A').shape).toBe('other');
  });

  it('changes the shape where the node is defined, keeping its label and class', async () => {
    const code = 'flowchart LR\n  A[Place order]:::hot --> B\n  A --> C';
    const round = setNodeShape(code, 'A', 'rounded');
    expect(round).toBe('flowchart LR\n  A(Place order):::hot --> B\n  A --> C');
    expect(setNodeShape(code, 'A', 'diamond')).toContain('A{Place order}:::hot');
    expect(setNodeShape(code, 'A', 'circle')).toContain('A((Place order)):::hot');
    expect(setNodeShape(code, 'A', 'stadium')).toContain('A([Place order]):::hot');
    // A bare node gets its id as the label.
    expect(setNodeShape(code, 'B', 'diamond')).toContain('A[Place order]:::hot --> B{"B"}');
    await expect(typeOf(setNodeShape(lanes, 'D', 'stadium') ?? '')).resolves.toBe('swimlane');
    expect(setNodeShape(lanes, 'D', 'stadium')).toContain('    D([In stock?])\n');
  });

  it('quotes a label whose brackets would end the new shape', () => {
    expect(setNodeShape('flowchart LR\n  A["x (y)"]', 'A', 'rounded')).toBe(
      'flowchart LR\n  A("x (y)")'
    );
  });

  it('changes a shape given as data, and leaves an icon node alone', () => {
    expect(setNodeShape('flowchart LR\n  A@{ shape: rect, label: "x" }', 'A', 'diamond')).toBe(
      'flowchart LR\n  A@{ shape: diam, label: "x" }'
    );
    expect(setNodeShape('flowchart LR\n  A@{ icon: "tabler:user" }', 'A', 'rect')).toBeUndefined();
  });

  it('sets, changes and clears an icon', async () => {
    const code = 'flowchart LR\n  A["利用者"] --> B(処理)';
    const withIcon = setNodeIcon(code, 'A', 'tabler:user');
    expect(withIcon).toBe('flowchart LR\n  A@{ icon: "tabler:user", label: "利用者" } --> B(処理)');
    await expect(typeOf(withIcon ?? '')).resolves.toBe('flowchart-v2');
    const changed = setNodeIcon(withIcon ?? '', 'A', 'mdi:account');
    expect(changed).toContain('A@{ icon: "mdi:account", label: "利用者" }');
    expect(setNodeIcon(changed ?? '', 'A', '')).toBe(code);
    expect(setNodeIcon(code, 'B', 'tabler:server')).toContain(
      'B@{ icon: "tabler:server", label: "処理" }'
    );
    expect(setNodeIcon(code, 'A', 'not an icon')).toBeUndefined();
  });

  it('moves a standalone node to another lane', async () => {
    const moved = moveNodeToLane(lanes, 'C', 'Customer');
    expect(moved).toContain(
      '  subgraph Customer\n    A[Place order] --> B[Receive goods]\n    C[Accept order]\n  end\n  subgraph Shop\n    D{In stock?}\n  end'
    );
    expect(moved?.split('\n').slice(-2)).toEqual([
      '  linkStyle 1 stroke:#d64545',
      '  linkStyle 3,4 stroke:#3f9b52'
    ]);
    await expect(typeOf(moved ?? '')).resolves.toBe('swimlane');
    expect(flowNodeDetails(moved ?? '', 'C').lane).toBe('Customer');
  });

  it('moves a node out of a chain inside its lane; the arrow stays and keeps its colour', async () => {
    const code = `flowchart LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order]
  end
  B --> C
  linkStyle 0 stroke:#d64545`;
    const moved = moveNodeToLane(code, 'A', 'Shop');
    expect(moved).toBe(`flowchart LR
  subgraph Customer
    B[Receive goods]
  end
  A --> B
  subgraph Shop
    C[Accept order]
    A[Place order]
  end
  B --> C
  linkStyle 0 stroke:#d64545`);
    await expect(typeOf(moved ?? '')).resolves.toBe('flowchart-v2');
    const objects = await editableObjects(moved ?? '');
    expect(objects?.items.find(({ id }) => id === 'Shop')?.members).toEqual(['C', 'A']);
    expect(objects?.items.find(({ id }) => id === 'Customer')?.members).toEqual(['B']);
  });

  it('renumbers linkStyle when an arrow moves past another', () => {
    const code = `flowchart LR
  subgraph L1
    A --> B
    C --> D
  end
  subgraph L2
    E
  end
  linkStyle 0 stroke:red
  linkStyle 1 stroke:blue`;
    const moved = moveNodeToLane(code, 'A', 'L2');
    expect(moved).toBe(`flowchart LR
  subgraph L1
    B
    C --> D
  end
  A --> B
  subgraph L2
    E
    A
  end
  linkStyle 1 stroke:red
  linkStyle 0 stroke:blue`);
  });

  it('takes a node out of every lane, and puts a top-level node into one', async () => {
    const out = moveNodeToLane(lanes, 'D', '');
    expect(out).toContain('  subgraph Shop\n    C[Accept order]\n  end\n');
    expect(out).toContain('  D ==> B\n  D{In stock?}\n  style Shop');
    expect(flowNodeDetails(out ?? '', 'D').lane).toBe('');
    await expect(typeOf(out ?? '')).resolves.toBe('swimlane');
    const back = moveNodeToLane(out ?? '', 'D', 'Shop');
    expect(back).toContain('  subgraph Shop\n    C[Accept order]\n    D{In stock?}\n  end\n');
    expect(back).not.toContain('  D{In stock?}\n  style');
    expect(moveNodeToLane(lanes, 'D', 'Nowhere')).toBeUndefined();
  });

  it('moves a node into a nested lane', () => {
    const code = `flowchart TB
  subgraph Outer
    subgraph Inner
      X
    end
  end
  A[Start] --> X`;
    expect(moveNodeToLane(code, 'A', 'Inner')).toBe(`flowchart TB
  subgraph Outer
    subgraph Inner
      X
      A[Start]
    end
  end
  A --> X`);
  });
});

describe('architecture service icon and group', () => {
  const code = `architecture-beta
  group api(cloud)[API]
  group inner(cloud)[Inner] in api
  service db(database)[Database] in inner
  service dns(internet)[DNS]
  db:R --> L:dns`;
  it('reads a service’s icon and group', () => {
    expect(serviceDetails(code, 'db')).toEqual({ group: 'inner', icon: 'database' });
    expect(serviceDetails(code, 'dns')).toEqual({ group: '', icon: 'internet' });
    expect(serviceDetails(code, 'api')).toBeUndefined();
  });
  it('changes the icon', async () => {
    const next = setServiceIcon(code, 'dns', 'logos:aws-route53');
    expect(next).toContain('  service dns(logos:aws-route53)[DNS]\n');
    await expect(typeOf(next ?? '')).resolves.toBe('architecture');
    expect(setServiceIcon(code, 'dns', 'bad icon!')).toBeUndefined();
  });
  it('moves a service into another group and out of every group', async () => {
    const moved = moveService(code, 'dns', 'api');
    expect(moved).toContain('  service dns(internet)[DNS] in api\n');
    await expect(typeOf(moved ?? '')).resolves.toBe('architecture');
    expect(moveService(code, 'db', '')).toContain('  service db(database)[Database]\n');
    expect(moveService(code, 'db', 'api')).toContain('  service db(database)[Database] in api\n');
  });
});

describe('sequence notes and blocks', () => {
  const code = `sequenceDiagram
  participant A as Alice
  participant B
  A->>B: hi
  Note over A,B: 確認
  alt 在庫あり
    B-->>A: ok
  else 在庫なし
    B-->>A: ng
  end
  loop 毎日
  end`;
  it('lists notes and blocks after the participants', async () => {
    const items = (await editableObjects(code))?.items ?? [];
    expect(items.map(({ id, label }) => [id, label])).toEqual([
      ['A', 'Alice'],
      ['B', 'B'],
      ['line:4', 'Note over A,B: 確認'],
      ['line:5', 'alt 在庫あり'],
      ['line:10', 'loop 毎日']
    ]);
  });
  it('changes a note’s text and a block’s condition', async () => {
    expect(renameObject(code, 'sequence', await object(code, 'line:4'), '承認; 済み')).toContain(
      '\n  Note over A,B: 承認, 済み\n'
    );
    expect(renameObject(code, 'sequence', await object(code, 'line:5'), '在庫は?')).toContain(
      '\n  alt 在庫は?\n'
    );
  });
  it('deletes a note, and a block keeping the messages inside', async () => {
    const note = deleteObject(code, 'sequence', await object(code, 'line:4'));
    expect(note).not.toContain('Note');
    const alt = deleteObject(code, 'sequence', await object(code, 'line:5'));
    expect(alt).toBe(`sequenceDiagram
  participant A as Alice
  participant B
  A->>B: hi
  Note over A,B: 確認
  B-->>A: ok
  B-->>A: ng
  loop 毎日
  end`);
    await expect(typeOf(alt)).resolves.toBe('sequence');
    const loop = deleteObject(code, 'sequence', await object(code, 'line:10'));
    await expect(typeOf(loop)).resolves.toBe('sequence');
    expect(loop).not.toContain('loop');
  });
});
