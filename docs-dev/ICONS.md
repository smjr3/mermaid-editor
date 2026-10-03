# Icons in diagrams

`architecture-beta` services and flowchart icon nodes name icons as `prefix:name`:

```
architecture-beta
  group aws(logos:aws)[AWS]
  service fn(logos:aws-lambda)[Lambda] in aws
  service fw(carbon:firewall)[Firewall]
```

Icons come from three places. All three end up registered with mermaid
(`mermaid.registerIconPacks`) in `src/lib/util/mermaid.ts`.

## 1. Bundled packs

Permissively licensed [Iconify](https://icon-sets.iconify.design/) sets, shipped in the build as
lazily loaded chunks — fetched from this site the first time a diagram uses the prefix, never
from a CDN (`src/lib/util/iconPacks.ts`):

| Prefix             | License    | Good for                                                                |
| ------------------ | ---------- | ----------------------------------------------------------------------- |
| `logos`            | CC0-1.0    | Colour logos: ~80 AWS services, the Azure and Google Cloud marks, SaaS  |
| `simple-icons`     | CC0-1.0    | Monochrome brand icons: Microsoft 365, Azure and Google Cloud products  |
| `devicon`          | MIT        | Development and platform logos: Azure, SQL Server, Windows, Oracle      |
| `carbon`           | Apache-2.0 | IBM Carbon infrastructure pictograms: firewall, router, switch, LB, VPN |
| `fluent`           | MIT        | Microsoft's Fluent UI System Icons: server, database, laptop, shield    |
| `flat-color-icons` | MIT        | Colour business icons: devices, people, documents                       |
| `mdi`              | Apache-2.0 | Generic shapes: server, database, cloud, account                        |

Names are the Iconify names; the "Icons" card in the editor links to the Iconify browser to look
them up. Together the packs add about 30 MB of chunks to the built site, none of which loads
until a diagram names that prefix.

**Not bundled:** the vendors' own architecture icon sets (AWS Architecture Icons, Azure
Architecture Icons, Google Cloud icons). Their terms allow using the icons in diagrams but restrict
redistributing them as a set, which a public npm package and repository would do. Use one of the
next two routes for those.

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
