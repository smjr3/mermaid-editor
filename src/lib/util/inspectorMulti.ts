/**
 * Local: what the inspector shows for several selected items (MultiSection.svelte) —
 * which tab heads the panel, which commands of the registry (selectionCommands.ts)
 * become a row and with what control, and how a row's value and the colour buttons'
 * swatches translate into each other. Pure functions, so the panel's rules are unit
 * tested apart from the components.
 */
import type { EditObject } from './diagramModify';
import { swatches, type Swatch } from './colors';
import { tabOfSelection, type InspectorTabId } from './inspectorTabs';
import type { Selected } from './selection.svelte';
import type { CommandKey, SelectionCommand } from './selectionCommands';

/** The tab 「選択」 that heads a selection of several kinds (図形 and 矢印 together). */
export const SELECTION_TAB: InspectorTabId = 'selection';

/**
 * The tab a selection of several items belongs to: the kind's tab when they are all of
 * one kind (図形 / 矢印 / レーン …), 「選択」 when they are mixed, 図全体 for none.
 */
export const tabOfItems = (
  code: string,
  items: Selected[],
  objects: EditObject[] = []
): InspectorTabId => {
  if (items.length === 0) return 'all';
  const tabs = new Set(items.map((item) => tabOfSelection(code, item, objects)));
  return tabs.size === 1 ? [...tabs][0] : SELECTION_TAB;
};

/** How a multi-selection row shows its command. */
export type RowControl = 'fill' | 'line' | 'select' | 'segmented' | 'toggle';

const controls: Partial<Record<CommandKey, RowControl>> = {
  arrowHead: 'segmented',
  bold: 'toggle',
  edgeLength: 'segmented',
  fillColor: 'fill',
  lineStyle: 'segmented',
  moveToLane: 'select',
  shape: 'select',
  strokeColor: 'line',
  textColor: 'line',
  textSize: 'segmented'
};

/** The control a command gets as a row, or undefined for one that is not a row. */
export const rowControl = (key: CommandKey): RowControl | undefined => controls[key];

/**
 * The commands that make a value row of the multi view, in registry order: every
 * `choice` command but 「同じものを選ぶ」, and 太字 (an action with a current value, shown
 * as a toggle). 削除 and 「同じものを選ぶ」 have their own rows.
 */
export const rowCommands = (available: SelectionCommand[]): SelectionCommand[] =>
  available.filter((command) => rowControl(command.key) !== undefined);

/**
 * The swatch the 塗り row shows for a fill value: the named swatch, undefined for 'none'
 * (the theme's colour) and a swatch no button has for a colour outside the palette or
 * for 「まちまち」, so that no button is pressed.
 */
export const fillSwatch = (value: string | undefined): Swatch | undefined => {
  if (value === undefined || value === 'none') return undefined;
  return swatches.find(({ name }) => name === value) ?? { fill: 'mixed', stroke: 'mixed' };
};

/**
 * The 塗り command's value for a swatch the buttons picked: the swatch's name, 'none'
 * for the theme's colour, undefined for a colour outside the built-in palette (a
 * deployment's presets, ＋好きな色), which the row writes through `applyToAll` itself.
 */
export const fillValue = (swatch: Swatch | undefined): string | undefined => {
  if (!swatch) return 'none';
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return swatches.find(({ fill, stroke }) => same(fill, swatch.fill) && same(stroke, swatch.stroke))
    ?.name;
};

/** A line colour (枠, 文字) as the ColorRow shows it: the hex, undefined for 'none' or 「まちまち」. */
export const lineCurrent = (value: string | undefined, mixed: boolean): string | undefined =>
  mixed ? 'mixed' : value === 'none' ? undefined : value;
