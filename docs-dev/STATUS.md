# Where this fork stands

An index and a handover note. Read this first; each section points at the document that
carries the detail and the reasoning.

Accurate as of **2026-09-27**, including the release dependency refresh (PR #27), the
Monaco DOMPurify override (PR #28), and the upstream merge that brought mermaid 12.

## What this is

`@smjr3/mermaid-editor` is a fork of [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor),
imported at upstream **2.0.67** and last merged from upstream commit `e5e2ca4` (2026-09-22), customised for internal organisational use.

The standing constraints, which shape almost every decision recorded here:

- **Swimlane support** is the reason for the fork. It arrived in mermaid 11.16.0; this
  fork renders with `mermaid ^12.0.0`, so `swimlane-beta` is available. mermaid 12 kept the
  `swimlane-beta` keyword (its detector is unchanged from 11.17.2), so saved diagrams still render.
- **Keep the upstream delta small.** Prefer a feature flag or a wrapper over deleting or
  rewriting upstream code, so a future upstream merge takes their side and re-applies ours.
- **Keep the boundary explicit.** `docs-dev/UPSTREAM.md` holds a regenerated inventory of
  every locally changed path — currently **101**.
- Published to npm, delivered internally through JFrog → internal GitLab → GitLab Pages.

## The documents

| Document                      | What it covers                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `UPSTREAM.md`                 | How the vendor branch works, how to merge an upstream update, the per-area conflict guidance, and the inventory of locally changed paths |
| `FEATURE-FLAGS.md`            | Which surfaces are switched off for organisational use and by which variable                                                             |
| `CROSS-PLATFORM.md`           | Why the build runs on Windows as well as Linux, and what is reasoned rather than executed                                                |
| `THEME.md`                    | The accent palette per mode with measured contrast, and why the dark `--accent-foreground` must not be reverted                          |
| `I18N.md`                     | The message catalogue, `t()` and its interpolation, what stays in English, and how the e2e suite avoids depending on translated text     |
| `PACKAGING.md`                | npm packaging and the tarball → rebuild round trip                                                                                       |
| `GITLAB-PAGES.md`             | The GitLab Pages deployment path                                                                                                         |
| `QUALITY-AUDIT-2026-08-31.md` | An external portability audit, its three findings, and a follow-up for each recording how it was resolved                                |
| `codex/`                      | Task notes from the earlier build-out                                                                                                    |

## What is delivered

All of this is on `master`.

**Base and packaging.** Upstream imported on a `vendor/upstream` branch, derivative-OSS
licensing and attribution in place, npm packaging verified by an actual tarball → install →
rebuild round trip, GitLab Pages build verified twice in one workspace.

**Organisational surfaces off by default** (`FEATURE-FLAGS.md`). Mermaid Chart links, AI
features and community links are switched off by environment variable; `MERMAID_RENDERER_URL`
and `MERMAID_KROKI_RENDERER_URL` are emptied, which closes every path that would put diagram
source into a third-party URL. Local PNG/SVG export still works — it renders in the browser.
Nothing was deleted, so an upstream merge keeps their markup and re-applies the guard.

**The build runs on Windows** (`CROSS-PLATFORM.md`). Three things were genuinely broken, not
merely untested: `mv docs public` in CI, a `postinstall` chain that used `true` as a command,
and the absence of `.gitattributes`. The Windows half is reasoned from mechanism — there is
no Windows host in the development environment — and that document says so and asks for one
real run on the runner.

**Unused files removed.** Upstream's release and hosting helpers, container files, dependency-bot
configs, `SECURITY.md` (which pointed reporters at mermaid.live) and 13 dev dependencies that
nothing loaded are deleted; `UPSTREAM.md` lists them and how to keep a merge from restoring them.

**Theme** (`THEME.md`). Upstream's single pink accent is replaced by one per mode, both at
WCAG AA, with the figures computed rather than eyeballed. The editor follows the operating
system; the toggle overrides it per browser. The Mermaid brand mark is removed from the
navbar, the favicons and `manifest.json`.

**Japanese UI** (`I18N.md`). A dependency-free catalogue, **109 keys**, read through a typed
`t(key, params)`. `en` holds upstream's original wording, so `MERMAID_LOCALE=en` builds the
editor unchanged. Sample diagram names stay in English on purpose — they are keys into
`@mermaid-js/examples`.

**The audit's three findings each have a follow-up** (`QUALITY-AUDIT-2026-08-31.md`), but
"followed up" is not the same as "finished" and the difference matters:

- **Finding 2** (a hoisted test mock) is resolved outright.
- **Finding 3** (Chromium-only e2e) is resolved as a deliverable — Firefox now runs the
  `@smoke` journeys, which in turn exposed a latent CI misconfiguration that only a second
  browser engine could reveal. WebKit is a deliberate exclusion carrying a reopen condition.
- **Finding 1** (dependency advisories) is resolved. The Monaco-specific DOMPurify override that
  closed it has since been removed again: Monaco 0.57.0 depends on the patched
  `dompurify@3.4.15` itself. The production audit reports zero advisories.

## What is open

One standing decision is recorded in `QUALITY-AUDIT-2026-08-31.md` rather than in the issue
tracker — that is where this project tracks findings, and the owner chose to keep it that way.

**The `lodash-es` override.** mermaid 12 depends on `chevrotain ~11.1.2`, which (with two of its
`@chevrotain/*` packages) pins `lodash-es@4.17.23` exactly — vulnerable to a high and a moderate
advisory. `lodash-es@<4.18.0` is overridden to the patched `4.18.1` — twice, because the package is
built with both package managers: `pnpm.overrides` for this repository and a top-level npm
`overrides` for the published tarball, which consumers install with `npm install`; see
`QUALITY-AUDIT-2026-08-31.md`. Remove it once mermaid's chevrotain depends on `lodash-es >=4.18.0`.

**TypeScript held at 6.x.** TypeScript 7 is the native (Go) compiler: its `typescript` package no
longer exposes the compiler API (only a version export and `unstable/*` entry points), and
`svelte-check`, `svelte2tsx` and `typescript-eslint` all declare support up to TypeScript 6
(`<6.1.0` for typescript-eslint). Upgrading would break `pnpm check` and `pnpm lint`. Revisit
when those three support 7. `@types/node` likewise stays on 24.x to match the Node 24 runtime.

**`pako` held at 2.1.0.** pako 3 silently ignores `inflate(..., { to: 'string' })` and returns
bytes, so upgrading as-is breaks every existing shared link; it also changes the deflate bytes,
so the same diagram gets a new URL. 2.1.0 has no advisory and upstream is still on it, so the
upgrade is deferred to an upstream merge. `src/lib/util/serde.compat.test.ts` freezes links
made by 2.1.0 and fails on either change — run it before any pako or js-base64 upgrade.

**Deprecated dependencies, kept on purpose.** `lucide-svelte` (successor `@lucide/svelte`) is
used only by two vendored shadcn-svelte components (`ui/dialog`, `ui/resizable`); it is left
for upstream to migrate so this fork adds no delta. `plausible-tracker` is never loaded while
`MERMAID_ANALYTICS_URL` is empty — see `FEATURE-FLAGS.md`. Revisit either if it stops
installing or picks up an advisory.

**WebKit coverage.** Safari is a documented exclusion, not a silent gap — nothing is known to
be broken there, it simply is not exercised, so it is not claimed. Reopen if any of these
becomes true: a request to support Safari, a macOS or iOS user of this deployment, or a
WebKit-only defect reported by a user.

## Repository conventions worth knowing before changing anything

- **`docs/` is build output** (GitHub Pages convention) and is gitignored. Never edit it.
- **`vendor/upstream` must not be deleted.** It is the base against which upstream updates
  are merged, and `.upstream-version.json` records the commit (`vendorBaseCommit`) the
  inventory is derived from.
- **Regenerate the inventory last, and against the merge base you will actually land on.**
  `UPSTREAM.md`'s table of locally changed paths is produced by the command that document
  names. Two ways it goes stale, both of which have now happened:
  - Regenerating it _before_ the other edits in the same commit leaves it short by exactly
    those edits. Caught in review.
  - Regenerating it on a branch whose base has since moved leaves it short by whatever landed
    on `master` meanwhile — `scripts/dev-force.js` was missed this way. Re-check **after**
    merging, not only before.

  Compare the entries, not the totals: one path added while another is reverted leaves the
  count unchanged and the table still wrong. Compare the **status letter as well as the
  path**: an upstream update that starts tracking a file this fork added flips its row from
  `A` to `M`, which a path-only comparison cannot see.

  `node scripts/check-local-delta.js` does exactly that — the table against
  `git diff --name-status vendorBaseCommit` as a set of status-and-path pairs, the count
  above against the table, and every changed `package.json` key against `UPSTREAM.md`'s
  lists — and exits 1 on any mismatch. Run it as the last step of any change.

- **Node.js 24.16.0** is required (`engines`, and `.node-version`). pnpm 10.34.5 via
  `corepack enable pnpm`.
- eslint enforces alphabetically sorted keys on objects with 5+ keys under `src/`, which the
  message catalogue is subject to.

## Testing

`pnpm test:unit` (vitest, 154 tests) and `pnpm test:e2e` (Playwright).

The e2e suite runs **Chromium** for everything and **Firefox** for six `@smoke`-tagged
journeys — load, edit/render, persistence, embed. `README.md` states the supported-browser
policy.

Two facts that cost time to rediscover:

- `test.slow()` extends a test's _overall_ budget, not the per-assertion `expect` timeout.
  A test marked slow can still fail on a single 5-second assertion.
- The view renders asynchronously — a debounced state update, an async `mermaid.parse`, then
  a render the app deliberately defers for large diagrams. `EditorPage.checkTextInView`
  carries a raised timeout for that reason; `checkTextNotInView` deliberately does not,
  because it asserts absence and returns as soon as the text is gone.

## Known-red check

`Analyze (javascript)` (CodeQL) fails on every pull request: SARIF upload requires code
scanning, which is unavailable while the repository is private. It is not a code defect.

The owner has chosen to tolerate it, and that is a defensible choice — but it is a choice, and
it has a cost worth naming: a permanently red check hides a _new_ CodeQL failure, because
nobody looks at a signal that is always red. The options, so a maintainer is not left thinking
there are only two:

| Option                                    | Effect                                                                                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leave it (current)                        | Every PR shows one red check. Cheapest, and the failure is understood                                                                                                                                                                                    |
| Make the repository public                | The check starts passing; a product decision, not a CI one                                                                                                                                                                                               |
| Disable the workflow from the Actions tab | Stops it running without touching the tree or adding upstream delta; re-enable in one click                                                                                                                                                              |
| Gate the job on repository visibility     | Keeps it in the tree and self-documenting, but edits an upstream file and so adds a path to the local-change inventory. The exact expression needs checking against the events this workflow uses — it triggers on `push`, `pull_request` and `schedule` |

Deleting the workflow is the one option to avoid: it loses the analysis for the day the
repository does go public.
