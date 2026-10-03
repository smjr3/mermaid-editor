/**
 * Convert a folder of SVG files into an Iconify JSON icon pack, so a deployment
 * can host icons it may not redistribute in this repository — a vendor's
 * official architecture icons, an in-house set — next to the site:
 *
 *   node scripts/svg-to-iconify.js <svg-folder> <prefix> <output.json>
 *
 * e.g. in the GitLab Pages job, after `pnpm build:pages`:
 *
 *   node scripts/svg-to-iconify.js azure-icons azure public/icon-packs/azure.json
 *
 * and build with MERMAID_ICON_PACKS='azure=./icon-packs/azure.json'. Folders are
 * searched recursively; icon names come from file names (Azure's
 * `12345-icon-service-` prefix is dropped). The app sanitises every icon when it
 * loads the pack, so this script only extracts markup. See docs-dev/ICONS.md.
 *
 * Node-only and dependency-free, so it runs the same on Windows.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const slug = (/** @type {string} */ value) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** @param {string} dir @returns {string[]} */
const svgFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return svgFiles(path);
    return /\.svg$/i.test(entry.name) ? [path] : [];
  });

/** @param {string | undefined} value */
const positive = (value) => {
  const number = Number.parseFloat(value ?? '');
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

/**
 * Turn `<style>` class rules into attributes on the elements that use them.
 * Vendor icons (Google Cloud's, for one) style paths with `.cls-1{fill:…}`;
 * every icon in a diagram shares the page, so their class rules would restyle
 * each other, and the app strips `<style>` anyway.
 * @param {string} text
 */
export const inlineStyles = (text) => {
  /** @type {Map<string, [string, string][]>} */
  const rules = new Map();
  for (const [, css] of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const [, selectors, block] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const declarations = block
        .split(';')
        .map((declaration) => declaration.split(':').map((part) => part.trim()))
        .filter(([property, value]) => /^[a-z-]+$/.test(property ?? '') && value)
        .map(
          ([property, value]) =>
            /** @type {[string, string]} */ ([property, value.replaceAll('"', "'")])
        );
      for (const selector of selectors.split(',').map((part) => part.trim())) {
        const name = /^\.([\w-]+)$/.exec(selector)?.[1];
        if (name) rules.set(name, [...(rules.get(name) ?? []), ...declarations]);
      }
    }
  }
  return text
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replaceAll(/<defs>\s*<\/defs>/gi, '')
    .replaceAll(
      /<([\w:-]+)([^>]*?)\sclass\s*=\s*["']([^"']*)["']([^>]*)>/g,
      (_, tag, before, classes, after) => {
        /** @type {Map<string, string>} */
        const styles = new Map();
        for (const name of classes.split(/\s+/)) {
          for (const [property, value] of rules.get(name) ?? []) styles.set(property, value);
        }
        const drop = (/** @type {string} */ attributes) =>
          attributes.replaceAll(/\s([\w:-]+)\s*=\s*("[^"]*"|'[^']*')/g, (attribute, name) =>
            styles.has(name) ? '' : attribute
          );
        const added = [...styles].map(([property, value]) => ` ${property}="${value}"`).join('');
        return `<${tag}${drop(before)}${added}${drop(after)}>`;
      }
    );
};

/**
 * @param {string} source
 * @returns {{ body: string, width: number, height: number } | undefined}
 */
export const parseSvg = (source) => {
  const text = inlineStyles(source);
  const open = /<svg\b([^>]*)>/i.exec(text);
  const close = text.lastIndexOf('</svg>');
  if (!open || close === -1) return undefined;
  const attributes = open[1];
  const attribute = (/** @type {string} */ name) =>
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attributes)?.[1];
  const viewBox = (attribute('viewBox') ?? '').split(/[\s,]+/);
  return {
    body: text.slice(open.index + open[0].length, close).trim(),
    height: positive(viewBox[3]) ?? positive(attribute('height')) ?? 24,
    width: positive(viewBox[2]) ?? positive(attribute('width')) ?? 24
  };
};

/**
 * @param {string} dir
 * @param {string} prefix
 * @returns {{ prefix: string, icons: Record<string, { body: string, width: number, height: number }> }}
 */
export const convertSvgDirectory = (dir, prefix) => {
  /** @type {Record<string, { body: string, width: number, height: number }>} */
  const icons = {};
  for (const file of svgFiles(dir)) {
    const name = slug(file.replace(/^.*[\\/]/, '').replace(/\.svg$/i, '')).replace(
      /^\d+-icon-service-/,
      ''
    );
    const icon = parseSvg(readFileSync(file, 'utf8'));
    if (icon && namePattern.test(name)) icons[name] = icon;
  }
  return { icons, prefix: slug(prefix) };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, prefix, out] = process.argv.slice(2);
  if (!dir || !prefix || !out) {
    console.error('usage: node scripts/svg-to-iconify.js <svg-folder> <prefix> <output.json>');
    process.exit(1);
  }
  const pack = convertSvgDirectory(dir, prefix);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(pack));
  console.log(`${Object.keys(pack.icons).length} icons → ${out} (prefix "${pack.prefix}")`);
}
