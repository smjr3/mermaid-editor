import { resolve } from '$app/paths';
import { defaultState } from '$/constants';
import type { State } from '$/types';
import { serializeState } from './serde';

/**
 * Local: the link that opens `code` as a fresh diagram in a new editor tab (the 新規
 * dialog's results), the same hash link a shared diagram uses. `pan`/`zoom` null: a link
 * without them keeps the view the new tab's stored state had (the browser's last
 * diagram); null drops it, so the new diagram is fitted (stateGuard.ts). The config is
 * empty so the editor-managed theme applies.
 */
export const newTabHref = (code: string): string =>
  `${resolve('/edit', {})}#${serializeState({
    ...defaultState,
    code,
    mermaid: '{}',
    pan: null,
    zoom: null
  } as unknown as State)}`;
