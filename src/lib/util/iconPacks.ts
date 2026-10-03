import type { AsyncIconLoader } from 'mermaid';

type IconifyJSON = Awaited<ReturnType<AsyncIconLoader['loader']>>;

/**
 * Icon packs for `architecture-beta` services and flowchart `@{ icon: … }`
 * nodes, written as `prefix:name` (`logos:aws-lambda`).
 *
 * Each pack is bundled and loaded on first use from this site, never from a
 * CDN: the organisational build must not send diagrams, or requests that
 * reveal them, to third parties. Only permissively licensed Iconify sets are
 * included (see THIRD-PARTY-LICENSES.md). The vendors' own AWS, Azure and
 * Google Cloud architecture icon sets restrict redistribution, so they are not.
 *
 * - `logos` (CC0-1.0): colour logos, including ~80 AWS services and the
 *   Azure, Google Cloud, Kubernetes, Docker and Terraform marks.
 * - `simple-icons` (CC0-1.0): monochrome brand icons, including many Azure and
 *   Google Cloud products.
 * - `devicon` (MIT): development and platform logos — Azure, SQL Server,
 *   Windows, Oracle and most languages, frameworks and databases.
 * - `carbon` (Apache-2.0, IBM Carbon): infrastructure pictograms — firewall,
 *   router, L2/L3 switch, load balancer, VPN, DNS, storage.
 * - `fluent` (MIT, Microsoft Fluent UI System Icons): Microsoft's own UI icon
 *   style — server, database, laptop, shield, people.
 * - `flat-color-icons` (MIT): colour business icons — devices, people, documents.
 * - `mdi` (Apache-2.0): generic shapes — server, database, cloud, user.
 *
 * Packs that cannot be bundled — a vendor's official set, an in-house one — can
 * still be used: a deployment can host them (MERMAID_ICON_PACKS) and a user can
 * import them; see customIcons.ts.
 */
export const iconPacks: AsyncIconLoader[] = [
  {
    loader: async () => (await import('@iconify-json/logos/icons.json')).default as IconifyJSON,
    name: 'logos'
  },
  {
    loader: async () =>
      (await import('@iconify-json/simple-icons/icons.json')).default as IconifyJSON,
    name: 'simple-icons'
  },
  {
    loader: async () => (await import('@iconify-json/devicon/icons.json')).default as IconifyJSON,
    name: 'devicon'
  },
  {
    loader: async () => (await import('@iconify-json/carbon/icons.json')).default as IconifyJSON,
    name: 'carbon'
  },
  {
    loader: async () => (await import('@iconify-json/fluent/icons.json')).default as IconifyJSON,
    name: 'fluent'
  },
  {
    loader: async () =>
      (await import('@iconify-json/flat-color-icons/icons.json')).default as IconifyJSON,
    name: 'flat-color-icons'
  },
  {
    loader: async () => (await import('@iconify-json/mdi/icons.json')).default as IconifyJSON,
    name: 'mdi'
  }
];
