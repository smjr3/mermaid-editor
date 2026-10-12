/**
 * Local: the /edit shell's remembered layout — the widths of the code pane and the
 * inspector (% of the window) and whether each is folded to its rail. paneforge saves
 * nothing itself (no `autoSaveId`); the page reads these and writes them back when a
 * drag ends.
 *
 * `migrateEditorLayout` (migrations.svelte.ts) seeds them once from the layout keys of the
 * previous three-pane editor (tools | diagram | code) and removes those keys.
 */
import { persisted, readJSON } from './persist.svelte';

export interface PaneSizes {
  code: number;
  inspector: number;
}

export const CODE_MIN = 15;
export const CODE_MAX = 40;
export const INSPECTOR_MIN = 18;
export const INSPECTOR_MAX = 40;
/** The default widths, in pixels, before they are turned into % of the window. */
export const CODE_DEFAULT_PX = 270;
export const INSPECTOR_DEFAULT_PX = 300;

export const editorPaneSizes = persisted<Partial<PaneSizes>>('editorPaneSizes', {});
export const editorCodeCollapsed = persisted<boolean>('editorCodeCollapsed', false);
export const editorInspectorCollapsed = persisted<boolean>('editorInspectorCollapsed', false);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const round = (value: number): number => Math.round(value * 10) / 10;
const isSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const clampCode = (size: number): number => round(clamp(size, CODE_MIN, CODE_MAX));
export const clampInspector = (size: number): number =>
  round(clamp(size, INSPECTOR_MIN, INSPECTOR_MAX));

/** The default widths for a window this wide: 270px and 300px, as % within the limits. */
export const defaultPaneSizes = (windowWidth: number): PaneSizes => {
  const width = windowWidth > 0 ? windowWidth : 1280;
  return {
    code: clampCode((CODE_DEFAULT_PX / width) * 100),
    inspector: clampInspector((INSPECTOR_DEFAULT_PX / width) * 100)
  };
};

/** The widths to lay the panes out with: the remembered ones, else the defaults. */
export const paneSizesFor = (windowWidth: number): PaneSizes => {
  const saved = editorPaneSizes.value;
  const fallback = defaultPaneSizes(windowWidth);
  return {
    code: isSize(saved.code) ? clampCode(saved.code) : fallback.code,
    inspector: isSize(saved.inspector) ? clampInspector(saved.inspector) : fallback.inspector
  };
};

/** Remembers the widths a drag left the panes at (a folded pane is not a width). */
export const rememberPaneSizes = (sizes: Partial<PaneSizes>): void => {
  const next = { ...editorPaneSizes.value };
  if (isSize(sizes.code)) next.code = clampCode(sizes.code);
  if (isSize(sizes.inspector)) next.inspector = clampInspector(sizes.inspector);
  if (
    next.code === editorPaneSizes.value.code &&
    next.inspector === editorPaneSizes.value.inspector
  )
    return;
  editorPaneSizes.value = next;
};

/** The old editor's layout keys, which the migration reads and then removes. */
export const legacyLayoutKeys = [
  'toolsPaneWidths',
  'paneOrder',
  'foldCodeWhileFixing',
  'codeFoldedForFix',
  'paneforge:liveEditor',
  'paneforge:liveEditorToolsLeft'
] as const;

interface PaneforgeEntry {
  expandToSizes?: Record<string, number>;
  layout?: number[];
}

/**
 * The code pane's width paneforge saved for the old editor: the first pane in
 * `liveEditor` (code | diagram | tools), the last in `liveEditorToolsLeft`
 * (tools | diagram | code); the size it expands to when it was collapsed.
 */
const legacyCodeSize = (key: string, codeFirst: boolean): number | undefined => {
  const state = readJSON<Record<string, PaneforgeEntry> | undefined>(key, undefined);
  if (!state || typeof state !== 'object') return undefined;
  for (const entry of Object.values(state)) {
    const layout = entry?.layout;
    if (!Array.isArray(layout) || layout.length < 2) continue;
    const size = codeFirst ? layout[0] : layout.at(-1);
    if (isSize(size)) return size;
    const expand = entry.expandToSizes?.['pane-code'];
    if (isSize(expand)) return expand;
  }
  return undefined;
};

const removeItem = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; nothing to remove then.
  }
};

/**
 * Seeds the new layout from the old editor's and removes the old keys: the inspector
 * takes the tools pane's width (`toolsPaneWidths.fix`, else `.normal`), the code pane its
 * old width (from the order that was in use first), and a code pane folded only because
 * 直す was shown comes back unfolded. The stored `locale` goes too: there is no language
 * button any more.
 */
export const migrateEditorLayout = (): void => {
  if (typeof window === 'undefined') return;
  const widths = readJSON<{ fix?: unknown; normal?: unknown }>('toolsPaneWidths', {});
  const order = readJSON<string>('paneOrder', 'tools-left');
  const sizes: Partial<PaneSizes> = {};
  const tools = isSize(widths.fix) ? widths.fix : widths.normal;
  if (isSize(tools)) sizes.inspector = clampInspector(tools);
  const sources: [string, boolean][] = [
    ['paneforge:liveEditorToolsLeft', false],
    ['paneforge:liveEditor', true]
  ];
  if (order === 'code-left') sources.reverse();
  for (const [key, codeFirst] of sources) {
    const size = legacyCodeSize(key, codeFirst);
    if (size !== undefined) {
      sizes.code = clampCode(size);
      break;
    }
  }
  if (sizes.code !== undefined || sizes.inspector !== undefined) {
    editorPaneSizes.value = { ...editorPaneSizes.value, ...sizes };
  }
  if (readJSON<unknown>('codeFoldedForFix', false) === true) {
    editorCodeCollapsed.value = false;
  }
  for (const key of legacyLayoutKeys) removeItem(key);
  removeItem('locale');
};
