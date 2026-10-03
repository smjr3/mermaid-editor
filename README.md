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
  同梱しているのは OSS の汎用アイコン集 tabler（MIT）と lucide（ISC）だけで、企業ロゴや商標は含めていません。
  サイトに同梱していて、外部から取得しません。AWS・Azure などの各社アイコンを使いたい場合は、社内で利用を確認したうえで、
  画面左の「アイコン」から SVG ファイルを取り込むか、GitLab Pages に置いて `MERMAID_ICON_PACKS` で読み込めます
  （`docs-dev/ICONS.md`）。「サンプル図」の「System Architecture」に例があります
- **名前の一括変更**。エディタでノード名などにカーソルを置いて F2 を押すと、使われている箇所をまとめて
  書き換えます（ラベルの文字やメッセージは変えません）。同じ語を順に選ぶ Ctrl+D、すべて選ぶ
  Ctrl+Shift+L、Alt+クリックでの複数カーソルも使えます
- **設定のリセット**。「設定」タブの「設定をリセット」で、壊れた設定を初期状態に戻せます（図のコードは残ります）
- デスクトップでは、エディタと図の表示を固定の 2 画面に分け、境目をドラッグして幅を変えられます
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

| 変数                                                  | 既定    | 内容                                                                         |
| ----------------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `MERMAID_LOCALE`                                      | `ja`    | UI の標準言語（`ja` / `en`）。閲覧者が画面で選んだ言語はこれより優先されます |
| `MERMAID_IS_ENABLED_*`                                | `false` | Mermaid Chart リンク、AI 機能、コミュニティリンクの有効化                    |
| `MERMAID_RENDERER_URL` / `MERMAID_KROKI_RENDERER_URL` | 空      | 外部レンダラー（mermaid.ink / Kroki）の URL。空なら連携を無効化              |

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
- Bundled generic OSS icon packs for system diagrams (`tabler`, `lucide`; e.g.
  `service fw(tabler:firewall-check)[FW]`), loaded from the site, never a CDN. No logos or
  trademarks are bundled; vendor icon sets can be imported in the browser or hosted by the
  deployment (`docs-dev/ICONS.md`).
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
