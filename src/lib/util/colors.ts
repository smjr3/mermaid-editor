/**
 * Local: helpers for the editor's "Colours" card (ColorControls.svelte).
 *
 * The theme and the line colour live in the mermaid config; lane and subgraph
 * colours are ordinary `style <id> fill:…,stroke:…` statements in the code.
 * Either way the result is plain mermaid, so a shared link keeps the colours.
 */
import { isManagedTheme } from './mermaid';

/** Themes offered besides "auto"; the managed ones (see isManagedTheme) are not, since the editor would replace them. */
export const themeChoices = [
  'redux',
  'neo',
  'neutral',
  'forest',
  'base',
  'redux-dark',
  'neo-dark'
] as const;
export type ThemeChoice = 'auto' | (typeof themeChoices)[number];

export interface Swatch {
  fill: string;
  stroke: string;
}

/** Light fills with a stronger border of the same hue; dark text stays readable on every fill. */
export type SwatchName =
  'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal' | 'yellow' | 'grey';

export const swatches: (Swatch & { name: SwatchName })[] = [
  { fill: '#dde9fb', name: 'blue', stroke: '#3b73c9' },
  { fill: '#def5e1', name: 'green', stroke: '#3f9b52' },
  { fill: '#fdebd3', name: 'orange', stroke: '#d9822b' },
  { fill: '#ece2fb', name: 'purple', stroke: '#7d55c7' },
  { fill: '#fde2e1', name: 'red', stroke: '#d64545' },
  { fill: '#d7f3f1', name: 'teal', stroke: '#2a9d8f' },
  { fill: '#fdf6c9', name: 'yellow', stroke: '#c9a400' },
  { fill: '#eceff1', name: 'grey', stroke: '#78848f' }
];

/** Lane title colour with a fill: the dark theme's light title would vanish on the light fills. */
export const laneText = '#1f2329';

/** Colours for the line-colour buttons. */
export const lineColors = ['#333333', '#3b73c9', '#3f9b52', '#d9822b', '#d64545', '#7d55c7'];

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

const format = (config: Config) => JSON.stringify(config, undefined, 2);

const hexPattern = /^#[\da-f]{6}$/i;

export const getTheme = (config: string): ThemeChoice | string => {
  const theme = parse(config)?.theme;
  return isManagedTheme(theme) || typeof theme !== 'string' ? 'auto' : theme;
};

/** The config with the theme set; "auto" drops it so the editor picks one again. */
export const setTheme = (config: string, theme: ThemeChoice): string => {
  const parsed = parse(config);
  if (!parsed) return config;
  const rest = { ...parsed };
  delete rest.theme;
  return format(theme === 'auto' ? rest : { ...rest, theme });
};

const themeVariables = (config: Config): Config =>
  config.themeVariables && typeof config.themeVariables === 'object'
    ? (config.themeVariables as Config)
    : {};

export const getLineColor = (config: string): string | undefined => {
  const parsed = parse(config);
  const value = parsed ? themeVariables(parsed).lineColor : undefined;
  return typeof value === 'string' ? value : undefined;
};

/** The config with the line colour (a #rrggbb colour) set, or cleared when undefined. */
export const setLineColor = (config: string, color: string | undefined): string => {
  const parsed = parse(config);
  if (!parsed || (color !== undefined && !hexPattern.test(color))) return config;
  const variables = { ...themeVariables(parsed) };
  delete variables.lineColor;
  const next = color === undefined ? variables : { ...variables, lineColor: color };
  const rest = { ...parsed };
  delete rest.themeVariables;
  return format(Object.keys(next).length > 0 ? { ...rest, themeVariables: next } : rest);
};

/** A light fill for a border colour: the colour mixed with 84% white. */
export const tint = (color: string): string => {
  if (!hexPattern.test(color)) return '#eceff1';
  const mixed = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16);
    return Math.round(value + (255 - value) * 0.84)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${mixed.join('')}`;
};

// Monaco can write Windows line endings; split on either and write back what was there.
const splitLines = (code: string) => ({
  eol: code.includes('\r\n') ? '\r\n' : '\n',
  lines: code.split(/\r?\n/)
});

const groupHeader = /^\s*(?:flowchart-elk|flowchart|graph|swimlane-beta)\b/;
// `subgraph id`, `subgraph id [Title]` or `subgraph id["Title"]`; a quoted title alone has no id.
const subgraphPattern = /^\s*subgraph\s+([\w-]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/;

export interface Group {
  id: string;
  label: string;
}

/** The lanes of a swimlane diagram, or the subgraphs of a flowchart, that a style statement can name. */
export const listGroups = (code: string): Group[] => {
  const { lines } = splitLines(code);
  const header = lines.find((line) => line.trim() && !line.trim().startsWith('%%'));
  if (!header || !groupHeader.test(header)) return [];
  const groups: Group[] = [];
  for (const line of lines) {
    const match = subgraphPattern.exec(line);
    if (match && !groups.some(({ id }) => id === match[1])) {
      groups.push({ id: match[1], label: match[2]?.trim() || match[1] });
    }
  }
  return groups;
};

const stylePattern = (id: string) =>
  new RegExp(`^(\\s*)style\\s+${id.replaceAll('-', '\\-')}\\s+(.*?)\\s*;?\\s*$`);

const readStyle = (properties: string): [string, string][] =>
  properties
    .split(',')
    .map((part) => part.split(':').map((value) => value.trim()))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, value]);

export const getGroupColor = (code: string, id: string): Swatch | undefined => {
  const pattern = stylePattern(id);
  for (const line of splitLines(code).lines) {
    const match = pattern.exec(line);
    if (!match) continue;
    const properties = Object.fromEntries(readStyle(match[2]));
    if (properties.fill || properties.stroke) {
      return { fill: properties.fill ?? '', stroke: properties.stroke ?? '' };
    }
  }
  return undefined;
};

/** The code with the lane's fill and border set, or removed when `swatch` is undefined. */
export const setGroupColor = (code: string, id: string, swatch: Swatch | undefined): string => {
  if (swatch && (!hexPattern.test(swatch.fill) || !hexPattern.test(swatch.stroke))) return code;
  const { eol, lines } = splitLines(code);
  const pattern = stylePattern(id);
  const index = lines.findIndex((line) => pattern.test(line));
  const colors: [string, string][] = swatch
    ? [
        ['fill', swatch.fill],
        ['stroke', swatch.stroke],
        ['color', laneText]
      ]
    : [];
  if (index === -1) {
    if (!swatch) return code;
    // After the last statement, so a trailing newline stays at the end.
    const last = lines.findLastIndex((line) => line.trim());
    lines.splice(last + 1, 0, `  style ${id} ${colors.map((pair) => pair.join(':')).join(',')}`);
    return lines.join(eol);
  }
  const [, indent, properties] = pattern.exec(lines[index]) ?? [];
  const others = readStyle(properties ?? '').filter(
    ([key]) => !['color', 'fill', 'stroke'].includes(key)
  );
  const next = [...colors, ...others];
  if (next.length === 0) {
    lines.splice(index, 1);
  } else {
    lines[index] = `${indent}style ${id} ${next.map((pair) => pair.join(':')).join(',')}`;
  }
  return lines.join(eol);
};

/** Every lane coloured with its own swatch, in order; or every lane colour removed. */
export const colorAllGroups = (code: string, clear = false): string =>
  listGroups(code).reduce(
    (result, { id }, index) =>
      setGroupColor(result, id, clear ? undefined : swatches[index % swatches.length]),
    code
  );
