import { remoteIconPacks } from './customIcons';
import { listIconPacks } from './customIconStore';
import { env } from './env';
import { iconPacks } from './iconPacks';
import { searchIcons, type SearchablePack } from './iconSearch';
import { standardIconPack, standardPrefix } from './standardIcons';
import type { AsyncIconLoader } from 'mermaid';

/**
 * Local: the icon packs as a catalogue the editor can question — which packs
 * exist, whether an icon reference in the code is one of them, and what to
 * suggest when it is not. The picker (IconPicker.svelte) and the "unknown
 * icons" helper (UnknownIcons.svelte) share the loaded packs through here.
 */

const loaders: AsyncIconLoader[] = [...iconPacks, ...remoteIconPacks(env.iconPacks)];
const cache = new Map<string, Promise<SearchablePack | undefined>>();

/** The bundled, hosted and standard pack names; imported packs come from `importedPacks`. */
export const packNames = (): string[] => [standardPrefix, ...loaders.map(({ name }) => name)];

/** Packs the user imported in this browser (IndexedDB); empty when that store is unavailable. */
export const importedPacks = async (): Promise<SearchablePack[]> => {
  try {
    return (await listIconPacks()) as SearchablePack[];
  } catch {
    return [];
  }
};

/** A pack by name, loaded once; undefined for a name nothing provides or a pack that fails to load. */
export const loadPack = (name: string): Promise<SearchablePack | undefined> => {
  if (name === standardPrefix) return Promise.resolve(standardIconPack as SearchablePack);
  let pending = cache.get(name);
  if (!pending) {
    const loader = loaders.find((candidate) => candidate.name === name);
    pending = loader
      ? loader.loader().then(
          (json) => ({ ...json, prefix: name }) as SearchablePack,
          () => undefined
        )
      : importedPacks().then((packs) => packs.find((pack) => pack.prefix === name));
    cache.set(name, pending);
  }
  return pending;
};

const hasIcon = (pack: SearchablePack, name: string): boolean =>
  name in pack.icons || name in (pack.aliases ?? {});

// `service id(prefix:name)[Label]` / `group id(icon)[Label]` / `junction j(icon)`, and
// flowchart `@{ icon: "prefix:name" }`. `fa:` names are Font Awesome, not an icon pack.
const archIcon = /^\s*(?:service|group|junction)\s+[\w-]+\(\s*([\w-]+(?::[\w-]+)?)\s*\)/;
const flowIcon = /@\{[^}]*\bicon\s*:\s*(["'])([\w-]+:[\w-]+)\1/g;

/** The icon references the code uses, in order, each once. */
export const iconRefsIn = (code: string): string[] => {
  const refs = new Set<string>();
  for (const line of code.split(/\r?\n/)) {
    const arch = archIcon.exec(line);
    if (arch) refs.add(arch[1]);
    for (const match of line.matchAll(flowIcon)) refs.add(match[2]);
  }
  return [...refs].filter((ref) => !ref.startsWith('fa:'));
};

export interface UnknownIcon {
  ref: string;
  /** Existing references that look like what was meant, best first. */
  candidates: string[];
}

const nameOf = (ref: string): string => ref.slice(ref.indexOf(':') + 1);

/** Suggestions for a reference: icons named like it, across every pack. */
export const suggestIcons = async (ref: string, limit = 8): Promise<string[]> => {
  const packs = (
    await Promise.all([...packNames().map(loadPack), importedPacks().then((packs) => packs)])
  )
    .flat()
    .filter((pack): pack is SearchablePack => pack !== undefined);
  const name = nameOf(ref);
  const colon = ref.indexOf(':');
  const prefix = colon === -1 ? '' : ref.slice(0, colon);
  const words = name.split('-').filter(Boolean);
  const seen = new Set<string>();
  const found: string[] = [];
  // A made-up pack name is usually a hint (`aws:lambda` means `logos:aws-lambda`),
  // so it leads; then the whole name, then its words from the longest run down,
  // so `aws-sqs-typo` still finds `aws-sqs`.
  const queries = [
    ...(prefix && !packNames().includes(prefix) ? [`${prefix} ${name}`] : []),
    name,
    ...words.map((_, i) => words.slice(0, words.length - i).join(' '))
  ];
  for (const query of queries) {
    for (const match of searchIcons(packs, query, limit)) {
      const id = match.id.startsWith(`${standardPrefix}:`)
        ? match.id.slice(standardPrefix.length + 1)
        : match.id;
      if (!seen.has(id)) {
        seen.add(id);
        found.push(id);
      }
      if (found.length >= limit) return found;
    }
  }
  return found;
};

/** The references in the code that no pack provides, each with suggestions. */
export const checkIcons = async (code: string): Promise<UnknownIcon[]> => {
  const unknown: UnknownIcon[] = [];
  for (const ref of iconRefsIn(code)) {
    const colon = ref.indexOf(':');
    const pack = await loadPack(colon === -1 ? standardPrefix : ref.slice(0, colon));
    if (pack && hasIcon(pack, nameOf(ref))) continue;
    unknown.push({ candidates: await suggestIcons(ref), ref });
  }
  return unknown;
};

const escape = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}-]/g, String.raw`\$&`);

/** The code with every icon use of `from` changed to `to`; labels and ids are left alone. */
export const replaceIconRef = (code: string, from: string, to: string): string =>
  code
    .replaceAll(
      new RegExp(
        String.raw`(^\s*(?:service|group|junction)\s+[\w-]+\(\s*)${escape(from)}(\s*\))`,
        'gm'
      ),
      `$1${to}$2`
    )
    .replaceAll(
      new RegExp(String.raw`(@\{[^}]*\bicon\s*:\s*)(["'])${escape(from)}\2`, 'g'),
      `$1$2${to}$2`
    );
