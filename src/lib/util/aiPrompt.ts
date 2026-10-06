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
  ja: string;
  en: string;
}

export const curatedIcons: CuratedIcon[] = [
  // mermaid's built-in icons: render anywhere mermaid does.
  { en: 'server (standard)', id: 'server', ja: 'サーバー（標準）' },
  { en: 'database (standard)', id: 'database', ja: 'データベース（標準）' },
  { en: 'disk (standard)', id: 'disk', ja: 'ディスク（標準）' },
  { en: 'internet (standard)', id: 'internet', ja: 'インターネット（標準）' },
  { en: 'cloud (standard)', id: 'cloud', ja: 'クラウド（標準）' },
  // Infrastructure (tabler)
  { en: 'server', id: 'tabler:server', ja: 'サーバー' },
  { en: 'server rack', id: 'tabler:server-2', ja: 'サーバーラック' },
  { en: 'database', id: 'tabler:database', ja: 'データベース' },
  { en: 'file server / storage', id: 'tabler:files', ja: 'ファイルサーバー・ストレージ' },
  { en: 'router', id: 'tabler:router', ja: 'ルーター' },
  { en: 'switch', id: 'tabler:switch', ja: 'スイッチ' },
  { en: 'firewall', id: 'tabler:firewall-check', ja: 'ファイアウォール' },
  { en: 'load balancer', id: 'tabler:load-balancer', ja: 'ロードバランサー' },
  { en: 'Wi-Fi', id: 'tabler:wifi', ja: 'Wi-Fi' },
  { en: 'VPN / lock', id: 'tabler:lock', ja: 'VPN・ロック' },
  { en: 'shield / security', id: 'tabler:shield', ja: 'セキュリティ' },
  { en: 'internet / world', id: 'tabler:world', ja: 'インターネット' },
  { en: 'cloud', id: 'tabler:cloud', ja: 'クラウド' },
  { en: 'building / office', id: 'tabler:building', ja: '建物・オフィス' },
  { en: 'desktop PC', id: 'tabler:device-desktop', ja: 'デスクトップPC' },
  { en: 'laptop', id: 'tabler:device-laptop', ja: 'ノートPC' },
  { en: 'smartphone', id: 'tabler:device-mobile', ja: 'スマートフォン' },
  { en: 'printer', id: 'tabler:printer', ja: 'プリンター' },
  { en: 'user', id: 'tabler:user', ja: '利用者' },
  { en: 'users / team', id: 'tabler:users', ja: '利用者（複数）' },
  { en: 'mail', id: 'tabler:mail', ja: 'メール' },
  { en: 'browser', id: 'tabler:browser', ja: 'ブラウザ' },
  { en: 'API', id: 'tabler:api', ja: 'API' },
  { en: 'queue / list', id: 'tabler:list-details', ja: 'キュー・一覧' },
  { en: 'backup / upload', id: 'tabler:cloud-upload', ja: 'バックアップ' },
  { en: 'clock / batch', id: 'tabler:clock', ja: '時刻・バッチ' },
  { en: 'document', id: 'tabler:file-text', ja: '文書' },
  { en: 'spreadsheet', id: 'tabler:file-spreadsheet', ja: '表計算' },
  { en: 'camera', id: 'tabler:camera', ja: 'カメラ' },
  { en: 'cpu / compute', id: 'tabler:cpu', ja: 'CPU・計算' },
  { en: 'container', id: 'tabler:box', ja: 'コンテナ' },
  { en: 'git / repository', id: 'tabler:git-branch', ja: 'リポジトリ' },
  { en: 'settings', id: 'tabler:settings', ja: '設定' },
  { en: 'robot / AI', id: 'tabler:robot', ja: 'AI・ロボット' },
  // Network and data-centre gear (clarity, eos-icons)
  { en: 'router', id: 'clarity:router-line', ja: 'ルーター' },
  { en: 'network switch', id: 'clarity:network-switch-line', ja: 'ネットワークスイッチ' },
  { en: 'firewall appliance', id: 'clarity:firewall-line', ja: 'ファイアウォール機器' },
  { en: 'rack server', id: 'clarity:rack-server-line', ja: 'ラックサーバー' },
  { en: 'storage array', id: 'clarity:storage-line', ja: 'ストレージ装置' },
  { en: 'tape backup', id: 'clarity:tape-drive-line', ja: 'テープバックアップ' },
  { en: 'virtual machine', id: 'clarity:vm-line', ja: '仮想マシン' },
  { en: 'thin client / VDI', id: 'clarity:thin-client-line', ja: 'シンクライアント・VDI' },
  { en: 'DNS', id: 'eos-icons:dns', ja: 'DNS' },
  { en: 'proxy', id: 'eos-icons:proxy', ja: 'プロキシ' },
  { en: 'ingress / reverse proxy', id: 'eos-icons:ingress', ja: 'イングレス・リバースプロキシ' },
  // Microsoft 365 look (fluent-color: Microsoft's colour Fluent icons)
  { en: 'team (Teams)', id: 'fluent-color:people-team-48', ja: 'チーム（Teams）' },
  { en: 'chat', id: 'fluent-color:chat-multiple-24', ja: 'チャット' },
  {
    en: 'mail (Outlook / Exchange)',
    id: 'fluent-color:mail-48',
    ja: 'メール（Outlook・Exchange）'
  },
  { en: 'calendar', id: 'fluent-color:calendar-48', ja: '予定表' },
  {
    en: 'document library (SharePoint)',
    id: 'fluent-color:document-folder-24',
    ja: '文書ライブラリ（SharePoint）'
  },
  {
    en: 'approvals (Power Automate)',
    id: 'fluent-color:approvals-app-32',
    ja: '承認（Power Automate）'
  },
  { en: 'sign-in (Entra ID)', id: 'fluent-color:person-key-32', ja: 'サインイン（Entra ID）' },
  {
    en: 'managed devices (Intune)',
    id: 'fluent-color:phone-laptop-32',
    ja: '管理デバイス（Intune）'
  },
  // Logos (only in builds that bundle them)
  { en: 'AWS', id: 'logos:aws', ja: 'AWS' },
  { en: 'AWS EC2', id: 'logos:aws-ec2', ja: 'AWS EC2' },
  { en: 'AWS Lambda', id: 'logos:aws-lambda', ja: 'AWS Lambda' },
  { en: 'AWS S3', id: 'logos:aws-s3', ja: 'AWS S3' },
  { en: 'AWS RDS', id: 'logos:aws-rds', ja: 'AWS RDS' },
  { en: 'AWS API Gateway', id: 'logos:aws-api-gateway', ja: 'AWS API Gateway' },
  { en: 'AWS CloudFront', id: 'logos:aws-cloudfront', ja: 'AWS CloudFront' },
  { en: 'AWS SQS', id: 'logos:aws-sqs', ja: 'AWS SQS' },
  { en: 'Microsoft Azure', id: 'logos:microsoft-azure', ja: 'Microsoft Azure' },
  { en: 'Google Cloud', id: 'logos:google-cloud', ja: 'Google Cloud' },
  { en: 'Docker', id: 'logos:docker-icon', ja: 'Docker' },
  { en: 'Kubernetes', id: 'logos:kubernetes', ja: 'Kubernetes' },
  { en: 'PostgreSQL', id: 'logos:postgresql', ja: 'PostgreSQL' },
  { en: 'MySQL', id: 'logos:mysql-icon', ja: 'MySQL' },
  { en: 'Redis', id: 'logos:redis', ja: 'Redis' },
  { en: 'nginx', id: 'logos:nginx', ja: 'nginx' },
  { en: 'GitHub', id: 'logos:github-icon', ja: 'GitHub' },
  { en: 'GitLab', id: 'logos:gitlab', ja: 'GitLab' },
  { en: 'Slack', id: 'logos:slack-icon', ja: 'Slack' },
  { en: 'Microsoft Teams', id: 'logos:microsoft-teams', ja: 'Microsoft Teams' },
  { en: 'SharePoint', id: 'simple-icons:microsoftsharepoint', ja: 'SharePoint' },
  { en: 'OneDrive', id: 'logos:microsoft-onedrive', ja: 'OneDrive' },
  { en: 'Salesforce', id: 'logos:salesforce', ja: 'Salesforce' },
  { en: 'Windows', id: 'logos:microsoft-windows-icon', ja: 'Windows' },
  { en: 'Linux', id: 'logos:linux-tux', ja: 'Linux' }
];

export interface AiPromptOptions {
  locale: Locale;
  /** The packs this site offers: standard (`mermaid`), bundled, hosted and imported. */
  packs: string[];
  /** Icons the user collected in the picker for this diagram. */
  collected: string[];
}

const STANDARD = 'mermaid';

const text: Record<
  Locale,
  {
    intro: string;
    syntax: string;
    rules: string[];
    packs: (names: string) => string;
    collected: string;
    curated: string;
    outro: string;
  }
> = {
  en: {
    collected: 'Icons I want in this diagram (use these names exactly):',
    curated: 'Other icons that exist (name — meaning):',
    intro:
      'Write the diagram as mermaid code for an editor that bundles icon packs. Follow these rules exactly.',
    outro:
      'Reply with the mermaid code only, in one code block. Use only icon names from the lists above or names you are certain exist in the named packs; if unsure, use a standard icon.',
    packs: (names) =>
      `Icon packs available: ${names}. An icon is written as prefix:name (tabler:server). The standard icons server, database, disk, internet and cloud are written without a prefix and render everywhere.`,
    rules: [
      'ids are ASCII letters and digits only (web, db1); the label in [ ] can be Japanese.',
      'An id must not start with R, L, T or B (those letters name the sides in edges).',
      'Edges: web:R --> L:db joins the right side of web to the left side of db; sides are L, R, T, B. Use --> for an arrow and -- for a plain line.',
      'service id(icon)[Label] in groupId puts a service in a group; group id(icon)[Label] in parentId nests groups.',
      'Font Awesome (fa:) icons do not work in architecture diagrams.',
      'In a flowchart, an icon node is written id@{ icon: "tabler:server", form: "square", label: "Web" }.'
    ],
    syntax: `Example:
architecture-beta
  group office(tabler:building)[Office]
  group cloud(tabler:cloud)[Cloud]

  service pc(tabler:device-desktop)[PCs] in office
  service web(tabler:server)[Web] in cloud
  service db(database)[DB] in cloud

  pc:R --> L:web
  web:R --> L:db`
  },
  ja: {
    collected: 'この図で使いたいアイコン（この名前をそのまま使うこと）:',
    curated: 'ほかに使えるアイコン（名前 — 意味）:',
    intro:
      'アイコン集を同梱したエディタ向けに、図を mermaid コードで書いてください。次のルールを厳守してください。',
    outro:
      '返答は mermaid コードだけを 1 つのコードブロックで。アイコン名は上のリストにあるもの、または指定したアイコン集に確実に存在するものだけを使い、迷ったら標準アイコンを使ってください。',
    packs: (names) =>
      `使えるアイコン集: ${names}。アイコンは 接頭辞:名前 の形で書きます（例 tabler:server）。標準アイコン server, database, disk, internet, cloud は接頭辞なしで書け、どこでも表示されます。`,
    rules: [
      'ID は半角英数字のみ（web, db1 など）。[ ] の中の表示名は日本語でよい。',
      'ID を R, L, T, B で始めない（矢印で辺を表す文字と衝突するため）。',
      '矢印: web:R --> L:db は web の右辺と db の左辺をつなぐ。辺は L, R, T, B。矢印は -->、線だけなら --。',
      'service id(アイコン)[表示名] in グループID でグループに入れる。group id(アイコン)[表示名] in 親ID で入れ子にできる。',
      'Font Awesome（fa:）のアイコンはアーキテクチャ図では使えない。',
      'フローチャートでアイコン付きノードを書くときは id@{ icon: "tabler:server", form: "square", label: "Web" } の形。'
    ],
    syntax: `例:
architecture-beta
  group office(tabler:building)[本社]
  group cloud(tabler:cloud)[クラウド]

  service pc(tabler:device-desktop)[社員PC] in office
  service web(tabler:server)[Webサーバー] in cloud
  service db(database)[DB] in cloud

  pc:R --> L:web
  web:R --> L:db`
  }
};

/** The briefing text for the clipboard. */
export const buildAiPrompt = ({ collected, locale, packs }: AiPromptOptions): string => {
  const words = text[locale];
  const names = packs.filter((name) => name !== STANDARD);
  const available = new Set(packs);
  const curated = curatedIcons.filter(({ id }) => {
    const colon = id.indexOf(':');
    return available.has(colon === -1 ? STANDARD : id.slice(0, colon));
  });
  const lines = [
    words.intro,
    '',
    words.syntax,
    '',
    ...words.rules.map((rule) => `- ${rule}`),
    '',
    words.packs(names.join(', '))
  ];
  if (collected.length > 0) {
    lines.push('', words.collected, ...collected.map((id) => `- ${id}`));
  }
  lines.push('', words.curated, ...curated.map((icon) => `- ${icon.id} — ${icon[locale]}`));
  lines.push('', words.outro);
  return lines.join('\n');
};
