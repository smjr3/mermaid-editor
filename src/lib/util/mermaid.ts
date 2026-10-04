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

const flowTypes = new Set(['flowchart', 'flowchart-elk', 'flowchart-v2', 'swimlane']);

// A node label as plain text: no HTML tags, markdown emphasis or code marks.
const plainLabel = (text: string): string =>
  text
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/[*_`]+/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

/**
 * Local: the nodes of a flowchart or swimlane diagram that a `style` statement
 * can name, with plain-text labels, for the Colours card. Empty for other
 * diagram types and for code that does not parse.
 */
export const flowNodes = async (code: string): Promise<{ id: string; label: string }[]> => {
  try {
    await mermaid.parse(code);
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
    const db = diagram.db as {
      getSubGraphs?: () => { id: string }[];
      getVertices?: () => Map<string, { id: string; text?: string }>;
    };
    if (!flowTypes.has(diagram.type) || !db.getVertices) return [];
    // A `style` statement naming a lane or subgraph also registers it as a vertex.
    const groups = new Set((db.getSubGraphs?.() ?? []).map(({ id }) => id));
    return [...db.getVertices().values()]
      .filter(({ id }) => /^[\w-]+$/.test(id) && !groups.has(id))
      .map(({ id, text }) => ({ id, label: plainLabel(text ?? '') || id }));
  } catch {
    return [];
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
