# Third-party licenses

This project is a derivative of [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor)
(MIT, Copyright (c) 2020 - 2023 Knut Sveidqvist). Upstream's license text is preserved verbatim in
[`LICENSE`](LICENSE); attribution and the components that need an explicit notice are in
[`NOTICE`](NOTICE).

## Scope

This document covers the **production dependency tree** — the packages whose code is bundled into
the built static site and therefore redistributed with it.

Development-only dependencies (the build toolchain: Vite, SvelteKit, ESLint, Playwright, Vitest and
so on) are **not** covered here. They are not redistributed in the build output, and they are not
present in the published npm tarball's dependency closure at runtime.

## License summary

Production dependency tree at the snapshot described below: **306 packages**.

| Count | License                                    |
| ----: | ------------------------------------------ |
|   234 | MIT                                        |
|    38 | ISC                                        |
|    15 | Apache-2.0                                 |
|    11 | BSD-3-Clause                               |
|     1 | OFL-1.1                                    |
|     1 | (MPL-2.0 OR Apache-2.0)                    |
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

Reaches this project through `@mermaid-js/layout-elk`, which provides the ELK layout engine. Its
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

## Snapshot caveat

The counts above are a **point-in-time snapshot**, taken against:

- upstream commit `990dd241f2acf39c10db9da94464cbb833150426` (upstream version 2.0.67)
- the `pnpm-lock.yaml` committed at that upstream commit

Dependency versions — and therefore this table — will change whenever the lockfile changes.
**Regenerate this file after any dependency update or upstream merge**, and re-check the
"Components requiring specific attention" section for newly introduced copyleft or unknown-license
packages.
