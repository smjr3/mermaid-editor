import DOMPurify from 'dompurify';
import type { AsyncIconLoader } from 'mermaid';
import { fetchAllowed } from './offline';

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

// Local (N04): the style attribute and the presentation attributes are CSS, and CSS
// lets a name be spelt with escapes (`u\72l(` is `url(`), in any case, with comments
// in between — so they are read with a CSS tokenizer (below, after CSS Syntax 3)
// rather than matched as text. A value is kept only when every function in it is
// one that computes a value (colours, maths, transforms, filters, shapes, gradients,
// `var()`) and every `url()`/`src()` names a local `#id`. Anything else — an
// external url, `image-set()`, an unknown function, a malformed url or string — drops
// the declaration (or the attribute).
type CssToken = { end?: number } & (
  | { type: 'bad' | 'close' | 'colon' | 'open' | 'other' | 'semicolon' | 'space' }
  | { type: 'function'; name: string }
  | { type: 'string' | 'url' | 'word'; value: string }
);

const isHex = (char: string | undefined) => char !== undefined && /^[\da-f]$/i.test(char);
const isSpace = (char: string | undefined) => char !== undefined && /^[\t\n\f\r ]$/.test(char);
const isNameChar = (char: string | undefined) =>
  char !== undefined && (/^[\w-]$/.test(char) || (char.codePointAt(0) ?? 0) >= 0x80);

const tokenizeCss = (text: string): CssToken[] => {
  const tokens: CssToken[] = [];
  let index = 0;
  // Each token records where it ends in the text, so callers can cut the text at one.
  const push = (token: CssToken) => {
    tokens.push({ ...token, end: index });
  };
  // A backslash starts an escape unless a newline follows it (end of text: U+FFFD).
  const startsEscape = (at: number) => text[at] === '\\' && !/^[\n\f\r]$/.test(text[at + 1] ?? '');
  // The code point an escape at `index` (a backslash) stands for; moves past it.
  const readEscape = (): string => {
    index += 1;
    if (index >= text.length) return '�';
    if (isHex(text[index])) {
      let hex = '';
      while (hex.length < 6 && isHex(text[index])) hex += text[index++];
      if (text[index] === '\r' && text[index + 1] === '\n') index += 2;
      else if (isSpace(text[index])) index += 1;
      const code = Number.parseInt(hex, 16);
      return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? '�'
        : String.fromCodePoint(code);
    }
    const char = String.fromCodePoint(text.codePointAt(index) ?? 0xfffd);
    index += char.length;
    return char;
  };
  const readName = (): string => {
    let name = '';
    while (index < text.length) {
      if (startsEscape(index)) name += readEscape();
      else if (isNameChar(text[index])) name += text[index++];
      else break;
    }
    return name;
  };
  const skipSpace = () => {
    while (isSpace(text[index])) index += 1;
  };
  while (index < text.length) {
    const char = text[index];
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 2;
      push({ type: 'space' });
    } else if (isSpace(char)) {
      skipSpace();
      push({ type: 'space' });
    } else if (char === '"' || char === "'") {
      index += 1;
      let value = '';
      let bad = true;
      while (index < text.length) {
        const next = text[index];
        if (next === char) {
          index += 1;
          bad = false;
          break;
        }
        if (/^[\n\f\r]$/.test(next)) break;
        if (next === '\\') {
          if (/^[\n\f\r]$/.test(text[index + 1] ?? '')) index += 2;
          else value += readEscape();
        } else {
          value += next;
          index += 1;
        }
      }
      push(bad ? { type: 'bad' } : { type: 'string', value });
    } else if (startsEscape(index) || isNameChar(char)) {
      const name = readName();
      if (text[index] !== '(') {
        push({ type: 'word', value: name });
        continue;
      }
      index += 1;
      const lower = name.toLowerCase();
      const start = index;
      skipSpace();
      if (lower === 'url' && text[index] !== '"' && text[index] !== "'") {
        // An unquoted url(…): its contents, escapes resolved, up to the `)`.
        let value = '';
        let bad = false;
        while (index < text.length && text[index] !== ')') {
          if (isSpace(text[index])) {
            skipSpace();
            if (index < text.length && text[index] !== ')') bad = true;
          } else if (/^["'(]$/.test(text[index])) {
            bad = true;
            index += 1;
          } else if (text[index] === '\\') {
            if (startsEscape(index)) value += readEscape();
            else {
              bad = true;
              index += 1;
            }
          } else value += text[index++];
        }
        if (index >= text.length) bad = true;
        index += 1;
        push(bad ? { type: 'bad' } : { type: 'url', value });
      } else {
        index = start;
        push({ name: lower, type: 'function' });
      }
    } else {
      index += 1;
      if (char === '(' || char === '[' || char === '{') push({ type: 'open' });
      else if (char === ')' || char === ']' || char === '}') push({ type: 'close' });
      else if (char === ';') push({ type: 'semicolon' });
      else if (char === ':') push({ type: 'colon' });
      else if (char === '\\') push({ type: 'bad' });
      else push({ type: 'other' });
    }
  }
  return tokens;
};

const valueFunctions = new Set(
  [
    // colours
    'rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark device-cmyk',
    // maths and custom properties (their own values are checked where they are set)
    'calc min max clamp round mod rem abs sign sin cos tan asin acos atan atan2 pow sqrt hypot log exp var env',
    // transforms
    'matrix matrix3d translate translatex translatey translatez translate3d scale scalex scaley scalez scale3d',
    'rotate rotatex rotatey rotatez rotate3d skew skewx skewy perspective',
    // filters, easing, basic shapes, gradients
    'blur brightness contrast drop-shadow grayscale hue-rotate invert opacity saturate sepia',
    'cubic-bezier steps linear inset circle ellipse polygon path rect xywh',
    'linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient',
    // references, allowed only to `#id` (checked below)
    'url src'
  ]
    .join(' ')
    .split(' ')
);
const referenceFunctions = new Set(['src', 'url']);
const isLocalReference = (value: string) => value.trim().startsWith('#');

/** Whether a CSS value (or a run of tokens of one) refers only to what is inside the icon. */
const safeCssTokens = (tokens: CssToken[]): boolean =>
  tokens.every((token, at) => {
    if (token.type === 'bad') return false;
    if (token.type === 'url') return isLocalReference(token.value);
    if (token.type !== 'function') return true;
    if (!valueFunctions.has(token.name)) return false;
    if (!referenceFunctions.has(token.name)) return true;
    // url("…")/src("…"): exactly one string naming a local id.
    const args = [];
    for (const next of tokens.slice(at + 1)) {
      if (next.type === 'close') break;
      if (next.type !== 'space') args.push(next);
    }
    const [only] = args;
    return args.length === 1 && only.type === 'string' && isLocalReference(only.value);
  });

const safeCssValue = (value: string): boolean => safeCssTokens(tokenizeCss(value));

// The attributes SVG reads as CSS (its presentation attributes, plus the transform
// lists), checked like a declaration in a style attribute.
const cssAttributes = new Set(
  [
    'alignment-baseline baseline-shift clip clip-path clip-rule color color-interpolation',
    'color-interpolation-filters color-rendering cursor direction display dominant-baseline fill',
    'fill-opacity fill-rule filter flood-color flood-opacity font font-family font-size',
    'font-size-adjust font-stretch font-style font-variant font-weight glyph-orientation-horizontal',
    'glyph-orientation-vertical image-rendering letter-spacing lighting-color marker marker-end',
    'marker-mid marker-start mask mask-type opacity overflow paint-order pointer-events',
    'shape-rendering stop-color stop-opacity stroke stroke-dasharray stroke-dashoffset',
    'stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor',
    'text-decoration text-overflow text-rendering transform transform-origin unicode-bidi',
    'vector-effect visibility white-space word-spacing writing-mode',
    'gradienttransform patterntransform'
  ]
    .join(' ')
    .split(' ')
);

// For attributes that are not CSS: the functions that would name another file.
const fetchingFunctions = new Set([
  '-webkit-image-set',
  'cross-fade',
  'element',
  'image',
  'image-set',
  'src',
  'url'
]);
const refersOutside = (value: string): boolean =>
  !safeCssTokens(
    tokenizeCss(value).filter(
      (token) =>
        token.type !== 'bad' && (token.type !== 'function' || fetchingFunctions.has(token.name))
    )
  );

// Properties that bind behaviour rather than draw (old IE/Gecko), dropped whatever their value.
const forbiddenProperties = new Set(['-moz-binding', 'behavior']);

/** The declarations of a style attribute that refer only to what is inside the icon. */
const safeStyle = (style: string): string => {
  // Cut at the top-level `;` tokens, so a `;` inside a string or a function stays put;
  // each declaration keeps its original text.
  const declarations: { text: string; tokens: CssToken[] }[] = [];
  let current: CssToken[] = [];
  let depth = 0;
  let start = 0;
  for (const token of tokenizeCss(style)) {
    if (token.type === 'open' || token.type === 'function') depth += 1;
    else if (token.type === 'close') depth = Math.max(0, depth - 1);
    if (token.type === 'semicolon' && depth === 0) {
      const end = token.end ?? style.length;
      declarations.push({ text: style.slice(start, end - 1), tokens: current });
      start = end;
      current = [];
    } else current.push(token);
  }
  declarations.push({ text: style.slice(start), tokens: current });
  const kept: string[] = [];
  for (const { text, tokens } of declarations) {
    const colon = tokens.findIndex((token) => token.type === 'colon');
    if (colon === -1) continue;
    // The property: one name (escapes resolved), with nothing but spaces around it.
    const names = tokens.slice(0, colon).filter((token) => token.type !== 'space');
    const [property] = names;
    if (names.length !== 1 || property.type !== 'word') continue;
    const name = property.value.toLowerCase();
    if (!/^(--|-?[a-z])[\w-]*$/.test(name) || forbiddenProperties.has(name)) continue;
    if (safeCssTokens(tokens.slice(colon + 1))) kept.push(text);
  }
  return kept.join(';');
};

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
      const lower = attribute.toLowerCase();
      if (lower === 'style') {
        const kept = safeStyle(value);
        if (kept.trim()) element.setAttribute('style', kept);
        else element.removeAttribute('style');
      } else if (cssAttributes.has(lower)) {
        if (!safeCssValue(value)) element.removeAttribute(attribute);
      } else if (externalUrl.test(value) || refersOutside(value)) {
        // Not CSS, so never fetched by the browser; dropped anyway when it names a
        // url() or an image function outside the icon, escapes resolved.
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
      // Local (R04, N03): MERMAID_OFFLINE refuses a pack on another site, and a
      // redirect before it is followed; this site's own packs stay.
      const response = await fetchAllowed(target);
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
