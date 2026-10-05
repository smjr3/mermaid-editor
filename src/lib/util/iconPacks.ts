import type { AsyncIconLoader } from 'mermaid';
import { vendorIconPacks } from './customIcons';

type IconifyJSON = Awaited<ReturnType<AsyncIconLoader['loader']>>;

/**
 * Icon packs for `architecture-beta` services and flowchart `@{ icon: … }`
 * nodes, written as `prefix:name` (`tabler:server`, `logos:aws-lambda`). Each
 * pack loads on first use from this site, never from a CDN.
 *
 * Generic sets (always bundled):
 * - `tabler` (MIT), `lucide` (ISC): servers, network gear, firewalls, devices.
 * - `carbon` (Apache-2.0, IBM): network and cloud infrastructure.
 * - `fluent` (MIT, Microsoft), `flat-color-icons` (MIT), `mdi` (Apache-2.0).
 * - `clarity` (MIT, VMware): data-centre and network gear — routers, switches,
 *   firewalls, rack servers, storage, tape, VMs, hosts and clusters.
 * - `eos-icons` (MIT, SUSE): Kubernetes and infrastructure concepts — DNS, proxy,
 *   IP, ingress, network policy, pods, pipelines.
 * - `fluent-color` (MIT, Microsoft): Fluent 2 colour icons, the look of
 *   Microsoft 365 — people, teams, chat, mail, calendar, documents, approvals.
 *
 * Logo sets (bundled unless MERMAID_BUNDLE_LOGOS=false):
 * - `logos`, `simple-icons` (CC0): cloud services, products, vendors.
 * - `devicon` (MIT): languages, databases, middleware, cloud.
 *
 * The packs are npm dependencies, so the repository and the npm package carry
 * none of their data; a build pulls them from npm. The licences above cover the
 * artwork, not the trademarks it shows. A deployment that may not host marks
 * builds with MERMAID_BUNDLE_LOGOS=false: the logo sets drop out and the brand
 * icons mixed into the generic sets are removed on load (isBrandIcon).
 *
 * Vendor architecture icon sets (AWS, Azure, Google Cloud) are not OSS; they are
 * fetched at build time (scripts/fetch-icon-packs.js), hosted by the deployment
 * or imported by a user. See customIcons.ts and docs-dev/ICONS.md.
 */

// Words that make an icon a logo or a trademark, matched as whole hyphen-separated
// parts of the name (so `pocket-knife` stays but `brand-pocket` goes).
const trademarkWords = new Set([
  'adobe',
  'amazon',
  'android',
  'apple',
  'aws',
  'azure',
  'bitcoin',
  'chrome',
  'codepen',
  'codesandbox',
  'debian',
  'discord',
  'docker',
  'dribbble',
  'dropbox',
  'ethereum',
  'facebook',
  'figma',
  'firefox',
  'framer',
  'github',
  'gitlab',
  'google',
  'ibm',
  'instagram',
  'java',
  'javascript',
  'kubernetes',
  'linkedin',
  'linux',
  'microsoft',
  'netflix',
  'npm',
  'oracle',
  'paypal',
  'playstation',
  'reddit',
  'redhat',
  'safari',
  'skype',
  'slack',
  'spotify',
  'steam',
  'trello',
  'twitch',
  'twitter',
  'ubuntu',
  'vmw',
  'vmware',
  'whatsapp',
  'windows',
  'xbox',
  'youtube'
]);

/** Whether an Iconify icon name is a logo or names a trademark. */
export const isBrandIcon = (name: string): boolean => {
  const parts = name.split('-');
  return (
    parts[0] === 'brand' || parts[0] === 'logo' || parts.some((part) => trademarkWords.has(part))
  );
};

/** The pack without logo and trademark icons, or aliases that point at them. */
const withoutBrands = (pack: IconifyJSON): IconifyJSON => {
  const icons = Object.fromEntries(
    Object.entries(pack.icons).filter(([name]) => !isBrandIcon(name))
  );
  const aliases = Object.fromEntries(
    Object.entries(pack.aliases ?? {}).filter(
      ([name, alias]) => !isBrandIcon(name) && alias.parent in icons
    )
  );
  return { ...pack, aliases, icons };
};

type PackModule = Promise<{ default: unknown }>;

const pack = (name: string, load: () => PackModule, stripBrands: boolean): AsyncIconLoader => ({
  loader: async () => {
    const json = (await load()).default as IconifyJSON;
    return stripBrands ? withoutBrands(json) : json;
  },
  name
});

const genericPacks = (stripBrands: boolean): AsyncIconLoader[] => [
  pack('tabler', () => import('@iconify-json/tabler/icons.json'), stripBrands),
  pack('lucide', () => import('@iconify-json/lucide/icons.json'), stripBrands),
  pack('carbon', () => import('@iconify-json/carbon/icons.json'), stripBrands),
  pack('fluent', () => import('@iconify-json/fluent/icons.json'), stripBrands),
  pack('flat-color-icons', () => import('@iconify-json/flat-color-icons/icons.json'), stripBrands),
  pack('mdi', () => import('@iconify-json/mdi/icons.json'), stripBrands),
  pack('clarity', () => import('@iconify-json/clarity/icons.json'), stripBrands),
  pack('eos-icons', () => import('@iconify-json/eos-icons/icons.json'), stripBrands),
  pack('fluent-color', () => import('@iconify-json/fluent-color/icons.json'), stripBrands)
];

const logoPacks = (): AsyncIconLoader[] => [
  pack('logos', () => import('@iconify-json/logos/icons.json'), false),
  pack('simple-icons', () => import('@iconify-json/simple-icons/icons.json'), false),
  pack('devicon', () => import('@iconify-json/devicon/icons.json'), false)
];

/** The bundled packs; the logo sets only when `bundleLogos`. */
export const selectIconPacks = (bundleLogos: boolean): AsyncIconLoader[] =>
  bundleLogos ? [...genericPacks(false), ...logoPacks()] : genericPacks(true);

// Gated on the build-time constant directly, so MERMAID_BUNDLE_LOGOS=false
// leaves the logo chunks out of the build rather than just unused.
const bundledPacks: AsyncIconLoader[] =
  import.meta.env.MERMAID_BUNDLE_LOGOS === 'false'
    ? genericPacks(true)
    : [...genericPacks(false), ...logoPacks()];

/** The bundled packs, then the vendor packs fetched at build time (if any). */
export const iconPacks: AsyncIconLoader[] = [
  ...bundledPacks,
  ...vendorIconPacks(
    import.meta.glob('../vendor-icons/*.json'),
    // Every bundled prefix, logo sets included, as plain names: listing them
    // through logoPacks() would keep its chunks in a MERMAID_BUNDLE_LOGOS=false build.
    [
      'tabler',
      'lucide',
      'carbon',
      'fluent',
      'flat-color-icons',
      'mdi',
      'clarity',
      'eos-icons',
      'fluent-color',
      'logos',
      'simple-icons',
      'devicon'
    ]
  )
];
