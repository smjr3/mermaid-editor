# Icons in diagrams

`architecture-beta` services and flowchart icon nodes name icons as `prefix:name`:

```
architecture-beta
  group app(tabler:server-2)[Application]
  service fw(tabler:firewall-check)[Firewall]
  service lb(tabler:load-balancer)[Load balancer] in app
  service db(lucide:database)[Database] in app
```

Icons come from three places. All three end up registered with mermaid
(`mermaid.registerIconPacks`) in `src/lib/util/mermaid.ts`.

## 1. Bundled packs

Two generic, OSS [Iconify](https://icon-sets.iconify.design/) sets, shipped in the build as
lazily loaded chunks — fetched from this site the first time a diagram uses the prefix, never
from a CDN (`src/lib/util/iconPacks.ts`):

| Prefix   | License | Good for                                                                                              |
| -------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `tabler` | MIT     | Infrastructure and IT: server, database, router, switch, firewall, load balancer, topologies, devices |
| `lucide` | ISC     | General and IT: server, network, shield, brick-wall-fire, hard drive, container                       |

**No logos or trademarks are bundled.** The site is meant to be hosted internally, and shipping
third-party marks — cloud vendors', software vendors', anyone's — could need clearance there.
Both sets mix a few brand icons in with the generic ones (`tabler:brand-*`, `lucide:github`, …);
`isBrandIcon` drops them when the pack loads, and `iconPacks.test.ts` fails if one slips through.
For the same reason the packs considered earlier — `logos`, `simple-icons`, `devicon` (logo
sets) and `mdi`, `carbon`, `fluent`, `flat-color-icons` (generic sets with brand icons mixed in
that cannot be separated reliably) — are not bundled.

Names are the Iconify names; the "Icons" card in the editor links to the Iconify browser to look
them up. The two packs add about 3 MB of chunks to the built site.

**Logos and vendor icon sets** (AWS, Azure, Google Cloud architecture icons, product logos) are
not OSS: they come with their owners' terms, which generally allow use in diagrams but not
redistribution as a set. Where the organisation has cleared them, use one of the next two routes.

## 2. Packs the deployment hosts (`MERMAID_ICON_PACKS`)

A build-time variable of comma-separated `prefix=url` pairs. Each pack is fetched on first use;
relative URLs resolve against the site, so a pack can sit next to it on GitLab Pages:

```
MERMAID_ICON_PACKS='azure=./icon-packs/azure.json,corp=./icon-packs/corp.json'
```

A pack is an [Iconify JSON](https://iconify.design/docs/types/iconify-json.html) file.
`scripts/svg-to-iconify.js` makes one from a folder of SVG files (searched recursively; icon names
come from file names, and Azure's `12345-icon-service-` prefix is dropped):

```sh
node scripts/svg-to-iconify.js <svg-folder> <prefix> <output.json>
```

In the GitLab Pages job — the deployer downloads the vendor's icon archive, having accepted its
terms, and publishes it only on the internal site:

```yaml
pages:
  variables:
    MERMAID_BASE_PATH: '/$CI_PROJECT_NAME'
    MERMAID_ICON_PACKS: 'azure=./icon-packs/azure.json'
  script:
    - pnpm build
    - pnpm build:pages
    # azure-icons/ holds the unpacked official SVGs (downloaded in an earlier step)
    - node scripts/svg-to-iconify.js azure-icons azure public/icon-packs/azure.json
```

`.gitlab-ci.yml` carries the same lines, commented.

## 3. Packs a user imports

The "Icons" card in the editor imports either several SVG files (the user picks a prefix) or one
Iconify JSON file (its own prefix, unless one is typed). Imported packs are stored in that
browser's IndexedDB (`src/lib/util/customIconStore.ts`) and registered on every load, including
the view and embed pages. They are **per browser**: someone opening a shared link without the same
pack sees mermaid's `?` placeholder. Bundled prefixes cannot be reused.

## Security

mermaid inserts an icon's `body` into the diagram SVG as markup. Hosted and imported packs are
untrusted input, so every body is sanitised with DOMPurify (SVG profile, no `script`, `style` or
`foreignObject`, no event handlers or `javascript:` URLs) when the pack is loaded — including
packs read back from IndexedDB (`src/lib/util/customIcons.ts`). `scripts/svg-to-iconify.js` only
extracts markup; the sanitising happens in the app.
