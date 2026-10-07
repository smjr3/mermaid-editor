/**
 * Local: every id a diagram's objects answer to, from mermaid's own parse — what
 * F2 (mermaidRename.ts) must not rename an object to. mermaid merges two objects
 * that share an id without complaint (`A[Alpha] --> B[Beta]` renamed A → B is one
 * node, `B`), so a rename onto a taken id would silently join them.
 *
 * Labels are not ids: `participant A as Alice` answers to `A`, `B[Alpha]` to `B`.
 * Undefined for diagram types without a reader here and for code that does not
 * parse; the rename then falls back to the lexical check.
 */
import mermaid from 'mermaid';
import { diagramFromText } from './mermaid';
import { memoByCode } from './memo';

type Db = Record<string, unknown>;
type Entry = Record<string, unknown>;

const read = (db: Db, name: string): unknown =>
  typeof db[name] === 'function' ? (db[name] as () => unknown).call(db) : undefined;
const list = (value: unknown): Entry[] => (Array.isArray(value) ? (value as Entry[]) : []);
const keys = (value: unknown): string[] =>
  value instanceof Map ? [...value.keys()].map(String) : [];
const field = (entries: Entry[], name: string): string[] =>
  entries.map((entry) => entry[name]).filter((id): id is string => typeof id === 'string');
const nodes = (db: Db): Entry[] => list((read(db, 'getData') as Entry | undefined)?.nodes);

// Start and end points, notes and concurrency dividers are not something a user names.
const stateHidden = new Set(['divider', 'note', 'noteGroup', 'stateEnd', 'stateStart']);

const flowchart = (db: Db) => [
  ...keys(read(db, 'getVertices')),
  ...field(list(read(db, 'getSubGraphs')), 'id')
];

const readers: Record<string, (db: Db) => string[]> = {
  architecture: (db) =>
    ['getServices', 'getGroups', 'getJunctions'].flatMap((name) =>
      field(list(read(db, name)), 'id')
    ),
  block: (db) =>
    field(
      list(read(db, 'getBlocksFlat')).filter(({ id, type }) => id !== 'root' && type !== 'space'),
      'id'
    ),
  c4: (db) => [
    ...field(list(read(db, 'getC4ShapeArray')), 'alias'),
    ...field(list(read(db, 'getBoundaries')), 'alias').filter((alias) => alias !== 'global')
  ],
  classDiagram: (db) => [...keys(read(db, 'getClasses')), ...keys(read(db, 'getNamespaces'))],
  er: (db) => keys(read(db, 'getEntities')),
  flowchart,
  'flowchart-elk': flowchart,
  'flowchart-v2': flowchart,
  gitGraph: (db) => keys(read(db, 'getBranches')),
  kanban: (db) => field(nodes(db), 'id'),
  mindmap: (db) => field(nodes(db), 'nodeId'),
  requirement: (db) => [...keys(read(db, 'getRequirements')), ...keys(read(db, 'getElements'))],
  sequence: (db) => keys(read(db, 'getActors')),
  stateDiagram: (db) =>
    field(
      nodes(db).filter(
        ({ id, shape }) =>
          typeof id === 'string' && !stateHidden.has(String(shape)) && !id.includes('----')
      ),
      'id'
    ),
  swimlane: flowchart
};

/** The ids of the diagram's objects, or undefined when unknown (see above). */
export const diagramIds = memoByCode(
  async (code: string): Promise<ReadonlySet<string> | undefined> => {
    try {
      await mermaid.parse(code);
      const diagram = await diagramFromText(code);
      const reader = readers[diagram.type];
      return reader ? new Set(reader(diagram.db as Db)) : undefined;
    } catch {
      return undefined;
    }
  }
);
