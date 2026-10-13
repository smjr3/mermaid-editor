<script module lang="ts">
  const LABEL_MIN = 52;
  const LABEL_MAX = 84;

  /**
   * Local (QA 2026-10-13): lets the label column of the rows inside `node` grow to fit
   * their longest label, from 52px up to 84px, so a label such as 「メンバー名」 shows
   * whole while every row of the panel keeps its control at the same x. Rows outside
   * such a container keep 52px.
   */
  export const labelColumn = (node: HTMLElement) => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let widest = 0;
        for (const label of node.querySelectorAll<HTMLElement>('[data-field-label]'))
          widest = Math.max(widest, label.scrollWidth);
        const width = Math.min(LABEL_MAX, Math.max(LABEL_MIN, Math.ceil(widest)));
        node.style.setProperty('--field-label-w', `${width}px`);
      });
    };
    // Rows come and go with the selection; the style set above is not observed.
    const observer = new MutationObserver(measure);
    observer.observe(node, { characterData: true, childList: true, subtree: true });
    measure();
    void document.fonts?.ready.then(measure);
    return {
      destroy() {
        observer.disconnect();
        cancelAnimationFrame(frame);
      }
    };
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // Local: one inspector row — a label (52px, or what `labelColumn` gives the panel) and
  // its control on one line. An empty label makes a continuation row (the control lines
  // up under the controls above). The label is only as wide as its text, so its
  // scrollWidth is the width it needs.
  let { children, label, testID }: { children: Snippet; label: string; testID?: string } = $props();
</script>

<div
  class="grid min-h-7 grid-cols-[var(--field-label-w,52px)_minmax(0,1fr)] items-center gap-x-2 text-sm"
  data-testid={testID}>
  <span
    class="max-w-full justify-self-start truncate text-xs text-muted-foreground"
    title={label || undefined}
    data-field-label>{label}</span>
  <div class="flex min-w-0 items-center gap-1">
    {@render children()}
  </div>
</div>
