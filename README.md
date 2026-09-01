# @smjr3/mermaid-editor

A customizable distribution of Mermaid Live Editor — delivered as an npm package and deployable as
a static site.

> **Unofficial derivative.** This project is not affiliated with, endorsed by, or supported by the
> Mermaid team. The official Mermaid Live Editor instance is <https://mermaid.live>.

- Repository: <https://github.com/smjr3/mermaid-editor>
- npm package name: `@smjr3/mermaid-editor`

## 概要

本プロジェクトは [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor) の派生版
（フォーク）です。カスタマイズ可能なディストリビューションとして npm パッケージ
`@smjr3/mermaid-editor` で配布し、静的サイトとしてデプロイできます。

- 上流: mermaid-js/mermaid-live-editor（MIT ライセンス、Copyright (c) 2020 - 2023 Knut Sveidqvist）
- 取り込み元コミット: `990dd241f2acf39c10db9da94464cbb833150426`（上流バージョン 2.0.67）
- 本プロジェクトは**非公式**の派生版です。Mermaid チームによる承認・関連付けはありません。
  公式インスタンスは <https://mermaid.live> です。
- ライセンスは MIT。上流の MIT ライセンスを継承します。詳細は `LICENSE` / `NOTICE` /
  `THIRD-PARTY-LICENSES.md` を参照してください。
- 動作要件: Node.js >= 24.16.0、開発には pnpm が必要です。
- 開発は `pnpm install` の後に `pnpm dev`、ビルドは `pnpm build`（出力先は `docs/`）。
- 上流のオリジナル README は [`README.upstream.md`](README.upstream.md) にそのまま保存しています。

## Attribution

This project is based on **Mermaid Live Editor** by Knut Sveidqvist and contributors, which is
distributed under the MIT License.

- **Upstream project:** Mermaid Live Editor
- **Upstream repository:** <https://github.com/mermaid-js/mermaid-live-editor>
- **Upstream copyright:** Copyright (c) 2020 - 2023 Knut Sveidqvist
- **Upstream license:** MIT
- **Imported commit:** `990dd241f2acf39c10db9da94464cbb833150426` (branch `master`)
- **Upstream version:** 2.0.67
- **Snapshot date:** 2026-08-25

Upstream publishes no git tags, so the import is identified by commit SHA.

## Unofficial derivative

This is an unofficial derivative work. It is **not** affiliated with, endorsed by, or supported by
the Mermaid team or the Mermaid Live Editor maintainers, and nothing here should be read as an
endorsement by them. <https://mermaid.live> is the official Mermaid Live Editor instance — use it
for anything that should reflect the official project. Problems with this distribution belong in
this repository's issue tracker, not upstream's.

## Licensing

This project is released under the **MIT License** and inherits upstream's MIT License.

- [`LICENSE`](LICENSE) — upstream's MIT license text, preserved unmodified, including the original
  copyright line (Copyright (c) 2020 - 2023 Knut Sveidqvist). MIT requires this notice to travel
  with the work, so this file is never edited.
- [`NOTICE`](NOTICE) — redistribution notice: upstream attribution, this project's own copyright
  for material added on top, and the third-party components that require an explicit notice.
- [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) — license summary for the production
  dependency tree that is bundled into the built static site.

## Included feature set

Upstream's editor feature set is included as-is at version 2.0.67:

- Live editing and preview of mermaid diagrams, with inline error markers
- Monaco editor on desktop, CodeMirror on mobile
- Shareable view and edit links — the diagram state is encoded in the URL
- SVG export, PNG/SVG links via the configured renderer, and Kroki links
- Pan/zoom, hand-drawn ("rough") rendering, sample diagrams, and a session diagram history
- Additional layout and renderer plugins: ELK layout, tidy-tree layout, and ZenUML

Rendering uses `mermaid` `^11.17.2`, so the mermaid 11.17 diagram set is available — including
swimlane diagrams (`swimlane-beta`), which were added in mermaid 11.16.0.

## Requirements

- Node.js >= 24.16.0 (declared in `package.json` `engines`; `.node-version` pins 24.16.0)
- [pnpm](https://pnpm.io/) for development — `corepack enable pnpm`

## Supported browsers

| Browser                       | Support       | Covered by CI         |
| ----------------------------- | ------------- | --------------------- |
| Chromium-based (Chrome, Edge) | Supported     | Full end-to-end suite |
| Firefox                       | Supported     | The `@smoke` journeys |
| Safari / WebKit               | Not supported | Not run               |

Chromium carries the full suite because it is where the editor is developed and where
most of this deployment's users are. Firefox runs a smaller set — load, edit/render,
persistence and embed — which is enough to catch a portability break without paying for
a second full run on every pull request. Tests in that set are tagged `@smoke`; the
`firefox` project in `playwright.config.ts` selects them by that tag.

WebKit is deliberately out of scope rather than untested-and-unmentioned. Nothing is
known to be broken there; it simply is not exercised, so it is not claimed. The exclusion
is tracked in `docs-dev/QUALITY-AUDIT-2026-08-31.md` under finding 3, with the condition
that reopens it: any request to support Safari, or any macOS or iOS user of this
deployment. Acting on it is one more project in `playwright.config.ts`, mirroring the
`firefox` one.

## Development

```sh
pnpm install
pnpm dev
```

The dev server runs on <http://localhost:3000>.

## Build

```sh
pnpm build
```

The build produces a static site; output goes to `docs/`.

## Relationship to upstream

The repository is layered so that upstream code and local customization stay separable:

1. **The first commit is a byte-exact import** of the upstream tree at
   `990dd241f2acf39c10db9da94464cbb833150426`. No local edits are mixed into it.
2. **All local changes sit on top of that import** as separate commits, so diffing against the
   import always shows exactly what this distribution changes.
3. **Upstream updates are pulled in via a vendor branch rooted at that import commit.** New
   upstream snapshots land on the vendor branch and are merged forward, which keeps the derivative
   layer intact and keeps merge conflicts limited to files this project actually customizes.

## Upstream README

Upstream's original README is preserved verbatim in [`README.upstream.md`](README.upstream.md).
