/**
 * Local: the small drawings on the 新規 dialog's cards (NewDiagramDialog.svelte): one per
 * kind of diagram, drawn with the app's own colours so they follow the light and dark
 * chrome. A drawing only hints at the shape of the diagram; the サンプル tab's detail
 * pane shows the real rendering (templateThumbnails.ts).
 */
import type { StarterId } from './newDiagram';

export type ThumbKind =
  | 'arch'
  | 'blank'
  | 'er'
  | 'flow'
  | 'gantt'
  | 'kanban'
  | 'mind'
  | 'org'
  | 'pie'
  | 'quad'
  | 'seq'
  | 'swim'
  | 'timeline';

const a = 'var(--accent)';
const f = 'var(--muted-foreground)';
const sf = 'var(--card)';

const drawings: Record<ThumbKind, string> = {
  arch: `<rect x="14" y="10" width="92" height="52" rx="6" fill="none" stroke="${f}" stroke-dasharray="4 3"/><rect x="24" y="26" width="18" height="18" rx="4" fill="${a}"/><rect x="51" y="26" width="18" height="18" rx="4" fill="${a}" opacity=".7"/><rect x="78" y="26" width="18" height="18" rx="4" fill="${a}" opacity=".45"/>`,
  blank: `<rect x="34" y="16" width="52" height="40" rx="4" fill="none" stroke="${f}" stroke-dasharray="4 3"/><path d="M60 28v16M52 36h16" stroke="${f}" stroke-width="2"/>`,
  er: `<rect x="12" y="14" width="36" height="44" rx="3" fill="${sf}" stroke="${a}"/><rect x="12" y="14" width="36" height="10" rx="3" fill="${a}"/><rect x="72" y="14" width="36" height="44" rx="3" fill="${sf}" stroke="${a}"/><rect x="72" y="14" width="36" height="10" rx="3" fill="${a}"/><path d="M48 36h24" stroke="${f}"/>`,
  flow: `<rect x="44" y="6" width="32" height="12" rx="6" fill="${sf}" stroke="${a}"/><rect x="44" y="30" width="32" height="12" rx="2" fill="${sf}" stroke="${a}"/><rect x="44" y="54" width="32" height="12" rx="6" fill="${sf}" stroke="${a}"/><path d="M60 18v12M60 42v12" stroke="${f}"/>`,
  gantt: `<rect x="14" y="12" width="40" height="8" rx="2" fill="${a}"/><rect x="38" y="26" width="46" height="8" rx="2" fill="${a}" opacity=".75"/><rect x="60" y="40" width="34" height="8" rx="2" fill="${a}" opacity=".55"/><polygon points="100,52 106,58 100,64 94,58" fill="${a}"/>`,
  kanban: `<rect x="12" y="8" width="30" height="56" rx="3" fill="none" stroke="${f}"/><rect x="45" y="8" width="30" height="56" rx="3" fill="none" stroke="${f}"/><rect x="78" y="8" width="30" height="56" rx="3" fill="none" stroke="${f}"/><rect x="16" y="14" width="22" height="9" rx="2" fill="${a}"/><rect x="16" y="27" width="22" height="9" rx="2" fill="${a}" opacity=".6"/><rect x="49" y="14" width="22" height="9" rx="2" fill="${a}" opacity=".8"/><rect x="82" y="14" width="22" height="9" rx="2" fill="${a}" opacity=".4"/>`,
  mind: `<circle cx="60" cy="36" r="10" fill="${a}"/><path d="M50 32L26 16M50 40L26 56M70 32l24-16M70 40l24 16" stroke="${f}"/><rect x="10" y="10" width="20" height="9" rx="4" fill="${a}" opacity=".5"/><rect x="10" y="52" width="20" height="9" rx="4" fill="${a}" opacity=".5"/><rect x="90" y="10" width="20" height="9" rx="4" fill="${a}" opacity=".5"/><rect x="90" y="52" width="20" height="9" rx="4" fill="${a}" opacity=".5"/>`,
  org: `<rect x="46" y="6" width="28" height="12" rx="2" fill="${a}"/><path d="M60 18v8M24 26h72M24 26v8M60 26v8M96 26v8" stroke="${f}" fill="none"/><rect x="10" y="34" width="28" height="12" rx="2" fill="${a}" opacity=".6"/><rect x="46" y="34" width="28" height="12" rx="2" fill="${a}" opacity=".6"/><rect x="82" y="34" width="28" height="12" rx="2" fill="${a}" opacity=".6"/>`,
  pie: `<circle cx="60" cy="36" r="26" fill="${a}" opacity=".35"/><path d="M60 36V10a26 26 0 0 1 24 36z" fill="${a}"/>`,
  quad: `<rect x="30" y="8" width="28" height="28" fill="${a}" opacity=".15"/><rect x="62" y="8" width="28" height="28" fill="${a}" opacity=".3"/><rect x="30" y="40" width="28" height="28" fill="${a}" opacity=".08"/><rect x="62" y="40" width="28" height="28" fill="${a}" opacity=".15"/><circle cx="76" cy="20" r="3" fill="${a}"/><circle cx="44" cy="52" r="3" fill="${a}"/><circle cx="70" cy="48" r="3" fill="${a}"/>`,
  seq: `<rect x="18" y="6" width="28" height="10" rx="2" fill="${a}"/><rect x="74" y="6" width="28" height="10" rx="2" fill="${a}"/><path d="M32 16v50M88 16v50" stroke="${f}" stroke-dasharray="3 2"/><path d="M32 28h52M88 42H36M32 56h52" stroke="${a}"/>`,
  swim: `<rect x="10" y="6" width="48" height="60" rx="3" fill="none" stroke="${f}"/><rect x="62" y="6" width="48" height="60" rx="3" fill="none" stroke="${f}"/><rect x="20" y="16" width="28" height="10" rx="2" fill="${a}"/><rect x="72" y="32" width="28" height="10" rx="2" fill="${a}"/><rect x="20" y="48" width="28" height="10" rx="2" fill="${a}" opacity=".6"/><path d="M48 21h10v16h14" fill="none" stroke="${f}"/>`,
  timeline: `<path d="M10 36h100" stroke="${f}" stroke-width="2"/><circle cx="24" cy="36" r="5" fill="${a}"/><circle cx="52" cy="36" r="5" fill="${a}" opacity=".8"/><circle cx="80" cy="36" r="5" fill="${a}" opacity=".6"/><rect x="14" y="14" width="22" height="8" rx="2" fill="${a}" opacity=".5"/><rect x="70" y="50" width="22" height="8" rx="2" fill="${a}" opacity=".5"/>`
};

/** An inline SVG drawing of the kind, `width` px wide (the viewBox keeps the 5:3 shape). */
export const thumbSvg = (kind: ThumbKind, width = 120): string =>
  `<svg width="${width}" height="${Math.round((width * 3) / 5)}" viewBox="0 0 120 72" fill="none" stroke-width="1.5" aria-hidden="true">${drawings[kind]}</svg>`;

/** The drawing for each "empty diagram" kind. */
export const starterThumb: Record<StarterId, ThumbKind> = {
  architecture: 'arch',
  block: 'kanban',
  c4: 'arch',
  class: 'er',
  er: 'er',
  flowchart: 'flow',
  gantt: 'gantt',
  git: 'timeline',
  journey: 'timeline',
  kanban: 'kanban',
  mindmap: 'mind',
  packet: 'kanban',
  pie: 'pie',
  quadrant: 'quad',
  sankey: 'swim',
  sequence: 'seq',
  state: 'flow',
  swimlane: 'swim',
  timeline: 'timeline',
  xychart: 'gantt',
  zenuml: 'seq'
};

const groupThumbs: Record<string, ThumbKind> = {
  Architecture: 'arch',
  Block: 'kanban',
  C4: 'arch',
  Class: 'er',
  'Entity Relationship': 'er',
  Flowchart: 'flow',
  Gantt: 'gantt',
  Git: 'timeline',
  Journey: 'timeline',
  Kanban: 'kanban',
  Mindmap: 'mind',
  Packet: 'kanban',
  Pie: 'pie',
  Quadrant: 'quad',
  Sankey: 'swim',
  Sequence: 'seq',
  State: 'flow',
  Swimlane: 'swim',
  Timeline: 'timeline',
  'XY Chart': 'gantt',
  ZenUML: 'seq'
};

/** Business templates by their form's id (templateForms.ts). */
const formThumbs: Record<string, ThumbKind> = {
  approval: 'flow',
  architecture: 'arch',
  closing: 'seq',
  expense: 'swim',
  gantt: 'gantt',
  hiring: 'timeline',
  kanban: 'kanban',
  org: 'org',
  support: 'swim'
};

/** The drawing for a sample card: by its form if it has one, else by its group. */
export const sampleThumb = (group: string, formId?: string): ThumbKind =>
  (formId ? formThumbs[formId] : undefined) ?? groupThumbs[group] ?? 'blank';
