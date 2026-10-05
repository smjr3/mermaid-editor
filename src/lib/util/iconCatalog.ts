/**
 * Local: every icon pack the editor knows — mermaid's standard icons, the
 * bundled and build-time packs, the deployment's hosted packs and the ones this
 * browser imported — loaded on demand and searched by name. Used by the Edit
 * card's icon search (IconChooser.svelte); the Icons card keeps its own copy
 * in IconPicker.svelte, which also offers a pack filter and a large view.
 */
import { remoteIconPacks } from './customIcons';
import { listIconPacks } from './customIconStore';
import { env } from './env';
import { iconPacks } from './iconPacks';
import { searchIcons, type IconMatch, type SearchablePack } from './iconSearch';
import { standardIconPack, standardPrefix } from './standardIcons';

const loaders = [...iconPacks, ...remoteIconPacks(env.iconPacks)];
const cache = new Map<string, Promise<SearchablePack | undefined>>();
let imported: Promise<SearchablePack[]> | undefined;

const importedPacks = (): Promise<SearchablePack[]> => {
  imported ??= listIconPacks().then(
    (packs) => packs as SearchablePack[],
    () => []
  );
  return imported;
};

/** One pack by prefix, loaded once; undefined when it cannot be loaded. */
export const loadPack = async (name: string): Promise<SearchablePack | undefined> => {
  if (name === standardPrefix) return standardIconPack;
  const own = (await importedPacks()).find((pack) => pack.prefix === name);
  if (own) return own;
  let cached = cache.get(name);
  if (!cached) {
    const loader = loaders.find((candidate) => candidate.name === name);
    cached = loader
      ? loader.loader().then(
          (json) => ({ ...json, prefix: name }) as SearchablePack,
          () => undefined
        )
      : Promise.resolve(undefined);
    cache.set(name, cached);
  }
  return cached;
};

/** Every pack's prefix, mermaid's standard icons first. */
export const packNames = async (): Promise<string[]> => [
  standardPrefix,
  ...loaders.map(({ name }) => name),
  ...(await importedPacks()).map(({ prefix }) => prefix)
];

/**
 * Icons whose names match the query across every pack, standard ones first.
 * mermaid's standard icons are known to architecture diagrams only, so a
 * flowchart node's search leaves them out (`standard: false`).
 */
export const searchCatalog = async (
  query: string,
  { limit = 40, standard = true }: { limit?: number; standard?: boolean } = {}
): Promise<IconMatch[]> => {
  if (query.trim().length < 2) return [];
  const names = (await packNames()).filter((name) => standard || name !== standardPrefix);
  const packs = (await Promise.all(names.map(loadPack))).filter((pack) => pack !== undefined);
  return [
    ...searchIcons(
      packs.filter(({ prefix }) => prefix === standardPrefix),
      query
    ),
    ...searchIcons(
      packs.filter(({ prefix }) => prefix !== standardPrefix),
      query,
      limit
    )
  ].slice(0, limit);
};
