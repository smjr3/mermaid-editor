# @smjr3/mermaid-editor

[Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor) の派生版（フォーク）です。
Mermaid 記法で図を書いてその場でプレビューできるエディタを、npm パッケージとして配布し、
静的サイトとしてデプロイできる形にしています。UI は日本語が標準で、画面右下のボタンで英語に
切り替えられます。

> **非公式の派生版です。** Mermaid チームおよび Mermaid Live Editor のメンテナーとは関係がなく、
> 承認やサポートも受けていません。公式のインスタンスは <https://mermaid.live> です。

- リポジトリ: <https://github.com/smjr3/mermaid-editor>
- npm パッケージ: `@smjr3/mermaid-editor`
- English summary: [below](#english)

## 主な機能

上流のエディタの機能（バージョン 2.0.67 時点）をそのまま含みます。

- Mermaid 図のライブ編集とプレビュー、エラー箇所の表示
- デスクトップでは Monaco、モバイルでは CodeMirror のエディタ
- 図の状態を URL に埋め込んだ共有リンク（閲覧用・編集用）
- SVG / PNG の書き出し、設定したレンダラー経由の PNG / SVG リンクと Kroki リンク
- パン・ズーム、手描き風の描画、サンプル図、セッション中の図の履歴
- 追加のレイアウト・レンダラー: ELK、tidy-tree、ZenUML

この派生版で加えたもの:

- **日本語 UI**（標準）と、画面上で切り替えられる英語 UI。選んだ言語はブラウザに保存されます
- **スイムレーン図**（`swimlane-beta`）。描画には `mermaid` `^12.1.0` を使っています。スイムレーン図は
  mermaid 11.16.0 で追加され、mermaid 12 でもキーワードは変わらないため、mermaid 11 で保存した図も
  そのまま描画できます。上流のサンプル集にはないスイムレーンの例を「サンプル図」に加えています
- **外部サービスへの送信を既定で無効化**。Mermaid Chart へのリンク、AI 機能、コミュニティリンク、
  図のソースを第三者の URL に載せるレンダラー連携を、環境変数でオフにしています
  （`docs-dev/FEATURE-FLAGS.md`）。PNG / SVG の書き出しはブラウザ内で描画するので使えます
- **システム構成図のアイコン**。サーバー・データベース・ルーター・スイッチ・ファイアウォール・
  ロードバランサー・端末などのアイコンを `prefix:name` の形で図に使えます（例: `service fw(tabler:firewall-check)[FW]`）。
  OSS のアイコン集 12 種（tabler、lucide、carbon、fluent、flat-color-icons、mdi、ネットワーク・データセンター機器の
  clarity、Kubernetes・DNS・プロキシなどの eos-icons、Microsoft 365 風カラーの fluent-color と、ロゴ集の logos、
  simple-icons、devicon）をサイトに同梱し、外部からは取得しません（例: `logos:aws-lambda`）。
  ロゴを置けない環境では `MERMAID_BUNDLE_LOGOS=false` でロゴを外してビルドできます。
  AWS・Azure・Google Cloud の公式アイコンは、ビルド時に各社のサイトから取り込めます
  （`MERMAID_FETCH_ICON_PACKS`）。リポジトリと npm パッケージにはアイコンのデータを含めていません。
  画面右の「アイコン」から SVG ファイルを取り込むこともできます（`docs-dev/ICONS.md`）。
  「サンプル図」の「System Architecture」に例があります
- **レイアウトの調整**。画面右の「レイアウト」で、図の向き（上→下・左→右・画面に合わせる）、配置方式（標準・ELK）、
  間隔（詰める・標準・広く）を切り替えられます。結果は図のコードと設定に書き込まれるので、共有リンクでも同じ形で表示されます
- **配色**。画面右の「配色」で、テーマ、線の色、スイムレーン（フローチャートのグループ）ごとの色、
  ノード・状態・クラス・エンティティ・要件・ブロック・C4 要素ごとの色、矢印ごとの色（一覧か図のクリックで選択）を
  選べます。用意された色のほか好きな色も選べ、選んだ色は次から色ボタンに並びます。色ボタンは `MERMAID_COLOR_PRESETS` で
  会社の色などに差し替えられます。色はコードに `style` 文として書き込むので、共有リンクでもそのまま再現されます
- **レーン・ノードの追加**。画面右の「追加」で、名前を入れてボタンを押すだけでレーンやノード（入れるレーンと
  矢印の元、形も選べます）をコードに書き足せます。「つなぐ」で既にある2つのノードを矢印でつなげます。アーキテクチャ図では、グループ・サービス（アイコン、入れるグループ、
  つなぐ元と置く位置を選択）・接続を追加できます。シーケンス図・状態図・クラス図・ER図・マインドマップ・ガントチャート・
  円グラフ・カンバン・タイムライン・C4図・ブロック図でも、それぞれの要素（登場人物とメッセージ、タスクなど）を追加できます
- **使い方の案内**。画面右上の「使い方」で、各機能の使い方をまとめた画面が開きます
- **3 つの画面とたたみ方**。左にコード、中央に図、右にツール（レイアウト・追加・編集・配色・アイコン・サンプル図・操作）が並びます。
  コードの上部とツールの上部のボタンで、それぞれをアイコンだけの細い列にたためます。アイコンを押すとその項目を開いて戻ります。
  コードを書かない人はコードを、コードだけ書く人はツールをたたむと広く使えます
- **アイコンを探して入れる**。「アイコン」で名前を検索すると絵が一覧で出て、クリックするとコードのカーソル位置に
  `logos:aws-lambda` のような名前が入ります。名前が分からなくても「一覧から選ぶ」で、分類（サーバー・ストレージ、
  ネットワーク機器、セキュリティ、Microsoft 365、AWS / Azure / Google Cloud など 12 種）ごと、または
  アイコン集をまるごと 200 個ずつ見て選べます。「大きく表示」で広い画面から名前付きで選ぶこともできます。
  緑の印は Mermaid 標準のアイコン（GitLab などでも表示）、橙の印は拡張アイコン（このエディタだけで表示）です
- **HTML で書き出し**。「操作」の「HTML」で、図を入れた HTML ファイルを保存できます（ネットなしで開け、元のコードも入ります）。
  「HTMLタグをコピー」は、Wiki やメールなどに貼れる `<img>` タグ1つを作ります。どちらもアイコンごと図に入っています
- **GitLab 用に書き出し**。「操作」の「GitLab 用に書き出し」で、図を SVG で保存し、それを表示する Markdown（編集リンクと元のコード付き）を
  コピーします。SVG をリポジトリのページと同じ場所に置き、Markdown を貼り付けると、アイコン入りの図がそのまま表示されます
- **ダークモードの見やすさ**。ダークモードでは図の線を明るく描き、明るいテーマの図にはライトグレーの下地を付けます
- **名前の一括変更**。エディタでノード名などにカーソルを置いて F2 を押すと、使われている箇所をまとめて
  書き換えます（ラベルの文字やメッセージは変えません）。同じ語を順に選ぶ Ctrl+D、すべて選ぶ
  Ctrl+Shift+L、Alt+クリックでの複数カーソルも使えます
- **設定のリセット**。「設定」タブの「設定をリセット」で、壊れた設定を初期状態に戻せます（図のコードは残ります）
- デスクトップでは、コード・図・ツールを固定の 3 画面に分け、境目をドラッグして幅を変えられます（幅はブラウザに保存）。
  拡大・縮小、手描き風、グリッド、ライト / ダーク、言語の切り替えは図の上の 1 本のツールバーにまとめています
- ライト / ダークそれぞれで WCAG AA を満たすアクセントカラー（`docs-dev/THEME.md`）
- Windows でもビルドできるスクリプト構成（`docs-dev/CROSS-PLATFORM.md`）

## 動作要件

- Node.js 24.16.0 以上（`package.json` の `engines`。`.node-version` は 24.16.0 を指定）
- 開発には [pnpm](https://pnpm.io/) が必要です（`corepack enable pnpm`）

## 使い方

### 開発

```sh
pnpm install
pnpm dev
```

開発サーバーは <http://localhost:3000> で起動します。

### ビルド

```sh
pnpm build
```

静的サイトが `docs/` に出力されます。

### npm パッケージから使う

パッケージにはビルド済みのサイトではなくソースが入っています。空のディレクトリで展開して
ビルドします。

```sh
npm pack @smjr3/mermaid-editor
tar -xzf smjr3-mermaid-editor-*.tgz --strip-components=1
npm install
npm run build
```

詳しくは `docs-dev/PACKAGING.md` を参照してください。

### 設定

ビルド時の環境変数（`MERMAID_` で始まるもの）で挙動を変えられます。既定値は `.env` にあり、
ローカルでは `.env.local` にコピーして上書きします。

| 変数                                                  | 既定    | 内容                                                                                             |
| ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `MERMAID_LOCALE`                                      | `ja`    | UI の標準言語（`ja` / `en`）。閲覧者が画面で選んだ言語はこれより優先されます                     |
| `MERMAID_IS_ENABLED_*`                                | `false` | Mermaid Chart リンク、AI 機能、コミュニティリンクの有効化                                        |
| `MERMAID_RENDERER_URL` / `MERMAID_KROKI_RENDERER_URL` | 空      | 外部レンダラー（mermaid.ink / Kroki）の URL。空なら連携を無効化                                  |
| `MERMAID_BUNDLE_LOGOS`                                | `true`  | `false` でロゴのアイコン集を同梱しない                                                           |
| `MERMAID_FETCH_ICON_PACKS`                            | 空      | ビルド時に取り込む各社アイコン（`gcp=<zip の URL>` など）                                        |
| `MERMAID_OFFLINE`                                     | `true`  | サイトから外部へ通信しない（設定の補完用スキーマ取得、SVG 内の CDN 参照、Gist 読み込みを無効化） |

全体は `docs-dev/FEATURE-FLAGS.md` を参照してください。

## 対応ブラウザ

| ブラウザ                    | 対応   | CI での確認                 |
| --------------------------- | ------ | --------------------------- |
| Chromium 系（Chrome、Edge） | 対応   | e2e テスト一式              |
| Firefox                     | 対応   | `@smoke` タグの主要シナリオ |
| Safari / WebKit             | 対象外 | 実行していません            |

Firefox では、読み込み、編集と描画、保存、埋め込み、スイムレーン描画といった主要なシナリオ
だけを実行しています（`playwright.config.ts` の `firefox` プロジェクトが `@smoke` タグで選択）。

Safari / WebKit は意図的に対象外としています。壊れていることが分かっているわけではなく、
確認していないので対応をうたっていない、という位置付けです。Safari への対応要望や macOS /
iOS の利用者が出てきたら見直します（`docs-dev/QUALITY-AUDIT-2026-08-31.md` の finding 3）。

## ライセンスと帰属表示

MIT ライセンスです。上流の MIT ライセンスを継承しています。

- [`LICENSE`](LICENSE) — 上流の MIT ライセンス本文。元の著作権表示（Copyright (c) 2020 - 2023
  Knut Sveidqvist）を含め、改変せずに保持しています
- [`NOTICE`](NOTICE) — 再配布のための通知。上流の帰属表示、この派生版で加えた部分の著作権、
  明示的な通知が必要なサードパーティ部品
- [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) — ビルドしたサイトに含まれる本番依存の
  ライセンス一覧

上流の情報:

- **プロジェクト:** Mermaid Live Editor（Knut Sveidqvist ほか）
- **リポジトリ:** <https://github.com/mermaid-js/mermaid-live-editor>
- **著作権:** Copyright (c) 2020 - 2023 Knut Sveidqvist
- **ライセンス:** MIT
- **取り込み元コミット:** `a70ed761a7d040a38f71bf13d999e387f4bf68ca`（ブランチ `master`）
- **上流バージョン:** 2.0.67
- **取り込み日:** 2026-10-03（初回取り込みは 2026-08-25、`990dd241f2acf39c10db9da94464cbb833150426`）

上流は git タグを付けていないため、取り込み元はコミット SHA で識別しています。

この派生版の不具合は、上流ではなくこのリポジトリの issue tracker に報告してください。

## 上流との関係

上流のコードとこの派生版の変更を分けて管理しています。

1. **最初のコミットは上流ツリーをそのまま取り込んだもの**です
   （`990dd241f2acf39c10db9da94464cbb833150426`）。ローカルの変更は混ぜていません。
2. **ローカルの変更はすべてその上に別コミットで積んでいます。** 現在の取り込み基点
   （`.upstream-version.json` の `vendorBaseCommit`）との差分が、この派生版の変更そのものです。
3. **上流の更新は vendor ブランチ経由で取り込みます。** 新しい上流のスナップショットを vendor
   ブランチに置いてからマージするので、競合はこの派生版が変更したファイルに限られます。

手順と変更ファイルの一覧は `docs-dev/UPSTREAM.md` にあります。上流のオリジナル README は
[`README.upstream.md`](README.upstream.md) にそのまま保存しています。

## English

A distribution of [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor),
published as the npm package `@smjr3/mermaid-editor` and deployable as a static site. The UI is
Japanese by default; the button at the bottom right of the editor switches it to English, and the
choice is remembered in the browser. Builds can change the default with `MERMAID_LOCALE=en`.

> **Unofficial derivative.** This project is not affiliated with, endorsed by, or supported by the
> Mermaid team or the Mermaid Live Editor maintainers. The official instance is
> <https://mermaid.live>. Report problems with this distribution in this repository's issue
> tracker, not upstream's.

- Includes upstream's editor feature set as of 2.0.67, rendering with `mermaid` `^12.1.0` —
  including swimlane diagrams (`swimlane-beta`), with swimlane examples in the sample panel.
- Twelve bundled OSS icon packs for system diagrams — network and data-centre gear (`clarity`),
  Kubernetes and DNS/proxy concepts (`eos-icons`) and Microsoft's colour Fluent icons
  (`fluent-color`) among them — logo sets included (e.g.
  `service fw(tabler:firewall-check)[FW]`, `logos:aws-lambda`), loaded from the site, never a
  CDN; `MERMAID_BUNDLE_LOGOS=false` leaves the logos out. Vendor architecture icon sets (AWS,
  Azure, Google Cloud) are imported from the vendor at build time
  (`MERMAID_FETCH_ICON_PACKS`), so neither the repository nor the npm package carries icon data
  (`docs-dev/ICONS.md`).
- A "Layout" card sets the direction (top-to-bottom, left-to-right, or fit to view), the layout
  engine (standard / ELK) and the spacing, written into the code and the config.
- A "Colours" card picks the theme, the line colour and a colour per swimlane lane (or flowchart
  subgraph) and per object — node, state, class, entity, requirement, block or C4 element (picked from a list or
  by clicking it) and per arrow; any colour can be picked, and picked colours are offered again. The
  colour buttons can be a company palette (`MERMAID_COLOR_PRESETS`).
- An "Add" card adds a lane, or a node (box, decision, …) in a lane joined from another node, or an arrow
  between two nodes, without writing the syntax;
  for architecture diagrams it adds groups, services (icon, group, side to join on) and connections,
  and sequence, state, class, ER, mindmap, gantt, pie, kanban, timeline, C4 and block diagrams get
  their own forms (participants and messages, tasks, topics, …).
- A "How to use" button in the header opens a short guide to the tools.
- The editor column collapses to an icon rail, and a bar hides the tool cards. An icon picker
  searches the packs, or lets you browse twelve hand-picked categories (servers, network
  equipment, security, Microsoft 365, AWS / Azure / Google Cloud, …) or a whole pack 200 icons a
  page, and inserts the clicked icon's name at the cursor. In dark mode, lines are
  drawn brighter and light-themed diagrams get a light grey background.
- HTML export: a standalone page (works offline, keeps the source) or one self-contained `<img>`
  tag to paste anywhere, icons included. "Export for GitLab" saves an SVG and copies Markdown that
  shows it, links back to the editor and keeps the source.
- F2 renames a node id everywhere it is used; the config tab can reset a broken config; on
  desktop the editor and the view are fixed panes split by a draggable divider.
- Mermaid Chart links, AI features, community links and third-party renderer integrations are
  switched off by default (`docs-dev/FEATURE-FLAGS.md`); local PNG/SVG export still works.
- Requires Node.js >= 24.16.0; use pnpm for development (`pnpm install`, `pnpm dev`,
  `pnpm build` → `docs/`). See `docs-dev/PACKAGING.md` to build from the npm package.
- MIT licensed, inheriting upstream's MIT license (Copyright (c) 2020 - 2023 Knut Sveidqvist);
  see `LICENSE`, `NOTICE` and `THIRD-PARTY-LICENSES.md`. Imported from upstream commit
  `a70ed761a7d040a38f71bf13d999e387f4bf68ca` (version 2.0.67); the procedure for following
  upstream is in `docs-dev/UPSTREAM.md`, and upstream's own README is kept in
  [`README.upstream.md`](README.upstream.md).
