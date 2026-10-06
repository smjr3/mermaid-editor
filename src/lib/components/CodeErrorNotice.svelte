<script lang="ts">
  // Local: what is wrong with the code, in plain words, and the way back to the last
  // valid state (codeHealth.svelte.ts). Shown over the diagram and at the top of the
  // tools, so someone who keeps the code pane folded still sees it.
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { codeHealth, describe, renderFailure, revertToLastValid } from '$/util/codeHealth.svelte';
  import { lastValid, resetConfig } from '$/util/state.svelte';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import ResetIcon from '~icons/material-symbols/restart-alt-rounded';
  import UndoIcon from '~icons/material-symbols/undo-rounded';

  const { testID, compact = false }: { testID: string; compact?: boolean } = $props();

  const problem = $derived(
    codeHealth.broken
      ? 'code'
      : codeHealth.configBroken
        ? 'config'
        : renderFailure.current
          ? 'render'
          : undefined
  );
  const message = $derived.by(() => {
    if (problem === 'code' && codeHealth.description) return describe(codeHealth.description);
    if (problem === 'config') return t('recover.config');
    if (problem === 'render') return t('recover.render');
    return '';
  });

  // A mistake typed a moment ago is usually being typed: wait before saying so.
  let shown = $state(false);
  $effect(() => {
    if (!problem) {
      shown = false;
      return;
    }
    const timer = setTimeout(() => (shown = true), 1000);
    return () => clearTimeout(timer);
  });

  const onResetConfig = () => {
    if (confirm(t('editor.resetConfigConfirm'))) resetConfig();
  };
</script>

{#if shown && problem}
  <div
    role="alert"
    class={[
      'flex flex-col gap-1.5 border border-destructive/40 bg-background/95 p-2 text-sm text-foreground shadow-sm',
      compact ? 'rounded-none border-x-0 border-t-0' : 'rounded-md'
    ]}
    data-testid={testID}
    data-problem={problem}>
    <p class="flex items-start gap-1.5">
      <ErrorIcon class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <span data-testid={TID.codeErrorMessage}>{message}</span>
    </p>
    {#if problem !== 'config' && lastValid.code !== undefined}
      <p class="text-xs text-muted-foreground">{t('recover.showingLast')}</p>
    {/if}
    <div class="flex flex-wrap gap-1">
      {#if problem === 'config'}
        <Button
          size="sm"
          variant="outline"
          data-testid={TID.noticeResetConfig}
          onclick={onResetConfig}>
          <ResetIcon />{t('editor.resetConfig')}
        </Button>
      {:else if codeHealth.canRevert}
        <Button
          size="sm"
          variant="outline"
          data-testid={TID.revertToValid}
          onclick={revertToLastValid}>
          <UndoIcon />{t('recover.revert')}
        </Button>
      {:else if lastValid.code === undefined}
        <Button
          size="sm"
          variant="outline"
          data-testid={TID.revertToValid}
          onclick={revertToLastValid}>
          <UndoIcon />{t('recover.startOver')}
        </Button>
      {/if}
    </div>
  </div>
{/if}
