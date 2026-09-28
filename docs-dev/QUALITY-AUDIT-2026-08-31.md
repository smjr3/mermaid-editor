# Quality audit — 2026-08-31

## Conclusion

The application builds, passes type and formatting checks, and passes all 104 unit tests. Three
follow-up issues were confirmed: production dependency advisories, a unit-test mock that Vitest
warns will become an error, and a browser/OS coverage gap in end-to-end CI.

This review deliberately separates confirmed results from environment limitations. The required
Node.js 24.16.0 runtime, Docker, and Playwright's Chromium binary were not available in the review
environment. No failure caused by those missing tools is reported as an application defect.

## Scope and method

The review covered:

- reproducible installation from `pnpm-lock.yaml`;
- formatting, static analysis, type checking, unit tests, and production builds;
- production dependency advisories and tracked secret-like files;
- static-site, npm-package, Docker, and CI configuration;
- CI coverage across operating systems and browsers;
- empty/corrupt persisted data tests already present in the project.

The commands below used Node.js 24.15.0 with the engine check explicitly relaxed because the
project requires 24.16.0. This is close enough to find likely problems, but it is not a substitute
for the required runtime in release verification.

## Confirmed findings (ready-to-post issue drafts)

### 1. Production dependency audit reports 26 advisories

**Suggested title:** `Audit and update vulnerable transitive production dependencies`

**Observed result**

`pnpm --config.engine-strict=false audit --prod` exits unsuccessfully and reports 26 advisories:
3 high, 17 moderate, and 6 low. Confirmed dependency paths include:

- `@mermaid-js/mermaid-zenuml -> @zenuml/core -> tailwindcss -> postcss -> nanoid`;
- `monaco-editor -> dompurify`;
- `@mermaid-js/mermaid-zenuml -> @zenuml/core -> dompurify`.

The reported versions include `nanoid@3.3.12`, `postcss@8.5.15`, `dompurify@3.2.7`, and
`dompurify@3.4.8`. An audit report proves that vulnerable versions are installed; it does **not**
by itself prove that every reported vulnerable code path is reachable in this application.

**Why this matters**

This editor processes user-authored diagram text in a browser. DOM sanitization advisories deserve
prompt reachability analysis because unsafe markup handling could affect users viewing a diagram.

**Recommended next steps**

1. Update the direct parent packages where compatible releases are available; do not force a
   transitive version without checking compatibility.
2. Re-run the production audit and the full unit/end-to-end suite.
3. For advisories that remain, document whether the affected API is reachable in the shipped
   browser bundle and record a review date.
4. Add `pnpm audit --prod` (or an equivalent monitored dependency scanner) to scheduled CI so a
   fresh clone does not rely on a developer remembering to run it.

**Acceptance criteria**

- No unresolved high-severity production advisory remains without a written reachability and risk
  decision.
- Dependency updates pass type checks, unit tests, builds, and browser tests.

### 2. Vitest warns that the setup mock will become an error

**Suggested title:** `Move the $app/environment mock to top level before a Vitest upgrade`

**Observed result**

`pnpm --config.engine-strict=false exec vitest run` passes 104 tests but warns that the
`vi.mock('$app/environment', ...)` call in `src/tests/setup.ts` is nested in `beforeAll`. Vitest
hoists module mocks and says this pattern will become an error in a future version.

**Why this matters**

The suite is green today, but a routine test-runner update can stop every unit test before it runs.
That would make later application changes harder to verify.

**Recommended next steps**

1. Move the mock to module scope so the source matches Vitest's actual execution order.
2. Preserve the existing dynamic browser value if tests depend on it.
3. Run all unit tests, not only the setup-file-related tests.

**Acceptance criteria**

- All 104 unit tests pass.
- The non-top-level `vi.mock` warning is absent.

### 3. End-to-end CI checks only Chromium on Linux

**Suggested title:** `Add a small cross-browser portability test matrix`

**Observed result**

`playwright.config.ts` defines only the `chromium` project. The GitHub workflow runs in one Linux
Playwright container. There is therefore no automated check for Firefox, WebKit/Safari behavior,
or an operating-system-specific path/clipboard/download difference.

**Why this matters**

The editor uses browser features including clipboard access, downloads, local storage, workers,
canvas, and SVG. These are common sources of differences after moving a web application to another
browser or desktop environment.

**Recommended next steps**

Start small to avoid unnecessary CI cost:

1. Run the existing smoke journeys (load, edit/render, persistence, and embed) in Chromium,
   Firefox, and WebKit on Linux.
2. Keep the full suite in Chromium initially.
3. Add one Windows job only for path/download/clipboard journeys if Linux cross-browser runs reveal
   insufficient coverage or Windows is a supported development target.

**Acceptance criteria**

- The core smoke journeys run in Chromium, Firefox, and WebKit.
- Browser-specific exclusions include a reason and tracking issue.
- The README states the browsers officially supported by the project.

## Checks that passed

- Frozen-lockfile installation completed, so dependency resolution is reproducible with the lock.
- `svelte-check` reported 0 errors and 0 warnings.
- Prettier and ESLint completed successfully.
- Vitest passed 11 files and 104 tests; the warning above remains.
- The production static build completed and wrote `docs/`.
- The repository pattern scan found no tracked private key, token, password, or credential file.
  The tracked `.env` contains public build defaults and external service URLs, not credentials.
- Existing persistence tests cover corrupt JSON, `undefined`, `null`, removal, and round trips.

## Environment limitations and unverified items

- **Required Node.js:** only 24.15.0 was available, while the repository requires 24.16.0. All pnpm
  checks above therefore used `--config.engine-strict=false`. Release behavior on 24.16.0 remains
  unverified here.
- **Browser binary:** the end-to-end command could start the development server, but Playwright
  could not launch Chromium because its downloaded browser binary was absent. This is an
  environment limitation, not a failed application assertion.
- **Docker:** neither Docker nor Podman was installed, so the multi-stage image and compose service
  were reviewed statically but not built or started.
- **Other operating systems/browsers:** Windows, macOS, Firefox, WebKit/Safari, mobile devices, and
  assistive technologies were not available in this environment.
- **GitHub-hosted checks:** CodeQL and the actual GitHub Actions jobs were not run locally.
- **Prior timeout:** the previously reported migration-test timeout did not reproduce; all unit
  tests passed in 30.16 seconds and their test bodies took 2.07 seconds in total. It should be
  monitored rather than treated as a confirmed current defect.

## Suggested priority

1. Dependency advisories — security-sensitive and already reproducible.
2. Vitest mock placement — small preventive maintenance before an upgrade.
3. Cross-browser matrix — portability protection, introduced incrementally to control CI cost.

---

## Follow-up — reachability of finding 1 (2026-09-01)

Finding 1 asks for the step an audit report cannot take on its own: whether the vulnerable code is
reachable in the shipped bundle. This section records that check on Node.js 24.16.0, the runtime the
project actually requires, which was unavailable when the audit above was written.

`pnpm audit --prod` still reports **26 advisories — 3 high, 17 moderate, 6 low**, unchanged. Grouping
them by path, though, changes the priority order the audit proposes.

### The three high-severity advisories do not ship

All three resolve to one build-time path:

```
@mermaid-js/mermaid-zenuml -> @zenuml/core -> tailwindcss -> postcss -> nanoid   (2 × nanoid)
@mermaid-js/mermaid-zenuml -> @zenuml/core -> tailwindcss -> postcss             (1 × postcss)
```

PostCSS and nanoid are a CSS toolchain that runs at build time. Searching the whole 27 MB production
build — 346 files, all types, no compressed archives — finds **zero** occurrences of `nanoid`,
`urlAlphabet`, `postcss`, or `tailwindcss/lib`. The same search finds 9 occurrences of
`DOMPurify`/`createPolicy`, so the method does detect a library that is present.

These three are therefore exposure of the **build machine**, not of anyone using the editor. That is
still worth patching, but it is a different risk class from the one "3 high advisories in production
dependencies" suggests, and it should not outrank a shipped moderate.

### DOMPurify does ship, and its attribution is unresolved

Every remaining advisory (all 17 moderate and all 6 low) is DOMPurify. Two versions are installed:

| Version | Reached via                       |
| ------- | --------------------------------- |
| 3.2.7   | `monaco-editor@0.55.1`            |
| 3.4.8   | `mermaid@11.17.2`, `@zenuml/core` |

DOMPurify is present in the built output, in both the Monaco vendor chunk and the mermaid chunks.
Which installed copy each advisory applies to is **not** established here: the copies are minified
with renamed identifiers, so attributing a bundled copy to a version needs more than a string search,
and the answer decides whether any of these are live for editor users.

Treat this as the open half of finding 1. It is the part that matters for users, and it is unfinished.

### What this changes

The audit's suggested priority stands, with one correction inside item 1: the high-severity count is
build-machine exposure, and the user-facing question is the DOMPurify attribution above.

Findings 2 and 3 were open when this section was written and have since been resolved; see the two
follow-ups below.

## Follow-up — finding 2 resolved (2026-09-01)

`vi.mock('$app/environment', …)` moved from inside `beforeAll` to module scope in
`src/tests/setup.ts`. Vitest hoists `vi.mock` above every import wherever it is written, so the
wrapper never delayed anything — it only hid the real execution order from the reader.

The factory is unchanged, so `browser: 'window' in globalThis` still resolves lazily on first
import, at the same moment as before. The audit asked for that dynamic value to be preserved.

**Both acceptance criteria are met:** all unit tests pass (110 now, up from the 104 the audit saw)
and the non-top-level `vi.mock` warning is absent from the output.

## Follow-up — finding 3 resolved as Chromium + Firefox (2026-09-01)

The acceptance criteria for finding 3 include a statement of which browsers the project
officially supports. That is a policy decision, not a technical one, and it was made:
**Chromium-based browsers and Firefox are supported; WebKit is not.** `README.md` says so
in a table, which is where a user looks.

What changed:

- `playwright.config.ts` gains a `firefox` project selecting `grep: /@smoke/`. Chromium
  keeps the full suite, per the audit's own advice to start small.
- Six tests carry `{ tag: '@smoke' }`, one or two per journey the audit names — load
  (`Check Home page load`, `should load compressed URL`), edit/render
  (`supports commenting code out/in`), persistence (`should keep code after reload`,
  `loads Saved and Timeline history from localStorage and restores entries`) and embed
  (`should render a diagram from the URL hash with footer links`).
- `permissions: ['clipboard-read', 'clipboard-write']` moves from the shared `use` into
  the `chromium` project. Those permission names are Chromium-only and Playwright rejects
  them when granting on Firefox, so leaving them shared would have failed every Firefox
  test at context creation, before a single assertion ran.

### WebKit, and why it is an exclusion rather than a gap

Nothing is known to be broken in WebKit. It is simply not exercised, so it is not claimed
— which is the honest form of the audit's "browser-specific exclusions include a reason".
The deployment this fork serves is Windows-centric; Safari is not on the path.

**Open item — WebKit coverage.** The audit asks an exclusion to carry a tracking issue as
well as a reason. This repository tracks its findings in this document rather than in the
issue tracker: the audit itself was written as "ready-to-post issue drafts" because the
reviewing environment held no credentials to file them. So the exclusion is recorded here,
with the condition that reopens it rather than an open-ended "someday":

> Reopen if any of these becomes true — a request to support Safari, a macOS or iOS user
> of this deployment, or a WebKit-only defect reported by a user. The work is one more
> project in `playwright.config.ts` mirroring the `firefox` one, plus a row in the
> README's supported-browser table.

If the project later moves finding tracking into GitHub issues, this item and the DOMPurify
attribution above are the two that should be filed.

### What is not verified here

Firefox is **not installed in the development sandbox** — only Chromium 1194 is. The
Firefox project's test selection was verified locally (`--list --project=firefox` returns
exactly the six tagged tests) and the full Chromium suite was re-run against the reworked
config with no change in results. But whether those six journeys actually _pass_ in
Firefox is unknown until CI runs them, because CI's
`mcr.microsoft.com/playwright:v1.60.0-jammy` image is the only place a Firefox binary
exists. A first red run there is information, not a regression: it is the portability gap
this finding was opened to expose.

## Follow-up — release dependency refresh (2026-09-06)

The lockfile was refreshed within the version ranges already allowed by `package.json`. This
updates the affected transitive packages without adding an override or changing the application's
declared direct dependencies:

| Package                    | Before | After  |
| -------------------------- | ------ | ------ |
| `dompurify` (Mermaid path) | 3.4.8  | 3.4.15 |
| `postcss`                  | 8.5.15 | 8.5.28 |
| `nanoid`                   | 3.3.12 | 3.3.18 |
| `postcss-selector-parser`  | 6.1.2  | 6.1.4  |

`pnpm audit --prod` now reports **18 advisories — 0 high, 14 moderate, and 4 low**, down
from 27 advisories (3 high, 17 moderate, and 7 low) immediately before this refresh. The high
severity `postcss` and `nanoid` findings are resolved, as are the findings against the Mermaid
copy of DOMPurify and the affected `postcss-selector-parser` copy.

Every remaining advisory follows the single path `monaco-editor@0.55.1 -> dompurify@3.2.7`.
Monaco pins that version exactly rather than accepting a compatible range. This refresh therefore
does not force a different DOMPurify version underneath Monaco: doing so without upstream
compatibility evidence would exchange a known security finding for an unmeasured editor risk.
Revisit the remaining findings when Monaco publishes a compatible update, or separately test and
document an override before applying one.

The required-runtime checks passed after the refresh: type checking, linting, all 110 unit tests,
and the production build. The Playwright browser download was blocked by a `403 Domain forbidden`
response from the browser CDN in this environment, so end-to-end execution remains a CI check and
must not be represented as locally verified for this release.

## Follow-up — resolve the remaining production advisories (2026-09-06)

The remaining advisories were resolved by adding a narrowly scoped pnpm override for only
`monaco-editor -> dompurify`. It replaces Monaco's pinned `dompurify@3.2.7` with the patched
`dompurify@3.4.15` already used by the Mermaid dependency paths. Monaco remains at `0.55.1`, so
this change does not introduce unrelated editor features or a broader Monaco upgrade.

After regenerating the lockfile, only one DOMPurify version is installed. `pnpm audit --prod`
reports **0 advisories — 0 critical, 0 high, 0 moderate, and 0 low**. The override is intentionally
kept specific to Monaco so future dependency changes remain visible instead of silently replacing
every DOMPurify requirement in the graph.

Because an override changes an upstream package's exact dependency, it requires regression checks
rather than being treated as risk-free. Type checking, linting, unit tests, the production build,
and available editor-focused browser tests must pass before release; the override should also be
removed once Monaco directly depends on a non-vulnerable DOMPurify release.

## Follow-up — mermaid 12 reintroduces a `lodash-es` advisory (2026-09-27)

The upstream merge that moved to `mermaid ^12.0.0` brought `chevrotain@11.1.2` (mermaid pins
`~11.1.2`). `chevrotain`, `@chevrotain/gast` and `@chevrotain/cst-dts-gen` each depend on
`lodash-es@4.17.23` exactly, and `pnpm audit --prod` reported **2 advisories — 1 high
(code injection via `_.template`) and 1 moderate (prototype pollution)**, both patched in
`lodash-es >=4.18.0`. The project's own direct dependency was already on `4.18.1`.

Three parents pin the same version, so a parent-scoped override in the style of
`monaco-editor>dompurify` would need three entries and miss any fourth. The override is scoped by
version instead: `lodash-es@<4.18.0` → `4.18.1`. It touches only copies inside the vulnerable
range, so a future `lodash-es` that is already patched is left alone. After regenerating the
lockfile only `lodash-es@4.18.1` is installed and `pnpm audit --prod` reports **0 advisories**.

`4.18.x` is a minor release of the same API. The unit suite does not parse diagrams, so the
regression check targeted the chevrotain paths directly: every one of the 79 sample diagrams in
`@mermaid-js/examples` was rendered in the editor (headless Chromium) with no parse error, no
error state in the view and no console error. That includes the chevrotain-parsed types — pie,
packet, gitGraph, architecture, radar, treemap. The Chromium e2e suite passed as well. Remove the
override once mermaid's `chevrotain` depends on `lodash-es >=4.18.0`.

## Follow-up — Monaco override removed (2026-09-27)

`monaco-editor` 0.57.0 depends on `dompurify@3.4.15` directly (its changelog: "Updates bundled
DOMPurify from 3.4.8 to 3.4.15"). That is the removal condition recorded above, so the project
moved from 0.55.1 to 0.57.0 and deleted the `monaco-editor>dompurify` override. After
regenerating the lockfile `pnpm audit --prod` still reports **0 advisories**; Monaco resolves
`dompurify@3.4.15` on its own, and mermaid/ZenUML resolve `3.4.16`.

Monaco 0.56 moved its ESM modules behind a package `exports` map, which broke the build on the old
`monaco-editor/esm/vs/.../*.worker` import paths; the two worker imports in
`DesktopEditor.svelte` now use the new entry points. Editor regression checks: type checking,
the production build (the same worker set is emitted as before), the Chromium e2e suite, and a
manual check in the editor that the custom `mermaid` language still tokenises and that syntax
errors still produce error markers. (The registered completion provider intentionally returns no
suggestions, before and after.)

Because upstream is still on Monaco 0.55.1, `UPSTREAM.md` now records that an upstream merge must
not take Monaco back below 0.57.0.

## Follow-up — the npm install path bypassed the overrides (2026-09-28)

The overrides above were written as `pnpm.overrides`, which npm ignores. The published package
is installed with `npm install` (`PACKAGING.md`, the npm-based job in `.gitlab-ci.yml`), so that
path still resolved `chevrotain`'s `lodash-es@4.17.23`: an `npm install` of the packed tarball
followed by `npm audit --omit=dev` reported **5 high** advisories, while `pnpm audit --prod` in
this repository reported none. (The removed Monaco override had the same gap while it existed.)

`package.json` now also carries a top-level npm `overrides` entry, `"lodash-es": "$lodash-es"`,
which pins every `lodash-es` in the tree to the direct dependency's range (`^4.18.1`). Verified by
packing the tarball, running `npm install` in a clean directory (every `lodash-es` resolves to
4.18.1, `npm audit --omit=dev` reports 0) and `npm run build`. pnpm ignores the npm field:
`pnpm install --frozen-lockfile` passes with the lockfile unchanged.

Audit both install paths from now on: `pnpm audit --prod` here, and `npm audit --omit=dev` after
the tarball round trip in `UPSTREAM.md`'s verification list.
