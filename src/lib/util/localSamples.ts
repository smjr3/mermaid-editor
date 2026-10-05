import type { SampleExample } from './mermaid';

/**
 * Sample diagrams this fork adds to the "Sample Diagrams" card.
 *
 * `@mermaid-js/examples` has no swimlane entry, yet swimlane support is the
 * reason this fork exists. "System Architecture" shows the bundled icon packs
 * (iconPacks.ts; the logo example needs MERMAID_BUNDLE_LOGOS left on), which upstream's architecture samples do not use. Kept in its own file so `Preset.svelte` gains one
 * spread rather than a block of code, and an upstream merge touches neither.
 * Drop an entry once `@mermaid-js/examples` ships one under the same name.
 */
// Uses the `logos` pack, so it is left out of builds without logos.
const awsLogos: SampleExample = {
  code: `architecture-beta
  group aws(logos:aws)[AWS]

  service user(tabler:user)[User]
  service cdn(logos:aws-cloudfront)[CloudFront] in aws
  service api(logos:aws-api-gateway)[API Gateway] in aws
  service app(logos:aws-ec2)[EC2] in aws
  service db(logos:aws-rds)[RDS] in aws
  service files(logos:aws-s3)[S3] in aws

  user:R --> L:cdn
  cdn:R --> L:api
  api:R --> L:app
  app:B --> T:db
  app:R --> L:files`,
  title: 'Cloud (AWS logos)'
};

/**
 * The "業務テンプレート" (business templates) group: Japanese-language samples
 * of the diagrams a Japanese office writes most — approval flows, swimlanes,
 * a gantt chart, an org chart. The name is the key the card shows (it does
 * not translate group names), so it is Japanese on purpose; the text inside is
 * Japanese and the ids are ASCII so the Add, Colours and F2 features all apply.
 * Kept to about a dozen nodes each so they read at a glance in the viewer.
 */
export const businessTemplatesName = '業務テンプレート';

const businessTemplates: SampleExample[] = [
  {
    code: `swimlane-beta LR
  subgraph applicant[申請者]
    A[経費精算を申請] --> B[指摘箇所を修正]
  end
  subgraph manager[上長]
    C{内容を承認する?}
  end
  subgraph accounting[経理]
    D[証憑を確認] --> E[振込処理]
    E --> F[申請者へ支払通知]
  end
  A --> C
  C -->|差戻し| B
  B --> C
  C -->|承認| D`,
    isDefault: true,
    title: 'スイムレーン業務フロー'
  },
  {
    code: `flowchart TD
  draft([稟議書を起案]) --> check[部門長が内容を確認]
  check --> amount{金額は10万円以上?}
  amount -->|いいえ| approve1[部門長が決裁]
  amount -->|はい| board[役員が審議]
  board --> decide{承認する?}
  decide -->|差戻し| fix[起案者が修正]
  fix --> check
  decide -->|承認| approve2[役員が決裁]
  approve1 --> order([発注・契約へ])
  approve2 --> order`,
    title: '稟議・承認フロー'
  },
  {
    code: `swimlane-beta LR
  subgraph customer[顧客]
    A[問い合わせを送る] --> F[回答を受け取る]
  end
  subgraph support[サポート]
    B[内容を確認] --> C{既知の問題?}
    C -->|はい| D[回答を作成]
  end
  subgraph dev[開発]
    E[原因を調査] --> G[修正をリリース]
  end
  A --> B
  C -->|いいえ| E
  G --> D
  D --> F`,
    title: '問い合わせ対応フロー'
  },
  {
    code: `timeline
    title 採用プロセス
    section 募集
        1週目 : 求人票を作成 : 採用媒体に掲載
    section 選考
        2〜3週目 : 書類選考 : 一次面接（現場）
        4週目 : 二次面接（役員） : 適性検査
    section 内定
        5週目 : 内定通知 : 条件面談
        6週目〜 : 入社手続き : 受け入れ準備`,
    title: '採用プロセス'
  },
  {
    code: `architecture-beta
  group onprem(tabler:building)[本社 オンプレミス]
  group cloud(tabler:cloud)[クラウド]

  service pc(tabler:device-desktop)[社員PC] in onprem
  service files(tabler:folders)[ファイルサーバ] in onprem
  service fw(tabler:firewall-check)[ファイアウォール] in onprem
  service vpn(tabler:lock)[VPN接続] in cloud
  service app(tabler:server-2)[業務システム] in cloud
  service db(tabler:database)[データベース] in cloud
  service backup(tabler:cloud-upload)[バックアップ] in cloud

  pc:B --> T:files
  pc:R --> L:fw
  fw:R --> L:vpn
  vpn:R --> L:app
  app:B --> T:db
  db:R --> L:backup`,
    title: 'システム構成図'
  },
  {
    code: `gantt
    title プロジェクト工程表
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    section 要件定義
        要件ヒアリング      :done, req1, 2026-04-01, 10d
        要件定義書の作成    :done, req2, after req1, 7d
    section 設計
        基本設計            :active, des1, after req2, 14d
        詳細設計            :des2, after des1, 14d
    section 開発
        実装                :dev1, after des2, 30d
        コードレビュー      :dev2, after dev1, 5d
    section テスト
        結合テスト          :test1, after dev2, 10d
        受入テスト          :test2, after test1, 7d
    section リリース
        本番リリース        :milestone, rel1, after test2, 1d`,
    title: 'プロジェクト工程表'
  },
  {
    code: `flowchart TB
  ceo[代表取締役社長]
  ceo --> sales[営業本部]
  ceo --> dev[開発本部]
  ceo --> admin[管理本部]
  sales --> sales1[第一営業部]
  sales --> sales2[第二営業部]
  dev --> dev1[製品開発部]
  dev --> dev2[品質保証部]
  admin --> hr[人事総務部]
  admin --> acc[経理部]`,
    title: '組織図'
  },
  {
    code: `sequenceDiagram
    autonumber
    participant 各部門
    participant 経理
    participant 経理部長
    participant 経営層
    各部門->>経理: 経費・売上の計上を締める
    経理->>経理: 仕訳を確認し修正
    経理->>各部門: 不明点を照会
    各部門-->>経理: 回答
    経理->>経理部長: 月次試算表を提出
    alt 修正が必要
        経理部長-->>経理: 差戻し
        経理->>経理部長: 修正して再提出
    else 問題なし
        経理部長->>経営層: 月次報告
    end`,
    title: '月次決算フロー'
  },
  {
    code: `kanban
  todo[未着手]
    t1[月次レポートの作成]@{ assigned: '田中' }
    t2[顧客向け提案書]@{ assigned: '鈴木' }
  doing[進行中]
    t3[新システムの要件整理]@{ assigned: '佐藤', priority: 'High' }
    t4[社内研修の企画]@{ assigned: '高橋' }
  review[確認待ち]
    t5[契約書の法務確認]@{ assigned: '伊藤' }
  done[完了]
    t6[週次定例の議事録]@{ assigned: '渡辺' }`,
    title: '業務分担表'
  }
];

export const localSamples: Record<string, SampleExample[]> = {
  [businessTemplatesName]: businessTemplates,
  'System Architecture': [
    {
      code: `architecture-beta
  group dmz(tabler:shield)[DMZ]
  group app(tabler:server-2)[Application]

  service users(tabler:users)[Users]
  service fw(tabler:firewall-check)[Firewall]
  service lb(tabler:load-balancer)[Load balancer] in dmz
  service web(tabler:server)[Web servers] in app
  service db(tabler:database)[Database] in app

  users:R --> L:fw
  fw:R --> L:lb
  lb:R --> L:web
  web:B --> T:db`,
      isDefault: true,
      title: 'Web System'
    },
    {
      code: `architecture-beta
  group office(tabler:building)[Office]

  service internet(tabler:world)[Internet]
  service router(tabler:router)[Router] in office
  service switch(tabler:switch)[Switch] in office
  service ap(tabler:wifi)[Wi-Fi] in office
  service pc(tabler:device-desktop)[PCs] in office
  service printer(tabler:printer)[Printer] in office
  service laptop(tabler:device-laptop)[Laptops] in office

  internet:R --> L:router
  router:R --> L:switch
  switch:R --> L:pc
  switch:B --> T:printer
  switch:T --> B:ap
  ap:R --> L:laptop`,
      title: 'Office Network'
    },
    {
      code: `architecture-beta
  group cloud(lucide:cloud)[Cloud]

  service user(tabler:user)[User]
  service gw(lucide:shield)[API gateway] in cloud
  service app(lucide:container)[Containers] in cloud
  service db(lucide:database)[Database] in cloud
  service files(lucide:hard-drive)[Storage] in cloud

  user:R --> L:gw
  gw:R --> L:app
  app:B --> T:db
  app:R --> L:files`,
      title: 'Cloud (generic)'
    },
    // Only when the logo sets are bundled (iconPacks.ts). `?.`: also read outside Vite (Playwright).
    ...(import.meta.env?.MERMAID_BUNDLE_LOGOS === 'false' ? [] : [awsLogos])
  ],
  Swimlane: [
    {
      code: `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order] --> D{In stock?}
    D -->|Yes| E[Ship]
    D -->|No| F[Back-order]
  end
  subgraph Warehouse
    G[Pick and pack]
  end
  A --> C
  E --> G
  G --> B
  F --> A`,
      isDefault: true,
      title: 'Order Fulfilment'
    },
    {
      code: `swimlane-beta TB
  subgraph Requester
    A[Submit request] --> B[Revise]
  end
  subgraph Manager
    C{Approve?}
  end
  subgraph Finance
    D[Process payment] --> E[Notify requester]
  end
  A --> C
  C -->|No| B
  B --> C
  C -->|Yes| D`,
      title: 'Approval Workflow'
    }
  ]
};
