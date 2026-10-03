# Packaging and rebuilding

This project is published as the npm package `@smjr3/mermaid-editor`. The package contains
the application source, not the generated site. A consumer installs the dependencies and
builds the static site into `docs/`.

## Requirements

- Node.js 24.16.0 or newer (see `.node-version` and `package.json`)
- npm credentials that can publish to, or download from, the intended registry
- network access to that registry and to every registry used for dependencies

The package does not contain `.npmrc`, authentication details, or a dependency lockfile.
npm strips `.npmrc` from every tarball, so upstream's `engine-strict=true` never reaches a
consumer: a Node version mismatch there is a warning, not an error. The build also needs
`.svelte-kit/tsconfig.json`, which `postinstall` generates with `svelte-kit sync`; deleting
`.svelte-kit` and building without reinstalling fails with `Tsconfig not found`.
Keep registry URLs and tokens in the consumer's npm configuration or CI variables, never in
the package.

## Build the package

From the repository root, run:

```sh
npm pack
```

This creates `smjr3-mermaid-editor-<version>.tgz`. Before distributing it, inspect the file
list and confirm that it does not contain credentials, `node_modules/`, `.git/`, `docs/`, or
`.env.local`:

```sh
tar -tzf smjr3-mermaid-editor-<version>.tgz
```

## Publish the package

Releases to npmjs.org go through `.github/workflows/publish.yml`, which runs lint, the type
check, the unit tests and a build, then `npm publish --provenance`. Provenance links the
package page on npmjs.com to the commit and workflow run that built it; it requires the
repository to be public, which it is.

- **Release:** bump `version` in `package.json` on `master`, then publish a GitHub release
  tagged `v<version>` (for example `v0.1.0`). The job fails if the tag and the version differ.
- **By hand:** run the workflow from the Actions tab. It defaults to a dry run, which prints
  the tarball contents and uploads nothing; untick "dry run" to publish.

Authentication, in order of preference:

1. **Trusted publishing** (no stored secret). On npmjs.com, open the package's settings and
   add a trusted publisher: GitHub Actions, repository `smjr3/mermaid-editor`, workflow
   `publish.yml`. npm only offers this for a package that already exists, so it cannot be
   used for the first release.
2. **`NPM_TOKEN`**, a repository secret holding a granular npm access token with
   read-and-write permission on the `@smjr3` scope. Needed for the first release; delete
   the secret once trusted publishing is configured.

A version can be published only once; npm rejects a second publish of the same version.

To publish from a workstation instead, authenticate with `npm login` and run
`npm publish --access public`. `package.json` already sets `publishConfig.access` to
`public`, which a public scoped package requires. For a private internal registry, confirm
its scoped-package and access-policy settings first. Do not publish as part of a test.

## Rebuild the static site from the package

Use an empty working directory so that files from the source repository cannot affect the
result:

```sh
mkdir mermaid-editor-build
cd mermaid-editor-build
npm pack @smjr3/mermaid-editor
tar -xzf smjr3-mermaid-editor-*.tgz --strip-components=1
npm install
npm run build
```

The completed site is in `docs/`. It must contain at least `index.html`, `edit.html`,
`view.html`, and the `_app/` directory.

`package.json` carries its dependency overrides twice: `pnpm.overrides` for this repository
and a top-level `overrides` that npm applies when the tarball is installed. Without the npm
entry, `npm install` of the tarball resolves Monaco's vulnerable `dompurify@3.4.15`
even though this repository's pnpm audit is clean.

When downloading through JFrog or another internal registry, that registry must proxy or
contain all transitive dependencies as well as this package. The first install can otherwise
fail even when `@smjr3/mermaid-editor` itself is available.

## Reproducible installs

npm always removes a root `pnpm-lock.yaml` from a package tarball. Therefore, the first
`npm install` shown above resolves the allowed dependency versions available at that time;
it is **not reproducible by itself**.

The chosen approach is to keep the `package-lock.json` generated in the consuming build
repository:

1. Run `npm install` when importing a new package version.
2. Review and commit `package-lock.json` in the consuming repository.
3. Use `npm ci` in subsequent CI jobs, then run `npm run build`.

```sh
npm ci
npm run build
```

This keeps one lockfile in the repository that actually performs the build. It avoids a
second, easily outdated copy of `pnpm-lock.yaml` in the published package. The trade-off is
that the very first dependency resolution is not reproducible; it must be reviewed and
captured before production use. Update the committed lockfile deliberately whenever the
package version changes.

The alternative of shipping a nested copy of `pnpm-lock.yaml` was rejected because npm does
not use it for `npm install` or `npm ci`. It would add a synchronization mechanism without
making the required npm-only build reproducible.

## Verified round trip

On 2026-08-30, using the supported Node.js 24.16.0 runtime, `npm pack` produced a 128 kB
archive containing 169 files. In a new directory, `npm install` installed 667 packages and
exited successfully; `npm run build` also exited successfully and produced the required
files in `docs/`. Immediately after that first install, deleting `node_modules/` and
`.svelte-kit` and running `npm ci` against the generated lockfile also exited successfully.

Other observed warnings were the deprecated `husky install` command, the absence of `.git`
in the unpacked directory, deprecations for `plausible-tracker` and `lucide-svelte`, large
generated JavaScript chunks, and 8 audit findings (6 low and 2 moderate). None stopped the
build. Dependency upgrades and vulnerability remediation are separate maintenance work and
must not be performed automatically with `npm audit fix --force` because it may introduce
breaking changes.
