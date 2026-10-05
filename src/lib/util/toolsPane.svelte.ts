/**
 * Local: the desktop layout settings of the tools pane.
 *
 * - `paneOrder`: which side the tools sit on. The default puts the tools on the left
 *   (tools | diagram | code), because people start from the left and most of this
 *   fork's users build diagrams with the tools; `code-left` is mermaid.live's order.
 *   Kept per browser.
 * - `toolsAccordion`: the tool cards in the desktop tools pane are an accordion, one
 *   card open at a time, filling the pane's height. `enabled` is false on a phone,
 *   where the cards stack under the editor and open independently as upstream's do.
 */
import { TID } from '$/constants';
import { persisted } from './persist.svelte';

export type PaneOrder = 'tools-left' | 'code-left';

export const paneOrder = persisted<PaneOrder>('paneOrder', 'tools-left');

export const swapPanes = (): void => {
  paneOrder.value = paneOrder.value === 'code-left' ? 'tools-left' : 'code-left';
};

export const toolsAccordion = $state<{ enabled: boolean; open: string | undefined }>({
  enabled: false,
  // The Samples card is the one open on a first visit, as upstream's is.
  open: TID.sampleDiagramsCard
});
