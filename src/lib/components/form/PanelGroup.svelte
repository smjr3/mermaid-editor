<script lang="ts">
  import type { Snippet } from 'svelte';

  // Local: a block of inspector rows, padded, with a line under it. The caption is
  // optional: rows say what they edit through their own labels.
  let { caption, children }: { caption?: string; children: Snippet } = $props();
</script>

<section class="flex flex-col gap-1 border-b border-border px-3 py-2">
  {#if caption}
    <h3 class="text-xs font-semibold text-muted-foreground">{caption}</h3>
  {/if}
  {@render children()}
</section>
