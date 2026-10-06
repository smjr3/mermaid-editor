/**
 * Local: named diagram themes (テーマ) for the Colours card (ColorControls.svelte)
 * and the command palette.
 *
 * Each preset is plain mermaid config: `theme: "base"` plus `themeVariables` and a
 * `themeCSS` for what the variables cannot do (glow, rounded corners, line weight).
 * mermaid's `base` theme is the only one that takes variables, and since the editor
 * does not manage it (see `isManagedTheme`), a preset is the user's choice: dark/light
 * mode switching leaves it alone. "Standard" is the absence of a preset: the theme,
 * its variables and its CSS are dropped and the editor manages the theme again.
 *
 * The preset's id travels in the CSS, as a leading comment, so it survives a shared
 * link and a hand-edited line colour (`presetOf`). The CSS never contains `<` or `>`:
 * the editor's config sanitiser treats those as unsafe (sanitize.ts).
 */
import type { MessageKey } from '$/i18n/messages';

export const themePresetIds = [
  'standard',
  'modern',
  'neon',
  'cyber',
  'pastel',
  'mono',
  'business',
  'sunset',
  'forest',
  'glass',
  'wa',
  'contrast'
] as const;
export type ThemePresetId = (typeof themePresetIds)[number];

type Config = Record<string, unknown>;
type Variables = Record<string, unknown>;

export interface ThemePreset {
  id: ThemePresetId;
  name: MessageKey;
  description: MessageKey;
  /** Five colours for the picker's preview: background, fills, accent, lines, text. */
  swatches: [string, string, string, string, string];
  /** The diagram's background, painted behind it in the view and the exports. */
  background?: string;
  /** Whether the preset is a dark design (light text on a dark background). */
  dark?: boolean;
  themeVariables?: Variables;
  themeCSS?: string;
}

/** What a preset is made of; `variablesOf` turns it into mermaid's theme variables. */
interface Palette {
  dark: boolean;
  background: string;
  /** Node fill, its border and its text. */
  node: string;
  border: string;
  text: string;
  /** Second and third fills (notes, clusters, alternate rows) and their borders. */
  second: string;
  secondBorder: string;
  third: string;
  thirdBorder: string;
  /** Arrows and connectors. */
  line: string;
  /** Behind edge labels; must be opaque so the label reads over the line. */
  labelBackground: string;
  /** Light or dark fills for sections (mindmap, timeline, journey, kanban), with their text. */
  fills: string[];
  fillText: string;
  /** Stronger colours for series (pie, git, charts), with the text drawn on them. */
  series: string[];
  seriesText: string;
  /** Gantt: critical tasks, done tasks and the today line. */
  critical: string;
  criticalBorder: string;
  done: string;
  font: string;
  fontSize: string;
}

const sans =
  '"Inter", "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, system-ui, sans-serif';
const mono =
  '"JetBrains Mono", "Cascadia Code", Consolas, "BIZ UDGothic", "Noto Sans Mono CJK JP", monospace';
const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "BIZ UDMincho", serif';

/** mermaid's theme variables for a palette: every diagram type's colours, set explicitly. */
const variablesOf = (p: Palette): Variables => {
  const scale: Variables = {};
  for (let index = 0; index < 12; index++) {
    scale[`cScale${index}`] = p.fills[index % p.fills.length];
    scale[`cScalePeer${index}`] = p.border;
    scale[`cScaleLabel${index}`] = p.fillText;
    scale[`cScaleInv${index}`] = p.fillText;
  }
  const series: Variables = {};
  for (let index = 0; index < 12; index++) {
    series[`pie${index + 1}`] = p.series[index % p.series.length];
  }
  for (let index = 0; index < 8; index++) {
    series[`git${index}`] = p.series[index % p.series.length];
    series[`gitInv${index}`] = p.seriesText;
    series[`gitBranchLabel${index}`] = p.seriesText;
    series[`fillType${index}`] = p.fills[index % p.fills.length];
  }
  return {
    activationBkgColor: p.second,
    activationBorderColor: p.secondBorder,
    activeTaskBkgColor: p.second,
    activeTaskBorderColor: p.secondBorder,
    actorBkg: p.node,
    actorBorder: p.border,
    actorLineColor: p.line,
    actorTextColor: p.text,
    altBackground: p.third,
    altSectionBkgColor: p.background,
    archEdgeArrowColor: p.line,
    archEdgeColor: p.line,
    archGroupBorderColor: p.thirdBorder,
    arrowheadColor: p.line,
    attributeBackgroundColorEven: p.third,
    attributeBackgroundColorOdd: p.node,
    background: p.background,
    border2: p.thirdBorder,
    branchLabelColor: p.seriesText,
    classText: p.text,
    clusterBkg: p.third,
    clusterBorder: p.thirdBorder,
    commitLabelBackground: p.labelBackground,
    commitLabelColor: p.text,
    compositeBackground: p.third,
    compositeBorder: p.thirdBorder,
    compositeTitleBackground: p.node,
    critBkgColor: p.critical,
    critBorderColor: p.criticalBorder,
    darkMode: p.dark,
    defaultLinkColor: p.line,
    doneTaskBkgColor: p.done,
    doneTaskBorderColor: p.border,
    dropShadow: 'none',
    edgeLabelBackground: p.labelBackground,
    errorBkgColor: p.second,
    errorTextColor: p.text,
    excludeBkgColor: p.third,
    flowContainerStroke: p.thirdBorder,
    fontFamily: p.font,
    fontSize: p.fontSize,
    gridColor: p.thirdBorder,
    innerEndBackground: p.border,
    labelBackgroundColor: p.labelBackground,
    labelBoxBkgColor: p.second,
    labelBoxBorderColor: p.secondBorder,
    labelColor: p.text,
    labelTextColor: p.text,
    lineColor: p.line,
    loopTextColor: p.text,
    mainBkg: p.node,
    nodeBkg: p.node,
    nodeBorder: p.border,
    nodeTextColor: p.text,
    noteBkgColor: p.second,
    noteBorderColor: p.secondBorder,
    noteTextColor: p.text,
    personBkg: p.node,
    personBorder: p.border,
    pieLegendTextColor: p.text,
    pieOuterStrokeColor: p.border,
    pieSectionTextColor: p.seriesText,
    pieStrokeColor: p.background,
    pieTitleTextColor: p.text,
    primaryBorderColor: p.border,
    primaryColor: p.node,
    primaryTextColor: p.text,
    quadrant1Fill: p.fills[0],
    quadrant1TextFill: p.fillText,
    quadrant2Fill: p.fills[1],
    quadrant2TextFill: p.fillText,
    quadrant3Fill: p.fills[2],
    quadrant3TextFill: p.fillText,
    quadrant4Fill: p.fills[3],
    quadrant4TextFill: p.fillText,
    quadrantExternalBorderStrokeFill: p.border,
    quadrantInternalBorderStrokeFill: p.thirdBorder,
    quadrantPointFill: p.series[0],
    quadrantPointTextFill: p.text,
    quadrantTitleFill: p.text,
    quadrantXAxisTextFill: p.text,
    quadrantYAxisTextFill: p.text,
    rectBkgColor: p.third,
    relationColor: p.line,
    relationLabelBackground: p.labelBackground,
    relationLabelColor: p.text,
    requirementBackground: p.node,
    requirementBorderColor: p.border,
    requirementTextColor: p.text,
    rowEven: p.third,
    rowOdd: p.node,
    scaleLabelColor: p.fillText,
    secondaryBorderColor: p.secondBorder,
    secondaryColor: p.second,
    secondaryTextColor: p.text,
    sectionBkgColor: p.third,
    sectionBkgColor2: p.node,
    sequenceNumberColor: p.background,
    signalColor: p.line,
    signalTextColor: p.text,
    specialStateColor: p.line,
    stateBkg: p.node,
    stateLabelColor: p.text,
    tagLabelBackground: p.second,
    tagLabelBorder: p.secondBorder,
    tagLabelColor: p.text,
    taskBkgColor: p.node,
    taskBorderColor: p.border,
    taskTextClickableColor: p.text,
    taskTextColor: p.text,
    taskTextDarkColor: p.text,
    taskTextLightColor: p.text,
    taskTextOutsideColor: p.text,
    tertiaryBorderColor: p.thirdBorder,
    tertiaryColor: p.third,
    tertiaryTextColor: p.text,
    textColor: p.text,
    titleColor: p.text,
    todayLineColor: p.criticalBorder,
    transitionColor: p.line,
    transitionLabelColor: p.text,
    useGradient: false,
    xyChart: {
      backgroundColor: p.background,
      dataLabelColor: p.text,
      legendTextColor: p.text,
      plotColorPalette: p.series.join(', '),
      titleColor: p.text,
      xAxisLabelColor: p.text,
      xAxisLineColor: p.line,
      xAxisTickColor: p.line,
      xAxisTitleColor: p.text,
      yAxisLabelColor: p.text,
      yAxisLineColor: p.line,
      yAxisTickColor: p.line,
      yAxisTitleColor: p.text
    },
    ...scale,
    ...series
  };
};

// Selectors shared by the CSS below. mermaid prefixes every rule with the diagram's id.
const shapes = '.node rect, .node polygon, .node circle, .node ellipse, .node path';
const edges =
  '.flowchart-link, .edgePath path, path.relation, .transition, .messageLine0, .messageLine1, .relationshipLine';
const marker = (id: ThemePresetId) => `/* theme-preset: ${id} */\n`;

const palettes: Record<Exclude<ThemePresetId, 'standard'>, Palette> = {
  business: {
    background: '#ffffff',
    border: '#1f4e9a',
    critical: '#f8d7d3',
    criticalBorder: '#b42318',
    dark: false,
    done: '#e3e8ef',
    fillText: '#14213d',
    fills: ['#d6e4f5', '#e3e8ef', '#cfe0f3', '#dfe9f3', '#e6edf7', '#d9e2ec', '#c9daf0', '#eef2f7'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#ffffff',
    line: '#3c4a5e',
    node: '#e8f0fb',
    second: '#f1f3f6',
    secondBorder: '#6b7a90',
    series: [
      '#1f4e9a',
      '#2e75b6',
      '#44546a',
      '#3a7d7c',
      '#7a5195',
      '#b0563c',
      '#5b6f8a',
      '#2f6f4f'
    ],
    seriesText: '#ffffff',
    text: '#14213d',
    third: '#f5f8fc',
    thirdBorder: '#9fb3d1'
  },
  contrast: {
    background: '#ffffff',
    border: '#000000',
    critical: '#ffd0d0',
    criticalBorder: '#000000',
    dark: false,
    done: '#d9d9d9',
    fillText: '#000000',
    fills: ['#ffe14d', '#9fd8ff', '#a8f0a0', '#ffc2d1', '#ffffff', '#e0e0e0', '#ffb84d', '#e3c4f5'],
    font: sans,
    fontSize: '20px',
    labelBackground: '#ffffff',
    line: '#000000',
    node: '#ffffff',
    second: '#fff7b3',
    secondBorder: '#000000',
    series: [
      '#ffe14d',
      '#9fd8ff',
      '#a8f0a0',
      '#ffc2d1',
      '#ffffff',
      '#e0e0e0',
      '#ffb84d',
      '#e3c4f5'
    ],
    seriesText: '#000000',
    text: '#000000',
    third: '#f2f2f2',
    thirdBorder: '#000000'
  },
  cyber: {
    background: '#0a1022',
    border: '#3d8bff',
    critical: '#3a1424',
    criticalBorder: '#ff5c8a',
    dark: true,
    done: '#1b2540',
    fillText: '#e6eeff',
    fills: ['#13284f', '#3a2410', '#0f3340', '#3a1830', '#1d3a1a', '#2b1f4a', '#3a3210', '#0f3a33'],
    font: mono,
    fontSize: '15px',
    labelBackground: '#0f1a33',
    line: '#ff9f1c',
    node: '#0f1a33',
    second: '#1a1530',
    secondBorder: '#ff9f1c',
    series: [
      '#3d8bff',
      '#ff9f1c',
      '#00d1ff',
      '#ff5c8a',
      '#7cff6b',
      '#b18cff',
      '#ffd23f',
      '#4de8c2'
    ],
    seriesText: '#06101f',
    text: '#dbe7ff',
    third: '#0c1630',
    thirdBorder: '#2a5bb5'
  },
  forest: {
    background: '#fbfaf5',
    border: '#4f7a3a',
    critical: '#f2d6c9',
    criticalBorder: '#9c3d1f',
    dark: false,
    done: '#e2e0d6',
    fillText: '#1f2d1a',
    fills: ['#cfe3c3', '#e9dcc0', '#d8e8d0', '#e2d3b8', '#c8dcc8', '#efe2c4', '#d5e0c0', '#ddd0bb'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#fbfaf5',
    line: '#5c4a32',
    node: '#e3efdc',
    second: '#efe6d2',
    secondBorder: '#9a7b4f',
    series: [
      '#9cc08a',
      '#d1b68a',
      '#b8d4a3',
      '#c9a874',
      '#8fb8a6',
      '#e0cc94',
      '#b4c48a',
      '#c2ad93'
    ],
    seriesText: '#1f2d1a',
    text: '#1f2d1a',
    third: '#f2f5ec',
    thirdBorder: '#8aa67a'
  },
  glass: {
    background: '#0f172a',
    border: 'rgba(226, 232, 240, 0.55)',
    critical: 'rgba(248, 113, 113, 0.28)',
    criticalBorder: '#f87171',
    dark: true,
    done: 'rgba(148, 163, 184, 0.12)',
    fillText: '#f1f5f9',
    fills: [
      'rgba(96, 165, 250, 0.28)',
      'rgba(167, 139, 250, 0.28)',
      'rgba(52, 211, 153, 0.26)',
      'rgba(244, 114, 182, 0.26)',
      'rgba(251, 191, 36, 0.24)',
      'rgba(34, 211, 238, 0.26)',
      'rgba(248, 113, 113, 0.26)',
      'rgba(163, 230, 53, 0.24)'
    ],
    font: sans,
    fontSize: '16px',
    labelBackground: '#1e293b',
    line: '#94a3b8',
    node: 'rgba(148, 163, 184, 0.16)',
    second: 'rgba(99, 102, 241, 0.2)',
    secondBorder: 'rgba(165, 180, 252, 0.6)',
    series: [
      '#60a5fa',
      '#a78bfa',
      '#34d399',
      '#f472b6',
      '#fbbf24',
      '#22d3ee',
      '#f87171',
      '#a3e635'
    ],
    seriesText: '#0f172a',
    text: '#e2e8f0',
    third: 'rgba(255, 255, 255, 0.05)',
    thirdBorder: 'rgba(226, 232, 240, 0.25)'
  },
  modern: {
    background: '#ffffff',
    border: '#94a3b8',
    critical: '#ffe4e6',
    criticalBorder: '#e11d48',
    dark: false,
    done: '#e2e8f0',
    fillText: '#0f172a',
    fills: ['#c7d2fe', '#cbd5e1', '#bae6fd', '#ddd6fe', '#99f6e4', '#fde68a', '#fecdd3', '#a7f3d0'],
    font: sans,
    fontSize: '15px',
    labelBackground: '#ffffff',
    line: '#64748b',
    node: '#eef2ff',
    second: '#f1f5f9',
    secondBorder: '#a5b4fc',
    series: [
      '#818cf8',
      '#94a3b8',
      '#38bdf8',
      '#a78bfa',
      '#2dd4bf',
      '#fbbf24',
      '#fb7185',
      '#34d399'
    ],
    seriesText: '#0f172a',
    text: '#1e293b',
    third: '#f8fafc',
    thirdBorder: '#cbd5e1'
  },
  mono: {
    background: '#ffffff',
    border: '#111111',
    critical: '#bfbfbf',
    criticalBorder: '#111111',
    dark: false,
    done: '#e6e6e6',
    fillText: '#111111',
    fills: ['#f2f2f2', '#d9d9d9', '#e6e6e6', '#cccccc', '#fafafa', '#bfbfbf', '#ededed', '#d4d4d4'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#ffffff',
    line: '#111111',
    node: '#f2f2f2',
    second: '#e6e6e6',
    secondBorder: '#555555',
    series: [
      '#f2f2f2',
      '#bfbfbf',
      '#d9d9d9',
      '#a6a6a6',
      '#e6e6e6',
      '#cccccc',
      '#b3b3b3',
      '#8c8c8c'
    ],
    seriesText: '#111111',
    text: '#111111',
    third: '#fafafa',
    thirdBorder: '#555555'
  },
  neon: {
    background: '#07070d',
    border: '#00e5ff',
    critical: '#2a0a24',
    criticalBorder: '#ff2bd6',
    dark: true,
    done: '#16161f',
    fillText: '#f2fbff',
    fills: ['#062a33', '#330a2c', '#1f3300', '#332e00', '#331800', '#1f0f33', '#330f1c', '#00331f'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#12121c',
    line: '#ff2bd6',
    node: '#0d0f1a',
    second: '#160a1f',
    secondBorder: '#ff2bd6',
    series: [
      '#00e5ff',
      '#ff2bd6',
      '#a6ff00',
      '#ffe600',
      '#ff7a00',
      '#9d4dff',
      '#ff4d8d',
      '#00ffa3'
    ],
    seriesText: '#05050a',
    text: '#e6faff',
    third: '#0a120c',
    thirdBorder: '#a6ff00'
  },
  pastel: {
    background: '#fffdfa',
    border: '#8fc9ae',
    critical: '#ffd6dc',
    criticalBorder: '#e07a8a',
    dark: false,
    done: '#ececf1',
    fillText: '#3d3d4e',
    fills: ['#d8f3e8', '#ffe3d3', '#ece4ff', '#d6eaff', '#fff1c2', '#ffdbe8', '#e0f2cf', '#efe3d8'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#ffffff',
    line: '#a0a4ad',
    node: '#d8f3e8',
    second: '#ffe3d3',
    secondBorder: '#efb093',
    series: [
      '#a8e0c8',
      '#ffc9ae',
      '#d2c4ff',
      '#b8dbff',
      '#ffe597',
      '#ffc2d8',
      '#c9e8ad',
      '#e3cfbd'
    ],
    seriesText: '#3d3d4e',
    text: '#3d3d4e',
    third: '#f5f0ff',
    thirdBorder: '#c3b3ef'
  },
  sunset: {
    background: '#fff8f0',
    border: '#e8604c',
    critical: '#f6d0dc',
    criticalBorder: '#a3245a',
    dark: false,
    done: '#efe3dc',
    fillText: '#4a1f2e',
    fills: ['#ffd9cc', '#ffe8b8', '#f6d4e6', '#ffe0d1', '#fde3c0', '#ecd5ea', '#ffd1c4', '#f9e6c4'],
    font: sans,
    fontSize: '16px',
    labelBackground: '#fff8f0',
    line: '#9b4a6b',
    node: '#ffe1d6',
    second: '#ffefc7',
    secondBorder: '#e3a21a',
    series: [
      '#ff9a7a',
      '#ffc46b',
      '#f2846b',
      '#e07aa5',
      '#c08bc0',
      '#ffd98a',
      '#f7a6a0',
      '#d4a5b0'
    ],
    seriesText: '#3a1424',
    text: '#4a1f2e',
    third: '#f8e6ee',
    thirdBorder: '#b0709a'
  },
  wa: {
    background: '#f8f4e6',
    border: '#165e83',
    critical: '#f6d5c0',
    criticalBorder: '#c53d13',
    dark: false,
    done: '#e6e1d1',
    fillText: '#2b2b2b',
    fills: ['#dbe7ee', '#fbe3d1', '#e3eed8', '#fbefc8', '#e8e3f1', '#f6dde3', '#e6e3d0', '#eae5d8'],
    font: serif,
    fontSize: '16px',
    labelBackground: '#f8f4e6',
    line: '#595857',
    node: '#fdfbf3',
    second: '#fbe7d6',
    secondBorder: '#eb6101',
    series: [
      '#8fb8cf',
      '#f4a46b',
      '#9fd3b2',
      '#f9cf6a',
      '#c5bde0',
      '#ec8fa3',
      '#c4bf7a',
      '#a9b7b8'
    ],
    seriesText: '#2b2b2b',
    text: '#2b2b2b',
    third: '#efe9d6',
    thirdBorder: '#b8a98a'
  }
};

const css: Record<Exclude<ThemePresetId, 'standard'>, string> = {
  business: `.node rect, .node polygon { stroke-width: 1.5px !important; }
.titleText, .flowchartTitleText, .cluster-label .nodeLabel { font-weight: 700; }`,
  contrast: `${shapes} { stroke-width: 3px !important; }
${edges} { stroke-width: 3px !important; }
.cluster rect { stroke-width: 3px !important; }`,
  cyber: `${shapes} { filter: drop-shadow(0 0 2px rgba(61, 139, 255, 0.85)) !important; }
${edges} { filter: drop-shadow(0 0 2px rgba(255, 159, 28, 0.7)); }
.cluster rect { stroke-dasharray: 6 3; }`,
  forest: `.node rect { rx: 6px; ry: 6px; }`,
  glass: `.node rect, .cluster rect { rx: 10px; ry: 10px; }
${shapes} { filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35)) !important; }`,
  modern: `.node rect, .cluster rect { rx: 10px; ry: 10px; }
${shapes} { stroke-width: 1px !important; filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.12)) !important; }`,
  mono: `${shapes} { filter: none !important; }`,
  neon: `${shapes} { stroke-width: 2px !important; filter: drop-shadow(0 0 4px #00e5ff) drop-shadow(0 0 8px rgba(0, 229, 255, 0.45)) !important; }
${edges} { filter: drop-shadow(0 0 3px #ff2bd6); }
.cluster rect { filter: drop-shadow(0 0 4px rgba(166, 255, 0, 0.6)); }
.nodeLabel, .label text { text-shadow: 0 0 6px rgba(0, 229, 255, 0.55); }`,
  pastel: `.node rect, .cluster rect { rx: 12px; ry: 12px; }`,
  sunset: `.node rect { rx: 8px; ry: 8px; }`,
  wa: `.cluster rect { stroke-dasharray: 2 3; }`
};

/**
 * CSS every preset needs. ER and flowchart edge labels draw a half-transparent box of
 * a derived colour; C4 draws boundaries, relationships and their text in a fixed #444444
 * (presentation attributes, which CSS overrides), unreadable on a dark background.
 */
const common = (
  palette: Palette
) => `.labelBkg { background-color: ${palette.labelBackground} !important; }
line[stroke="#444444"], path[stroke="#444444"] { stroke: ${palette.line}; }
rect[stroke="#444444"] { stroke: ${palette.thirdBorder}; }
text[fill="#444444"] { fill: ${palette.text}; }`;

const preset = (
  id: Exclude<ThemePresetId, 'standard'>,
  swatches: ThemePreset['swatches'],
  extra: Variables = {}
): ThemePreset => {
  const palette = palettes[id];
  return {
    background: palette.background,
    dark: palette.dark,
    description: `themePreset.${id}.description`,
    id,
    name: `themePreset.${id}`,
    swatches,
    themeCSS: `${marker(id)}${css[id]}\n${common(palette)}`,
    themeVariables: { ...variablesOf(palette), ...extra }
  };
};

export const themePresets: ThemePreset[] = [
  {
    description: 'themePreset.standard.description',
    id: 'standard',
    name: 'themePreset.standard',
    swatches: ['#ffffff', '#ececff', '#9370db', '#333333', '#1f2329']
  },
  preset('modern', ['#ffffff', '#eef2ff', '#818cf8', '#64748b', '#1e293b'], { radius: 10 }),
  preset('neon', ['#07070d', '#00e5ff', '#ff2bd6', '#a6ff00', '#e6faff'], { strokeWidth: 2 }),
  preset('cyber', ['#0a1022', '#0f1a33', '#3d8bff', '#ff9f1c', '#dbe7ff']),
  preset('pastel', ['#fffdfa', '#d8f3e8', '#ffe3d3', '#ece4ff', '#a0a4ad']),
  preset('mono', ['#ffffff', '#f2f2f2', '#bfbfbf', '#555555', '#111111']),
  preset('business', ['#ffffff', '#e8f0fb', '#1f4e9a', '#3c4a5e', '#14213d'], {
    strokeWidth: 1.5
  }),
  preset('sunset', ['#fff8f0', '#ffe1d6', '#e8604c', '#e3a21a', '#9b4a6b'], {
    gradientStart: '#ff7a59',
    gradientStop: '#8e3b7a',
    useGradient: true
  }),
  preset('forest', ['#fbfaf5', '#e3efdc', '#4f7a3a', '#9a7b4f', '#5c4a32']),
  preset('glass', ['#0f172a', '#334155', '#a5b4fc', '#94a3b8', '#e2e8f0']),
  preset('wa', ['#f8f4e6', '#165e83', '#eb6101', '#595857', '#2b2b2b']),
  preset('contrast', ['#ffffff', '#ffe14d', '#9fd8ff', '#000000', '#000000'], {
    strokeWidth: 3
  })
];

const byId = new Map<string, ThemePreset>(themePresets.map((entry) => [entry.id, entry]));

export const isThemePresetId = (value: unknown): value is ThemePresetId =>
  typeof value === 'string' && byId.has(value);

export const getThemePreset = (id: ThemePresetId): ThemePreset => byId.get(id) ?? themePresets[0];

const parse = (config: string | Config): Config | undefined => {
  if (typeof config !== 'string') return config;
  try {
    const value: unknown = JSON.parse(config);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Config)
      : undefined;
  } catch {
    return undefined;
  }
};

const markerPattern = /^\/\* theme-preset: ([a-z-]+) \*\//;

/** The preset a config uses: its `base` theme and the id in its CSS; otherwise "standard". */
export const presetOf = (config: string | Config): ThemePresetId => {
  const parsed = parse(config);
  if (parsed?.theme !== 'base' || typeof parsed.themeCSS !== 'string') return 'standard';
  const id = markerPattern.exec(parsed.themeCSS)?.[1];
  return id && id !== 'standard' && isThemePresetId(id) ? id : 'standard';
};

/** The background a config's preset paints behind the diagram, if it uses one. */
export const presetBackground = (config: string | Config): string | undefined =>
  getThemePreset(presetOf(config)).background;

/**
 * The config with a preset applied. The previous preset's (or the user's) theme,
 * variables and CSS are replaced as a whole, every other key is kept. "Standard"
 * drops all three, so the editor manages the theme again.
 */
export const applyThemePreset = (config: string, id: ThemePresetId): string => {
  const parsed = parse(config);
  if (!parsed) return config;
  const rest = { ...parsed };
  delete rest.theme;
  delete rest.themeVariables;
  delete rest.themeCSS;
  const chosen = getThemePreset(id);
  const next =
    chosen.themeVariables && chosen.themeCSS
      ? {
          ...rest,
          theme: 'base',
          themeCSS: chosen.themeCSS,
          themeVariables: structuredClone(chosen.themeVariables)
        }
      : rest;
  return JSON.stringify(next, undefined, 2);
};
