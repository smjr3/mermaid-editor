/**
 * Local: the validated code once typing has paused, for the tool cards and the
 * selection layer. Each of them reads the diagram through mermaid's parse (often
 * twice: `mermaid.parse`, then `getDiagramFromText`), and all three tool tabs stay
 * mounted, so following every keystroke cost about seven parses per character —
 * on a 100-node flowchart, several hundred milliseconds of main thread per key,
 * which also delayed the picture. They follow this instead:
 *
 * - a typed change arrives after `settleDelay` without a newer one;
 * - an edit made by a button or card (`updateDiagram`), the first state and a
 *   change of the error alone arrive at once;
 * - a state with the same code and error (pan, zoom, editor mode, config) is not
 *   passed on, so the cards' effects do not run again for it.
 */
import { createSettler, type Settled } from './renderScheduler';
import { validatedState } from './state.svelte';

let settled = $state.raw<Settled>({
  code: validatedState.current.code,
  error: validatedState.current.error
});

const settle = createSettler((next) => (settled = next));

$effect.root(() => {
  $effect(() => {
    const { code, error, updateDiagram } = validatedState.current;
    settle({ code, error, updateDiagram });
  });
});

export const settledState = {
  get current(): Settled {
    return settled;
  }
};
