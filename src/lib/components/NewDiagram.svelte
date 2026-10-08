<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { defaultState, TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Direction } from '$/util/layout';
  import { starter, starterKinds, type StarterId } from '$/util/newDiagram';
  import { serializeState } from '$/util/serde';
  import type { State } from '$/types';
  import { cn } from '$lib/utils';
  import { resolve } from '$app/paths';
  import NewIcon from '~icons/material-symbols/note-add-outline-rounded';
  import OpenIcon from '~icons/material-symbols/open-in-new-rounded';

  // Local: "New diagram" at the top of the templates card — a type, an optional title
  // and a direction, then a minimal starter the Add and Edit cards can work on
  // (newDiagram.ts). It opens in a new browser tab, through the same link a shared
  // diagram uses, so the diagram in this tab stays as it is and nothing needs asking.
  let open = $state(false);
  let kind = $state<StarterId>('flowchart');
  let title = $state('');
  let direction = $state<Direction | undefined>();
  let message = $state('');
  const current = $derived(starterKinds.find(({ id }) => id === kind) ?? starterKinds[0]);
  // Swimlanes read best left to right; everything else starts top to bottom.
  const shownDirection = $derived(direction ?? (kind === 'swimlane' ? 'LR' : 'TB'));

  const code = $derived(
    starter(kind, {
      direction: current.direction ? shownDirection : undefined,
      title: current.title ? title : ''
    })
  );
  // `pan`/`zoom` null: a link without them keeps the view the new tab's stored state had
  // (the browser's last diagram); null drops it, so the starter is fitted (stateGuard.ts).
  const href = $derived(
    `${resolve('/edit', {})}#${serializeState({
      ...defaultState,
      code,
      mermaid: '{}',
      pan: null,
      zoom: null
    } as unknown as State)}`
  );

  // After the click has opened the link: a link taken out of the page does not navigate.
  const opened = () => {
    setTimeout(() => {
      message = t('new.openedInTab', { name: t(`new.kind.${kind}`) });
      title = '';
      open = false;
    });
  };

  let link: HTMLElement | null = $state(null);
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
      <p class="text-xs text-muted-foreground">{t('new.intro')}</p>
      <span class="font-semibold">{t('new.type')}</span>
      <div
        role="radiogroup"
        aria-label={t('new.type')}
        class="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1 overflow-y-auto sm:max-h-none sm:overflow-visible">
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
            onkeydown={(event) => event.key === 'Enter' && link?.click()} />
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

      <!-- Sticky: the type list makes this form taller than the pane, and 作成 must not hide below it. -->
      <div class="sticky bottom-0 -mx-2 -mb-2 rounded-b-md border-t bg-card px-2 py-2">
        <Button
          bind:ref={link}
          size="sm"
          {href}
          target="_blank"
          rel="noopener"
          data-testid={TID.newDiagramCreate}
          onclick={opened}>
          <OpenIcon />
          {t('new.create')}
        </Button>
      </div>
    </div>
  {/if}
  {#if message}
    <p role="status" class="text-muted-foreground" data-testid={TID.newDiagramMessage}>
      {message}
    </p>
  {/if}
</div>
