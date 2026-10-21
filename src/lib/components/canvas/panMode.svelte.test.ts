import { describe, expect, it } from 'vitest';
import { dragGesture, panCursor, panMode, stopPanMode, togglePanMode } from './panMode.svelte';

describe('dragGesture', () => {
  const plain = { mode: false, onObject: false, space: false };

  it('a plain left drag on the empty canvas draws the band', () => {
    expect(dragGesture({ ...plain, button: 0 })).toBe('band');
  });

  it('a left drag that starts on an object does nothing (the click selects)', () => {
    expect(dragGesture({ ...plain, button: 0, onObject: true })).toBe('none');
  });

  it('Space, the 移動 button or the middle button pan, on an object too', () => {
    expect(dragGesture({ ...plain, button: 0, space: true })).toBe('pan');
    expect(dragGesture({ ...plain, button: 0, mode: true })).toBe('pan');
    expect(dragGesture({ ...plain, button: 0, mode: true, onObject: true })).toBe('pan');
    expect(dragGesture({ ...plain, button: 1 })).toBe('pan');
    expect(dragGesture({ ...plain, button: 1, onObject: true })).toBe('pan');
  });

  it('the right button is the menu’s', () => {
    expect(dragGesture({ ...plain, button: 2 })).toBe('none');
  });
});

describe('panCursor', () => {
  it('shows a hand while a pan is possible, a closed one while dragging', () => {
    expect(panCursor({ dragging: false, mode: false, space: false })).toBe('');
    expect(panCursor({ dragging: false, mode: false, space: true })).toBe('grab');
    expect(panCursor({ dragging: false, mode: true, space: false })).toBe('grab');
    expect(panCursor({ dragging: true, mode: false, space: false })).toBe('grabbing');
  });
});

describe('panMode', () => {
  it('toggles and stops', () => {
    expect(panMode.on).toBe(false);
    togglePanMode();
    expect(panMode.on).toBe(true);
    togglePanMode();
    expect(panMode.on).toBe(false);
    togglePanMode();
    stopPanMode();
    expect(panMode.on).toBe(false);
  });
});
