/**
 * Local: helpers for the editor's "Colours" card (ColorControls.svelte).
 *
 * The theme and the line colour live in the mermaid config; lane and subgraph
 * colours are ordinary `style <id> fill:…,stroke:…` statements in the code.
 * Either way the result is plain mermaid, so a shared link keeps the colours.
 */
import { headerLine } from './diagramEdit';
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
const subgraphPattern = /^\s*subgraph\s+([\p{L}\p{N}_-]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/u;

export interface Group {
  id: string;
  label: string;
}

/** The lanes of a swimlane diagram, or the subgraphs of a flowchart, that a style statement can name. */
export const listGroups = (code: string): Group[] => {
  const { lines } = splitLines(code);
  if (!groupHeader.test(headerLine(code))) return [];
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

export const getStyleColor = (code: string, id: string): Swatch | undefined => {
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

type Property = [string, string];

const joinStyle = (properties: Property[]) => properties.map((pair) => pair.join(':')).join(',');

/**
 * Which statement colours an object: `style <id> …` for most diagrams, the same
 * for class diagrams (whose grammar needs a little help, see `withLeadIn`), or
 * C4's `UpdateElementStyle(id, …)`.
 */
export type ColorSyntax = 'style' | 'class' | 'c4';

// mermaid's class grammar rejects a style statement whose first property has a
// hyphen (`style A font-size:18px` or `stroke-width:2px` fails with "got 'MINUS'";
// `fill:…,font-size:18px` is fine). A harmless property goes in front when needed
// and is dropped again once a colour leads; `opacity:1` is the default, so it
// changes nothing.
const leadIn: Property = ['opacity', '1'];
const withoutLeadIn = (properties: Property[], syntax: ColorSyntax) =>
  syntax === 'class'
    ? properties.filter(([key, value]) => key !== leadIn[0] || value !== leadIn[1])
    : properties;
const withLeadIn = (properties: Property[], syntax: ColorSyntax) =>
  syntax === 'class' && properties[0]?.[0].includes('-') ? [leadIn, ...properties] : properties;

/** The object's style statement rewritten by `update`: added when missing, removed when empty. */
const updateStyle = (
  code: string,
  id: string,
  update: (properties: Property[]) => Property[],
  syntax: ColorSyntax = 'style'
): string => {
  const { eol, lines } = splitLines(code);
  const pattern = stylePattern(id);
  const index = lines.findIndex((line) => pattern.test(line));
  const [, indent = '  ', properties = ''] = index === -1 ? [] : (pattern.exec(lines[index]) ?? []);
  const next = withLeadIn(update(withoutLeadIn(readStyle(properties), syntax)), syntax);
  const statement = next.length > 0 ? `${indent}style ${id} ${joinStyle(next)}` : undefined;
  if (index === -1) {
    if (!statement) return code;
    // After the last statement, so a trailing newline stays at the end.
    const last = lines.findLastIndex((line) => line.trim());
    lines.splice(last + 1, 0, statement);
  } else {
    lines.splice(index, 1, ...(statement ? [statement] : []));
  }
  return lines.join(eol);
};

const colorKeys = new Set(['color', 'fill', 'stroke']);

/**
 * The code with the lane's fill and border set, or removed when `swatch` is
 * undefined. A text colour the user chose stays; otherwise the dark `laneText`
 * keeps the title readable on the light fill.
 */
export const setStyleColor = (
  code: string,
  id: string,
  swatch: Swatch | undefined,
  syntax: ColorSyntax = 'style'
): string => {
  if (swatch && (!hexPattern.test(swatch.fill) || !hexPattern.test(swatch.stroke))) return code;
  return updateStyle(
    code,
    id,
    (properties) => {
      const text = properties.find(([key]) => key === 'color')?.[1] ?? laneText;
      const others = properties.filter(([key]) => !colorKeys.has(key));
      return swatch
        ? [['fill', swatch.fill], ['stroke', swatch.stroke], ['color', text], ...others]
        : others;
    },
    syntax
  );
};

/** Every lane coloured with its own swatch, in order; or every lane colour removed. */
export const colorAllGroups = (code: string, clear = false, palette: Swatch[] = swatches): string =>
  listGroups(code).reduce(
    (result, { id }, index) =>
      setStyleColor(result, id, clear ? undefined : palette[index % palette.length]),
    code
  );

const c4Pattern = (id: string) =>
  new RegExp(`^(\\s*)UpdateElementStyle\\(\\s*${id.replaceAll('-', '\\-')}\\s*(?:,(.*))?\\)\\s*$`);
// `$name="value"` settings, in order.
const c4Settings = (text: string): Property[] =>
  [...text.matchAll(/\$(\w+)\s*=\s*"([^"]*)"/g)].map(([, key, value]) => [key, value]);
const c4Keys = new Set(['bgColor', 'borderColor', 'fontColor']);

/** The element's settings, from the first UpdateElementStyle statement naming it. */
const c4SettingsOf = (code: string, id: string): Record<string, string> => {
  const pattern = c4Pattern(id);
  for (const line of splitLines(code).lines) {
    const match = pattern.exec(line);
    if (match) return Object.fromEntries(c4Settings(match[2] ?? ''));
  }
  return {};
};

/** The element's UpdateElementStyle statement rewritten by `update`: added when missing, removed when empty. */
const updateC4 = (
  code: string,
  id: string,
  update: (settings: Property[]) => Property[]
): string => {
  const { eol, lines } = splitLines(code);
  const pattern = c4Pattern(id);
  const index = lines.findIndex((line) => pattern.test(line));
  const [, indent = '  ', rest = ''] = index === -1 ? [] : (pattern.exec(lines[index]) ?? []);
  const next = update(c4Settings(rest));
  const statement =
    next.length > 0
      ? `${indent}UpdateElementStyle(${[id, ...next.map(([key, value]) => `$${key}="${value}"`)].join(', ')})`
      : undefined;
  if (index === -1) {
    if (!statement) return code;
    const last = lines.findLastIndex((line) => line.trim());
    lines.splice(last + 1, 0, statement);
  } else {
    lines.splice(index, 1, ...(statement ? [statement] : []));
  }
  return lines.join(eol);
};

const getC4Color = (code: string, id: string): Swatch | undefined => {
  const settings = c4SettingsOf(code, id);
  return settings.bgColor || settings.borderColor
    ? { fill: settings.bgColor ?? '', stroke: settings.borderColor ?? '' }
    : undefined;
};

/** C4 has no `style` statement: colours go in `UpdateElementStyle(id, $bgColor=…, …)`. */
const setC4Color = (code: string, id: string, swatch: Swatch | undefined): string => {
  if (swatch && (!hexPattern.test(swatch.fill) || !hexPattern.test(swatch.stroke))) return code;
  return updateC4(code, id, (settings) => {
    const text = settings.find(([key]) => key === 'fontColor')?.[1] ?? laneText;
    const others = settings.filter(([key]) => !c4Keys.has(key));
    return swatch
      ? [['bgColor', swatch.fill], ['borderColor', swatch.stroke], ['fontColor', text], ...others]
      : others;
  });
};

export const getObjectColor = (code: string, id: string, syntax: ColorSyntax) =>
  syntax === 'c4' ? getC4Color(code, id) : getStyleColor(code, id);

/** The code with the object's colours set, or removed when `swatch` is undefined. */
export const setObjectColor = (
  code: string,
  id: string,
  swatch: Swatch | undefined,
  syntax: ColorSyntax
): string =>
  syntax === 'c4' ? setC4Color(code, id, swatch) : setStyleColor(code, id, swatch, syntax);

/** Every object coloured with its own swatch, in order; or every object's colour removed. */
export const colorAll = (
  code: string,
  ids: string[],
  syntax: ColorSyntax,
  clear = false,
  palette: Swatch[] = swatches
): string =>
  ids.reduce(
    (result, id, index) =>
      setObjectColor(result, id, clear ? undefined : palette[index % palette.length], syntax),
    code
  );

export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';
export const textSizeChoices: TextSize[] = ['small', 'normal', 'large', 'xlarge'];
/** The `font-size` each choice writes; "normal" writes none, so the theme's size applies. */
export const textSizes: Partial<Record<TextSize, string>> = {
  large: '18px',
  small: '12px',
  xlarge: '24px'
};

export interface TextStyle {
  bold: boolean;
  size: TextSize;
}

const fontKeys = new Set(['font-size', 'font-weight']);
const boldValues = new Set(['bold', 'bolder', '700', '800', '900']);

/** The object's properties, from the first style statement naming it. */
const styleProperties = (code: string, id: string): Record<string, string> => {
  const pattern = stylePattern(id);
  for (const line of splitLines(code).lines) {
    const match = pattern.exec(line);
    if (match) return Object.fromEntries(readStyle(match[2]));
  }
  return {};
};

/**
 * Whether the object's text is bold, and which size it has; a size written by
 * hand that is not one of the choices reads as normal. C4 has neither.
 */
export const getTextStyle = (code: string, id: string, syntax: ColorSyntax): TextStyle => {
  if (syntax === 'c4') return { bold: false, size: 'normal' };
  const properties = styleProperties(code, id);
  const size = textSizeChoices.find((choice) => textSizes[choice] === properties['font-size']);
  return { bold: boldValues.has(properties['font-weight'] ?? ''), size: size ?? 'normal' };
};

/**
 * The code with the object's text made bold (or not) and given a size:
 * `font-weight:bold` and `font-size:18px` in the same style statement as its
 * colours, removed again for not bold and normal. A field left out keeps its
 * value. mermaid honours both for flowchart, swimlane, state, class, ER,
 * requirement and block diagrams; C4's UpdateElementStyle has no such setting,
 * so the code comes back unchanged.
 */
export const setTextStyle = (
  code: string,
  id: string,
  text: Partial<TextStyle>,
  syntax: ColorSyntax
): string => {
  if (syntax === 'c4') return code;
  const current = getTextStyle(code, id, syntax);
  const { bold = current.bold, size = current.size } = text;
  const px = textSizes[size];
  return updateStyle(
    code,
    id,
    (properties) => [
      ...properties.filter(([key]) => !fontKeys.has(key)),
      ...(bold ? [['font-weight', 'bold'] as Property] : []),
      ...(px ? [['font-size', px] as Property] : [])
    ],
    syntax
  );
};

/** The text colour the object's statement sets: `color:`, or C4's `$fontColor`. */
export const getTextColor = (code: string, id: string, syntax: ColorSyntax): string | undefined =>
  syntax === 'c4' ? c4SettingsOf(code, id).fontColor : styleProperties(code, id).color;

// The text colour after the fill and border, before the rest.
const placeText = (
  properties: Property[],
  key: string,
  value: string | undefined,
  leading: Set<string>
): Property[] => {
  const others = properties.filter(([other]) => other !== key);
  if (value === undefined) return others;
  return [
    ...others.filter(([other]) => leading.has(other)),
    [key, value],
    ...others.filter(([other]) => !leading.has(other))
  ];
};

/** The code with the object's text colour set, or removed when `color` is undefined. */
export const setTextColor = (
  code: string,
  id: string,
  color: string | undefined,
  syntax: ColorSyntax
): string => {
  if (color !== undefined && !hexPattern.test(color)) return code;
  return syntax === 'c4'
    ? updateC4(code, id, (settings) =>
        placeText(settings, 'fontColor', color, new Set(['bgColor', 'borderColor']))
      )
    : updateStyle(
        code,
        id,
        (properties) => placeText(properties, 'color', color, new Set(['fill', 'stroke'])),
        syntax
      );
};

/** The code with the object's bold, size and text colour removed; its fill and border stay. */
export const resetTextStyle = (code: string, id: string, syntax: ColorSyntax): string =>
  setTextColor(
    setTextStyle(code, id, { bold: false, size: 'normal' }, syntax),
    id,
    undefined,
    syntax
  );

/**
 * The object behind a clicked SVG element, from its id: mermaid ids elements
 * `<svg id>-<id>` (requirement, block, C4) or `<svg id>-<kind>-<id>-<n>`
 * (flowchart, state, class, ER).
 */
export const pickedObject = (domId: string, svgId: string, ids: string[]): string | undefined => {
  if (!domId.startsWith(`${svgId}-`)) return undefined;
  const rest = domId.slice(svgId.length + 1);
  const candidate = ids.includes(rest)
    ? rest
    : /^(?:flowchart|state|classId|entity)-(.+)-\d+$/.exec(rest)?.[1];
  return candidate !== undefined && ids.includes(candidate) ? candidate : undefined;
};

// `linkStyle 1 …` or `linkStyle 0,2 …`; `linkStyle default` is left alone.
const linkStylePattern = /^(\s*)linkStyle\s+(\d+(?:\s*,\s*\d+)*)\s+(.*?)\s*;?\s*$/;

const parseLinkStyle = (line: string) => {
  const match = linkStylePattern.exec(line);
  if (!match) return undefined;
  return {
    indent: match[1],
    indices: match[2].split(',').map((value) => Number(value.trim())),
    properties: readStyle(match[3])
  };
};

const linkStyleLine = (indent: string, indices: number[], properties: [string, string][]) =>
  `${indent}linkStyle ${indices.join(',')} ${properties.map((pair) => pair.join(':')).join(',')}`;

/** The stroke colour a linkStyle statement gives the edge, if any. */
export const getEdgeColor = (code: string, index: number): string | undefined => {
  for (const line of splitLines(code).lines) {
    const parsed = parseLinkStyle(line);
    const stroke = parsed?.properties.find(([key]) => key === 'stroke')?.[1];
    if (parsed?.indices.includes(index) && stroke) return stroke;
  }
  return undefined;
};

/** The code with the edge's colour set, or removed when `color` is undefined. */
export const setEdgeColor = (code: string, index: number, color: string | undefined): string => {
  if (color !== undefined && !hexPattern.test(color)) return code;
  const { eol, lines } = splitLines(code);
  const at = lines.findIndex((line) => parseLinkStyle(line)?.indices.includes(index));
  const parsed = at === -1 ? undefined : parseLinkStyle(lines[at]);
  const others = (parsed?.properties ?? []).filter(([key]) => key !== 'stroke');
  const next: [string, string][] = color === undefined ? others : [['stroke', color], ...others];
  const own = next.length > 0 ? linkStyleLine(parsed?.indent ?? '  ', [index], next) : undefined;
  if (!parsed) {
    if (!own) return code;
    const last = lines.findLastIndex((line) => line.trim());
    lines.splice(last + 1, 0, own);
  } else if (parsed.indices.length === 1) {
    lines.splice(at, 1, ...(own ? [own] : []));
  } else {
    // Shared with other edges: they keep the statement, this edge gets its own.
    const rest = parsed.indices.filter((value) => value !== index);
    lines.splice(
      at,
      1,
      linkStyleLine(parsed.indent, rest, parsed.properties),
      ...(own ? [own] : [])
    );
  }
  return lines.join(eol);
};

/**
 * The edge behind a clicked SVG element: a path carries the edge id in
 * `data-id`, a label is `edge-label-<start>-<end>-<id>`.
 */
export const pickedEdge = (
  element: { dataId: string | null; id: string },
  ids: string[]
): number | undefined => {
  const index = ids.findIndex(
    (id) =>
      element.dataId === id ||
      (element.id.startsWith('edge-label-') && element.id.endsWith(`-${id}`))
  );
  return index === -1 ? undefined : index;
};

/**
 * A deployment's own palette (`MERMAID_COLOR_PRESETS`: border colours as
 * `#rrggbb`, separated by commas or spaces), each with a light fill to match.
 * Undefined when the setting names no colour, so the built-in swatches apply.
 */
export const parsePresets = (value: string): Swatch[] | undefined => {
  const colors = value
    .split(/[\s,]+/)
    .map((color) => color.trim().toLowerCase())
    .filter((color) => hexPattern.test(color));
  return colors.length > 0 ? colors.map((stroke) => ({ fill: tint(stroke), stroke })) : undefined;
};

/** The colours picked freely, latest first, without repeats, at most eight. */
export const addRecent = (recent: string[], color: string): string[] => {
  const value = color.toLowerCase();
  if (!hexPattern.test(value)) return recent;
  return [value, ...recent.filter((other) => other.toLowerCase() !== value)].slice(0, 8);
};
