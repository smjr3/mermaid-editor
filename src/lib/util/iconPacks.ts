import type { AsyncIconLoader } from 'mermaid';

type IconifyJSON = Awaited<ReturnType<AsyncIconLoader['loader']>>;

/**
 * Icon packs for `architecture-beta` services and flowchart `@{ icon: … }`
 * nodes, written as `prefix:name` (`tabler:server`).
 *
 * Only generic, OSS icon sets are bundled, and no logos: this site is meant to
 * be hosted internally, where shipping third-party trademarks (cloud vendors',
 * software vendors', anyone's) could need clearance. Both sets mix a few brand
 * icons in with the generic ones, so those are removed on load (isBrandIcon).
 * Each pack loads on first use from this site, never from a CDN.
 *
 * - `tabler` (MIT, Tabler Icons): infrastructure and IT — server, database,
 *   router, switch, firewall, load balancer, network topologies, devices.
 * - `lucide` (ISC, Lucide): general UI and IT — server, network, shield,
 *   brick-wall-fire, hard drive, container.
 *
 * Logos and vendor icon sets (AWS, Azure, Google Cloud, …) are not bundled. A
 * deployment that has cleared them can host them (MERMAID_ICON_PACKS) and a user
 * can import them; see customIcons.ts and docs-dev/ICONS.md.
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
  'vmware',
  'whatsapp',
  'windows',
  'xbox',
  'youtube'
]);

/** Whether an Iconify icon name is a logo or names a trademark. */
export const isBrandIcon = (name: string): boolean => {
  const parts = name.split('-');
  return parts[0] === 'brand' || parts.some((part) => trademarkWords.has(part));
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

export const iconPacks: AsyncIconLoader[] = [
  {
    loader: async () =>
      withoutBrands((await import('@iconify-json/tabler/icons.json')).default as IconifyJSON),
    name: 'tabler'
  },
  {
    loader: async () =>
      withoutBrands((await import('@iconify-json/lucide/icons.json')).default as IconifyJSON),
    name: 'lucide'
  }
];
