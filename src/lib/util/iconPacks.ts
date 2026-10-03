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
 * - `mdi` (Apache-2.0): generic shapes — server, database, cloud, user.
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
    loader: async () => (await import('@iconify-json/mdi/icons.json')).default as IconifyJSON,
    name: 'mdi'
  }
];
