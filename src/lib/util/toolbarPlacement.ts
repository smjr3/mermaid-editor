// Local: where the selection's mini toolbar (SelectionToolbar.svelte) floats, in the
// coordinates of the view pane that hosts it.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const margin = 4;
const gap = 10;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Centred above the selection; below it when there is no room above. A panel over the
 * diagram (`avoid`, such as the notice shown while the code is broken) would sit on top
 * of the toolbar and take its clicks, so a place clear of it is preferred.
 */
export const toolbarPlacement = ({
  avoid = [],
  box,
  hostHeight,
  hostWidth,
  size
}: {
  avoid?: Rect[];
  box: Rect;
  hostHeight: number;
  hostWidth: number;
  size: { width: number; height: number };
}): { left: number; top: number } => {
  const { height, width } = size;
  const left = Math.max(
    margin,
    Math.min(box.x + box.width / 2 - width / 2, hostWidth - width - margin)
  );
  const lowest = Math.max(margin, hostHeight - height - margin);
  const above = box.y - height - gap;
  const below = Math.min(box.y + box.height + gap, lowest);
  const fallback = above >= margin ? above : below;
  const panels = avoid.filter((rect) => rect.width > 0 && rect.height > 0);
  if (panels.length === 0) return { left, top: fallback };
  const clear = (top: number) =>
    !panels.some((rect) => overlaps({ height, width, x: left, y: top }, rect));
  const candidates = [
    ...(above >= margin ? [above] : []),
    below,
    // Just under a panel that covers both, as near the selection as that gets.
    ...panels.map((rect) => Math.min(rect.y + rect.height + gap, lowest))
  ];
  return { left, top: candidates.find((top) => clear(top)) ?? fallback };
};
