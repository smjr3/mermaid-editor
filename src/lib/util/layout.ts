/**
 * Local: layout controls for the editor's "Layout" card (LayoutControls.svelte).
 *
 * mermaid has no aspect-ratio setting; what shapes a diagram is its direction
 * (top-to-bottom or left-to-right), the layout engine and the spacing. These
 * helpers change those through the diagram code and the mermaid config, so the
 * result is ordinary mermaid that a shared link or mermaid.live renders the same.
 */

export type Direction = 'TB' | 'LR';
export type Engine = 'dagre' | 'elk';
export type Spacing = 'compact' | 'normal' | 'wide';
export interface LayoutOptions {
  engine: Engine;
  spacing: Spacing;
}
export interface Size {
  width: number;
  height: number;
}

// Diagrams whose direction is part of the header line (`flowchart LR`).
const headerPattern =
  /^(\s*(?:flowchart-elk|flowchart|graph|swimlane-beta))\b(?:[ \t]+(TB|TD|BT|RL|LR)\b)?(.*)$/;
// Diagrams that take a `direction LR` statement.
const statementHeaderPattern =
  /^\s*(?:stateDiagram-v2|stateDiagram|classDiagram-v2|classDiagram|erDiagram|requirementDiagram)\b/;
const statementPattern = /^(\s*direction[ \t]+)(TB|BT|LR|RL)\b/;

// Monaco can write Windows line endings; split on either and write back what was there.
const splitLines = (code: string) => ({
  eol: code.includes('\r\n') ? '\r\n' : '\n',
  lines: code.split(/\r?\n/)
});

const orientation = (value: string | undefined): Direction =>
  value === 'LR' || value === 'RL' ? 'LR' : 'TB';

/** Index of the diagram's header line, past front matter, blank lines and comments. */
const headerIndex = (lines: string[]): number => {
  let index = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    index = end === -1 ? lines.length : end + 1;
  }
  while (index < lines.length && (!lines[index].trim() || lines[index].trim().startsWith('%%'))) {
    index++;
  }
  return index;
};

/** The top-level `direction` statement (outside any `{ … }` block), if there is one. */
const statementIndex = (lines: string[], header: number): number => {
  let depth = 0;
  for (let index = header + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim().startsWith('%%')) continue;
    if (depth === 0 && statementPattern.test(line)) return index;
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
  }
  return -1;
};

/** The diagram's direction, or undefined for a diagram type whose direction cannot be set. */
export const getDirection = (code: string): Direction | undefined => {
  const { lines } = splitLines(code);
  const header = headerIndex(lines);
  const line = lines[header] ?? '';
  const match = headerPattern.exec(line);
  if (match) return orientation(match[2]);
  if (!statementHeaderPattern.test(line)) return undefined;
  const statement = statementIndex(lines, header);
  return orientation(statement === -1 ? undefined : statementPattern.exec(lines[statement])?.[2]);
};

/** The code with its direction set; unchanged for a diagram type that has none. */
export const setDirection = (code: string, direction: Direction): string => {
  const { eol, lines } = splitLines(code);
  const header = headerIndex(lines);
  const line = lines[header] ?? '';
  const match = headerPattern.exec(line);
  if (match) {
    lines[header] = `${match[1]} ${direction}${match[3]}`;
    return lines.join(eol);
  }
  if (!statementHeaderPattern.test(line)) return code;
  const statement = statementIndex(lines, header);
  if (statement === -1) {
    const next = lines.slice(header + 1).find((candidate) => candidate.trim());
    const indent = /^\s+/.exec(next ?? '')?.[0] ?? '  ';
    lines.splice(header + 1, 0, `${indent}direction ${direction}`);
  } else {
    lines[statement] = lines[statement].replace(statementPattern, `$1${direction}`);
  }
  return lines.join(eol);
};

// How much smaller left-to-right may show a diagram and still be chosen: the
// editor's view is wide, and the request behind "fit" is to avoid tall flows.
const landscapePreference = 1.25;

/**
 * The direction that shows the diagram largest when it is scaled to fit the
 * view (fit scale = min(view width / width, view height / height)), with
 * left-to-right preferred unless top-to-bottom is clearly larger.
 */
export const pickDirection = (sizes: Record<Direction, Size>, view: Size): Direction => {
  const scale = ({ width, height }: Size) => Math.min(view.width / width, view.height / height);
  return scale(sizes.LR) * landscapePreference >= scale(sizes.TB) ? 'LR' : 'TB';
};

/** The width and height in a rendered SVG's viewBox. */
export const viewBoxSize = (svg: string): Size | undefined => {
  const values = /viewBox="([^"]+)"/
    .exec(svg)?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (!values || values.length !== 4 || !(values[2] > 0) || !(values[3] > 0)) return undefined;
  return { height: values[3], width: values[2] };
};

// Config sections whose renderer reads nodeSpacing / rankSpacing.
const spacingSections = ['flowchart', 'class', 'state', 'er'];
const spacingValues: Record<
  Exclude<Spacing, 'normal'>,
  { nodeSpacing: number; rankSpacing: number }
> = {
  compact: { nodeSpacing: 25, rankSpacing: 30 },
  wide: { nodeSpacing: 80, rankSpacing: 80 }
};

type Config = Record<string, unknown>;

const parse = (config: string): Config | undefined => {
  try {
    const value: unknown = JSON.parse(config);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Config)
      : undefined;
  } catch {
    return undefined;
  }
};

export const getLayoutOptions = (config: string): LayoutOptions => {
  const parsed = parse(config) ?? {};
  const flowchart = parsed.flowchart as { nodeSpacing?: unknown } | undefined;
  const spacing =
    (Object.keys(spacingValues) as (keyof typeof spacingValues)[]).find(
      (key) => flowchart?.nodeSpacing === spacingValues[key].nodeSpacing
    ) ?? 'normal';
  return { engine: parsed.layout === 'elk' ? 'elk' : 'dagre', spacing };
};

/** The config JSON with the layout engine and spacing set; unchanged when it does not parse. */
export const setLayoutOptions = (config: string, { engine, spacing }: LayoutOptions): string => {
  const parsed = parse(config);
  if (!parsed) return config;
  if (engine === 'elk') {
    parsed.layout = 'elk';
  } else {
    delete parsed.layout;
  }
  for (const name of spacingSections) {
    const rest = Object.fromEntries(
      Object.entries((parsed[name] ?? {}) as Config).filter(
        ([key]) => key !== 'nodeSpacing' && key !== 'rankSpacing'
      )
    );
    parsed[name] = spacing === 'normal' ? rest : { ...rest, ...spacingValues[spacing] };
  }
  // Drop the sections left empty, so a normal layout leaves no trace in the config.
  const result = Object.fromEntries(
    Object.entries(parsed).filter(
      ([name, value]) => !spacingSections.includes(name) || Object.keys(value as Config).length > 0
    )
  );
  return JSON.stringify(result, undefined, 2);
};
