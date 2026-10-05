<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Direction } from '$/util/layout';
  import { isReplaceable, starter, starterKinds, type StarterId } from '$/util/newDiagram';
  import { inputState, updateCode } from '$/util/state.svelte';
  import { cn } from '$lib/utils';
  import NewIcon from '~icons/material-symbols/note-add-outline-rounded';

  // Local: "New diagram" at the top of the Samples card — a type, an optional
  // title and a direction, then a minimal starter the Add and Edit cards can
  // work on (newDiagram.ts). Asks first unless the code is a sample or a starter.
  let { samples }: { samples: string[] } = $props();

  let open = $state(false);
  let kind = $state<StarterId>('flowchart');
  let title = $state('');
  let direction = $state<Direction | undefined>();
  let message = $state('');
  const current = $derived(starterKinds.find(({ id }) => id === kind) ?? starterKinds[0]);
  // Swimlanes read best left to right; everything else starts top to bottom.
  const shownDirection = $derived(direction ?? (kind === 'swimlane' ? 'LR' : 'TB'));

  const create = () => {
    if (!isReplaceable(inputState.code, samples) && !window.confirm(t('new.confirm'))) return;
    const code = starter(kind, {
      direction: current.direction ? shownDirection : undefined,
      title: current.title ? title : ''
    });
    updateCode(code, { resetPanZoom: true, updateDiagram: true });
    message = t('new.done', { name: t(`new.kind.${kind}`) });
    title = '';
    open = false;
  };

  const choice = (active: boolean) => (active ? 'default' : 'outline');
</script>

<div class="flex flex-col gap-2 p-2 pb-0 text-sm">
  <Button
    size="sm"
    variant={choice(open)}
    class="self-start"
    aria-expanded={open}
    data-testid={TID.newDiagramToggle}
    onclick={() => {
      open = !open;
      message = '';
    }}>
    <NewIcon />
    {t('new.button')}
  </Button>
  {#if open}
    <div class="flex flex-col gap-2 rounded-md border border-border p-2">
      <span class="font-semibold">{t('new.type')}</span>
      <div
        role="radiogroup"
        aria-label={t('new.type')}
        class="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {#each starterKinds as option (option.id)}
          <button
            type="button"
            role="radio"
            aria-checked={kind === option.id}
            data-testid={`${TID.newDiagramKind}-${option.id}`}
            class={cn(
              'flex flex-col items-start rounded-md border px-2 py-1 text-left',
              kind === option.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
            )}
            onclick={() => {
              kind = option.id;
              direction = undefined;
            }}>
            <span class="font-medium">{t(`new.kind.${option.id}`)}</span>
            <span class="text-xs text-muted-foreground">{t(`new.kind.${option.id}.hint`)}</span>
          </button>
        {/each}
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('new.diagramTitle')}</span>
        {#if current.title}
          <Input
            bind:value={title}
            class="h-9"
            aria-label={t('new.diagramTitle')}
            data-testid={TID.newDiagramTitle}
            onkeydown={(event) => event.key === 'Enter' && create()} />
        {:else}
          <p class="text-xs text-muted-foreground">{t('layout.titleUnsupported')}</p>
        {/if}
      </div>

      {#if current.direction}
        <div class="flex flex-col gap-1">
          <span class="font-semibold">{t('new.direction')}</span>
          <div class="flex flex-wrap gap-1">
            {#each ['TB', 'LR'] as const as option (option)}
              <Button
                size="sm"
                variant={choice(shownDirection === option)}
                data-testid={`${TID.newDiagramDirection}-${option}`}
                onclick={() => (direction = option)}>{t(`layout.direction${option}`)}</Button>
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <Button size="sm" data-testid={TID.newDiagramCreate} onclick={create}
          >{t('new.create')}</Button>
      </div>
    </div>
  {/if}
  {#if message}
    <p role="status" class="text-muted-foreground" data-testid={TID.newDiagramMessage}>
      {message}
    </p>
  {/if}
</div>
