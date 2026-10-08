/**
 * Local: the desktop layout settings of the tools pane.
 *
 * - `paneOrder`: which side the tools sit on. The default puts the tools on the left
 *   (tools | diagram | code), because people start from the left and most of this
 *   fork's users build diagrams with the tools; `code-left` is mermaid.live's order.
 *   Kept per browser.
 * - `toolsAccordion`: the tool sections in the desktop tools pane sit in three tabs —
 *   作る (make: templates and new diagrams; AI and unknown icons), 直す (fix: the
 *   selection, then add, layout, edit, colours, icons) and 出す (out: export; share
 *   links) — and are an accordion: one section open at a time, filling the pane's
 *   height. Opening a section shows its tab. `enabled` is false on a phone, where the
 *   cards stack under the editor and open independently as upstream's do.
 * - `toolsWidths` and `foldCodeWhileFixing`: 直す holds the longest forms, so while it is
 *   shown the tools pane has a width of its own (wider by default, remembered apart from
 *   the other tabs' width), and the code pane folds away unless the user turned that off.
 */
import { TID } from '$/constants';
import { persisted } from './persist.svelte';

export type PaneOrder = 'tools-left' | 'code-left';

export const paneOrder = persisted<PaneOrder>('paneOrder', 'tools-left');

export const swapPanes = (): void => {
  paneOrder.value = paneOrder.value === 'code-left' ? 'tools-left' : 'code-left';
};

export type ToolsTab = 'make' | 'fix' | 'out';

/** The tabs in order, each with the test ids of its sections' headers, in order. */
export const toolsTabs: { id: ToolsTab; sections: string[] }[] = [
  { id: 'make', sections: [TID.sampleDiagramsCard, TID.aiCard] },
  {
    id: 'fix',
    sections: [TID.addCard, TID.layoutCard, TID.editCard, TID.colorsCard, TID.iconPacksCard]
  },
  { id: 'out', sections: [TID.actionsCard, TID.shareCard] }
];

/** The tab a section (by its header's test id) belongs to. */
export const tabOf = (section: string): ToolsTab | undefined =>
  toolsTabs.find(({ sections }) => sections.includes(section))?.id;

export const toolsAccordion = $state<{
  enabled: boolean;
  open: string | undefined;
  tab: ToolsTab;
  /** The section last open in each tab, which showing the tab again reopens. */
  last: Partial<Record<ToolsTab, string>>;
}>({
  enabled: false,
  last: {},
  // The templates section is the one open on a first visit, as upstream's samples card is.
  open: TID.sampleDiagramsCard,
  tab: 'make'
});

/** Opens a section (closing the open one) and shows its tab. */
export const openSection = (section: string): void => {
  const tab = tabOf(section);
  toolsAccordion.open = section;
  if (tab) {
    toolsAccordion.tab = tab;
    toolsAccordion.last[tab] = section;
  }
};

/** A click on a section's header: opens it, or closes it when it is the open one. */
export const toggleSection = (section: string): void => {
  if (toolsAccordion.open === section) {
    toolsAccordion.open = undefined;
    const tab = tabOf(section);
    if (tab) toolsAccordion.tab = tab;
  } else {
    openSection(section);
  }
};

/** Shows a tab, reopening the section last open in it (or its first one). */
export const showTab = (tab: ToolsTab): void => {
  if (toolsAccordion.tab === tab && tabOf(toolsAccordion.open ?? '') === tab) return;
  const sections = toolsTabs.find(({ id }) => id === tab)?.sections ?? [];
  openSection(toolsAccordion.last[tab] ?? sections[0]);
};

/** Which width the tools pane uses: 直す's own, or the one the other tabs share. */
export type ToolsWidthMode = 'fix' | 'normal';

export const widthModeOf = (tab: ToolsTab): ToolsWidthMode => (tab === 'fix' ? 'fix' : 'normal');

/**
 * The tools pane's width (% of the window) per mode, as the user last left it. Unset
 * until the user (or the first switch) sets it; `defaultToolsSize` stands in until then.
 */
export const toolsWidths = persisted<Partial<Record<ToolsWidthMode, number>>>(
  'toolsPaneWidths',
  {}
);

/**
 * The default width of the tools pane (% of the window): about a third of a wide window
 * for 作る and 出す; 直す, whose forms and tables are the widest, gets two fifths.
 */
export const defaultToolsSize = (mode: ToolsWidthMode, windowWidth: number): number => {
  if (mode === 'fix') return windowWidth >= 1280 ? 40 : 36;
  return windowWidth >= 1280 ? 32 : 25;
};

/** The width to use for a mode: the remembered one, if sensible, else the default. */
export const toolsSizeFor = (mode: ToolsWidthMode, windowWidth: number): number => {
  const saved = toolsWidths.value[mode];
  return typeof saved === 'number' && saved >= 15 && saved <= 70
    ? saved
    : defaultToolsSize(mode, windowWidth);
};

/** Remembers the width the user left a mode at (a collapsed pane is not a width). */
export const rememberToolsSize = (mode: ToolsWidthMode, size: number): void => {
  if (size <= 0 || Math.abs((toolsWidths.value[mode] ?? -1) - size) < 0.1) return;
  toolsWidths.value = { ...toolsWidths.value, [mode]: Math.round(size * 10) / 10 };
};

/** Folds the code pane away while 直す is shown (on by default: most users never code). */
export const foldCodeWhileFixing = persisted<boolean>('foldCodeWhileFixing', true);

/**
 * True while the code pane is folded because 直す is shown (not by the user), so leaving
 * 直す — or reloading the page — brings it back. Kept per browser, because the pane sizes
 * paneforge stores would otherwise reopen the page with the code folded in 作る.
 */
export const codeFoldedForFix = persisted<boolean>('codeFoldedForFix', false);
