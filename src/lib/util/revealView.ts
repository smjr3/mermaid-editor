/**
 * Local: bringing a just-added (and selected) object into view. After an addition the
 * diagram is redrawn and the new object may land outside the part of the canvas the
 * user is looking at (zoomed in, panned away). `revealPlan` says how to move the view so
 * it is fully visible: nothing when it already is, else a pan at the current zoom that
 * leaves a margin round it, or, when it is bigger than the canvas, a zoom out about its
 * centre (never in) and a pan that centres it. Screen pixels throughout
 * (`getBoundingClientRect`), which is what svg-pan-zoom's `panBy` takes for the editor's
 * view (the library removes the svg's viewBox). Used by `PanZoomState.reveal`.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RevealPlan {
  /** Zoom factor about the box's centre, applied first; 1 keeps the zoom. */
  scale: number;
  /** Then a pan, in screen pixels. */
  dx: number;
  dy: number;
}

const EPSILON = 0.5;

/** Whether `box` lies entirely within `viewport` (half a pixel of rounding allowed). */
export const isInside = (box: Box, viewport: Box): boolean =>
  box.left >= viewport.left - EPSILON &&
  box.top >= viewport.top - EPSILON &&
  box.left + box.width <= viewport.left + viewport.width + EPSILON &&
  box.top + box.height <= viewport.top + viewport.height + EPSILON;

/**
 * The shift along one axis that brings [start, start + size] into the viewport with a
 * margin; none when it is already within along that axis.
 */
const shift = (
  start: number,
  size: number,
  viewStart: number,
  viewSize: number,
  margin: number
) => {
  const end = start + size;
  const viewEnd = viewStart + viewSize;
  // Already within on this axis: not moved along it.
  if (start >= viewStart - EPSILON && end <= viewEnd + EPSILON) return 0;
  // As much of the margin as there is room for.
  const room = Math.max(0, Math.min(margin, (viewSize - size) / 2));
  if (start < viewStart + room) return viewStart + room - start;
  if (end > viewEnd - room) return viewEnd - room - end;
  return 0;
};

/**
 * How to move the view so `box` is fully visible in `viewport`, or undefined when it
 * already is (or there is nothing to show).
 */
export const revealPlan = (box: Box, viewport: Box, margin = 24): RevealPlan | undefined => {
  if (box.width <= 0 && box.height <= 0) return undefined;
  if (viewport.width <= 0 || viewport.height <= 0) return undefined;
  if (isInside(box, viewport)) return undefined;
  if (box.width > viewport.width || box.height > viewport.height) {
    const fit = Math.min(
      (viewport.width - 2 * margin) / box.width,
      (viewport.height - 2 * margin) / box.height
    );
    const scale = Math.min(1, Math.max(fit, Number.EPSILON));
    // Zooming about the box's centre keeps that centre where it is; then centre it.
    return {
      dx: viewport.left + viewport.width / 2 - (box.left + box.width / 2),
      dy: viewport.top + viewport.height / 2 - (box.top + box.height / 2),
      scale
    };
  }
  return {
    dx: shift(box.left, box.width, viewport.left, viewport.width, margin),
    dy: shift(box.top, box.height, viewport.top, viewport.height, margin),
    scale: 1
  };
};
