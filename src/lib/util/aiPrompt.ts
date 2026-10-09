import type { Locale } from '$/i18n/messages';

/**
 * Local: a briefing to paste into an AI chat before asking it for a diagram.
 * An AI invents icon names (`aws:lambda`, `icon-server`) because it cannot see
 * the packs; this text tells it the syntax, the packs this site bundles, a
 * short list of icons for the usual parts of a system, and the icons the user
 * collected in the picker for the diagram at hand (aiCollection.svelte.ts).
 * Every curated name is checked against the packs by aiPrompt.test.ts.
 */
export interface CuratedIcon {
  id: string;
  en: string;
}

export const curatedIcons: CuratedIcon[] = [
  // mermaid's built-in icons: render anywhere mermaid does.
  { en: 'server (standard)', id: 'server' },
  { en: 'database (standard)', id: 'database' },
  { en: 'disk (standard)', id: 'disk' },
  { en: 'internet (standard)', id: 'internet' },
  { en: 'cloud (standard)', id: 'cloud' },
  // Infrastructure (tabler)
  { en: 'server', id: 'tabler:server' },
  { en: 'server rack', id: 'tabler:server-2' },
  { en: 'database', id: 'tabler:database' },
  { en: 'file server / storage', id: 'tabler:files' },
  { en: 'router', id: 'tabler:router' },
  { en: 'switch', id: 'tabler:switch' },
  { en: 'firewall', id: 'tabler:firewall-check' },
  { en: 'load balancer', id: 'tabler:load-balancer' },
  { en: 'Wi-Fi', id: 'tabler:wifi' },
  { en: 'VPN / lock', id: 'tabler:lock' },
  { en: 'shield / security', id: 'tabler:shield' },
  { en: 'internet / world', id: 'tabler:world' },
  { en: 'cloud', id: 'tabler:cloud' },
  { en: 'building / office', id: 'tabler:building' },
  { en: 'desktop PC', id: 'tabler:device-desktop' },
  { en: 'laptop', id: 'tabler:device-laptop' },
  { en: 'smartphone', id: 'tabler:device-mobile' },
  { en: 'printer', id: 'tabler:printer' },
  { en: 'user', id: 'tabler:user' },
  { en: 'users / team', id: 'tabler:users' },
  { en: 'mail', id: 'tabler:mail' },
  { en: 'browser', id: 'tabler:browser' },
  { en: 'API', id: 'tabler:api' },
  { en: 'queue / list', id: 'tabler:list-details' },
  { en: 'backup / upload', id: 'tabler:cloud-upload' },
  { en: 'clock / batch', id: 'tabler:clock' },
  { en: 'document', id: 'tabler:file-text' },
  { en: 'spreadsheet', id: 'tabler:file-spreadsheet' },
  { en: 'camera', id: 'tabler:camera' },
  { en: 'cpu / compute', id: 'tabler:cpu' },
  { en: 'container', id: 'tabler:box' },
  { en: 'git / repository', id: 'tabler:git-branch' },
  { en: 'settings', id: 'tabler:settings' },
  { en: 'robot / AI', id: 'tabler:robot' },
  // Network and data-centre gear (clarity, eos-icons)
  { en: 'router', id: 'clarity:router-line' },
  { en: 'network switch', id: 'clarity:network-switch-line' },
  { en: 'firewall appliance', id: 'clarity:firewall-line' },
  { en: 'rack server', id: 'clarity:rack-server-line' },
  { en: 'storage array', id: 'clarity:storage-line' },
  { en: 'tape backup', id: 'clarity:tape-drive-line' },
  { en: 'virtual machine', id: 'clarity:vm-line' },
  { en: 'thin client / VDI', id: 'clarity:thin-client-line' },
  { en: 'DNS', id: 'eos-icons:dns' },
  { en: 'proxy', id: 'eos-icons:proxy' },
  { en: 'ingress / reverse proxy', id: 'eos-icons:ingress' },
  // Microsoft 365 look (fluent-color: Microsoft's colour Fluent icons)
  { en: 'team (Teams)', id: 'fluent-color:people-team-48' },
  { en: 'chat', id: 'fluent-color:chat-multiple-24' },
  {
    en: 'mail (Outlook / Exchange)',
    id: 'fluent-color:mail-48'
  },
  { en: 'calendar', id: 'fluent-color:calendar-48' },
  {
    en: 'document library (SharePoint)',
    id: 'fluent-color:document-folder-24'
  },
  {
    en: 'approvals (Power Automate)',
    id: 'fluent-color:approvals-app-32'
  },
  { en: 'sign-in (Entra ID)', id: 'fluent-color:person-key-32' },
  {
    en: 'managed devices (Intune)',
    id: 'fluent-color:phone-laptop-32'
  },
  // Logos (only in builds that bundle them)
  { en: 'AWS', id: 'logos:aws' },
  { en: 'AWS EC2', id: 'logos:aws-ec2' },
  { en: 'AWS Lambda', id: 'logos:aws-lambda' },
  { en: 'AWS S3', id: 'logos:aws-s3' },
  { en: 'AWS RDS', id: 'logos:aws-rds' },
  { en: 'AWS API Gateway', id: 'logos:aws-api-gateway' },
  { en: 'AWS CloudFront', id: 'logos:aws-cloudfront' },
  { en: 'AWS SQS', id: 'logos:aws-sqs' },
  { en: 'Microsoft Azure', id: 'logos:microsoft-azure' },
  { en: 'Google Cloud', id: 'logos:google-cloud' },
  { en: 'Docker', id: 'logos:docker-icon' },
  { en: 'Kubernetes', id: 'logos:kubernetes' },
  { en: 'PostgreSQL', id: 'logos:postgresql' },
  { en: 'MySQL', id: 'logos:mysql-icon' },
  { en: 'Redis', id: 'logos:redis' },
  { en: 'nginx', id: 'logos:nginx' },
  { en: 'GitHub', id: 'logos:github-icon' },
  { en: 'GitLab', id: 'logos:gitlab' },
  { en: 'Slack', id: 'logos:slack-icon' },
  { en: 'Microsoft Teams', id: 'logos:microsoft-teams' },
  { en: 'SharePoint', id: 'simple-icons:microsoftsharepoint' },
  { en: 'OneDrive', id: 'logos:microsoft-onedrive' },
  { en: 'Salesforce', id: 'logos:salesforce' },
  { en: 'Windows', id: 'logos:microsoft-windows-icon' },
  { en: 'Linux', id: 'logos:linux-tux' }
];

/** What the briefing teaches: diagram types with icon syntax get their own, the rest a generic one. */
export type AiKind = 'flowchart' | 'architecture' | 'sequence' | 'other';

/**
 * The briefing kind for a mermaid diagram type as `parse` reports it
 * (`flowchart-v2`, `flowchart-elk`, `architecture`, `sequence`, ...). With no
 * type yet, the general example is a flowchart.
 */
export const aiKind = (diagramType: string | undefined): AiKind => {
  if (!diagramType || diagramType === 'graph' || diagramType.startsWith('flowchart')) {
    return 'flowchart';
  }
  if (diagramType === 'architecture') return 'architecture';
  if (diagramType.startsWith('sequence')) return 'sequence';
  return 'other';
};

export interface AiPromptOptions {
  locale: Locale;
  /** The packs this site offers: standard (`mermaid`), bundled, hosted and imported. */
  packs: string[];
  /** Icons the user collected in the picker for this diagram. */
  collected: string[];
  /** The current diagram's type (validatedState.diagramType); the example follows it. */
  diagramType?: string;
}

const STANDARD = 'mermaid';

interface KindText {
  /** The example diagram, introduced by `Words.example`. */
  example: string;
  /** How an icon is written in this diagram type; absent where icons do not exist. */
  icons?: string;
  rules: string[];
}

interface Words {
  collected: string;
  common: string[];
  curated: string;
  example: (type: string) => string;
  iconOutro: string;
  intro: string;
  kinds: Record<Exclude<AiKind, 'other'>, KindText>;
  noIcons: (type: string) => string;
  otherType: (type: string) => string;
  outro: string;
  packs: (names: string) => string;
  usingIcons: string;
}

const text: Record<Locale, Words> = {
  en: {
    collected: 'Icons I want in this diagram (use these names exactly):',
    common: [
      'ids are ASCII letters and digits only (web, db1); the label shown on the diagram can be Japanese.',
      'Keep to one diagram type and start with its keyword (flowchart, sequenceDiagram, architecture-beta, ...).'
    ],
    curated: 'Other icons that exist (name — meaning):',
    example: (type) => `Example (${type}):`,
    iconOutro:
      'Use only icon names from the lists above or names you are certain exist in the named packs; if unsure, use a standard icon.',
    intro:
      'Write the diagram as mermaid code for an editor that bundles icon packs. Follow these rules exactly.',
    kinds: {
      architecture: {
        example: `architecture-beta
  group office(tabler:building)[Office]
  group cloud(tabler:cloud)[Cloud]

  service pc(tabler:device-desktop)[PCs] in office
  service web(tabler:server)[Web] in cloud
  service db(database)[DB] in cloud

  pc:R --> L:web
  web:R --> L:db`,
        icons: 'service web(tabler:server)[Web] in cloud',
        rules: [
          'An id must not start with R, L, T or B (those letters name the sides in edges).',
          'Edges: web:R --> L:db joins the right side of web to the left side of db; sides are L, R, T, B. Use --> for an arrow and -- for a plain line.',
          'service id(icon)[Label] in groupId puts a service in a group; group id(icon)[Label] in parentId nests groups.',
          'Font Awesome (fa:) icons do not work in architecture diagrams.'
        ]
      },
      flowchart: {
        example: `flowchart LR
  start([Start]) --> order[Receive the order]
  order --> stock{In stock?}
  stock -->|yes| ship[Ship it]
  stock -->|no| wait[Tell the customer]`,
        icons: `web@{ icon: "tabler:server", form: "square", label: "Web" }
db@{ icon: "tabler:database", form: "square", label: "DB" }
web --> db`,
        rules: [
          'Shapes: [text] box, (text) rounded, ([text]) stadium, {text} decision. Arrows: --> and -->|label|.',
          'Group steps with subgraph name[Title] ... end.',
          'An icon node is written id@{ icon: "tabler:server", form: "square", label: "Web" }.'
        ]
      },
      sequence: {
        example: `sequenceDiagram
  participant U as Customer
  participant S as Shop
  U->>S: Place an order
  S-->>U: Confirmation`,
        rules: [
          'participant id as Label declares a participant; ->> is a request, -->> a reply.',
          'Group steps with alt / else / end, loop ... end and opt ... end.'
        ]
      }
    },
    noIcons: (type) =>
      `This diagram type (${type}) has no icons: do not write icon names, only the plain mermaid syntax for this type.`,
    otherType: (type) => `Write the diagram in the same type as the current one (${type}).`,
    outro: 'Reply with the mermaid code only, in one code block.',
    packs: (names) =>
      `Icon packs available: ${names}. An icon is written as prefix:name (tabler:server). The standard icons server, database, disk, internet and cloud are written without a prefix and render everywhere (architecture diagrams only).`,
    usingIcons: 'Writing an icon:'
  },
  ja: {
    collected: 'この図で使いたいアイコン（この名前をそのまま使うこと）:',
    common: [
      'ID は半角英数字のみ（web, db1 など）。図に表示する名前は日本語でよい。',
      '図の種類は 1 つに絞り、その種類のキーワード（flowchart, sequenceDiagram, architecture-beta など）で始める。'
    ],
    curated: 'ほかに使えるアイコン（名前 — 意味）:',
    example: (type) => `例（${type}）:`,
    iconOutro:
      'アイコン名は上のリストにあるもの、または指定したアイコン集に確実に存在するものだけを使い、迷ったら標準アイコンを使ってください。',
    intro:
      'アイコン集を同梱したエディタ向けに、図を mermaid コードで書いてください。次のルールを厳守してください。',
    kinds: {
      architecture: {
        example: `architecture-beta
  group office(tabler:building)[本社]
  group cloud(tabler:cloud)[クラウド]

  service pc(tabler:device-desktop)[社員PC] in office
  service web(tabler:server)[Webサーバー] in cloud
  service db(database)[DB] in cloud

  pc:R --> L:web
  web:R --> L:db`,
        icons: 'service web(tabler:server)[Webサーバー] in cloud',
        rules: [
          'ID を R, L, T, B で始めない（矢印で辺を表す文字と衝突するため）。',
          '矢印: web:R --> L:db は web の右辺と db の左辺をつなぐ。辺は L, R, T, B。矢印は -->、線だけなら --。',
          'service id(アイコン)[表示名] in グループID でグループに入れる。group id(アイコン)[表示名] in 親ID で入れ子にできる。',
          'Font Awesome（fa:）のアイコンはアーキテクチャ図では使えない。'
        ]
      },
      flowchart: {
        example: `flowchart LR
  start([開始]) --> order[注文を受ける]
  order --> stock{在庫はある？}
  stock -->|ある| ship[発送する]
  stock -->|ない| wait[お客様に連絡する]`,
        icons: `web@{ icon: "tabler:server", form: "square", label: "Webサーバー" }
db@{ icon: "tabler:database", form: "square", label: "DB" }
web --> db`,
        rules: [
          '図形: [文字] 四角、(文字) 角丸、([文字]) 開始・終了、{文字} 判断。矢印は --> と -->|ラベル|。',
          '手順のまとまりは subgraph 名前[見出し] ... end で囲む。',
          'アイコン付きの図形は id@{ icon: "tabler:server", form: "square", label: "Web" } の形で書く。'
        ]
      },
      sequence: {
        example: `sequenceDiagram
  participant U as お客様
  participant S as 店
  U->>S: 注文する
  S-->>U: 確認を返す`,
        rules: [
          'participant ID as 表示名 で参加者を宣言する。->> は依頼、-->> は返信。',
          '分岐・繰り返しは alt / else / end、loop ... end、opt ... end で囲む。'
        ]
      }
    },
    noIcons: (type) =>
      `この種類の図（${type}）にはアイコンがありません。アイコン名は書かず、この種類の通常の mermaid の書き方だけを使うこと。`,
    otherType: (type) => `今の図と同じ種類（${type}）で書くこと。`,
    outro: '返答は mermaid コードだけを 1 つのコードブロックで返してください。',
    packs: (names) =>
      `使えるアイコン集: ${names}。アイコンは 接頭辞:名前 の形で書きます（例 tabler:server）。標準アイコン server, database, disk, internet, cloud は接頭辞なしで書け、どこでも表示されます（アーキテクチャ図のみ）。`,
    usingIcons: 'アイコンの書き方:'
  }
};

/** The briefing text for the clipboard. */
export const buildAiPrompt = ({
  collected,
  diagramType,
  locale,
  packs
}: AiPromptOptions): string => {
  const words = text[locale];
  const kind = aiKind(diagramType);
  const known = kind === 'other' ? undefined : words.kinds[kind];
  const names = packs.filter((name) => name !== STANDARD);
  const available = new Set(packs);
  // Standard (prefix-less) icons exist in architecture diagrams only.
  const curated = curatedIcons.filter(({ id }) => {
    const colon = id.indexOf(':');
    return colon === -1 ? kind === 'architecture' : available.has(id.slice(0, colon));
  });
  const lines = [words.intro, ''];
  if (known) {
    lines.push(words.example(kind), known.example, '');
  } else {
    lines.push(words.otherType(diagramType ?? ''), '');
  }
  lines.push(...[...words.common, ...(known?.rules ?? [])].map((rule) => `- ${rule}`));
  if (known?.icons) {
    lines.push('', words.packs(names.join(', ')), '', words.usingIcons, known.icons);
    if (collected.length > 0) {
      lines.push('', words.collected, ...collected.map((id) => `- ${id}`));
    }
    lines.push('', words.curated, ...curated.map((icon) => `- ${icon.id} — ${icon.en}`));
  } else {
    lines.push('', words.noIcons(diagramType ?? kind));
  }
  if (known?.icons) lines.push('', words.iconOutro);
  lines.push('', words.outro);
  return lines.join('\n');
};
