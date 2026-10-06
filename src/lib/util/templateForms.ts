/**
 * Local: "Create from a template" in the Samples card (TemplateForms.svelte).
 * For someone who cannot write mermaid: each of the nine business templates in
 * localSamples.ts ("業務テンプレート") gets a form — a schema of text boxes,
 * choices and lists of rows, filled in with that template's content — and a
 * generator that turns the filled form into the diagram code. Ids are ASCII
 * and never start with R/L/T/B (an architecture or swimlane id that does is
 * read as a side), so the Add, Edit and Colours cards work on the result.
 * Text is cleaned the way diagramEdit.ts and addActions.ts clean what the
 * cards write, so whatever is typed still parses.
 */
import type { Locale } from '$/i18n/messages';
import { oneLine, sequenceText } from './addActions';
import { setTitle } from './diagramTitle';

export interface Label {
  en: string;
  ja: string;
}

export interface Option {
  label: Label;
  value: string;
}

/** One row of a list field. `_id` is stable, so another list can refer to the row. */
export type Row = Record<string, string> & { _id: string };

export interface Column {
  key: string;
  kind: 'text' | 'choice';
  label: Label;
  /** Fixed choices. */
  options?: Option[];
  /** Choose a row of this list field (the value is the row's `_id`, shown by its first column). */
  source?: string;
  /** Choices shown before the rows of `source`. */
  extra?: Option[];
  /** A text column that wants a particular form (a date, a number), as a hint. */
  pattern?: Label;
  /** Shown only for rows where this holds. */
  when?: (row: Row) => boolean;
  /** The value of this column in a new row; for a sourced choice, '' means the first row. */
  initial?: string;
}

export interface TextField {
  initial: string;
  key: string;
  kind: 'text';
  label: Label;
  pattern?: Label;
}

export interface ListField {
  columns: Column[];
  initial: Row[];
  key: string;
  kind: 'list';
  label: Label;
}

export type Field = TextField | ListField;

export type FormValues = Record<string, string | Row[]>;

export interface TemplateForm {
  description: Label;
  fields: Field[];
  id: string;
  name: Label;
  /** The sample's title in localSamples.ts. */
  sample: string;
  generate: (values: FormValues) => string;
}

export const labelOf = (label: Label, locale: Locale): string =>
  locale === 'ja' ? label.ja : label.en;

const list = (values: FormValues, key: string): Row[] => {
  const value = values[key];
  return Array.isArray(value) ? value : [];
};
const text = (values: FormValues, key: string): string => {
  const value = values[key];
  return typeof value === 'string' ? value : '';
};

let counter = 0;
/** Adds an empty row (with each column's initial value) to a list field and returns it. */
export const addRow = (values: FormValues, field: ListField): Row => {
  const rows = list(values, field.key);
  const taken = new Set(rows.map(({ _id }) => _id));
  let id;
  do id = `${field.key}-new${++counter}`;
  while (taken.has(id));
  const row: Row = { _id: id };
  for (const column of field.columns) {
    let initial = column.initial ?? column.options?.[0]?.value ?? '';
    if (column.source && !column.initial) initial = list(values, column.source)[0]?._id ?? '';
    row[column.key] = initial;
  }
  values[field.key] = [...rows, row];
  return row;
};

/** A fresh copy of a template's initial values. */
export const defaultValues = (template: TemplateForm): FormValues =>
  Object.fromEntries(
    template.fields.map((field) => [
      field.key,
      field.kind === 'list' ? field.initial.map((row) => ({ ...row })) : field.initial
    ])
  );

export const generate = (template: TemplateForm, values: FormValues): string =>
  template.generate(values);

// ---- Cleaning text the way the cards do ----

// A quoted flowchart label: a quote inside would end it, so it becomes mermaid's entity.
const quoted = (value: string) => `"${oneLine(value).replaceAll('"', '#quot;')}"`;
// `|"…"|` holds an arrow label: unquoted, a bracket inside breaks it; a pipe would end it.
const edgeLabel = (value: string) =>
  oneLine(value).replaceAll('|', '/').replaceAll('"', '#quot;').trim();
// `[…]` ends an architecture title.
const archLabel = (value: string) =>
  oneLine(value)
    .replaceAll(/[[\]]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
const noBrackets = (value: string) => oneLine(value).replaceAll(/[()[\]{}]/g, '');
const ganttText = (value: string) => oneLine(value).replaceAll(/[:#;]/g, ' ').trim();
const timelineText = (value: string) => oneLine(value).replaceAll(':', '：');
const titleText = (values: FormValues) => oneLine(text(values, 'title'));

// The rows whose column has text, in order.
const filled = (rows: Row[], key: string) => rows.filter((row) => oneLine(row[key] ?? ''));

const label = (ja: string, en: string): Label => ({ en, ja });
const option = (value: string, ja: string, en: string): Option => ({
  label: label(ja, en),
  value
});
const titleField = (initial: string): TextField => ({
  initial,
  key: 'title',
  kind: 'text',
  label: label('タイトル', 'Title')
});

// ---- Flows: the swimlane expense flow, the approval flow and the support flow ----

const stepKinds: Option[] = [
  option('step', '作業', 'Step'),
  option('decision', '分岐（はい／いいえ）', 'Decision (yes / no)'),
  option('terminal', '開始・終了', 'Start / end')
];
const nextExtra: Option[] = [
  option('', '次の行へ', 'Next row'),
  option('-', 'ここで終わり', 'End here')
];
const isDecision = (row: Row) => row.kind === 'decision';

const stepsField = (lanes: boolean, initial: Row[]): ListField => ({
  columns: [
    { key: 'text', kind: 'text', label: label('内容', 'Text') },
    ...(lanes
      ? [{ key: 'lane', kind: 'choice', label: label('レーン', 'Lane'), source: 'lanes' } as Column]
      : []),
    {
      initial: 'step',
      key: 'kind',
      kind: 'choice',
      label: label('種類', 'Kind'),
      options: stepKinds
    },
    {
      extra: nextExtra,
      initial: '',
      key: 'next',
      kind: 'choice',
      label: label('次へ（はい）', 'Then (yes)'),
      source: 'steps'
    },
    {
      initial: '',
      key: 'yes',
      kind: 'text',
      label: label('「はい」のラベル', '"Yes" label'),
      when: isDecision
    },
    {
      extra: [option('-', 'なし', 'None')],
      initial: '-',
      key: 'alt',
      kind: 'choice',
      label: label('いいえのとき', 'If no'),
      source: 'steps',
      when: isDecision
    },
    {
      initial: '',
      key: 'no',
      kind: 'text',
      label: label('「いいえ」のラベル', '"No" label'),
      when: isDecision
    }
  ],
  initial,
  key: 'steps',
  kind: 'list',
  label: label('手順', 'Steps')
});

const lanesField = (names: [string, string][]): ListField => ({
  columns: [{ key: 'name', kind: 'text', label: label('レーン名', 'Lane name') }],
  initial: names.map(([id, name]) => ({ _id: id, name })),
  key: 'lanes',
  kind: 'list',
  label: label('レーン（担当）', 'Lanes (who)')
});

// A step row: text, lane, kind, then the "yes" target and labels.
const step = (
  _id: string,
  stepText: string,
  lane = '',
  extra: Partial<Record<'kind' | 'next' | 'yes' | 'alt' | 'no', string>> = {}
): Row => ({
  _id,
  alt: '-',
  kind: 'step',
  lane,
  next: '',
  no: '',
  text: stepText,
  yes: '',
  ...extra
});

const shapes: Record<string, [string, string]> = {
  decision: ['{', '}'],
  step: ['[', ']'],
  terminal: ['([', '])']
};

const flowCode = (values: FormValues, header: string, withLanes: boolean): string => {
  const steps = filled(list(values, 'steps'), 'text');
  const ids = new Map(steps.map((row, index) => [row._id, `n${index + 1}`]));
  const node = (row: Row) => {
    const [open, close] = shapes[row.kind] ?? shapes.step;
    return `${ids.get(row._id)}${open}${quoted(row.text)}${close}`;
  };
  const lines = [header];
  if (withLanes) {
    const lanes = filled(list(values, 'lanes'), 'name');
    if (lanes.length === 0) lanes.push({ _id: '', name: '担当' });
    const laneOf = (row: Row) =>
      lanes.some(({ _id }) => _id === row.lane) ? row.lane : lanes[0]._id;
    lanes.forEach((lane, index) => {
      lines.push(`  subgraph g${index + 1} [${quoted(lane.name)}]`);
      const inside = steps.filter((row) => laneOf(row) === lane._id);
      if (index === 0 && steps.length === 0) lines.push('    n1["作業"]');
      lines.push(...inside.map((row) => `    ${node(row)}`), '  end');
    });
  } else {
    lines.push(...steps.map((row) => `  ${node(row)}`));
    if (steps.length === 0) lines.push('  n1["作業"]');
  }
  // '' is the next row, '-' nothing; a row that is gone or empty counts as ''.
  const target = (index: number, ref: string, fallback: boolean) => {
    if (ref === '-') return;
    if (ids.has(ref)) return ids.get(ref);
    return fallback ? ids.get(steps[index + 1]?._id) : undefined;
  };
  const arrow = (from: string, to: string | undefined, arrowLabel = '') => {
    if (!to) return;
    const shown = edgeLabel(arrowLabel);
    lines.push(`  ${from} ${shown ? `-->|"${shown}"|` : '-->'} ${to}`);
  };
  steps.forEach((row, index) => {
    const from = ids.get(row._id) ?? '';
    const decision = isDecision(row);
    arrow(from, target(index, row.next ?? '', true), decision ? row.yes : '');
    if (decision) arrow(from, target(index, row.alt ?? '-', false), row.no);
  });
  return setTitle(lines.join('\n'), titleText(values));
};

const expense: TemplateForm = {
  description: label(
    '申請 → 上長の承認（差戻しあり）→ 経理の処理を、担当ごとのレーンで描きます。',
    'An expense claim, its approval (with send-back) and payment, in one lane per role.'
  ),
  fields: [
    titleField('経費精算フロー'),
    lanesField([
      ['applicant', '申請者'],
      ['manager', '上長'],
      ['accounting', '経理']
    ]),
    stepsField(true, [
      step('apply', '経費精算を申請', 'applicant'),
      step('approve', '内容を承認する?', 'manager', {
        alt: 'fix',
        kind: 'decision',
        no: '差戻し',
        yes: '承認'
      }),
      step('receipts', '証憑を確認', 'accounting'),
      step('pay', '振込処理', 'accounting'),
      step('notify', '申請者へ支払通知', 'accounting', { next: '-' }),
      step('fix', '指摘箇所を修正', 'applicant', { next: 'approve' })
    ])
  ],
  generate: (values) => flowCode(values, 'swimlane-beta LR', true),
  id: 'expense',
  name: label('スイムレーン業務フロー', 'Swimlane workflow'),
  sample: 'スイムレーン業務フロー'
};

const approval: TemplateForm = {
  description: label(
    '稟議の起案から決裁まで。金額などの条件で分かれる承認ルートを描きます。',
    'A request for approval from draft to decision, branching on conditions such as the amount.'
  ),
  fields: [
    titleField('稟議・承認フロー'),
    stepsField(false, [
      step('draft', '稟議書を起案', '', { kind: 'terminal' }),
      step('check', '部門長が内容を確認'),
      step('amount', '金額は10万円以上?', '', {
        alt: 'approve1',
        kind: 'decision',
        no: 'いいえ',
        yes: 'はい'
      }),
      step('board', '役員が審議'),
      step('decide', '承認する?', '', { alt: 'fix', kind: 'decision', no: '差戻し', yes: '承認' }),
      step('approve2', '役員が決裁', '', { next: 'order' }),
      step('approve1', '部門長が決裁', '', { next: 'order' }),
      step('fix', '起案者が修正', '', { next: 'check' }),
      step('order', '発注・契約へ', '', { kind: 'terminal', next: '-' })
    ])
  ],
  generate: (values) => flowCode(values, 'flowchart TD', false),
  id: 'approval',
  name: label('稟議・承認フロー', 'Approval flow'),
  sample: '稟議・承認フロー'
};

const support: TemplateForm = {
  description: label(
    '問い合わせの受付から回答まで。顧客・サポート・開発のレーンで描きます。',
    'A customer enquiry from receipt to answer, across customer, support and development lanes.'
  ),
  fields: [
    titleField('問い合わせ対応フロー'),
    lanesField([
      ['customer', '顧客'],
      ['support', 'サポート'],
      ['dev', '開発']
    ]),
    stepsField(true, [
      step('ask', '問い合わせを送る', 'customer'),
      step('check', '内容を確認', 'support'),
      step('known', '既知の問題?', 'support', {
        alt: 'investigate',
        kind: 'decision',
        no: 'いいえ',
        yes: 'はい'
      }),
      step('answer', '回答を作成', 'support'),
      step('receive', '回答を受け取る', 'customer', { next: '-' }),
      step('investigate', '原因を調査', 'dev'),
      step('release', '修正をリリース', 'dev', { next: 'answer' })
    ])
  ],
  generate: (values) => flowCode(values, 'swimlane-beta LR', true),
  id: 'support',
  name: label('問い合わせ対応フロー', 'Support flow'),
  sample: '問い合わせ対応フロー'
};

// ---- Hiring timeline ----

const hiring: TemplateForm = {
  description: label(
    '募集から入社までの段階と時期を、時系列で並べます。',
    'The stages from advertising a post to the first day, in time order.'
  ),
  fields: [
    titleField('採用プロセス'),
    {
      columns: [
        { key: 'stage', kind: 'text', label: label('段階', 'Stage') },
        { key: 'period', kind: 'text', label: label('時期', 'When') },
        {
          key: 'events',
          kind: 'text',
          label: label('やること（/ で区切る）', 'What happens (separate with /)')
        }
      ],
      initial: [
        { _id: 'w1', events: '求人票を作成 / 採用媒体に掲載', period: '1週目', stage: '募集' },
        { _id: 'w2', events: '書類選考 / 一次面接（現場）', period: '2〜3週目', stage: '選考' },
        { _id: 'w4', events: '二次面接（役員） / 適性検査', period: '4週目', stage: '選考' },
        { _id: 'w5', events: '内定通知 / 条件面談', period: '5週目', stage: '内定' },
        { _id: 'w6', events: '入社手続き / 受け入れ準備', period: '6週目〜', stage: '内定' }
      ],
      key: 'periods',
      kind: 'list',
      label: label('時期ごとの予定', 'Periods')
    }
  ],
  generate: (values) => {
    const lines = ['timeline'];
    let section = '';
    for (const row of filled(list(values, 'periods'), 'period')) {
      const stage = timelineText(row.stage ?? '');
      if (stage && stage !== section) lines.push(`    section ${stage}`);
      if (stage) section = stage;
      const events = (row.events ?? '').split(/[/／]/).map(timelineText).filter(Boolean);
      lines.push(`        ${timelineText(row.period)} : ${events.join(' : ')}`.trimEnd());
    }
    if (lines.length === 1) lines.push('        時期 : 予定');
    return setTitle(lines.join('\n'), titleText(values));
  },
  id: 'hiring',
  name: label('採用プロセス', 'Hiring process'),
  sample: '採用プロセス'
};

// ---- System architecture ----

/** A short list of icons for the parts of an office system (all tabler, bundled). */
export const architectureIcons: Option[] = [
  option('tabler:building', '建物・拠点', 'Building / site'),
  option('tabler:cloud', 'クラウド', 'Cloud'),
  option('tabler:server-2', 'サーバー', 'Server'),
  option('tabler:database', 'データベース', 'Database'),
  option('tabler:folders', 'ファイルサーバ', 'File server'),
  option('tabler:device-desktop', 'PC', 'Desktop PC'),
  option('tabler:device-laptop', 'ノートPC', 'Laptop'),
  option('tabler:users', '利用者', 'Users'),
  option('tabler:firewall-check', 'ファイアウォール', 'Firewall'),
  option('tabler:lock', 'VPN・認証', 'VPN / sign-in'),
  option('tabler:router', 'ルーター', 'Router'),
  option('tabler:world', 'インターネット', 'Internet'),
  option('tabler:mail', 'メール', 'Mail'),
  option('tabler:cloud-upload', 'バックアップ', 'Backup')
];
const iconOf = (value: string) =>
  architectureIcons.some((icon) => icon.value === value) ? value : 'tabler:server-2';

/** Where the second service sits from the first: right, below, left or above. */
const sides: Record<string, [string, string]> = {
  down: ['B', 'T'],
  left: ['L', 'R'],
  right: ['R', 'L'],
  up: ['T', 'B']
};

const architecture: TemplateForm = {
  description: label(
    'オンプレミスとクラウドのグループに、アイコン付きのサービスと接続を描きます。',
    'Services with icons in on-premises and cloud groups, and how they connect.'
  ),
  fields: [
    {
      columns: [
        { key: 'name', kind: 'text', label: label('グループ名', 'Group name') },
        {
          initial: 'tabler:cloud',
          key: 'icon',
          kind: 'choice',
          label: label('アイコン', 'Icon'),
          options: architectureIcons
        }
      ],
      initial: [
        { _id: 'onprem', icon: 'tabler:building', name: '本社 オンプレミス' },
        { _id: 'cloud', icon: 'tabler:cloud', name: 'クラウド' }
      ],
      key: 'groups',
      kind: 'list',
      label: label('グループ', 'Groups')
    },
    {
      columns: [
        { key: 'name', kind: 'text', label: label('名前', 'Name') },
        {
          initial: 'tabler:server-2',
          key: 'icon',
          kind: 'choice',
          label: label('アイコン', 'Icon'),
          options: architectureIcons
        },
        {
          extra: [option('-', 'グループなし', 'No group')],
          key: 'group',
          kind: 'choice',
          label: label('グループ', 'Group'),
          source: 'groups'
        }
      ],
      initial: [
        { _id: 'pc', group: 'onprem', icon: 'tabler:device-desktop', name: '社員PC' },
        { _id: 'files', group: 'onprem', icon: 'tabler:folders', name: 'ファイルサーバ' },
        { _id: 'fw', group: 'onprem', icon: 'tabler:firewall-check', name: 'ファイアウォール' },
        { _id: 'vpn', group: 'cloud', icon: 'tabler:lock', name: 'VPN接続' },
        { _id: 'app', group: 'cloud', icon: 'tabler:server-2', name: '業務システム' },
        { _id: 'db', group: 'cloud', icon: 'tabler:database', name: 'データベース' },
        { _id: 'backup', group: 'cloud', icon: 'tabler:cloud-upload', name: 'バックアップ' }
      ],
      key: 'services',
      kind: 'list',
      label: label('サービス', 'Services')
    },
    {
      columns: [
        { key: 'from', kind: 'choice', label: label('接続元', 'From'), source: 'services' },
        {
          initial: 'right',
          key: 'side',
          kind: 'choice',
          label: label('接続先の位置', 'Where the other one is'),
          options: [
            option('right', '右', 'Right'),
            option('down', '下', 'Below'),
            option('left', '左', 'Left'),
            option('up', '上', 'Above')
          ]
        },
        { key: 'to', kind: 'choice', label: label('接続先', 'To'), source: 'services' }
      ],
      initial: [
        { _id: 'c1', from: 'pc', side: 'down', to: 'files' },
        { _id: 'c2', from: 'pc', side: 'right', to: 'fw' },
        { _id: 'c3', from: 'fw', side: 'right', to: 'vpn' },
        { _id: 'c4', from: 'vpn', side: 'right', to: 'app' },
        { _id: 'c5', from: 'app', side: 'down', to: 'db' },
        { _id: 'c6', from: 'db', side: 'right', to: 'backup' }
      ],
      key: 'connections',
      kind: 'list',
      label: label('接続', 'Connections')
    }
  ],
  generate: (values) => {
    const groups = filled(list(values, 'groups'), 'name');
    const services = filled(list(values, 'services'), 'name');
    const groupIds = new Map(groups.map((row, index) => [row._id, `grp${index + 1}`]));
    const serviceIds = new Map(services.map((row, index) => [row._id, `svc${index + 1}`]));
    const lines = ['architecture-beta'];
    for (const row of groups) {
      lines.push(`  group ${groupIds.get(row._id)}(${iconOf(row.icon)})[${archLabel(row.name)}]`);
    }
    if (groups.length > 0) lines.push('');
    for (const row of services) {
      const group = groupIds.get(row.group ?? '');
      lines.push(
        `  service ${serviceIds.get(row._id)}(${iconOf(row.icon)})[${archLabel(row.name)}]${group ? ` in ${group}` : ''}`
      );
    }
    if (services.length === 0) lines.push('  service svc1(tabler:server-2)[サーバー]');
    const edges = list(values, 'connections').flatMap((row) => {
      const from = serviceIds.get(row.from ?? '');
      const to = serviceIds.get(row.to ?? '');
      if (!from || !to || from === to) return [];
      const [out, into] = sides[row.side] ?? sides.right;
      return [`  ${from}:${out} --> ${into}:${to}`];
    });
    if (edges.length > 0) lines.push('', ...edges);
    return lines.join('\n');
  },
  id: 'architecture',
  name: label('システム構成図', 'System architecture'),
  sample: 'システム構成図'
};

// ---- Project gantt chart ----

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateHint = label(
  '例: 2026-04-01（空欄なら前の作業の後）',
  'e.g. 2026-04-01 (empty: after the previous task)'
);

const gantt: TemplateForm = {
  description: label(
    '工程（セクション）ごとの作業と日数から、プロジェクトの工程表を作ります。',
    'A project schedule from the tasks in each phase and how many days they take.'
  ),
  fields: [
    { ...titleField('プロジェクト工程表'), label: label('プロジェクト名', 'Project name') },
    {
      initial: '2026-04-01',
      key: 'start',
      kind: 'text',
      label: label('開始日', 'Start date'),
      pattern: label('例: 2026-04-01', 'e.g. 2026-04-01')
    },
    {
      columns: [
        { key: 'section', kind: 'text', label: label('工程', 'Phase') },
        { key: 'name', kind: 'text', label: label('作業', 'Task') },
        { key: 'start', kind: 'text', label: label('開始日', 'Start'), pattern: dateHint },
        {
          initial: '5',
          key: 'days',
          kind: 'text',
          label: label('日数', 'Days'),
          pattern: label('日数（数字）', 'Days (a number)')
        },
        {
          initial: '',
          key: 'status',
          kind: 'choice',
          label: label('状態', 'Status'),
          options: [
            option('', 'なし', 'None'),
            option('done', '完了', 'Done'),
            option('active', '進行中', 'In progress'),
            option('crit', '重要', 'Critical'),
            option('milestone', 'マイルストーン', 'Milestone')
          ]
        }
      ],
      initial: [
        ['要件定義', '要件ヒアリング', '10', 'done'],
        ['要件定義', '要件定義書の作成', '7', 'done'],
        ['設計', '基本設計', '14', 'active'],
        ['設計', '詳細設計', '14', ''],
        ['開発', '実装', '30', ''],
        ['開発', 'コードレビュー', '5', ''],
        ['テスト', '結合テスト', '10', ''],
        ['テスト', '受入テスト', '7', ''],
        ['リリース', '本番リリース', '1', 'milestone']
      ].map(([section, name, days, status], index) => ({
        _id: `t${index + 1}`,
        days,
        name,
        section,
        start: '',
        status
      })),
      key: 'tasks',
      kind: 'list',
      label: label('作業', 'Tasks')
    }
  ],
  generate: (values) => {
    const projectStart = text(values, 'start').trim();
    const firstStart = datePattern.test(projectStart)
      ? projectStart
      : new Date().toISOString().slice(0, 10);
    const statuses = new Set(['done', 'active', 'crit', 'milestone']);
    const lines = ['gantt', '    dateFormat YYYY-MM-DD', '    axisFormat %m/%d'];
    let section = '';
    let previous = '';
    const tasks = list(values, 'tasks').filter((row) => ganttText(row.name ?? ''));
    tasks.forEach((row, index) => {
      const phase = ganttText(row.section ?? '');
      if (phase && phase !== section) lines.push(`    section ${phase}`);
      if (phase) section = phase;
      // Not `task1`…: mermaid names a task without an id that way, and a clash draws NaN.
      const id = `t${index + 1}`;
      const start = (row.start ?? '').trim();
      const when = datePattern.test(start) ? start : previous ? `after ${previous}` : firstStart;
      const days = Math.min(Math.max(Number.parseInt(row.days ?? '', 10) || 1, 1), 9999);
      const status = statuses.has(row.status) ? `${row.status}, ` : '';
      lines.push(`        ${ganttText(row.name)} :${status}${id}, ${when}, ${days}d`);
      previous = id;
    });
    if (tasks.length === 0) lines.push('    section 作業', `        作業 :t1, ${firstStart}, 5d`);
    return setTitle(lines.join('\n'), titleText(values));
  },
  id: 'gantt',
  name: label('プロジェクト工程表', 'Project schedule'),
  sample: 'プロジェクト工程表'
};

// ---- Org chart ----

const org: TemplateForm = {
  description: label(
    '部署と、それぞれがどこの下にあるかから組織図を作ります。',
    'An org chart from the units and which one each reports to.'
  ),
  fields: [
    titleField('組織図'),
    {
      columns: [
        { key: 'name', kind: 'text', label: label('部署・役職', 'Unit or role') },
        {
          extra: [option('-', 'なし（最上位）', 'None (top)')],
          initial: '',
          key: 'parent',
          kind: 'choice',
          label: label('上位', 'Reports to'),
          source: 'units'
        }
      ],
      initial: [
        ['ceo', '代表取締役社長', '-'],
        ['sales', '営業本部', 'ceo'],
        ['dev', '開発本部', 'ceo'],
        ['admin', '管理本部', 'ceo'],
        ['sales1', '第一営業部', 'sales'],
        ['sales2', '第二営業部', 'sales'],
        ['dev1', '製品開発部', 'dev'],
        ['dev2', '品質保証部', 'dev'],
        ['hr', '人事総務部', 'admin'],
        ['acc', '経理部', 'admin']
      ].map(([_id, name, parent]) => ({ _id, name, parent })),
      key: 'units',
      kind: 'list',
      label: label('部署', 'Units')
    }
  ],
  generate: (values) => {
    const units = filled(list(values, 'units'), 'name');
    const ids = new Map(units.map((row, index) => [row._id, `o${index + 1}`]));
    const lines = [
      'flowchart TB',
      ...units.map((row) => `  ${ids.get(row._id)}[${quoted(row.name)}]`)
    ];
    if (units.length === 0) lines.push('  o1["組織"]');
    for (const row of units) {
      const parent = ids.get(row.parent ?? '');
      if (parent && row.parent !== row._id) lines.push(`  ${parent} --> ${ids.get(row._id)}`);
    }
    return setTitle(lines.join('\n'), titleText(values));
  },
  id: 'org',
  name: label('組織図', 'Org chart'),
  sample: '組織図'
};

// ---- Monthly closing sequence ----

const closing: TemplateForm = {
  description: label(
    '参加者の間のやり取りを順番に並べます（月次決算の例）。',
    'The messages between participants in order (a monthly close as the example).'
  ),
  fields: [
    titleField('月次決算フロー'),
    {
      columns: [{ key: 'name', kind: 'text', label: label('参加者', 'Participant') }],
      initial: [
        ['depts', '各部門'],
        ['acc', '経理'],
        ['head', '経理部長'],
        ['exec', '経営層']
      ].map(([_id, name]) => ({ _id, name })),
      key: 'participants',
      kind: 'list',
      label: label('参加者', 'Participants')
    },
    {
      columns: [
        { key: 'from', kind: 'choice', label: label('送り手', 'From'), source: 'participants' },
        { key: 'to', kind: 'choice', label: label('受け手', 'To'), source: 'participants' },
        { key: 'text', kind: 'text', label: label('内容', 'Message') },
        {
          initial: 'sync',
          key: 'kind',
          kind: 'choice',
          label: label('矢印', 'Arrow'),
          options: [
            option('sync', '依頼（実線）', 'Request (solid)'),
            option('reply', '返答（点線）', 'Reply (dotted)')
          ]
        }
      ],
      initial: [
        ['depts', 'acc', '経費・売上の計上を締める', 'sync'],
        ['acc', 'acc', '仕訳を確認し修正', 'sync'],
        ['acc', 'depts', '不明点を照会', 'sync'],
        ['depts', 'acc', '回答', 'reply'],
        ['acc', 'head', '月次試算表を提出', 'sync'],
        ['head', 'acc', '修正があれば差戻し', 'reply'],
        ['acc', 'head', '修正して再提出', 'sync'],
        ['head', 'exec', '月次報告', 'sync']
      ].map(([from, to, message, kind], index) => ({
        _id: `m${index + 1}`,
        from,
        kind,
        text: message,
        to
      })),
      key: 'messages',
      kind: 'list',
      label: label('やり取り', 'Messages')
    }
  ],
  generate: (values) => {
    const people = list(values, 'participants').filter((row) => sequenceText(row.name ?? ''));
    const ids = new Map(people.map((row, index) => [row._id, `p${index + 1}`]));
    const lines = ['sequenceDiagram', '    autonumber'];
    for (const row of people)
      lines.push(`    participant ${ids.get(row._id)} as ${sequenceText(row.name)}`);
    if (people.length === 0) lines.push('    participant p1 as 担当者');
    for (const row of list(values, 'messages')) {
      const from = ids.get(row.from ?? '');
      const to = ids.get(row.to ?? '');
      if (!from || !to) continue;
      lines.push(
        `    ${from}${row.kind === 'reply' ? '-->>' : '->>'}${to}: ${sequenceText(row.text ?? '')}`
      );
    }
    return setTitle(lines.join('\n'), titleText(values));
  },
  id: 'closing',
  name: label('月次決算フロー', 'Monthly closing'),
  sample: '月次決算フロー'
};

// ---- Kanban duty table ----

const assignee = (value: string) =>
  oneLine(value)
    .replaceAll(/['"{}]/g, '')
    .trim();

const kanban: TemplateForm = {
  description: label(
    '列（状態）ごとに、仕事と担当者をカードで並べます。',
    'Cards with the work and who does it, in a column per state.'
  ),
  fields: [
    {
      columns: [{ key: 'name', kind: 'text', label: label('列の名前', 'Column name') }],
      initial: [
        ['todo', '未着手'],
        ['doing', '進行中'],
        ['review', '確認待ち'],
        ['done', '完了']
      ].map(([_id, name]) => ({ _id, name })),
      key: 'columns',
      kind: 'list',
      label: label('列', 'Columns')
    },
    {
      columns: [
        { key: 'text', kind: 'text', label: label('仕事', 'Work') },
        { key: 'column', kind: 'choice', label: label('列', 'Column'), source: 'columns' },
        { key: 'assignee', kind: 'text', label: label('担当者', 'Assignee') }
      ],
      initial: [
        ['todo', '月次レポートの作成', '田中'],
        ['todo', '顧客向け提案書', '鈴木'],
        ['doing', '新システムの要件整理', '佐藤'],
        ['doing', '社内研修の企画', '高橋'],
        ['review', '契約書の法務確認', '伊藤'],
        ['done', '週次定例の議事録', '渡辺']
      ].map(([column, work, person], index) => ({
        _id: `k${index + 1}`,
        assignee: person,
        column,
        text: work
      })),
      key: 'cards',
      kind: 'list',
      label: label('カード', 'Cards')
    }
  ],
  generate: (values) => {
    const columns = list(values, 'columns').filter((row) => noBrackets(row.name ?? '').trim());
    if (columns.length === 0) columns.push({ _id: '', name: '未着手' });
    const cards = list(values, 'cards').filter((row) => noBrackets(row.text ?? '').trim());
    const columnOf = (row: Row) =>
      columns.some(({ _id }) => _id === row.column) ? row.column : columns[0]._id;
    const lines = ['kanban'];
    let card = 0;
    columns.forEach((column, index) => {
      lines.push(`  col${index + 1}[${noBrackets(column.name).trim()}]`);
      for (const row of cards.filter((candidate) => columnOf(candidate) === column._id)) {
        const person = assignee(row.assignee ?? '');
        const meta = person ? `@{ assigned: '${person}' }` : '';
        lines.push(`    card${++card}[${noBrackets(row.text).trim()}]${meta}`);
      }
    });
    return lines.join('\n');
  },
  id: 'kanban',
  name: label('業務分担表', 'Duty board'),
  sample: '業務分担表'
};

/** The forms, in the order of the business templates in localSamples.ts. */
export const templateForms: TemplateForm[] = [
  expense,
  approval,
  support,
  hiring,
  architecture,
  gantt,
  org,
  closing,
  kanban
];

const normalize = (code: string) =>
  code
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

let defaultCodes: Set<string> | undefined;
/** Whether the code is what a template's form makes when nothing is changed. */
export const isTemplateCode = (code: string): boolean => {
  defaultCodes ??= new Set(
    templateForms.map((template) => normalize(template.generate(defaultValues(template))))
  );
  return defaultCodes.has(normalize(code));
};
