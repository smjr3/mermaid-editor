# Third-party licenses

This project is a derivative of [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor)
(MIT, Copyright (c) 2020 - 2023 Knut Sveidqvist). Upstream's license text is preserved verbatim in
[`LICENSE`](LICENSE); attribution and the components that need an explicit notice are in
[`NOTICE`](NOTICE).

## Scope

This document covers **everything emitted into `docs/` by the build** and therefore redistributed
with the static site. Whether the source package is listed in `dependencies` or `devDependencies`
does not determine whether its code or assets are redistributed.

The production dependency-tree counts below describe the bundled runtime dependency baseline, but
they are not the boundary of the audit. Inspection of the actual build output also identifies code
or assets originating in development dependencies. In this snapshot that includes Font Awesome
fonts, CSS and icons; Iconify icon collections compiled into application code; and Svelte UI
components and their runtime code. Build-only tooling that emits none of its own code or assets is
outside the redistributed output.

## License summary

Production dependency tree at the snapshot described below: **228 packages**.

| Count | License                                    |
| ----: | ------------------------------------------ |
|   159 | MIT                                        |
|    34 | ISC                                        |
|    18 | Apache-2.0                                 |
|     9 | BSD-3-Clause                               |
|     1 | (MPL-2.0 OR Apache-2.0)                    |
|     1 | OFL-1.1                                    |
|     1 | EPL-2.0                                    |
|     1 | (MIT AND Zlib)                             |
|     1 | Unlicense                                  |
|     1 | BSD-2-Clause                               |
|     1 | 0BSD                                       |
|     1 | _reported as Unknown_ (see `khroma` below) |

**No GPL-, AGPL-, LGPL-, SSPL- or CC-BY-SA-licensed package appears anywhere in the production
tree.** Every license above is permissive, or — in the case of EPL-2.0 and MPL-2.0 — file-level
("weak") copyleft that is satisfied by redistributing the component unmodified with its notice.

## Components requiring specific attention

### `elkjs` — EPL-2.0 (Eclipse Public License 2.0)

Reaches this project through `mermaid` itself, which bundles the ELK layout engine since mermaid 12
(it previously came through `@mermaid-js/layout-elk`, no longer a dependency). Its
code **is bundled into the built JavaScript** of the static site, so it is redistributed with every
deployment.

EPL-2.0 is file-level copyleft: it attaches to the EPL-licensed files themselves, not to the rest of
the program that links against them. This project uses `elkjs` **unmodified**, so no source
disclosure obligation is triggered for our own code. The obligation that does apply is notice and
source availability for `elkjs` itself; its unmodified source is published on the npm registry as
the `elkjs` package and at <https://github.com/kieler/elkjs>.

If `elkjs` is ever patched or vendored in modified form, the modified files must be made available
under EPL-2.0 — re-check this section before doing so.

### `dompurify` — dual-licensed, "MPL-2.0 OR Apache-2.0"

A dual license requires the recipient to record which license they take. **This project elects
Apache-2.0**, which carries no file-level copyleft obligation and is straightforwardly compatible
with redistribution under MIT. `dompurify` is used unmodified.

### `@fontsource-variable/recursive` — OFL-1.1 (SIL Open Font License 1.1)

A font, shipped unmodified. OFL-1.1 requires that the license travel with the font files wherever
they are redistributed — including inside the built static site and the npm tarball — and forbids
selling the font on its own. The Reserved Font Name provisions apply only to modified copies; this
project does not modify the font, so no renaming is required.

### `@fortawesome/fontawesome-free` — OFL-1.1, MIT and CC BY 4.0

Font Awesome Free is included through a development dependency, but its fonts, CSS and icons are
emitted into the built static site. Its fonts are licensed under OFL-1.1, its code under MIT, and
its icons under CC BY 4.0. The icons' CC BY 4.0 terms require attribution. Font Awesome Free is
Copyright Fonticons, Inc.; see <https://fontawesome.com/license/free>.

### Iconify icon packs — MIT and ISC

Two generic icon sets are bundled as lazily loaded chunks so diagrams can name icons such as
`tabler:server` (`src/lib/util/iconPacks.ts`, `docs-dev/ICONS.md`): `@iconify-json/tabler`
(Tabler Icons, MIT) and `@iconify-json/lucide` (Lucide, ISC). Both licenses require their notice
to travel with the redistributed icons, which `NOTICE` and this file do. Their few brand and
logo icons are removed when the pack loads, so **no third-party trademark is bundled**; logos
and vendor icon sets reach a diagram only through a pack the deployment hosts or a user imports.

### `khroma` — MIT (reported as "Unknown")

`khroma` ships **no `license` field in its `package.json`**, so license-scanning tools report it as
`Unknown`. The package does contain a `license` file, which reads:

> The MIT License (MIT)
> Copyright (c) 2019-present Fabio Spampinato, Andrew Maney

It is therefore MIT. The discrepancy is recorded here so that a future audit does not mistake a
tooling artifact for an unresolved license.

## Regenerating this audit

```sh
pnpm licenses list --prod          # human-readable
pnpm licenses list --prod --json   # machine-readable
```

The production-tree report is only the starting point. After every build, inspect the JavaScript,
CSS, font, icon and other assets under `docs/`, trace each emitted asset back to its source package,
and include packages from `devDependencies` whenever their code or assets are present. Do not infer
redistribution solely from the dependency section in `package.json`.

## Snapshot caveat

The counts above are a **point-in-time snapshot**, taken against:

- upstream commit `a70ed761a7d040a38f71bf13d999e387f4bf68ca` (upstream version 2.0.67), merged
  on 2026-10-03
- this repository's `pnpm-lock.yaml` after that merge, the move to mermaid 12.1.0, the
  bundled icon packs and the direct `dompurify` dependency (2026-10-03), including its `pnpm.overrides`. mermaid 12.1.0's chevrotain 13
  no longer pulls in `lodash-es@4.17.23`, and Monaco's `dompurify` is overridden to 3.4.16, so a
  single `dompurify` (3.4.16) is installed; the Apache-2.0 election applies to it.

Dependency versions — and therefore this table — will change whenever the lockfile changes.
**Regenerate this file after any dependency update or upstream merge**, and re-check the
"Components requiring specific attention" section for newly introduced copyleft or unknown-license
packages.
