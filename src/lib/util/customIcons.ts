import DOMPurify from 'dompurify';
import type { AsyncIconLoader } from 'mermaid';
import { assertFetchAllowed } from './offline';

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

// Local (R04): an icon is drawn on every render, so anything in it that points outside
// it would be fetched without a click: an <image> that is not embedded, a <use> of
// another file, a url(…) paint, filter, mask or clip that is not `#id`. Those go;
// links (<a href>) stay, since they only go anywhere when clicked.
const linkAttributes = ['href', 'xlink:href'];
const localUrl = /^\s*['"]?#/;
const externalUrl = /url\(\s*(?!['"]?\s*#)[^)]*\)/i;
const externalDeclaration = (declaration: string) => externalUrl.test(declaration);

const dropExternalReferences = (root: Element): void => {
  for (const element of root.querySelectorAll('*')) {
    const name = element.localName.toLowerCase();
    const link = linkAttributes
      .map((attribute) => element.getAttribute(attribute))
      .find((value): value is string => value !== null);
    if (
      (name === 'image' || name === 'feimage') &&
      link !== undefined &&
      !/^\s*data:/i.test(link)
    ) {
      element.remove();
      continue;
    }
    if (name === 'use' && link !== undefined && !localUrl.test(link)) {
      element.remove();
      continue;
    }
    for (const { name: attribute, value } of [...element.attributes]) {
      if (attribute === 'style') {
        const kept = value.split(';').filter((part) => !externalDeclaration(part));
        if (kept.length === 0 || kept.every((part) => !part.trim())) {
          element.removeAttribute('style');
        } else {
          element.setAttribute('style', kept.join(';'));
        }
      } else if (externalUrl.test(value)) {
        element.removeAttribute(attribute);
      }
    }
  }
};

const sanitizeBody = (body: string): string => {
  const sanitized = DOMPurify.sanitize(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, {
    FORBID_TAGS: ['foreignObject', 'script', 'style'],
    USE_PROFILES: { svg: true, svgFilters: true }
  });
  // Parsed the way DOMPurify's own output is read back, so the markup keeps its form.
  const template = document.createElement('template');
  template.innerHTML = sanitized;
  const svg = template.content.querySelector('svg');
  if (!svg) return '';
  dropExternalReferences(svg);
  return svg.innerHTML;
};

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

type Transform = Pick<IconData, 'height' | 'hFlip' | 'left' | 'rotate' | 'top' | 'vFlip' | 'width'>;

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * The Iconify drawing properties of an icon, an alias or a pack's defaults that
 * are valid: a finite `left`/`top` (negative ones too — a viewBox may start
 * anywhere), a positive `width`/`height`, a whole number of quarter turns for
 * `rotate`, and boolean flips. Anything else is left out.
 */
const transformOf = (value: Record<string, unknown>): Transform => {
  const out: Transform = {};
  const left = finite(value.left);
  const top = finite(value.top);
  const width = positive(value.width);
  const height = positive(value.height);
  const rotate = finite(value.rotate);
  if (left !== undefined) out.left = left;
  if (top !== undefined) out.top = top;
  if (width !== undefined) out.width = width;
  if (height !== undefined) out.height = height;
  if (rotate !== undefined && Number.isInteger(rotate)) out.rotate = ((rotate % 4) + 4) % 4;
  if (typeof value.hFlip === 'boolean') out.hFlip = value.hFlip;
  if (typeof value.vFlip === 'boolean') out.vFlip = value.vFlip;
  return out;
};

// An icon or alias name: Iconify's syntax, and never a key Object.prototype has
// (`constructor`), which a lookup by name would otherwise find on every pack.
const isIconName = (name: string): boolean =>
  namePattern.test(name) && !(name in Object.prototype) && name !== 'prototype';

/**
 * The aliases of a pack that lead, possibly through other aliases, to one of its
 * icons. Ones that point nowhere, loop, or have no `parent` are left out.
 */
const sanitizeAliases = (
  value: unknown,
  icons: Record<string, IconData>
): Record<string, Transform & { parent: string }> => {
  if (!isRecord(value)) return {};
  const raw = new Map<string, Record<string, unknown>>();
  for (const [name, alias] of Object.entries(value)) {
    if (isIconName(name) && !Object.hasOwn(icons, name) && isRecord(alias)) {
      raw.set(name, alias);
    }
  }
  const resolves = (name: string, seen: Set<string>): boolean => {
    if (Object.hasOwn(icons, name)) return true;
    const alias = raw.get(name);
    if (!alias || seen.has(name) || typeof alias.parent !== 'string') return false;
    seen.add(name);
    return resolves(alias.parent, seen);
  };
  const aliases: Record<string, Transform & { parent: string }> = {};
  for (const [name, alias] of raw) {
    if (resolves(name, new Set())) {
      aliases[name] = { parent: alias.parent as string, ...transformOf(alias) };
    }
  }
  return aliases;
};

/**
 * Validate an Iconify JSON pack and sanitise every body. Throws when the value
 * is not a pack. `prefix` overrides the pack's own. What Iconify draws an icon
 * with — its position, size, rotation and flips, the pack's defaults for them,
 * and the pack's aliases — is kept, validated, so a pack read back from storage
 * draws the same as when it was imported.
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
    if (isIconName(iconName) && isRecord(icon) && typeof icon.body === 'string') {
      icons[iconName] = { body: sanitizeBody(icon.body), ...transformOf(icon) };
    }
  }
  const aliases = sanitizeAliases(value.aliases, icons);
  return {
    icons,
    prefix: name,
    ...(Object.keys(aliases).length > 0 ? { aliases } : {}),
    ...transformOf(value)
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
      const target = new URL(url, document.baseURI);
      // Local (R04): MERMAID_OFFLINE refuses a pack on another site; this site's own stay.
      assertFetchAllowed(target.href);
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`Icon pack ${name}: HTTP ${response.status}`);
      }
      return sanitizeIconSet(await response.json(), name);
    },
    name
  }));

/**
 * Loaders for the vendor packs scripts/fetch-icon-packs.js put in the build
 * (`import.meta.glob` of src/lib/vendor-icons/), named after their files.
 * Sanitised like any other pack; a name that clashes with a bundled pack is skipped.
 */
export const vendorIconPacks = (
  modules: Record<string, () => Promise<unknown>>,
  reserved: string[]
): AsyncIconLoader[] =>
  Object.entries(modules)
    .map(([path, load]) => ({
      load,
      name: toPrefix(path.replace(/^.*\//, '').replace(/\.json$/, ''))
    }))
    .filter(({ name }) => name !== undefined && !reserved.includes(name))
    .map(({ load, name = '' }) => ({
      loader: async () => sanitizeIconSet(((await load()) as { default: unknown }).default, name),
      name
    }));
