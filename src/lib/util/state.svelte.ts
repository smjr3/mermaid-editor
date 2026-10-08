import { defaultState } from '$/constants';
import { t } from '$/i18n';
import type { ErrorHash, MarkerData, State, ValidatedState } from '$/types';
import { resolve } from '$app/paths';
import { debounce, get as lodashGet } from 'lodash-es';
import type { MermaidConfig } from 'mermaid';
import { untrack } from 'svelte';
import { errorLineOf, hazardMessage, renderHazard } from './codeError';
import { env } from './env';
import {
  extractErrorLineText,
  findMostRelevantLineNumber,
  replaceLineNumberInErrorMessage
} from './errorHandling';
import { darkVariantOf, getDefaultTheme, isManagedTheme, parse } from './mermaid';
import { readJSON, writeJSON } from './persist.svelte';
import { createLatestGuard } from './renderScheduler';
import { findUnsafeConfigPaths, stripConfigPaths } from './sanitize';
import { deserializeState, pakoSerde, serializeState } from './serde';
import { normalizeState, parseConfigObject, storedState } from './stateGuard';
import { errorDebug, formatJSON, getUTMSource, MCBaseURL } from './util';

export { defaultState };

// The whole diagram is one catalogue entry: each locale owns its own mermaid
// source, which is the only way the node labels can be translated safely.
// Upstream's version ends in a `click` handler filing a bug against
// mermaid-js/mermaid-live-editor; a fork must not send its users there, so the
// advice points at whoever runs the deployment instead.
const urlParseFailedState = t('error.urlParseFailedDiagram');

const CODE_STORE_KEY = 'codeStore';

// The single mutable input state; only update() below may write to it.
// The fallback is cloned so mutations never write through to defaultState.
// Local: what is stored is checked field by field (stateGuard.ts) — a stored
// state without `rough`, or with a code that is not text, left the page white.
const input = $state<State>(storedState(readJSON<unknown>(CODE_STORE_KEY, null), defaultState));

// inputState is shared externally when exporting via URL, History, etc.
// It is reactive for reads; the read-only type keeps writes inside this
// module, where update() persists and re-validates every change.
export const inputState: Readonly<State> = input;

const validatedStateOf = (state: State, serialized: string): ValidatedState => ({
  ...state,
  editorMode: state.editorMode ?? 'code',
  error: undefined,
  errorMarkers: [],
  serialized
});

const initialState = $state.snapshot(input) as State;
// Only ever replaced wholesale, so raw (shallow) reactivity is enough.
let validatedCurrent = $state.raw<ValidatedState>(
  validatedStateOf(initialState, serializeState(initialState))
);

let lastDiagramType = '';

const processState = async (state: State) => {
  const processed = validatedStateOf(state, '');
  // Local: which part failed — the code (the tools then work from the last valid
  // code, see codeHealth.svelte.ts) or only the config.
  let codeParsed = false;
  // No changes should be done to fields part of `state`.
  try {
    processed.serialized = serializeState(state);
    const { diagramType } = await parse(state.code);
    // Local: code mermaid parses but would hang the page while drawing (codeError.ts).
    const hazard = renderHazard(state.code, diagramType);
    if (hazard) throw new Error(hazardMessage(hazard));
    codeParsed = true;
    processed.diagramType = diagramType;
    if (lastDiagramType === 'zenuml' && diagramType !== lastDiagramType) {
      // Temp Hack to refresh page after displaying ZenUML.
      setTimeout(() => window.location.reload(), 500);
    }
    lastDiagramType = diagramType;
    // Local: JSON whose root is not an object (null, a number, …) is a config error too.
    parseConfigObject(state.mermaid);
  } catch (error) {
    // Local: mermaid can throw something that is not an Error (a string, an object).
    processed.error = error instanceof Error ? error : new Error(String(error));
    processed.errorKind = codeParsed ? 'config' : 'code';
    errorDebug();
    console.error(error);
    if (error && typeof error === 'object' && 'hash' in error) {
      try {
        let errorString = processed.error.toString();
        const errorLineText = extractErrorLineText(errorString);
        // Local: the line found from mermaid's excerpt (codeError.ts) first; upstream's
        // longest-common-substring guess picked the line before when the excerpt
        // spanned two lines.
        const realLineNumber =
          errorLineOf(errorString, state.code) ??
          findMostRelevantLineNumber(errorLineText, state.code);

        let first_line: number, last_line: number, first_column: number, last_column: number;
        try {
          ({ first_line, last_line, first_column, last_column } = (error.hash as ErrorHash).loc);
        } catch {
          const lineNo = findMostRelevantLineNumber(errorString, state.code);
          first_line = lineNo;
          last_line = lineNo + 1;
          first_column = 0;
          last_column = 0;
        }

        if (realLineNumber !== -1) {
          errorString = replaceLineNumberInErrorMessage(errorString, realLineNumber);
        }

        processed.error = new Error(errorString);
        const marker: MarkerData = {
          endColumn: last_column + (first_column === last_column ? 0 : 5),
          endLineNumber: last_line + (realLineNumber - first_line),
          message: errorString || 'Syntax error',
          severity: 8, // Error
          startColumn: first_column,
          startLineNumber: realLineNumber
        };
        processed.errorMarkers = [marker];
      } catch (error) {
        console.error('Error without line helper', error);
      }
    }
  }
  return processed;
};

// Replaces the old URL-hash store subscription; assigned by initURLSubscription.
let updateHash: ((serialized: string) => void) | undefined;

// Local: the last code mermaid parsed, which the tools and the "revert to the last
// valid state" action fall back on while the code has an error (codeHealth.svelte.ts).
let lastValidCode = $state.raw<string | undefined>(undefined);
export const lastValid = {
  get code(): string | undefined {
    return lastValidCode;
  }
};

// Local: the newest validation whose code parsed, so `lastValid` follows the typing
// even for results that a newer edit kept from being published.
let lastValidTicket = 0;

// Persist the current input state and asynchronously re-validate it,
// publishing the result to `validatedState` (and the URL hash, once
// initURLSubscription has run). Only called from update(), which suppresses
// dependency tracking.
// Local: validation is asynchronous (mermaid's parse waits for a render in progress),
// so results can arrive after a newer edit. Only the newest is published: an older one
// would put stale code back into the editor and the view. A result whose managed theme
// is about to change is not published either; the update that changes it is, so the
// diagram is not drawn twice on load or on a change of diagram type.
// Typed code (an update that changes the code without `updateDiagram`) is validated
// once typing pauses, when parsing is slow: mermaid's parse of a 200-node flowchart
// takes a couple of hundred milliseconds, and running it for every key blocked the
// typing itself. The pause follows the last parse (none under 50 ms, at most 150 ms),
// so a small diagram is validated at once. Everything else is validated at once.
const processing = createLatestGuard();
let processTimer: ReturnType<typeof setTimeout> | undefined;
let lastProcessedCode: string | undefined;
let lastParseMs = 0;
const typingPause = () => (lastParseMs < 50 ? 0 : Math.min(150, lastParseMs));
const persistAndProcess = (): void => {
  const snapshot = $state.snapshot(input) as State;
  writeJSON(CODE_STORE_KEY, snapshot);
  updateHash?.(serializeState(snapshot));
  const ticket = processing.next();
  const run = () => {
    processTimer = undefined;
    lastProcessedCode = snapshot.code;
    const started = performance.now();
    void processState(snapshot).then((processed) => {
      lastParseMs = performance.now() - started;
      if (processed.errorKind !== 'code' && ticket > lastValidTicket) {
        lastValidTicket = ticket;
        lastValidCode = processed.code;
      }
      // Errors are published like any result: only the newest counts, valid or not.
      if (!processing.isLatest(ticket)) return;
      syncManagedTheme(processed.diagramType);
      if (!processing.isLatest(ticket)) return;
      validatedCurrent = processed;
    });
  };
  clearTimeout(processTimer);
  const typed =
    !snapshot.updateDiagram &&
    lastProcessedCode !== undefined &&
    snapshot.code !== lastProcessedCode;
  const pause = typed ? typingPause() : 0;
  if (pause > 0) {
    processTimer = setTimeout(run, pause);
  } else {
    run();
  }
};

// The single mutation gateway: every update function funnels its writes
// through here. The mutator runs untracked so effects that call an update
// function never subscribe to the input state it reads, and the trailing
// persist + re-validate cannot be forgotten by a new update function.
const update = (mutate: (state: State) => void): void => {
  untrack(() => {
    mutate(input);
    persistAndProcess();
  });
};

// All internal reads should be done via validatedState, but it should not be
// persisted/shared externally.
export const validatedState = {
  get current(): ValidatedState {
    return validatedCurrent;
  }
};

const urlsCurrent = $derived.by(() => {
  const { code, serialized } = validatedCurrent;
  const { krokiRendererUrl, rendererUrl } = env;
  const png = rendererUrl ? `${rendererUrl}/img/${serialized}?type=png` : '';
  return {
    kroki: krokiRendererUrl ? `${krokiRendererUrl}/mermaid/svg/${pakoSerde.serialize(code)}` : '',
    mdCode: png ? `[![](${png})](${window.location.href})` : '',
    mermaidChart: ({
      medium,
      campaign
    }: {
      medium:
        | 'ai_edit'
        | 'ai_repair'
        | 'main_menu'
        | 'save_diagram'
        | 'vibe_diagramming'
        | 'visual_edit'
        | 'voice_edit';
      campaign?: string;
    }) => {
      const utmSource = getUTMSource();
      const params = new URLSearchParams({
        utm_source: utmSource,
        utm_medium: medium,
        ...(campaign ? { utm_campaign: campaign } : {})
      }).toString();
      return {
        save: `${MCBaseURL}/app/plugin/save?state=${serialized}&${params}`,
        playground: `${MCBaseURL}/play?${params}#${serialized}`,
        plugins: `${MCBaseURL}/plugins?${params}`,
        home: `${MCBaseURL}/?${params}`
      };
    },
    new: `${resolve('/edit', {})}#${serializeState(defaultState)}`,
    png,
    svg: rendererUrl ? `${rendererUrl}/svg/${serialized}` : '',
    view: `${resolve('/view', {})}#${serialized}`
  };
});

export const urls = {
  get current() {
    return urlsCurrent;
  }
};

/**
 * Asks the user for confirmation if the config contains settings that might
 * pose security risks, such as a relaxed `securityLevel`.
 *
 * @param config - The Mermaid configuration to sanitize.
 * @returns The sanitized Mermaid configuration as a JSON string.
 */
export const sanitizeConfig = (config: string | MermaidConfig) => {
  // Local: throws for a config whose root is not an object; loadState then drops it.
  const mermaidConfig: MermaidConfig =
    typeof config === 'string' ? (parseConfigObject(config) as MermaidConfig) : config;

  const unsafePaths = findUnsafeConfigPaths(mermaidConfig);

  if (
    unsafePaths.length > 0 &&
    confirm(
      t('security.unsafeConfigConfirm', {
        paths: unsafePaths
          .map((unsafePath) => {
            return `${JSON.stringify(unsafePath.join('.'))}: ${JSON.stringify(lodashGet(mermaidConfig, unsafePath))}`;
          })
          .join(',\n')
      })
    )
  ) {
    stripConfigPaths(mermaidConfig, unsafePaths);
  }
  return formatJSON(mermaidConfig);
};

export const loadState = (data: string): void => {
  console.log(`Loading '${data}'`);
  update((state) => {
    let next: State;
    try {
      // Local: a link holds whatever JSON it was given; only a real state is applied.
      next = normalizeState(deserializeState(data), $state.snapshot(state) as State);
      // Local: a link whose pan/zoom is null (the new-diagram link, NewDiagram.svelte) asks
      // for a fitted view; normalizeState drops the keys, so clear the stored view too.
      if (!('pan' in next)) next.pan = undefined;
      if (!('zoom' in next)) next.zoom = undefined;
      try {
        next.mermaid = sanitizeConfig(next.mermaid || defaultState.mermaid);
      } catch (error) {
        // Local: a config that is not JSON costs the link its config, not its diagram.
        console.error('Linked config ignored', error);
        next.mermaid = defaultState.mermaid;
      }
    } catch (error) {
      next = $state.snapshot(state) as State;
      if (data) {
        console.error('Init error', error);
        next.code = urlParseFailedState;
        next.mermaid = defaultState.mermaid;
      }
    }
    applyPartial(state, next);
  });
};

let renderCount = 0;
const applyPartial = (state: State, newState: Partial<State>): void => {
  renderCount++;
  Object.assign(state, newState, { renderCount });
};

export const updateCodeStore = (newState: Partial<State>): void => {
  update((state) => applyPartial(state, newState));
};

export const updateCode = (
  code: string,
  {
    updateDiagram = false,
    resetPanZoom = false
  }: { updateDiagram?: boolean; resetPanZoom?: boolean } = {}
): void => {
  errorDebug();

  update((state) => {
    if (resetPanZoom) {
      state.pan = undefined;
      state.zoom = undefined;
    }
    state.code = code;
    state.updateDiagram = updateDiagram;
  });
};

export const updateConfig = (config: string): void => {
  updateCodeStore({ mermaid: config });
};

let siteDark = false;

// The editor manages the diagram theme unless the user picked one of their
// own. A missing theme, mermaid's global default, a config section's default
// or any of their dark variants (see isManagedTheme) is replaced by the
// current diagram type's default, or its dark counterpart while the site is
// dark. Runs after every validation, since the diagram type may have changed,
// and whenever the site mode changes. Converges after one update: the next
// validation finds the theme already in place. Reads are untracked so an
// effect calling toggleDarkTheme does not subscribe to the input state.
const syncManagedTheme = (diagramType: string | undefined): void => {
  if (!diagramType) {
    return;
  }
  untrack(() => {
    let config: MermaidConfig;
    try {
      config = parseConfigObject(input.mermaid) as MermaidConfig;
    } catch {
      return;
    }
    if (!isManagedTheme(config.theme)) {
      return;
    }
    const defaultTheme = getDefaultTheme(diagramType);
    const theme = siteDark ? darkVariantOf(defaultTheme) : defaultTheme;
    if (config.theme === theme) {
      return;
    }
    update((state) => {
      state.mermaid = formatJSON({ ...config, theme });
    });
  });
};

export const toggleDarkTheme = (dark: boolean): void => {
  siteDark = dark;
  syncManagedTheme(untrack(() => validatedCurrent.diagramType));
};

const isOnlyDefaultTheme = (config: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(config);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      Object.keys(parsed).length === 1 &&
      (parsed as MermaidConfig).theme === 'default'
    );
  } catch {
    return false;
  }
};

// One-time migration (registered in migrations.svelte.ts): before mermaid 12
// every install was seeded with `{ "theme": "default" }`. A config that still
// only pins that value is cleared so mermaid's own defaults apply. Any other
// config is the user's and is left alone. Goes through updateConfig because
// the input state was already read from localStorage when this runs.
export const clearDefaultThemeConfig = (): void => {
  if (isOnlyDefaultTheme(inputState.mermaid)) {
    updateConfig(formatJSON({}));
  }
};

// Local: the "reset config" button. Returns the config to the default (`{}`;
// the managed theme is filled back in by the next validation), leaving the
// diagram alone — a broken config otherwise keeps every render failing.
export const resetConfig = (): void => {
  updateConfig(formatJSON({}));
};

// Replaces the whole input state (e.g. when restoring a history entry),
// dropping keys the next state does not define.
export const replaceInputState = (next: State): void => {
  // Local: a history entry is stored JSON too; take only a well-formed state from it.
  next = storedState(next, defaultState);
  update((state) => {
    for (const key of Object.keys(state)) {
      if (!(key in next)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- full-replace semantics
        delete (state as unknown as Record<string, unknown>)[key];
      }
    }
    Object.assign(state, next);
  });
};

// Local: the hash follows the input state, not the validated one — validation
// waits behind a render, so for a large diagram it lands seconds after the edit,
// and a reload in between (the language toggle, F5) would bring the old diagram
// back. Writes stay debounced; `flushHash` writes at once, and the page does so
// itself before it unloads.
let hashDebounce: ReturnType<typeof debounce<(serialized: string) => void>> | undefined;

/** Write the current input state into the URL hash now (before a reload). */
export const flushHash = (): void => {
  if (!hashDebounce) return;
  hashDebounce.cancel();
  const snapshot = untrack(() => $state.snapshot(input) as State);
  history.replaceState(undefined, '', `#${serializeState(snapshot)}`);
};

export const initURLSubscription = (): void => {
  hashDebounce = debounce((serialized: string) => {
    history.replaceState(undefined, '', `#${serialized}`);
  }, 250);
  updateHash = (serialized) => hashDebounce?.(serialized);
  updateHash(validatedCurrent.serialized);
  window.removeEventListener('pagehide', flushHash);
  window.addEventListener('pagehide', flushHash);
};

export const verifyState = (): void => {
  update((state) => applyPartial(state, state.panZoom ? {} : { panZoom: true }));
};
