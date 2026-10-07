<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import {
    directionUnsupportedKey,
    getDirection,
    getLayoutOptions,
    pickDirection,
    setDirection,
    setLayoutOptions,
    viewBoxSize,
    type Direction,
    type LayoutOptions,
    type Size
  } from '$/util/layout';
  import { getTitle, setTitle, titleShown } from '$/util/diagramTitle';
  import { render } from '$/util/mermaid';
  import { applyToolEdit, editsBlocked } from '$/util/codeHealth.svelte';
  import { inputState, updateConfig } from '$/util/state.svelte';
  import type { MermaidConfig } from 'mermaid';
  import LayoutIcon from '~icons/material-symbols/view-quilt-outline-rounded';

  // Local: direction, layout engine and spacing (layout.ts). They edit the code
  // and the config, so a shared link keeps the layout.
  const direction = $derived(getDirection(inputState.code));
  const options = $derived(getLayoutOptions(inputState.mermaid));
  // Local: the front-matter title (diagramTitle.ts); the field starts from what is there.
  const title = $derived(getTitle(inputState.code));
  const showsTitle = $derived(titleShown(inputState.code));
  let titleText = $derived(title);
  let message = $state('');
  let busy = $state(false);

  // Local: code changes are checked, and refused while the code has an error
  // (codeHealth.svelte.ts); the config-only options below stay available.
  const refusals: Partial<Record<string, MessageKey>> = {
    blocked: 'recover.blocked',
    refused: 'edit.breaks',
    stale: 'edit.stale'
  };
  const refusal = (result: string) => {
    const key = refusals[result];
    return key ? t(key) : '';
  };
  const applyDirection = async (next: Direction): Promise<boolean> => {
    message = '';
    const result = await applyToolEdit(setDirection(inputState.code, next), {
      resetPanZoom: true
    });
    message = refusal(result);
    return result === 'applied' || result === 'unchanged';
  };

  const applyTitle = async (next: string) => {
    const result = await applyToolEdit(setTitle(inputState.code, next));
    message =
      result === 'applied'
        ? t(next.trim() ? 'layout.titleDone' : 'layout.titleRemoved')
        : refusal(result);
  };

  const applyOptions = (next: Partial<LayoutOptions>) => {
    message = '';
    updateConfig(setLayoutOptions(inputState.mermaid, { ...options, ...next }));
  };

  const config = (): MermaidConfig => {
    try {
      return JSON.parse(inputState.mermaid) as MermaidConfig;
    } catch {
      return {};
    }
  };

  let probe = 0;
  const measure = async (next: Direction): Promise<Size | undefined> => {
    probe++;
    const { svg } = await render(
      config(),
      setDirection(inputState.code, next),
      `layout-probe-${probe}`
    );
    return viewBoxSize(svg);
  };

  // Draws the diagram both ways and keeps the one that shows largest in the view.
  const fitToView = async () => {
    // Local: the broken code cannot be drawn either way (codeHealth.svelte.ts).
    if (editsBlocked()) {
      message = t('recover.blocked');
      return;
    }
    busy = true;
    message = '';
    try {
      const view = document.querySelector(`#view`)?.getBoundingClientRect();
      const size = view && view.width > 0 && view.height > 0 ? view : { height: 900, width: 1600 };
      const [tb, lr] = [await measure('TB'), await measure('LR')];
      if (!tb || !lr) throw new Error('no size');
      const chosen = pickDirection({ LR: lr, TB: tb }, size);
      if (await applyDirection(chosen)) {
        message = t(chosen === 'LR' ? 'layout.fitChoseLR' : 'layout.fitChoseTB');
      }
    } catch {
      message = t('layout.fitFailed');
    } finally {
      busy = false;
    }
  };

  const choice = (active: boolean) => (active ? 'default' : 'outline');
</script>

<Card
  title={t('layout.title')}
  testID={TID.layoutCard}
  isStackable
  icon={{ component: LayoutIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('layout.diagramTitle')}</span>
      {#if showsTitle}
        <div class="flex gap-1">
          <Input
            bind:value={titleText}
            class="h-9"
            placeholder={t('layout.titlePlaceholder')}
            aria-label={t('layout.diagramTitle')}
            data-testid={TID.layoutTitleInput}
            onkeydown={(event) => event.key === 'Enter' && applyTitle(titleText)} />
          <Button
            size="sm"
            class="h-9"
            data-testid={TID.layoutTitleSet}
            onclick={() => applyTitle(titleText)}>{t('layout.titleSet')}</Button>
          {#if title}
            <Button
              size="sm"
              variant="outline"
              class="h-9"
              data-testid={TID.layoutTitleRemove}
              onclick={() => applyTitle('')}>{t('layout.titleRemove')}</Button>
          {/if}
        </div>
      {:else}
        <p class="text-muted-foreground">{t('layout.titleUnsupported')}</p>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('layout.direction')}</span>
      {#if direction}
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={choice(direction === 'TB')}
            data-testid={TID.layoutDirectionTB}
            onclick={() => applyDirection('TB')}>{t('layout.directionTB')}</Button>
          <Button
            size="sm"
            variant={choice(direction === 'LR')}
            data-testid={TID.layoutDirectionLR}
            onclick={() => applyDirection('LR')}>{t('layout.directionLR')}</Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            title={t('layout.fitHint')}
            data-testid={TID.layoutFit}
            onclick={fitToView}>{t('layout.fit')}</Button>
        </div>
      {:else}
        <p class="text-muted-foreground">{t(directionUnsupportedKey(inputState.code))}</p>
      {/if}
    </div>

    <!-- Only diagrams laid out by dagre/ELK (the ones with a direction) react to these. -->
    {#if direction}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('layout.engine')}</span>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={choice(options.engine === 'dagre')}
            data-testid={TID.layoutEngineDagre}
            onclick={() => applyOptions({ engine: 'dagre' })}>{t('layout.engineDagre')}</Button>
          <Button
            size="sm"
            variant={choice(options.engine === 'elk')}
            title={t('layout.engineElkHint')}
            data-testid={TID.layoutEngineElk}
            onclick={() => applyOptions({ engine: 'elk' })}>{t('layout.engineElk')}</Button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('layout.spacing')}</span>
        <div class="flex flex-wrap gap-1">
          {#each ['compact', 'normal', 'wide'] as const as spacing (spacing)}
            <Button
              size="sm"
              variant={choice(options.spacing === spacing)}
              data-testid={`${TID.layoutSpacing}-${spacing}`}
              onclick={() => applyOptions({ spacing })}>{t(`layout.spacing.${spacing}`)}</Button>
          {/each}
        </div>
        {#if options.engine === 'elk'}
          <p class="text-muted-foreground">{t('layout.spacingElkNote')}</p>
        {/if}
      </div>
    {:else}
      <p class="text-muted-foreground" data-testid={TID.layoutNoEngine}>
        {t('layout.noEngine')}
      </p>
    {/if}

    {#if message}
      <p role="status" class="text-muted-foreground" data-testid={TID.layoutMessage}>{message}</p>
    {/if}
  </div>
</Card>
