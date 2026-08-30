# Task 5 — GitLab Pages static delivery

Read [`README.md`](README.md) in this directory first. **Run task 4 before this one** — it
changes `package.json`.

## 目的 (Goal)

Prove the build output works as a static site served from a GitLab Pages subpath, and provide
the CI configuration and the runbook for bringing it into the internal GitLab.

## 対象範囲 (Scope)

CI configuration and subpath verification. No application source changes.

## 変更してよいファイル (Files you may change)

- `.gitlab-ci.yml` — new
- `docs-dev/GITLAB-PAGES.md` — new

## 変更してはいけない範囲 (Hard boundaries)

- Do not touch `src/`, `static/`, `tests/`, `bin/`, `scripts/`
- Do not edit `svelte.config.js` — upstream already reads `MERMAID_BASE_PATH` into `paths.base`
- Do not edit `package.json`
- Do not delete or modify anything under `.github/`
- **Never write a real internal hostname, registry URL, token or credential into any file.**
  Use placeholders and CI variables.

## 前提 (Established facts — do not re-derive)

- GitLab Pages serves from a **`public/`** directory. This app builds to **`docs/`**, so CI
  must move it.
- Subpath is controlled by `MERMAID_BASE_PATH` (e.g. `/$CI_PROJECT_NAME` for a project page).
- Asset references are already relative (`./_app/...`), so output is subpath-portable.
- Extensionless URLs (`/edit`) must resolve to `edit.html`.
- Node >= 24.16.0 is required by `engines`.

## 実装内容 (What to do)

1. Write `.gitlab-ci.yml` covering both intended paths — make one the active job and show the
   other as commented configuration:
   - (a) build directly from this repository's source
   - (b) fetch the npm package from an internal registry, unpack it, `npm install`, `npm run build`

   It must use a Node 24.16.0 image, take `MERMAID_BASE_PATH` from a CI variable, move `docs/`
   to `public/`, and publish `public/` as the `pages` job artifact.

2. Write `docs-dev/GITLAB-PAGES.md` as the runbook: how to point npm at an internal registry
   and supply auth via CI variables (generic form only — no real hosts or secrets), how to
   choose `MERMAID_BASE_PATH`, the air-gapped caveat from pitfall 5, and which `.env` settings
   to consider disabling for an internal deployment — `MERMAID_ANALYTICS_URL`,
   `MERMAID_RENDERER_URL`, `MERMAID_KROKI_RENDERER_URL`, and
   `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` (emptying the last one removes the Mermaid Chart
   promo banner and the "Save diagram" button, which an internal deployment will likely want).

## 完了条件 (Definition of done)

1. `.gitlab-ci.yml` is valid YAML
2. A build with `MERMAID_BASE_PATH=/mermaid-editor`, placed under `<root>/mermaid-editor/` and
   served over HTTP, opens correctly in a browser at `/mermaid-editor/edit`
3. `docs-dev/GITLAB-PAGES.md` exists and contains the runbook
4. No real hostname, token or credential appears anywhere in your changes

## 実施するテスト (Tests to run)

1. `python3 -c "import yaml;yaml.safe_load(open('.gitlab-ci.yml'));print('YAML OK')"`
2. The `MERMAID_BASE_PATH=/mermaid-editor` build — exit code
3. `curl -o /dev/null -w '%{http_code}'` against `/mermaid-editor/edit.html` **and**
   `/mermaid-editor/edit` — both must be 200
4. Drive a headless browser to `/mermaid-editor/edit` and report: HTTP status, whether any
   page errors occurred, and whether a diagram `svg` rendered. Save a screenshot.
5. List every failed network request, separating external domains (expected to fail in a
   sandbox) from same-origin ones (a real bug)

## 報告してほしい内容 (What to report)

1. The full text of `.gitlab-ci.yml`
2. The real output of every test above, including the browser result
3. Anything that broke under subpath serving — exact symptom and cause
4. The list of features that degrade on an air-gapped network
5. Anything you deliberately did not do, and why
6. Any open question you could not resolve by running something — as a question, not a guess
