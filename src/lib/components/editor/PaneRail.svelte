<script lang="ts">
  import { Button } from '$/components/ui/button';
  import type { Component } from 'svelte';

  // Local: the thin rail a folded code pane or inspector leaves on its side of /edit;
  // its button opens the pane again.
  let {
    expandLabel,
    expandTestID,
    icon: Icon,
    onexpand,
    side,
    testID
  }: {
    expandLabel: string;
    expandTestID: string;
    icon: Component;
    onexpand: () => void;
    side: 'left' | 'right';
    testID: string;
  } = $props();
</script>

<div
  class={[
    'flex w-9 shrink-0 flex-col items-center gap-1 border-border bg-card py-1',
    side === 'left' ? 'border-r' : 'border-l'
  ]}
  data-testid={testID}>
  <Button
    variant="ghost"
    size="sm"
    class="size-7 p-0"
    data-testid={expandTestID}
    title={expandLabel}
    aria-label={expandLabel}
    onclick={onexpand}>
    <Icon />
  </Button>
</div>
