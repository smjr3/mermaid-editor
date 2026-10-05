import { isBrandIcon } from './iconPacks';
import { standardPrefix } from './standardIcons';

/**
 * Local: what a user may want to know before putting an icon in a document —
 * which set it comes from, under which licence, and whether it shows a
 * trademark. The "Icons" card shows this in a dialog and the picker in each
 * icon's tooltip. The facts repeat NOTICE and THIRD-PARTY-LICENSES.md, which
 * travel with the built site; keep the three in step.
 */
export interface PackLicense {
  /** Icon prefix, or `mermaid` for the built-in architecture icons. */
  prefix: string;
  title: string;
  license: 'MIT' | 'ISC' | 'Apache-2.0' | 'CC0-1.0';
  holder: string;
  /** The set's home page. */
  url: string;
  licenseUrl: string;
  /** The whole set is logos, so every icon shows someone's trademark. */
  logos: boolean;
}

export const packLicenses: PackLicense[] = [
  {
    holder: 'Knut Sveidqvist and mermaid contributors',
    license: 'MIT',
    licenseUrl: 'https://github.com/mermaid-js/mermaid/blob/develop/LICENSE',
    logos: false,
    prefix: standardPrefix,
    title: 'mermaid built-in icons',
    url: 'https://mermaid.js.org/syntax/architecture.html'
  },
  {
    holder: 'Paweł Kuna',
    license: 'MIT',
    licenseUrl: 'https://github.com/tabler/tabler-icons/blob/main/LICENSE',
    logos: false,
    prefix: 'tabler',
    title: 'Tabler Icons',
    url: 'https://tabler.io/icons'
  },
  {
    holder: 'Lucide Contributors (Feather icons: Cole Bemis)',
    license: 'ISC',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
    logos: false,
    prefix: 'lucide',
    title: 'Lucide',
    url: 'https://lucide.dev/'
  },
  {
    holder: 'IBM Corp.',
    license: 'Apache-2.0',
    licenseUrl: 'https://github.com/carbon-design-system/carbon/blob/main/LICENSE',
    logos: false,
    prefix: 'carbon',
    title: 'Carbon Icons',
    url: 'https://carbondesignsystem.com/elements/icons/library/'
  },
  {
    holder: 'Microsoft Corporation',
    license: 'MIT',
    licenseUrl: 'https://github.com/microsoft/fluentui-system-icons/blob/main/LICENSE',
    logos: false,
    prefix: 'fluent',
    title: 'Fluent UI System Icons',
    url: 'https://github.com/microsoft/fluentui-system-icons'
  },
  {
    holder: 'Icons8',
    license: 'MIT',
    licenseUrl: 'https://github.com/icons8/flat-color-icons/blob/master/LICENSE.md',
    logos: false,
    prefix: 'flat-color-icons',
    title: 'Flat Color Icons',
    url: 'https://github.com/icons8/flat-color-icons'
  },
  {
    holder: 'Pictogrammers',
    license: 'Apache-2.0',
    licenseUrl: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE',
    logos: false,
    prefix: 'mdi',
    title: 'Material Design Icons',
    url: 'https://pictogrammers.com/library/mdi/'
  },
  {
    holder: 'Gil Barbara and contributors',
    license: 'CC0-1.0',
    licenseUrl: 'https://github.com/gilbarbara/logos/blob/main/LICENSE.txt',
    logos: true,
    prefix: 'logos',
    title: 'SVG Logos',
    url: 'https://github.com/gilbarbara/logos'
  },
  {
    holder: 'Simple Icons contributors',
    license: 'CC0-1.0',
    licenseUrl: 'https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md',
    logos: true,
    prefix: 'simple-icons',
    title: 'Simple Icons',
    url: 'https://simpleicons.org/'
  },
  {
    holder: 'konpa and Devicon contributors',
    license: 'MIT',
    licenseUrl: 'https://github.com/devicons/devicon/blob/master/LICENSE',
    logos: true,
    prefix: 'devicon',
    title: 'Devicon',
    url: 'https://devicon.dev/'
  }
];

export const packLicense = (prefix: string): PackLicense | undefined =>
  packLicenses.find((pack) => pack.prefix === prefix);

export interface IconLicense extends PackLicense {
  /** The icon is a logo or names a brand: the artwork licence does not cover the mark. */
  trademark: boolean;
}

/**
 * The licence facts for one icon reference (`tabler:server`, `logos:aws`, or a
 * bare standard name), or undefined for a vendor, hosted or imported pack,
 * whose terms the editor does not know.
 */
export const iconLicense = (id: string): IconLicense | undefined => {
  const colon = id.indexOf(':');
  const prefix = colon === -1 ? standardPrefix : id.slice(0, colon);
  const name = id.slice(colon + 1);
  const pack = packLicense(prefix);
  if (!pack) return undefined;
  return { ...pack, trademark: pack.logos || isBrandIcon(name) };
};
