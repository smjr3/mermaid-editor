import { diagramData } from '@mermaid-js/examples';
import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';
import type { MermaidConfig, RenderResult } from 'mermaid';
import mermaid from 'mermaid';
import { addLabelHalo } from './architectureLabels';
import { remoteIconPacks } from './customIcons';
import { addDarkSiteBackdrop, withVisibleLines } from './darkLines';
import { registerStoredIconPacks } from './customIconStore';
import { env } from './env';
import { iconPacks } from './iconPacks';

// ELK ships bundled with mermaid 12 and is registered automatically.
mermaid.registerLayoutLoaders(tidyTreeLayouts);
// Local: bundled icon packs (AWS, Azure, Google Cloud, …), the ones this deployment hosts,
// and the ones the user imported; see iconPacks.ts and customIcons.ts.
mermaid.registerIconPacks([...iconPacks, ...remoteIconPacks(env.iconPacks)]);
const storedIconPacks = registerStoredIconPacks();
const init = mermaid.registerExternalDiagrams([zenuml]);

export const render = async (
  config: MermaidConfig,
  code: string,
  id: string
): Promise<RenderResult> => {
  await init;
  await storedIconPacks;

  // Should be able to call this multiple times without any issues.
  // Local: brighter lines in dark themes (darkLines.ts).
  mermaid.initialize(withVisibleLines(config));
  const result = await mermaid.render(id, code);
  // Local: keep architecture edges from running through service labels (architectureLabels.ts),
  // and keep a light-themed diagram readable on the dark site (darkLines.ts).
  const themeBackground = mermaid.mermaidAPI.getConfig().themeVariables?.background as unknown;
  const background = typeof themeBackground === 'string' ? themeBackground : '';
  return {
    ...result,
    svg: addDarkSiteBackdrop(addLabelHalo(result.svg, id, background), id, background)
  };
};

export const parse = async (code: string) => {
  return await mermaid.parse(code);
};

// A label as plain text: no HTML tags, markdown bold/italic stars or code marks (underscores stay: ids use them).
const plainLabel = (text: unknown): string =>
  (typeof text === 'string' ? text : '')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/[*`]+/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

export interface DiagramObject {
  id: string;
  label: string;
}
export interface DiagramObjects {
  items: DiagramObject[];
  /** Which list this is, for the card's heading. */
  kind: 'flowchart' | 'state' | 'class' | 'er' | 'requirement' | 'block' | 'c4';
  /** How a colour is written: a `style` statement, or C4's `UpdateElementStyle`. */
  syntax: 'style' | 'c4';
}

type Db = Record<string, unknown>;
type Entry = Record<string, unknown>;

/** Calls a getter of the diagram's database, if it has one. */
const read = (db: Db, name: string): unknown =>
  typeof db[name] === 'function' ? (db[name] as () => unknown).call(db) : undefined;
const entries = (value: unknown): [string, Entry][] =>
  value instanceof Map ? ([...value.entries()] as [string, Entry][]) : [];
const list = (value: unknown): Entry[] => (Array.isArray(value) ? (value as Entry[]) : []);

const item = (id: string, label: unknown): DiagramObject => ({
  id,
  label: plainLabel(label) || id
});

const blockItems = (blocks: Entry[]): DiagramObject[] =>
  blocks.flatMap((block) => [
    ...(block.type === 'space' || typeof block.id !== 'string'
      ? []
      : [item(block.id, block.label)]),
    ...blockItems(list(block.children))
  ]);

const extractors: Record<
  string,
  (db: Db) => Omit<DiagramObjects, 'items'> & { items: DiagramObject[] }
> = {
  block: (db) => ({
    items: blockItems(list(read(db, 'getBlocks'))),
    kind: 'block',
    syntax: 'style'
  }),
  c4: (db) => ({
    items: list(read(db, 'getC4ShapeArray')).map((shape) =>
      item(String(shape.alias), (shape.label as Entry | undefined)?.text)
    ),
    kind: 'c4',
    syntax: 'c4'
  }),
  classDiagram: (db) => ({
    items: entries(read(db, 'getClasses')).map(([id, value]) => item(id, value.label)),
    kind: 'class',
    syntax: 'style'
  }),
  er: (db) => ({
    items: entries(read(db, 'getEntities')).map(([id, value]) =>
      item(id, value.alias || value.label)
    ),
    kind: 'er',
    syntax: 'style'
  }),
  flowchart: (db) => {
    // A `style` statement naming a lane or subgraph also registers it as a vertex.
    const groups = new Set(list(read(db, 'getSubGraphs')).map(({ id }) => id));
    return {
      items: entries(read(db, 'getVertices'))
        .filter(([id]) => !groups.has(id))
        .map(([id, value]) => item(id, value.text)),
      kind: 'flowchart',
      syntax: 'style'
    };
  },
  requirement: (db) => ({
    items: [...entries(read(db, 'getRequirements')), ...entries(read(db, 'getElements'))].map(
      ([id]) => item(id, id)
    ),
    kind: 'requirement',
    syntax: 'style'
  }),
  stateDiagram: (db) => {
    const nodes = list((read(db, 'getData') as Entry | undefined)?.nodes);
    // Start and end points, notes, and the dividers between concurrent regions are not states.
    const hidden = new Set(['divider', 'note', 'noteGroup', 'stateEnd', 'stateStart']);
    return {
      items: nodes
        .filter(
          ({ id, shape }) =>
            typeof id === 'string' && !hidden.has(String(shape)) && !id.includes('----')
        )
        .map(({ id, label }) => item(id as string, label)),
      kind: 'state',
      syntax: 'style'
    };
  }
};
extractors['flowchart-v2'] = extractors.flowchart;
extractors['flowchart-elk'] = extractors.flowchart;
extractors.swimlane = extractors.flowchart;

/**
 * Local: the objects of a diagram that the Colours card can colour (nodes,
 * states, classes, entities, requirements, blocks, C4 elements), from mermaid's
 * own parse, with plain-text labels. Only ids a statement can name are kept.
 * Undefined for other diagram types and for code that does not parse.
 */
export const diagramObjects = async (code: string): Promise<DiagramObjects | undefined> => {
  try {
    await mermaid.parse(code);
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
    const found = extractors[diagram.type]?.(diagram.db as Db);
    if (!found) return undefined;
    const seen = new Set<string>();
    const items = found.items.filter(({ id }) => {
      if (!/^[\w-]+$/.test(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { ...found, items };
  } catch {
    return undefined;
  }
};

/**
 * @see https://mermaid.js.org/config/schema-docs/config.html
 */
export const defaultMermaidConfig = mermaid.mermaidAPI.defaultConfig ?? {};

// Detector ids (what `mermaid.parse` reports as diagramType) whose config
// section is named differently. Every other id shares its section's name, and
// ids without a section at all (wardley, zenuml) use the global defaults.
const CONFIG_SECTION_ALIASES: Record<string, string> = {
  classDiagram: 'class',
  'flowchart-elk': 'flowchart',
  'flowchart-v2': 'flowchart',
  railroadAbnf: 'railroad',
  railroadEbnf: 'railroad',
  railroadPeg: 'railroad',
  stateDiagram: 'state',
  xychart: 'xyChart'
};

const themeOfSection = (section: unknown): string | undefined => {
  if (section && typeof section === 'object' && 'theme' in section) {
    const { theme } = section as { theme?: unknown };
    if (typeof theme === 'string') {
      return theme;
    }
  }
  return undefined;
};

const globalDefaultTheme: string = defaultMermaidConfig.theme ?? 'default';

/** Mermaid's own default theme for a diagram type: its config section's, else the global one. */
export const getDefaultTheme = (diagramType: string): string => {
  const key = CONFIG_SECTION_ALIASES[diagramType] ?? diagramType;
  const section = (defaultMermaidConfig as Record<string, unknown>)[key];
  return themeOfSection(section) ?? globalDefaultTheme;
};

/** Dark counterpart of a default theme: redux themes have -dark variants, anything else uses `dark`. */
export const darkVariantOf = (theme: string): string => {
  if (theme.includes('dark')) {
    return theme;
  }
  return theme.startsWith('redux') ? theme.replace('redux', 'redux-dark') : 'dark';
};

// Every theme the editor may set on its own: the global default, each config
// section's default and their dark variants. Anything else is the user's choice.
const managedThemes = new Set<string>();
for (const theme of [
  globalDefaultTheme,
  ...Object.values(defaultMermaidConfig).map(themeOfSection)
]) {
  if (theme) {
    managedThemes.add(theme);
    managedThemes.add(darkVariantOf(theme));
  }
}

/** Whether the editor may replace this theme (a missing theme counts as managed). */
export const isManagedTheme = (theme: unknown): boolean =>
  theme === undefined || (typeof theme === 'string' && managedThemes.has(theme));

type DiagramDefinition = (typeof diagramData)[number];

export type SampleExample = DiagramDefinition['examples'][number];

const isValidDiagram = (diagram: DiagramDefinition): diagram is Required<DiagramDefinition> => {
  return Boolean(diagram.name && diagram.examples && diagram.examples.length > 0);
};

export const getSampleDiagrams = (): Record<string, SampleExample[]> => {
  const samples: Record<string, SampleExample[]> = {};
  for (const diagram of diagramData.filter((d) => isValidDiagram(d))) {
    // The default example comes first, so it is loaded when clicking the
    // diagram name and shown at the top of the example dropdown.
    samples[diagram.name.replace(/ (Diagram|Chart|Graph)/, '')] = [...diagram.examples].sort(
      (a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false)
    );
  }
  return samples;
};
