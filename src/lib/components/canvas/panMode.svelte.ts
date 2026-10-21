/**
 * Local: how a mouse drag on the diagram is read (SelectionLayer.svelte). A plain left drag
 * that starts on the empty canvas draws the rubber band; the picture is moved by a
 * middle-button (wheel) drag, by a left drag with Space held, or by any left drag while
 * the 移動 button of the zoom controls (ZoomControls.svelte) is pressed (Escape or the
 * button again turns it off). Touch keeps panning through svg-pan-zoom's own gesture
 * handlers (panZoom.ts); this module is the mouse's.
 */

export const panMode = $state({
  /** The 移動 button is pressed: a plain drag moves the picture, the band is off. */
  on: false,
  /** Space is held (outside a field or the code editor): a left drag moves the picture. */
  space: false
});

export const togglePanMode = (): void => {
  panMode.on = !panMode.on;
};

export const stopPanMode = (): void => {
  panMode.on = false;
};

export type DragGesture = 'band' | 'pan' | 'none';

export interface DragInput {
  /** The mouse button: 0 left, 1 middle (wheel), 2 right. */
  button: number;
  /** Whether the press landed on a selectable object or arrow (a click selects it). */
  onObject: boolean;
  /** The 移動 button is pressed. */
  mode: boolean;
  /** Space is held. */
  space: boolean;
}

/**
 * What a drag that starts with `input` does: the middle button, or the left button with
 * Space or 移動, pans; a plain left button on the empty canvas draws the band; a left
 * button on an object (which the click that follows selects) does nothing; the right
 * button is the menu's.
 */
export const dragGesture = ({ button, mode, onObject, space }: DragInput): DragGesture => {
  if (button === 1) return 'pan';
  if (button !== 0) return 'none';
  if (space || mode) return 'pan';
  return onObject ? 'none' : 'band';
};

/** The cursor over the diagram: a hand while a pan gesture is on, a closed one while panning. */
export const panCursor = (state: {
  space: boolean;
  mode: boolean;
  dragging: boolean;
}): '' | 'grab' | 'grabbing' => {
  if (state.dragging) return 'grabbing';
  return state.space || state.mode ? 'grab' : '';
};
