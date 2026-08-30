# GitLab Pages deployment

This runbook deploys Mermaid Editor as a static GitLab Pages site. The active job in
`.gitlab-ci.yml` builds the checked-out source. A commented alternative builds a pinned
version of the npm package obtained through an internal registry.

## Before the first deployment

1. Confirm that the GitLab runner can use the `node:24.16.0` container image. Mirror that
   image internally if the runner cannot reach a public container registry.
2. In **Settings > CI/CD > Variables**, set `MERMAID_BASE_PATH` if the default
   `/$CI_PROJECT_NAME` is not the Pages path assigned to the project. Use no trailing slash.
   For example, a project available below `/mermaid-editor` uses `/mermaid-editor`.
3. Review the internal-deployment settings described below. Put overrides in CI variables;
   do not commit internal addresses or credentials.
4. Run the pipeline. The `pages` job builds `docs/`, renames it to `public/`, and publishes
   that directory as the Pages artifact.

The default base path is appropriate for a normal project Pages URL. A user or group site
served at the domain root should set `MERMAID_BASE_PATH` to an empty value.

## Building from the internal npm registry

Use this option when the internal deployment must consume the same package distributed
through JFrog or another npm-compatible registry. Disable the active source-based job and
uncomment the alternative `pages` job in `.gitlab-ci.yml`.

Create these protected CI/CD variables:

- `NPM_REGISTRY_URL`: the registry base URL, including `https://`, with no secret in it.
- `NPM_TOKEN`: a read-only registry token. Mark it **masked** and **protected**.
- `MERMAID_BASE_PATH`: the Pages path described above.

The alternative job writes a temporary project-local `.npmrc` in this generic form:

```ini
registry=https://registry.example.invalid/npm/
//registry.example.invalid/npm/:_authToken=${NPM_TOKEN}
```

The example hostname is deliberately non-operational. The CI job constructs the real entry
from CI variables so that the hostname and token are not stored in Git. Restrict the token
to package read access, restrict protected variables to trusted branches, and do not retain
`.npmrc` as an artifact. Keep `MERMAID_EDITOR_VERSION` pinned to the reviewed package version
instead of installing `latest`.

The package does not contain a root npm lockfile, so its first `npm install` resolves allowed
dependency versions at build time. For a reproducible long-lived internal build, unpack the
reviewed package in a separate internal source repository, commit the generated
`package-lock.json`, and use `npm ci` in later pipelines.

## Internal and air-gapped settings

The app normally requests the Mermaid configuration schema from
`https://mermaid.js.org/schemas/config.schema.json`. If that address is unavailable, diagram
editing and rendering still work, but configuration autocomplete is degraded. Browser
requests to other external services also fail unless those services are reachable or replaced
with internal endpoints.

Review these CI variables before deployment:

| Variable                                 | Recommended internal value                   | Effect                                                                  |
| ---------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `MERMAID_ANALYTICS_URL`                  | Empty                                        | Prevents analytics requests.                                            |
| `MERMAID_RENDERER_URL`                   | Empty, or an approved internal renderer      | Disables or redirects the Mermaid image renderer integration.           |
| `MERMAID_KROKI_RENDERER_URL`             | Empty, or an approved internal Kroki service | Disables or redirects Kroki rendering.                                  |
| `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` | Empty                                        | Removes the Mermaid Chart promotion banner and **Save diagram** button. |

Values are included at build time. After changing one, run a new Pages pipeline. Do not place
tokens, passwords, personal data, or private hostnames in these values unless the application
is explicitly designed to expose them: static-site JavaScript and its network requests are
visible to every user of the site.

## Verification after deployment

1. Open `<pages-url>/<base-path>/edit` without adding `.html`.
2. Confirm that the editor loads and a simple diagram renders as SVG.
3. Check the browser developer tools for failed same-origin requests. A same-origin failure
   indicates a base-path or deployment problem; an external failure indicates an unavailable
   optional service.
4. Confirm that the expected internal settings are reflected in the available buttons and
   network requests.

GitLab Pages must be configured to resolve extensionless paths such as `/edit` to
`edit.html`. If the GitLab installation or reverse proxy does not provide that behavior,
coordinate that server-side setting with the GitLab administrator; the static build already
contains `edit.html`.
