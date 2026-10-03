# Feature flags for organisational use

This fork ships with upstream's promotional, AI and community features switched off,
and with external diagram rendering disabled. Nothing is deleted: every one of these
is an environment variable, so the behaviour is a build-time setting rather than a
code fork, and re-enabling any of it is a one-line change with no merge cost.

The defaults live in `.env`. Override them per environment (`.env.local` locally, CI
variables in GitLab) — see `docs-dev/GITLAB-PAGES.md` for the deployment side.

## What is off, and what turns it back on

| Variable                                 | Default here | Upstream              | What it controls                                                                                                                                                                                    |
| ---------------------------------------- | ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` | `false`      | `true`                | Promotional banners, "Save to Mermaid Chart", "Contact sales", Edit in Playground, Plugins, the Mermaid Chart menu entry, the AI Repair button beside syntax errors, and the domain-migration modal |
| `MERMAID_IS_ENABLED_AI_FEATURES`         | `false`      | — (added here)        | The in-editor AI prompt popup, its gutter button, and the Visual Edit button                                                                                                                        |
| `MERMAID_IS_ENABLED_COMMUNITY_LINKS`     | `false`      | — (added here)        | The GitHub dropdown in the navbar and the Discord entry in the main menu                                                                                                                            |
| `MERMAID_HIDE_PRIVACY_POLICY`            | `true`       | unset                 | The privacy-policy link in the version toolbar                                                                                                                                                      |
| `MERMAID_RENDERER_URL`                   | empty        | `https://mermaid.ink` | Server-rendered PNG/SVG links and the "Copy Markdown" field                                                                                                                                         |
| `MERMAID_KROKI_RENDERER_URL`             | empty        | `https://kroki.io`    | The Kroki export button                                                                                                                                                                             |
| `MERMAID_ICON_PACKS`                     | empty        | — (added here)        | Extra icon packs the deployment hosts, as `prefix=url` pairs; fetched from those URLs on first use. Empty means bundled packs only (`docs-dev/ICONS.md`)                                            |
| `MERMAID_ANALYTICS_URL`                  | empty        | empty                 | Usage analytics. Already empty upstream, so nothing is sent either way                                                                                                                              |

`plausible-tracker` (the analytics client behind `MERMAID_ANALYTICS_URL`) is deprecated on
npm. It is kept deliberately: `src/lib/util/stats.ts` imports it only when the variable is
set, so with the empty default it is never loaded and nothing is sent. Removing it would edit
upstream code for no behavioural gain; follow upstream if it migrates to a successor.

The two `MERMAID_IS_ENABLED_*` flags added here follow upstream's own convention
(`isEnabledMermaidChartLinks`), read in `src/lib/util/env.ts`. Each reads
`=== 'true'`, so an **unset variable means off** — a forgotten CI variable fails
safe rather than exposing a feature.

## What emptying the renderer URLs does and does not break

`MERMAID_RENDERER_URL` and `MERMAID_KROKI_RENDERER_URL` are the only paths that put
diagram source into a URL sent to a third party. `urls` in
`src/lib/util/state.svelte.ts` returns an empty string for each derived link when its
base URL is empty, and every consumer is already guarded on that value upstream.

Still working, because it runs entirely in the browser:

- **PNG and SVG download** — the download buttons render locally. Verified: clicking
  PNG produces a `mermaid-diagram-<timestamp>.png`.
- **Copy Image** to the clipboard.
- Diagram rendering, sharing by URL, History, and Gist loading.

Gone, because each needs an external renderer:

- The external-link half of the PNG and SVG buttons.
- The Kroki button.
- The "Copy Markdown" field, which embedded a `mermaid.ink` image URL.

To keep image links while staying inside the network, point the variables at
internally hosted mermaid.ink and Kroki instances rather than re-enabling the public
ones.

## Remaining external calls

Two are left, and neither carries diagram content (plus the two the icon features add, below):

- `mermaid.js.org/schemas/config.schema.json` — fetched by the Monaco editor for
  config autocompletion (`src/lib/components/DesktopEditor.svelte`). On a closed
  network the request fails and the editor keeps working without completions.
  `MERMAID_DOCS_URL` controls it, but that same variable also drives the
  Mermaid.js and Documentation menu links, so changing it affects both.
- `api.github.com` — only when someone actually uses **Load Gist**. It is a feature
  the user invokes, not a background call, so it is left enabled.
- The **Icons** card's "Browse icons" link opens `icon-sets.iconify.design` in a new tab
  when clicked. It is a plain link and sends nothing about the diagram.
- `MERMAID_ICON_PACKS` URLs, when a deployment sets them — fetched the first time a diagram
  names that prefix. They are the deployment's own URLs (typically next to the site), empty by
  default; the bundled packs never leave the site (`docs-dev/ICONS.md`).

## Tests

Two upstream e2e tests covered behaviour these defaults remove, and were rewritten to
assert the configured behaviour instead of being skipped:

- `tests/actions.spec.ts` — the "Copy Markdown" test now asserts the off-site link is
  absent, plus a new test that local PNG/SVG export still works.
- `tests/errorDisplay.spec.ts` — the AI Repair test now asserts that a Code-tab syntax
  error is still reported to the user while no AI affordance appears.

Re-enabling a flag will therefore fail these two tests, which is intended: they encode
the organisational guarantee. Update them together with the flag.
