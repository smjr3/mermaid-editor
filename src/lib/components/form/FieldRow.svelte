<script lang="ts">
  import type { Snippet } from 'svelte';

  // Local: one inspector row — a 52px label and its control on one line. An empty label
  // makes a continuation row (the control lines up under the controls above).
  let { children, label, testID }: { children: Snippet; label: string; testID?: string } = $props();
</script>

<div
  class="grid min-h-7 grid-cols-[52px_minmax(0,1fr)] items-center gap-x-2 text-sm"
  data-testid={testID}>
  <span class="truncate text-xs text-muted-foreground" title={label || undefined}>{label}</span>
  <div class="flex min-w-0 items-center gap-1">
    {@render children()}
  </div>
</div>
