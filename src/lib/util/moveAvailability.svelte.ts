/**
 * Local: whether the selected node can move left or right among its siblings
 * (reorder.ts), as a value the command registry's synchronous `appliesTo` can read.
 *
 * `canMove` is async (it parses the code once, memoised by code). The registry is read
 * inside `$derived`s (the bar over the diagram, the menu), which cannot await, so the
 * answer is kept here in a one-entry `$state` cache keyed by code and node id: the first
 * read for a key starts the computation and answers undefined (the commands are not
 * offered), and when it lands the cache changes, so every `$derived` that read it runs
 * again and now sees the answer. One entry is enough: only a single selection can move,
 * and `reorder.ts` keeps the parsed analysis per code, so a change of selection costs
 * two cheap lookups, not a parse.
 */
import type { EditKind } from './diagramModify';
import { canMove } from './reorder';

export interface MoveAvailability {
  left: boolean;
  right: boolean;
}

let known = $state<(MoveAvailability & { key: string }) | undefined>();
let pending: string | undefined;

const keyOf = (code: string, id: string) => `${id}\u0000${code}`;

/**
 * Which ways `id` can move in `code`; undefined while that is being worked out (the
 * reader is a `$derived`: it is run again when the answer arrives).
 */
export const movesFor = (
  code: string,
  kind: EditKind,
  id: string
): MoveAvailability | undefined => {
  const key = keyOf(code, id);
  if (known?.key === key) return known;
  if (pending !== key) {
    pending = key;
    void Promise.all([canMove(code, kind, id, 'left'), canMove(code, kind, id, 'right')]).then(
      ([left, right]) => {
        // A later question replaced this one: its own answer applies.
        if (pending !== key) return;
        pending = undefined;
        known = { key, left, right };
      }
    );
  }
  return undefined;
};

/** Resolves once the answer for this code and node is in the cache (tests, callers that can wait). */
export const movesReady = async (
  code: string,
  kind: EditKind,
  id: string
): Promise<MoveAvailability> => {
  const found = movesFor(code, kind, id);
  if (found) return found;
  const [left, right] = await Promise.all([
    canMove(code, kind, id, 'left'),
    canMove(code, kind, id, 'right')
  ]);
  const key = keyOf(code, id);
  if (known?.key !== key) known = { key, left, right };
  if (pending === key) pending = undefined;
  return { left, right };
};
