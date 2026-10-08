<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { t } from '$/i18n';
  import { notify } from '$/util/notify';
  import { scale } from 'svelte/transition';
  import CheckIcon from '~icons/material-symbols/check-rounded';
  import CopyIcon from '~icons/material-symbols/content-copy-outline-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';

  let {
    onclick,
    label = t('actions.copy')
  }: { onclick: (event?: Event) => Promise<unknown>; label?: string } = $props();

  // Local: the tick is shown once the copy has succeeded, not when it starts (an
  // image copy takes a second or more and can still fail); a failure shows an
  // error mark and a notice instead.
  let copyState = $state<'busy' | 'done' | 'failed' | 'idle'>('idle');
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const showFor = (next: 'done' | 'failed') => {
    copyState = next;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyState = 'idle';
    }, 1000);
  };
</script>

<Button
  data-copy-state={copyState}
  aria-busy={copyState === 'busy'}
  onclick={async (event) => {
    clearTimeout(resetTimer);
    copyState = 'busy';
    try {
      await onclick(event);
      showFor('done');
    } catch (error) {
      console.error('Copy failed', error);
      showFor('failed');
      notify(t('notify.copyFailed'));
    }
  }}>
  <div class="grid">
    {#key copyState}
      <span transition:scale class="col-start-1 row-start-1">
        {#if copyState === 'done'}
          <CheckIcon />
        {:else if copyState === 'failed'}
          <ErrorIcon class="text-destructive" />
        {:else}
          <CopyIcon />
        {/if}
      </span>
    {/key}
  </div>
  {label}
</Button>
