import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import {
  addArchEdge,
  addArchGroup,
  addArchService,
  addLane,
  addNode,
  canAdd,
  isArchitecture
} from './diagramEdit';

const lanes = `swimlane-beta LR
  subgraph Customer
    A[Place order]
  end
  subgraph Shop
    C[Accept order]
  end
  A --> C
  style Shop fill:#dde9fb,stroke:#3b73c9,color:#1f2329
  linkStyle 0 stroke:#d64545`;

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

describe('canAdd', () => {
  it('is for flowcharts and swimlane diagrams', () => {
    expect(canAdd(lanes)).toBe(true);
    expect(canAdd('%% note\nflowchart TD\n  A')).toBe(true);
    expect(canAdd('graph LR\n  A')).toBe(true);
    expect(canAdd('sequenceDiagram\n  A->>B: hi')).toBe(false);
  });
});

describe('addLane', () => {
  it('adds an empty lane after the last statement, before the style statements', async () => {
    const { code, id } = addLane(lanes, 'New lane');
    expect(id).toBe('Lane1');
    expect(code).toBe(
      lanes.replace('  A --> C\n', '  A --> C\n  subgraph Lane1 ["New lane"]\n  end\n')
    );
    await expect(typeOf(code)).resolves.toBe('swimlane');
  });

  it('picks an id the code does not use yet', () => {
    expect(addLane(`${lanes}\n  %% Lane1 Lane2`, 'x').id).toBe('Lane3');
  });

  it('keeps quotes in the title from breaking the code', async () => {
    const { code } = addLane(lanes, 'Say "hi"');
    expect(code).toContain('subgraph Lane1 ["Say #quot;hi#quot;"]');
    await expect(typeOf(code)).resolves.toBe('swimlane');
  });

  it('keeps Windows line endings and a trailing newline', () => {
    const { code } = addLane('flowchart TD\r\n  A\r\n', 'L');
    expect(code).toBe('flowchart TD\r\n  A\r\n  subgraph Lane1 ["L"]\r\n  end\r\n');
  });
});

describe('addNode', () => {
  it('adds a node inside a lane, before its end', async () => {
    const { code, id } = addNode(lanes, { label: 'Pack', lane: 'Shop' });
    expect(id).toBe('n1');
    expect(code).toBe(
      lanes.replace('    C[Accept order]\n', '    C[Accept order]\n    n1["Pack"]\n')
    );
    await expect(typeOf(code)).resolves.toBe('swimlane');
  });

  it('adds a node outside any lane, and an arrow from another node', async () => {
    const { code } = addNode(lanes, { from: 'C', label: 'Ship' });
    expect(code).toBe(lanes.replace('  A --> C\n', '  A --> C\n  n1["Ship"]\n  C --> n1\n'));
    await expect(typeOf(code)).resolves.toBe('swimlane');
  });

  it('keeps the numbers of existing arrows, so linkStyle statements still match', async () => {
    const { code } = addNode(lanes, { from: 'A', label: 'x', lane: 'Customer' });
    await mermaid.parse(code);
    const db = (await mermaid.mermaidAPI.getDiagramFromText(code)).db as {
      getEdges: () => { start: string; end: string }[];
    };
    expect(db.getEdges().map(({ start, end }) => `${start}>${end}`)).toEqual(['A>C', 'A>n1']);
  });

  it('finds the end of a lane that holds a nested subgraph', () => {
    const code =
      'flowchart TD\n  subgraph Outer\n    subgraph Inner\n      a\n    end\n    b\n  end';
    expect(addNode(code, { label: 'c', lane: 'Outer' }).code).toBe(
      'flowchart TD\n  subgraph Outer\n    subgraph Inner\n      a\n    end\n    b\n    n1["c"]\n  end'
    );
  });
});

const arch = `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service web(server)[Web] in api
  db:R --> L:web
`;

describe('architecture', () => {
  it('is recognised', () => {
    expect(isArchitecture(arch)).toBe(true);
    expect(isArchitecture(lanes)).toBe(false);
    expect(canAdd(arch)).toBe(false);
  });

  it('adds a group, inside another group if asked', async () => {
    const { code, id } = addArchGroup(arch, { icon: 'cloud', label: 'Back office', parent: 'api' });
    expect(id).toBe('grp1');
    expect(code).toBe(`${arch}  group grp1(cloud)[Back office] in api\n`);
    await expect(typeOf(code)).resolves.toBe('architecture');
    expect(addArchGroup(arch, { icon: 'internet', label: 'Edge' }).code).toContain(
      '  group grp1(internet)[Edge]\n'
    );
  });

  it('adds a service in a group, joined from another service on the chosen side', async () => {
    const { code, id } = addArchService(arch, {
      arrow: true,
      from: 'web',
      group: 'api',
      icon: 'disk',
      label: 'ストレージ (本番)',
      place: 'down'
    });
    expect(id).toBe('svc1');
    expect(code).toBe(
      `${arch}  service svc1(disk)[ストレージ (本番)] in api\n  web:B --> T:svc1\n`
    );
    await expect(typeOf(code)).resolves.toBe('architecture');
  });

  it.each([
    ['right', 'web:R -- L:svc1'],
    ['left', 'web:L -- R:svc1'],
    ['up', 'web:T -- B:svc1']
  ] as const)('places the new service %s of the other', (place, edge) => {
    const { code } = addArchService(arch, { from: 'web', icon: 'server', label: 'x', place });
    expect(code).toContain(`  ${edge}\n`);
  });

  it('joins two existing services', async () => {
    const code = addArchEdge(arch, { arrow: false, from: 'web', place: 'right', to: 'db' });
    expect(code).toBe(`${arch}  web:R -- L:db\n`);
    await expect(typeOf(code)).resolves.toBe('architecture');
  });

  it('takes any icon name, and keeps brackets out of the label', async () => {
    const { code } = addArchService(arch, { icon: 'logos:aws-lambda', label: 'Fn [beta]' });
    expect(code).toContain('  service svc1(logos:aws-lambda)[Fn beta]\n');
    expect(addArchService(arch, { icon: 'bad icon)', label: 'x' }).code).toContain(
      'service svc1(server)[x]'
    );
    await expect(typeOf(code)).resolves.toBe('architecture');
  });
});
