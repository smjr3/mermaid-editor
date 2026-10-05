<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
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
  import { render } from '$/util/mermaid';
  import { inputState, updateCode, updateConfig } from '$/util/state.svelte';
  import type { MermaidConfig } from 'mermaid';
  import LayoutIcon from '~icons/material-symbols/view-quilt-outline-rounded';

  // Local: direction, layout engine and spacing (layout.ts). They edit the code
  // and the config, so a shared link keeps the layout.
  const direction = $derived(getDirection(inputState.code));
  const options = $derived(getLayoutOptions(inputState.mermaid));
  let message = $state('');
  let busy = $state(false);

  const applyDirection = (next: Direction) => {
    message = '';
    updateCode(setDirection(inputState.code, next), { resetPanZoom: true, updateDiagram: true });
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
    busy = true;
    message = '';
    try {
      const view = document.querySelector(`#view`)?.getBoundingClientRect();
      const size = view && view.width > 0 && view.height > 0 ? view : { height: 900, width: 1600 };
      const [tb, lr] = [await measure('TB'), await measure('LR')];
      if (!tb || !lr) throw new Error('no size');
      const chosen = pickDirection({ LR: lr, TB: tb }, size);
      applyDirection(chosen);
      message = t(chosen === 'LR' ? 'layout.fitChoseLR' : 'layout.fitChoseTB');
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
        <p class="text-muted-foreground">{t('layout.directionUnsupported')}</p>
      {/if}
    </div>

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

    {#if message}
      <p role="status" class="text-muted-foreground" data-testid={TID.layoutMessage}>{message}</p>
    {/if}
  </div>
</Card>
