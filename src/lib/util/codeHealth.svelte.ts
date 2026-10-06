/**
 * Local: what the editor does while the code has an error, so a mistake never
 * leaves someone who does not read mermaid stuck.
 *
 * - The diagram keeps the last picture that rendered (View.svelte), faded.
 * - The tools keep their lists from the last valid code, but an edit is refused
 *   while the code does not parse, with a message saying so (`editsBlocked`):
 *   applying it to the broken code could not be checked, and applying it to the
 *   last valid code would throw away what was typed since.
 * - A notice beside the diagram and in the tools pane (CodeErrorNotice.svelte)
 *   says, in plain words, which line is wrong, and offers "revert to the last
 *   valid state" (`revertToLastValid`), which is one more step on the undo stack,
 *   so what was typed can be brought back with Undo.
 * - A diagram that parses but fails to draw (a layout engine or icon failure, or
 *   an error mermaid throws while rendering) is reported the same way
 *   (`renderFailure`), instead of leaving a stale, faded picture unexplained.
 */
import { t } from '$/i18n';
import { describeCodeError, type CodeErrorDescription } from './codeError';
import { checkEdit } from './diagramModify';
import { notify } from './notify';
import { defaultState, inputState, lastValid, updateCode, validatedState } from './state.svelte';

let renderFailed = $state(false);
let lastDrawnCode: string | undefined;

/** Set by the view when a diagram that parsed could not be drawn, cleared when one is. */
export const renderFailure = {
  get current(): boolean {
    return renderFailed;
  }
};

/** The view drew this code. */
export const drawn = (code: string): void => {
  lastDrawnCode = code;
  renderFailed = false;
};

/** The view could not draw the code it was given. */
export const drawFailed = (): void => {
  renderFailed = true;
};

export const codeHealth = {
  /** The diagram code does not parse. */
  get broken(): boolean {
    return validatedState.current.errorKind === 'code';
  },
  /** The code parses but the config is not valid JSON. */
  get configBroken(): boolean {
    return validatedState.current.errorKind === 'config';
  },
  /** The code's error in plain words, while it has one. */
  get description(): CodeErrorDescription | undefined {
    const { code, error, errorKind } = validatedState.current;
    if (errorKind !== 'code') return undefined;
    return describeCodeError(error?.toString() ?? '', code);
  },
  /** There is an earlier valid code to go back to. */
  get canRevert(): boolean {
    const code = revertTarget();
    return code !== undefined && code !== inputState.code;
  }
};

/** What "revert" puts back: the last code drawn when drawing failed, else the last that parsed. */
const revertTarget = (): string | undefined =>
  renderFailed ? (lastDrawnCode ?? lastValid.code) : lastValid.code;

/** The description as one sentence in the current language. */
export const describe = ({ key, line, name }: CodeErrorDescription): string =>
  t(key, {
    ...(line === undefined ? {} : { line: String(line) }),
    ...(name === undefined ? {} : { name })
  });

/**
 * Puts the last code that parsed back (or, when nothing has parsed since the page
 * opened, the starting example), as one undoable step.
 */
export const revertToLastValid = (): void => {
  const code = revertTarget() ?? defaultState.code;
  updateCode(code, { updateDiagram: true });
  renderFailed = false;
  notify(t('recover.reverted'));
};

/**
 * Whether a tool must not change the code now; says why when it must not. Call it
 * first in every tool action that edits the code from the last valid state's
 * lists; whole-diagram replacements (a sample, a new diagram, a template, a
 * history entry) are the way out and stay allowed.
 */
export const editsBlocked = (): boolean => {
  if (!codeHealth.broken) return false;
  notify(t('recover.blocked'));
  return true;
};

export type ToolEditResult = 'applied' | 'blocked' | 'refused' | 'unchanged';

/**
 * Applies a tool's change to the code only if the code is valid now and mermaid
 * still reads the result as the same type of diagram — the check the Edit card
 * makes, for the tools that wrote their result straight in (Add, Colours, Layout,
 * the unknown-icon replacement, the selection's colours). A tool must never be the
 * one that leaves the code broken.
 */
export const applyToolEdit = async (
  next: string | undefined,
  { resetPanZoom = false }: { resetPanZoom?: boolean } = {}
): Promise<ToolEditResult> => {
  if (editsBlocked()) return 'blocked';
  const before = inputState.code;
  if (next === undefined || next === before) return 'unchanged';
  if (!(await checkEdit(before, next)) || inputState.code !== before) return 'refused';
  updateCode(next, { resetPanZoom, updateDiagram: true });
  return 'applied';
};
