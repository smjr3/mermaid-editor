/**
 * Local: "New diagram" in the Samples card (NewDiagram.svelte). For someone who
 * cannot write mermaid: choose a type, optionally a title and a direction, and
 * the code is replaced by a minimal valid starter — a header and one or two
 * placeholders named in Japanese (ids ASCII, as the Add, Edit and Colours
 * cards expect) — which the Add and Edit cards then grow and change.
 */
import { setTitle } from './diagramTitle';
import { setDirection, type Direction } from './layout';

export type StarterId =
  | 'flowchart'
  | 'swimlane'
  | 'architecture'
  | 'sequence'
  | 'state'
  | 'class'
  | 'er'
  | 'gantt'
  | 'mindmap'
  | 'kanban'
  | 'timeline'
  | 'pie'
  | 'c4'
  | 'block';

export interface StarterKind {
  id: StarterId;
  /** mermaid draws a title for this type (diagramTitle.ts). */
  title: boolean;
  /** The type has a direction the Layout card can set. */
  direction: boolean;
}

export const starterKinds: StarterKind[] = [
  { direction: true, id: 'flowchart', title: true },
  { direction: true, id: 'swimlane', title: true },
  { direction: false, id: 'architecture', title: false },
  { direction: false, id: 'sequence', title: true },
  { direction: true, id: 'state', title: true },
  { direction: true, id: 'class', title: true },
  { direction: true, id: 'er', title: true },
  { direction: false, id: 'gantt', title: true },
  { direction: false, id: 'mindmap', title: false },
  { direction: false, id: 'kanban', title: false },
  { direction: false, id: 'timeline', title: true },
  { direction: false, id: 'pie', title: true },
  { direction: false, id: 'c4', title: true },
  { direction: false, id: 'block', title: false }
];

const today = () => new Date().toISOString().slice(0, 10);

const bodies: Record<StarterId, (direction: Direction) => string[]> = {
  architecture: () => [
    'architecture-beta',
    '  group grp1(cloud)[システム]',
    '  service svc1(server)[サーバー] in grp1',
    '  service svc2(database)[データベース] in grp1',
    '  svc1:R --> L:svc2'
  ],
  block: () => [
    'block-beta',
    '  columns 2',
    '  blk1["ブロック1"]',
    '  blk2["ブロック2"]',
    '  blk1 --> blk2'
  ],
  c4: () => [
    'C4Context',
    '  Person(el1, "利用者")',
    '  System(el2, "システム")',
    '  Rel(el1, el2, "使う")'
  ],
  class: () => [
    'classDiagram',
    '  class c1["顧客"]',
    '  class c2["注文"]',
    '  c1 --> c2 : 注文する'
  ],
  er: () => ['erDiagram', '  e1["顧客"]', '  e2["注文"]', '  e1 ||--o{ e2 : "注文する"'],
  flowchart: (direction) => [
    `flowchart ${direction}`,
    '  n1(["開始"]) --> n2["作業"]',
    '  n2 --> n3(["終了"])'
  ],
  gantt: () => [
    'gantt',
    '  dateFormat YYYY-MM-DD',
    '  section 準備',
    `    作業1 : ${today()}, 3d`,
    '    作業2 : 2d'
  ],
  kanban: () => [
    'kanban',
    '  col1[未着手]',
    '    card1[タスク1]',
    '  col2[作業中]',
    '  col3[完了]'
  ],
  mindmap: () => ['mindmap', '  root((テーマ))', '    アイデア1', '    アイデア2'],
  pie: () => ['pie', '  "項目A" : 60', '  "項目B" : 40'],
  sequence: () => [
    'sequenceDiagram',
    '  participant p1 as 利用者',
    '  participant p2 as システム',
    '  p1->>p2: 依頼'
  ],
  state: () => [
    'stateDiagram-v2',
    '  state "待機中" as s1',
    '  state "処理中" as s2',
    '  [*] --> s1',
    '  s1 --> s2 : 開始'
  ],
  swimlane: (direction) => [
    `swimlane-beta ${direction}`,
    '  subgraph Lane1 ["担当者"]',
    '    n1["作業1"]',
    '  end',
    '  subgraph Lane2 ["承認者"]',
    '    n2["作業2"]',
    '  end',
    '  n1 --> n2'
  ],
  timeline: () => ['timeline', '  2026年 : 出来事1', '  2027年 : 出来事2']
};

/** The starter code for a type, with its title (where shown) and direction (where it has one). */
export const starter = (
  id: StarterId,
  { direction, title = '' }: { direction?: Direction; title?: string } = {}
): string => {
  const kind = starterKinds.find((candidate) => candidate.id === id);
  if (!kind) return '';
  const fallback: Direction = id === 'swimlane' ? 'LR' : 'TB';
  let code = bodies[id](direction ?? fallback).join('\n');
  // state, class and ER take a `direction` statement; only when asked for.
  if (kind.direction && direction && !/^(?:flowchart|swimlane)/.test(id)) {
    code = setDirection(code, direction);
  }
  return kind.title ? setTitle(code, title) : code;
};

const normalize = (code: string) =>
  code
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

// A starter with any title and direction, as a pattern: the date in a gantt starter differs by day.
const starterPattern = (code: string) =>
  normalize(code)
    .replace(/^---\ntitle: .*\n---\n/, '')
    .replaceAll(/\d{4}-\d{2}-\d{2}/g, '#date')
    .replace(/^(flowchart|swimlane-beta) (?:TB|LR)/, '$1')
    .replace(/\n {2}direction (?:TB|LR)/, '');

/**
 * Whether the code can be replaced without asking: it is empty, one of the
 * samples, or a starter nobody has changed yet.
 */
export const isReplaceable = (code: string, samples: string[]): boolean => {
  const text = normalize(code);
  if (!text) return true;
  if (samples.some((sample) => normalize(sample) === text)) return true;
  const shape = starterPattern(code);
  return starterKinds.some(({ id }) => starterPattern(starter(id)) === shape);
};
