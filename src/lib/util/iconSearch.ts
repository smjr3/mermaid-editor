/**
 * Local: the icon picker in the "Icons" card (IconPicker.svelte). Searches the
 * loaded icon packs by name and inserts the chosen `prefix:name` into the code
 * editor at the cursor.
 */

interface IconData {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

export interface SearchablePack {
  prefix: string;
  icons: Record<string, IconData>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

export interface IconMatch {
  id: string;
  icon: Required<Pick<IconData, 'body' | 'width' | 'height'>> & Pick<IconData, 'left' | 'top'>;
}

/** Icons whose names contain every word of the query; exact, then prefix matches first. */
export const searchIcons = (packs: SearchablePack[], query: string, limit = 60): IconMatch[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { match: IconMatch; score: number }[] = [];
  for (const pack of packs) {
    const names = [...Object.keys(pack.icons), ...Object.keys(pack.aliases ?? {})];
    for (const name of names) {
      if (!words.every((word) => name.includes(word))) continue;
      const data = pack.icons[name] ?? pack.icons[pack.aliases?.[name]?.parent ?? ''];
      if (!data) continue;
      const score = name === words[0] ? 0 : name.startsWith(words[0]) ? 1 : 2;
      scored.push({
        match: {
          icon: {
            ...data,
            height: data.height ?? pack.height ?? 16,
            width: data.width ?? pack.width ?? 16
          },
          id: `${pack.prefix}:${name}`
        },
        score
      });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.match.id.length - b.match.id.length)
    .slice(0, limit)
    .map(({ match }) => match);
};

/** An inline SVG for a preview. Bodies come from bundled packs or packs sanitised on load. */
export const iconSvg = ({ body, width, height, left = 0, top = 0 }: IconMatch['icon']): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="100%" height="100%">${body}</svg>`;

type Inserter = (text: string) => boolean;
let inserter: Inserter | undefined;

/** The code editor registers how to insert text at its cursor; returns the unregister call. */
export const registerEditorInserter = (next: Inserter): (() => void) => {
  inserter = next;
  return () => {
    if (inserter === next) inserter = undefined;
  };
};

/** Inserts text at the editor's cursor. False when no editor can take it (mobile, config tab). */
export const insertIntoEditor = (text: string): boolean => inserter?.(text) ?? false;
