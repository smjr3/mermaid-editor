# GitLab Pages deployment

This project builds a static site into `docs/`. The Pages job in `.gitlab-ci.yml`
builds it with Node 24.16.0, moves that directory to `public/`, and publishes
`public/` as the Pages artifact.

## Choose the Pages base path

Set `MERMAID_BASE_PATH` to the URL path at which GitLab Pages will expose the
site. For a project page this is normally `/$CI_PROJECT_NAME`, which is the CI
configuration's default. Use an empty value for a site served at the hostname
root, or set an explicit path such as `/mermaid-editor` when the external path
does not match the project name. The value must begin with `/` unless it is
empty, and it must not end with `/`.

Set or override the variable under **Settings > CI/CD > Variables** when the
deployment needs a different base path. Do not put a deployment hostname or a
credential in the repository.

## Build from source

The active job installs the locked dependencies with pnpm and runs the normal
build. `MERMAID_BASE_PATH` is available to SvelteKit during that build. GitLab
Pages only publishes `public/`, so the job moves the generated `docs/` directory
to `public/` before collecting its artifact.

## Build an npm package from an internal registry

The commented alternative in `.gitlab-ci.yml` downloads the package tarball,
unpacks it into a clean directory, installs its dependencies, and builds it.
To use that path, replace the active `pages` job with the commented job and add
these protected or masked CI/CD variables:

- `NPM_PACKAGE_SPEC`: the exact package and version, such as
  `@scope/package@1.2.3`.
- `NPM_REGISTRY_URL`: the generic registry endpoint, such as
  `https://npm.example.invalid/repository/npm/`.
- `NPM_REGISTRY_HOST_PATH`: the same registry's host and path without the
  protocol, such as `npm.example.invalid/repository/npm`.
- `NPM_TOKEN`: a read-only registry token. Mark it **masked** and **protected**.

The generic npm configuration performed by the job is equivalent to:

```ini
registry=${NPM_REGISTRY_URL}
//${NPM_REGISTRY_HOST_PATH}/:_authToken=${NPM_TOKEN}
```

Keep those values in GitLab CI/CD variables rather than committing an `.npmrc`.
If the registry uses a scoped endpoint, an administrator can instead supply a
scope mapping such as `@scope:registry=${NPM_REGISTRY_URL}` through CI setup.

## Internal and air-gapped deployments

Review `.env` before producing an internal build. Consider emptying these
settings so the deployed application does not attempt to use external services:

```dotenv
MERMAID_ANALYTICS_URL=
MERMAID_RENDERER_URL=
MERMAID_KROKI_RENDERER_URL=
MERMAID_IS_ENABLED_MERMAID_CHART_LINKS=
```

Emptying `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` removes the Mermaid Chart
promotion banner and the **Save diagram** button, which is usually appropriate
for an internal deployment. Empty renderer URLs disable the corresponding
remote rendering integrations, and an empty analytics URL prevents configured
analytics delivery.

The editor also requests
`https://mermaid.js.org/schemas/config.schema.json` at runtime to provide Mermaid
configuration autocomplete. That request fails on an air-gapped network.
Diagram editing and rendering continue to work, but configuration autocomplete
is degraded unless the application is changed in a future, separately scoped
customization to use an internally available schema.
