/**
 * Local: open a tools card, focus a control or press one, by data-testid.
 *
 * The command palette needs to reach controls that live in other components (the
 * tools cards, the diagram toolbar). The page already opens a card by clicking its
 * header and expands a collapsed tools pane through the rail's expand button, so
 * this drives those same public controls instead of adding a second path into the
 * page's state. Everything waits briefly for the control to exist, because a card's
 * body is only rendered once the card is open.
 */
import { TID } from '$/constants';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const byTestId = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const waitFor = async <T>(find: () => T | null | undefined, timeout = 2000): Promise<T | null> => {
  const end = Date.now() + timeout;
  for (;;) {
    const found = find();
    if (found) return found;
    if (Date.now() >= end) return null;
    await sleep(40);
  }
};

/**
 * On a phone the page shows either the diagram or the code and tools, chosen by the
 * 編集/表示 switch (`#editorMode`, checked while the diagram shows). Shows the tools
 * side; true when it had to switch. A no-op on the desktop, which has no such switch.
 */
export const showToolsSide = (): boolean => {
  const mode = document.querySelector<HTMLElement>('#editorMode');
  if (mode?.getAttribute('aria-checked') !== 'true') return false;
  mode.click();
  return true;
};

/** Opens the card whose header has this test id (expanding the tools pane if collapsed). */
export const openCard = async (id: string): Promise<HTMLElement | null> => {
  showToolsSide();
  byTestId(TID.toolsRailExpand)?.click();
  const header = await waitFor(() => byTestId(id));
  if (!header) return null;
  if (!header.closest('.card')?.classList.contains('isOpen')) header.click();
  header.scrollIntoView({ block: 'nearest' });
  return header;
};

/** Moves keyboard focus to the control with this test id. */
export const focus = async (id: string): Promise<boolean> => {
  showToolsSide();
  const element = await waitFor(() => byTestId(id));
  if (!element) return false;
  element.scrollIntoView({ block: 'nearest' });
  if (!element.matches('button, input, select, textarea, a[href], [tabindex]')) {
    element.tabIndex = -1;
  }
  element.focus();
  return true;
};

/** Presses the control with this test id. */
export const click = async (id: string): Promise<boolean> => {
  const element = await waitFor(() => byTestId(id));
  if (!element) return false;
  element.click();
  return true;
};

/** Presses the first button whose text contains `text` (for controls without a test id). */
export const clickByText = async (text: string): Promise<boolean> => {
  const element = await waitFor(() =>
    [...document.querySelectorAll<HTMLElement>('button')].find((button) =>
      button.textContent?.includes(text)
    )
  );
  if (!element) return false;
  element.click();
  return true;
};
