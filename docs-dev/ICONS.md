# Icons in diagrams

`architecture-beta` services and flowchart icon nodes name icons as `prefix:name`:

```
architecture-beta
  group app(tabler:server-2)[Application]
  service fw(tabler:firewall-check)[Firewall]
  service lb(tabler:load-balancer)[Load balancer] in app
  service db(lucide:database)[Database] in app
```

Icons come from four places. All of them end up registered with mermaid
(`mermaid.registerIconPacks`) in `src/lib/util/mermaid.ts`.

## 1. Bundled packs

OSS [Iconify](https://icon-sets.iconify.design/) sets, shipped in the build as lazily loaded
chunks — fetched from this site the first time a diagram uses the prefix, never from a CDN
(`src/lib/util/iconPacks.ts`):

| Prefix             | License    | Good for                                                                         |
| ------------------ | ---------- | -------------------------------------------------------------------------------- |
| `tabler`           | MIT        | Infrastructure and IT: server, database, router, switch, firewall, load balancer |
| `lucide`           | ISC        | General and IT: server, network, shield, brick-wall-fire, hard drive             |
| `carbon`           | Apache-2.0 | Network and cloud infrastructure (IBM): firewall, layer-3 switch, VPN, VM        |
| `fluent`           | MIT        | Microsoft's Fluent UI icons: office, devices, documents                          |
| `flat-color-icons` | MIT        | Colour icons: servers, documents, people                                         |
| `mdi`              | Apache-2.0 | Material Design Icons: a very large general set                                  |
| `logos`            | CC0-1.0    | Logos: AWS/Azure/Google Cloud services, products (`logos:aws-lambda`)            |
| `simple-icons`     | CC0-1.0    | Brand logos of ~3,000 products and companies (`simple-icons:microsoftazure`)     |
| `devicon`          | MIT        | Languages, databases, middleware, cloud (`devicon:microsoftsqlserver`)           |

The last three are logo sets. Names are the Iconify names. The "Icons" card has a picker: type part of a name (`server`,
`aws lambda`), optionally pick a pack, and click an icon to insert its `prefix:name` at the cursor
in the code (it is copied instead on mobile or on the config tab). "Enlarge" opens the same
picker in a large dialog, with each icon's name and pack under it.

The picker also lists mermaid's five built-in architecture icons (`database`, `server`, `disk`,
`internet`, `cloud`), first and marked **standard** (green): they are written without a prefix
and render anywhere mermaid runs, GitLab included — in architecture diagrams only (a flowchart
shows `?` for them; the picker warns when inserting one elsewhere). Every other icon is marked **extended**
(amber): it renders only in this editor, so share such diagrams as an exported image. The card also links to the
Iconify browser, an external site. All packs together add about 36 MB of chunks to the
built site (17 MB of it the logo sets); a page loads only the packs its diagram names.

### Logos, trademarks and redistribution

- **The repository and the npm package contain no icon data.** The packs are ordinary npm
  dependencies (`package.json`); whoever builds the site downloads them from npm, under the
  licences their authors publish them with. Publishing this project is therefore not a
  redistribution of the icons.
- **The built site does contain them** — the organisation that builds and hosts it distributes
  them to its users. The licences above allow that (MIT/ISC/Apache-2.0 need their notice to
  travel with the site, which `NOTICE` and `THIRD-PARTY-LICENSES.md` do; CC0 needs nothing).
- **A licence covers the artwork, not the trademark it shows.** Showing a product's logo in an
  architecture diagram to name that product is the use logo owners generally accept, but an
  organisation whose policy forbids hosting third-party marks builds with
  `MERMAID_BUNDLE_LOGOS=false`: the three logo sets drop out of the build, and the brand icons
  mixed into the generic sets (`tabler:brand-*`, `mdi:microsoft-azure`, …) are removed when the
  pack loads (`isBrandIcon`).

Vendor **architecture icon sets** (AWS Architecture Icons, Azure icons, Google Cloud icons) are
not OSS: their owners allow them in diagrams but restrict redistributing them as a set, so they
never go into the repository or the npm package. Section 2 imports them at build time instead.

## 2. Vendor icon sets imported at build time (`MERMAID_FETCH_ICON_PACKS`)

A build-time variable of comma-separated `prefix=source` pairs. Each source is a vendor's zip
archive (URL or local path) or a local folder of SVG files. `pnpm build` runs
`scripts/fetch-icon-packs.js` first, which downloads each archive, converts its SVGs into an
Iconify pack in `src/lib/vendor-icons/` (gitignored, excluded from the npm package), and the
build bundles it under that prefix like the packs above:

```
MERMAID_FETCH_ICON_PACKS='gcp=https://cloud.google.com/static/icons/files/google-cloud-icons.zip' pnpm build
```

```
architecture-beta
  service sql(gcp:cloud-sql)[Cloud SQL]
```

This way the organisation that builds the site downloads the icons from the vendor itself,
under the terms it accepts, and hosts them only on its own site. Icon names come from file
names: AWS's `Arch_`/`Res_` prefixes and size and Light/Dark suffixes and Azure's
`12345-icon-service-` prefix are dropped (`Arch_Amazon-EC2_64.svg` → `aws:amazon-ec2`), and of
several variants the largest light one is kept. `<style>` class rules (Google Cloud's icons use
them) are turned into attributes so icons in one diagram do not restyle each other. Without the
variable nothing is fetched and an earlier run's packs are kept.

The download pages and archive URLs, as of 2026-10 (they change with each release; check the
page and copy the current link):

| Vendor       | Page                                                    | Archive                                                                                                 |
| ------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Google Cloud | <https://cloud.google.com/icons>                        | `https://cloud.google.com/static/icons/files/google-cloud-icons.zip` (stable)                           |
| AWS          | <https://aws.amazon.com/architecture/icons/>            | "Asset package" link (`https://d1.awsstatic.com/…/Asset-Package_….zip`)                                 |
| Azure        | <https://learn.microsoft.com/azure/architecture/icons/> | "Download SVG icons" link (`https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V….zip`) |

A source that cannot be fetched fails the build rather than silently shipping without the pack.
A prefix that clashes with a bundled one is ignored.

## 3. Packs the deployment hosts (`MERMAID_ICON_PACKS`)

A build-time variable of comma-separated `prefix=url` pairs. Each pack is fetched on first use;
relative URLs resolve against the site, so a pack can sit next to it on GitLab Pages:

```
MERMAID_ICON_PACKS='azure=./icon-packs/azure.json,corp=./icon-packs/corp.json'
```

A pack is an [Iconify JSON](https://iconify.design/docs/types/iconify-json.html) file.
Unlike section 2 the pack is a separate file next to the site, fetched on first use, so it can be
replaced without a rebuild. `scripts/svg-to-iconify.js` makes one from a folder of SVG files (searched recursively; icon names
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

## 4. Packs a user imports

The "Icons" card in the editor imports either several SVG files (the user picks a prefix) or one
Iconify JSON file (its own prefix, unless one is typed). Imported packs are stored in that
browser's IndexedDB (`src/lib/util/customIconStore.ts`) and registered on every load, including
the view and embed pages. They are **per browser**: someone opening a shared link without the same
pack sees mermaid's `?` placeholder. Bundled prefixes cannot be reused.

## Security

mermaid inserts an icon's `body` into the diagram SVG as markup. Build-time, hosted and imported packs are
untrusted input, so every body is sanitised with DOMPurify (SVG profile, no `script`, `style` or
`foreignObject`, no event handlers or `javascript:` URLs) when the pack is loaded — including
packs read back from IndexedDB (`src/lib/util/customIcons.ts`). `scripts/svg-to-iconify.js` and
`scripts/fetch-icon-packs.js` only extract markup; the sanitising happens in the app.
