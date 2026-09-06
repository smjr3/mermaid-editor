# Where this fork stands

An index and a handover note. Read this first; each section points at the document that
carries the detail and the reasoning.

Accurate as of **2026-09-06**, including the release dependency refresh after the merge of PR #25.

## What this is

`@smjr3/mermaid-editor` is a fork of [mermaid-live-editor](https://github.com/mermaid-js/mermaid-live-editor),
imported at upstream **2.0.67**, customised for internal organisational use.

The standing constraints, which shape almost every decision recorded here:

- **Swimlane support** is the reason for the fork. It arrived in mermaid 11.16.0; this
  fork renders with `mermaid ^11.17.2`, so `swimlane-beta` is available.
- **Keep the upstream delta small.** Prefer a feature flag or a wrapper over deleting or
  rewriting upstream code, so a future upstream merge takes their side and re-applies ours.
- **Keep the boundary explicit.** `docs-dev/UPSTREAM.md` holds a regenerated inventory of
  every locally changed path — currently **82**.
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

**Theme** (`THEME.md`). Upstream's single pink accent is replaced by one per mode, both at
WCAG AA, with the figures computed rather than eyeballed. The editor follows the operating
system; the toggle overrides it per browser. The Mermaid brand mark is removed from the
navbar, the favicons and `manifest.json`.

**Japanese UI** (`I18N.md`). A dependency-free catalogue, **105 keys**, read through a typed
`t(key, params)`. `en` holds upstream's original wording, so `MERMAID_LOCALE=en` builds the
editor unchanged. Sample diagram names stay in English on purpose — they are keys into
`@mermaid-js/examples`.

**The audit's three findings each have a follow-up** (`QUALITY-AUDIT-2026-08-31.md`), but
"followed up" is not the same as "finished" and the difference matters:

- **Finding 2** (a hoisted test mock) is resolved outright.
- **Finding 3** (Chromium-only e2e) is resolved as a deliverable — Firefox now runs the
  `@smoke` journeys, which in turn exposed a latent CI misconfiguration that only a second
  browser engine could reveal. WebKit is a deliberate exclusion carrying a reopen condition.
- **Finding 1** (dependency advisories) is resolved. The final Monaco-specific DOMPurify override
  was applied only after separate regression testing; the production audit now reports zero
  advisories.

## What is open

One standing decision is recorded in `QUALITY-AUDIT-2026-08-31.md` rather than in the issue
tracker — that is where this project tracks findings, and the owner chose to keep it that way.

**Monaco's DOMPurify override.** Monaco still pins a vulnerable DOMPurify release, so pnpm now
applies a dependency-specific override to use the patched `dompurify@3.4.15`. The production audit
reports zero advisories. Keep the override covered by editor regression tests, and remove it when
Monaco directly depends on a non-vulnerable DOMPurify release.

**WebKit coverage.** Safari is a documented exclusion, not a silent gap — nothing is known to
be broken there, it simply is not exercised, so it is not claimed. Reopen if any of these
becomes true: a request to support Safari, a macOS or iOS user of this deployment, or a
WebKit-only defect reported by a user.

## Repository conventions worth knowing before changing anything

- **`docs/` is build output** (GitHub Pages convention) and is gitignored. Never edit it.
- **`vendor/upstream` must not be deleted.** It is the base against which upstream updates
  are merged, and `.upstream-version.json` records the commit (`vendorBaseCommit`) the
  inventory is derived from.
- **Regenerate the inventory last.** `UPSTREAM.md`'s table of locally changed paths is
  produced by the command that document names. Regenerating it before other edits in the same
  commit leaves it stale by exactly those edits — that has happened once and was caught in
  review.
- **Node.js 24.16.0** is required (`engines`, and `.node-version`). pnpm 10.34.5 via
  `corepack enable pnpm`.
- eslint enforces alphabetically sorted keys on objects with 5+ keys under `src/`, which the
  message catalogue is subject to.

## Testing

`pnpm test:unit` (vitest, 110 tests) and `pnpm test:e2e` (Playwright).

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
