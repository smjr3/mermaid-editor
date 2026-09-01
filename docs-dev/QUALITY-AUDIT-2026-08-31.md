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
