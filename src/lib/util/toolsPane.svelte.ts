/**
 * Local: the desktop layout settings of the tools pane.
 *
 * - `paneOrder`: which side the tools sit on. The default puts the tools on the left
 *   (tools | diagram | code), because people start from the left and most of this
 *   fork's users build diagrams with the tools; `code-left` is mermaid.live's order.
 *   Kept per browser.
 * - `toolsAccordion`: the tool sections in the desktop tools pane sit in three tabs —
 *   作る (make: new diagram, templates, samples; add), 直す (fix: the selection, edit,
 *   colours, layout, icons) and 出す (out: export and share; AI briefing) — and are an
 *   accordion: one section open at a time, filling the pane's height. Opening a section
 *   shows its tab. `enabled` is false on a phone, where the cards stack under the editor
 *   and open independently as upstream's do.
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
  { id: 'make', sections: [TID.sampleDiagramsCard, TID.addCard] },
  { id: 'fix', sections: [TID.editCard, TID.colorsCard, TID.layoutCard, TID.iconPacksCard] },
  { id: 'out', sections: [TID.actionsCard, TID.aiCard] }
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
  // The Samples section is the one open on a first visit, as upstream's card is.
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
