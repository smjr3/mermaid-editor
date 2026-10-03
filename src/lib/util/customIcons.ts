import DOMPurify from 'dompurify';
import type { AsyncIconLoader } from 'mermaid';

/**
 * Icon packs that do not ship in the bundle: ones a deployment hosts itself
 * (MERMAID_ICON_PACKS, e.g. a vendor's official icons published next to the
 * site on GitLab Pages) and ones a user imports from SVG files or an Iconify
 * JSON file.
 *
 * Every icon body from these sources is sanitised before mermaid sees it.
 * mermaid inserts icon bodies into the diagram SVG as markup, so an unsanitised
 * pack is a script-injection vector — and an imported or remote pack is
 * exactly the untrusted input that would carry one.
 */

export type IconifyJSON = Awaited<ReturnType<AsyncIconLoader['loader']>>;

type IconData = IconifyJSON['icons'][string];

// Iconify's own syntax for prefixes and icon names (see @iconify/utils' stringToIcon).
const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

/** An Iconify icon name from a file name. Strips Azure's `12345-icon-service-` prefix. */
export const toIconName = (fileName: string): string =>
  slug(fileName.replace(/\.svg$/i, '')).replace(/^\d+-icon-service-/, '');

/** A valid pack prefix from user input, or undefined when nothing usable is left. */
export const toPrefix = (value: string): string | undefined => {
  const prefix = slug(value);
  return namePattern.test(prefix) ? prefix : undefined;
};

const sanitizeBody = (body: string): string =>
  DOMPurify.sanitize(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, {
    FORBID_TAGS: ['foreignObject', 'script', 'style'],
    USE_PROFILES: { svg: true, svgFilters: true }
  })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

const positive = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : undefined;
};

/** One icon from the text of an SVG file: its sanitised drawing and its size. */
export const svgToIcon = (text: string): IconData => {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = document.documentElement;
  if (root.nodeName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
    throw new Error('Not an SVG file');
  }
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const width = positive(viewBox[2]) ?? positive(root.getAttribute('width')) ?? 24;
  const height = positive(viewBox[3]) ?? positive(root.getAttribute('height')) ?? 24;
  const left = Number.isFinite(viewBox[0]) ? viewBox[0] : 0;
  const top = Number.isFinite(viewBox[1]) ? viewBox[1] : 0;
  const inner = [...root.childNodes].map((node) => new XMLSerializer().serializeToString(node));
  return {
    body: sanitizeBody(inner.join('')),
    height,
    width,
    ...(left ? { left } : {}),
    ...(top ? { top } : {})
  };
};

/** An icon pack from SVG files, named after the files. */
export const buildIconSet = (
  prefix: string,
  files: { name: string; text: string }[]
): IconifyJSON => {
  const icons: Record<string, IconData> = {};
  for (const { name, text } of files) {
    const iconName = toIconName(name);
    if (namePattern.test(iconName)) {
      icons[iconName] = svgToIcon(text);
    }
  }
  return { icons, prefix };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate an Iconify JSON pack and sanitise every body. Throws when the value
 * is not a pack. `prefix` overrides the pack's own.
 */
export const sanitizeIconSet = (value: unknown, prefix?: string): IconifyJSON => {
  if (!isRecord(value) || !isRecord(value.icons)) {
    throw new Error('Not an Iconify icon pack');
  }
  const name = toPrefix(prefix ?? (typeof value.prefix === 'string' ? value.prefix : ''));
  if (!name) {
    throw new Error('The icon pack has no usable prefix');
  }
  const icons: Record<string, IconData> = {};
  for (const [iconName, icon] of Object.entries(value.icons)) {
    if (namePattern.test(iconName) && isRecord(icon) && typeof icon.body === 'string') {
      icons[iconName] = {
        body: sanitizeBody(icon.body),
        ...(positive(icon.width) ? { width: positive(icon.width) } : {}),
        ...(positive(icon.height) ? { height: positive(icon.height) } : {})
      };
    }
  }
  return {
    icons,
    prefix: name,
    ...(positive(value.width) ? { width: positive(value.width) } : {}),
    ...(positive(value.height) ? { height: positive(value.height) } : {})
  };
};

/** `MERMAID_ICON_PACKS`: comma-separated `prefix=url` pairs. Malformed entries are skipped. */
export const parseIconPackEnv = (value: string | undefined): { name: string; url: string }[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.split('='))
    .filter((parts) => parts.length >= 2)
    .map(([name, ...url]) => ({ name: toPrefix(name) ?? '', url: url.join('=').trim() }))
    .filter(({ name, url }) => name && url);

/** Loaders for the packs a deployment hosts, fetched (and sanitised) on first use. */
export const remoteIconPacks = (value: string | undefined): AsyncIconLoader[] =>
  parseIconPackEnv(value).map(({ name, url }) => ({
    loader: async () => {
      const response = await fetch(new URL(url, document.baseURI));
      if (!response.ok) {
        throw new Error(`Icon pack ${name}: HTTP ${response.status}`);
      }
      return sanitizeIconSet(await response.json(), name);
    },
    name
  }));
