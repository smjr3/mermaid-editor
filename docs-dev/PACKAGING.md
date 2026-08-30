# npm packaging and reproducible consumer builds

This project publishes its source as `@smjr3/mermaid-editor`. The package is intended
to be unpacked and built into the static site in `docs/`; it is not a prebuilt copy of
that site.

## Prerequisites

- Use the Node version in `.node-version`. The package's `engines.node` is the
  authoritative minimum.
- Use npm for the package-consumer workflow described here. pnpm remains the
  repository's development package manager.
- Authenticate npm to the target registry before publishing or downloading. For an
  internal JFrog registry, configure its registry URL and credentials outside this
  package; npm excludes `.npmrc` from published tarballs.

## Build the package

From a clean repository checkout, run:

```sh
npm pack
```

Inspect the resulting tarball before publishing:

```sh
tar -tzf smjr3-mermaid-editor-<version>.tgz
```

The archive must not contain generated or local state such as `node_modules/`, `.git/`,
`docs/`, `.env.local`, `.npmrc`, or credentials.

## Publish

Publishing is a deliberate release action and is not part of the build:

```sh
npm publish ./smjr3-mermaid-editor-<version>.tgz --access public
```

The `--access public` flag is required for a public scoped package. It is also recorded
in `publishConfig`, but keeping it in the release command makes the intended access
explicit. Substitute the configured JFrog registry with `--registry` when publishing
internally. Never publish a test tarball merely to verify packaging.

## First consumer import

Extract the package into an empty project directory, then create and validate the npm
lockfile that belongs to the consuming build repository:

```sh
mkdir mermaid-editor-build
tar -xzf smjr3-mermaid-editor-<version>.tgz \
  -C mermaid-editor-build --strip-components=1
cd mermaid-editor-build
npm install
rm -rf node_modules .svelte-kit docs
npm ci
npm run build
```

Verify that `docs/` contains at least `index.html`, `edit.html`, `view.html`, and `_app/`.
Commit the generated `package-lock.json` to the consuming build repository only after
the clean `npm ci` validation succeeds. If that validation reports that the manifest
and lockfile are out of sync, run `npm install` again, repeat the clean `npm ci`
validation, and review the lockfile changes before committing them.

## Subsequent reproducible builds

Once the consumer has committed its validated `package-lock.json`, every CI build uses:

```sh
npm ci
npm run build
```

When importing a new package version, replace the extracted source, run `npm install`,
review the resulting lockfile diff, repeat the clean `npm ci` validation above, and
commit the source-version and lockfile updates together.

## Lockfile decision and caveat

npm unconditionally excludes a root `pnpm-lock.yaml` from packed archives. Therefore a
fresh install directly from the published package is **not reproducible**: dependency
versions can float within the ranges in `package.json`.

The chosen policy is for the consuming build repository to own a generated
`package-lock.json` and use `npm ci` after the first validated import. This makes the
actual npm dependency tree reproducible, records npm's peer-dependency resolution, and
does not add a second copy of the upstream pnpm lockfile that could silently drift.

We deliberately do not copy `pnpm-lock.yaml` under a nested packaging path. Although
that bypasses npm's root-only exclusion and a prepack check could prevent drift, npm
does not consume a pnpm lockfile for `npm ci`; restoring it to the root would still not
lock an npm installation. We also do not commit a `package-lock.json` to this pnpm-based
source repository because it would create a second independently maintained dependency
resolution. The reproducibility boundary is instead the internal consumer/build
repository, whose package lock must be reviewed whenever the packaged source changes.

JFrog does not change this model: it can proxy or host the tarball and dependency
artifacts, but the consumer still needs registry authentication and a populated proxy
for every dependency selected by its lockfile. For an air-gapped build, mirror all
locked artifacts before running `npm ci`.
