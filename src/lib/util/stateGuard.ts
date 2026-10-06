/**
 * Local: a state read from outside the app — localStorage's `codeStore`, a URL
 * hash, a history entry — is whatever JSON was there, not necessarily a `State`.
 * A missing `rough` once left the page white (Svelte rejects `bind:pressed` of
 * `undefined`), and a number for `code` threw in every editor and card. These
 * take the fields that have the right type and leave the rest to a base state.
 */
import type { EditorMode, State } from '$/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A config as the editor holds it: JSON text (an object, as some old states have, is written out). */
const configText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return JSON.stringify(value, undefined, 2);
  return undefined;
};

/**
 * Whether the value looks like a saved state: an object whose `code` and
 * `mermaid`, where present, are the right type.
 */
export const isStateLike = (value: unknown): value is Partial<State> =>
  isRecord(value) &&
  (value.code === undefined || typeof value.code === 'string') &&
  (value.mermaid === undefined ||
    value.mermaid === null ||
    configText(value.mermaid) !== undefined);

/**
 * The fields of `raw` that have the right type, over `base`. Throws when `raw`
 * is not a state at all (not an object, or a `code` or `mermaid` of another
 * type), so a caller can tell the user the link was broken.
 */
export const normalizeState = (raw: unknown, base: State): State => {
  if (!isStateLike(raw)) {
    throw new TypeError('Not a saved diagram state');
  }
  const next: State = { ...base };
  if (typeof raw.code === 'string') next.code = raw.code;
  const config = configText(raw.mermaid);
  if (config !== undefined) next.mermaid = config;
  if (typeof raw.rough === 'boolean') next.rough = raw.rough;
  if (typeof raw.updateDiagram === 'boolean') next.updateDiagram = raw.updateDiagram;
  if (typeof raw.panZoom === 'boolean') next.panZoom = raw.panZoom;
  if (typeof raw.grid === 'boolean') next.grid = raw.grid;
  if (isFiniteNumber(raw.renderCount)) next.renderCount = raw.renderCount;
  if (raw.editorMode === 'code' || raw.editorMode === 'config') {
    next.editorMode = raw.editorMode satisfies EditorMode;
  }
  const { pan, zoom, loader } = raw as Record<string, unknown>;
  if (isRecord(pan) && isFiniteNumber(pan.x) && isFiniteNumber(pan.y)) {
    next.pan = { x: pan.x, y: pan.y };
  } else if (pan !== undefined) {
    delete next.pan;
  }
  if (isFiniteNumber(zoom) && zoom > 0) next.zoom = zoom;
  else if (zoom !== undefined) delete next.zoom;
  if (isRecord(loader)) next.loader = loader as unknown as State['loader'];
  return next;
};

/** A stored state, or the base when what is stored is not one. Never throws. */
export const storedState = (raw: unknown, base: State): State => {
  try {
    return normalizeState(raw, base);
  } catch {
    return { ...base };
  }
};
