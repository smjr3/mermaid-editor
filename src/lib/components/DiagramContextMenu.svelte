<script lang="ts">
  import ColorSwatches from '$/components/ColorSwatches.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { nodeShapes } from '$/util/diagramEdit';
  import type { EdgeStyle } from '$/util/diagramModify';
  import { requestRename, startConnect } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { onMount, tick } from 'svelte';

  // Local: the right-click menu over the diagram (SelectionLayer.svelte). On an object
  // or arrow: the selection's edits, as in the mini toolbar; on the empty canvas: add
  // a node, fit the diagram to the view. Arrow keys move, Enter or Space choose,
  // Escape closes.
  let {
    x,
    y,
    target,
    hostWidth,
    hostHeight,
    onclose
  }: {
    x: number;
    y: number;
    target: 'selection' | 'canvas';
    hostWidth: number;
    hostHeight: number;
    onclose: () => void;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();
  let width = $state(0);
  let height = $state(0);
  let sub = $state<'color' | 'shape' | 'style' | undefined>();
  const left = $derived(Math.max(4, Math.min(x, hostWidth - width - 4)));
  const top = $derived(Math.max(4, Math.min(y, hostHeight - height - 4)));

  const run = (action: () => unknown) => {
    onclose();
    void action();
  };
  const fit = () => {
    document.querySelector<HTMLElement>(`[data-testid="${TID.resetViewButton}"]`)?.click();
  };

  const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  onMount(() => {
    void tick().then(() => items()[0]?.focus());
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !menu?.contains(event.target)) onclose();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });
  const onkeydown = (event: KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    }
  };
  const item =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none';
  const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick'];
</script>

<div
  bind:this={menu}
  class="absolute z-30 flex w-56 flex-col rounded-lg border bg-card p-1 shadow-lg"
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="menu"
  tabindex="-1"
  aria-label={t('sel.menu')}
  data-selection-ui
  data-testid={TID.contextMenu}
  bind:offsetWidth={width}
  bind:offsetHeight={height}
  {onkeydown}>
  {#if target === 'canvas'}
    {#if model.kind}
      <button
        type="button"
        role="menuitem"
        class={item}
        data-testid={`${TID.contextMenuItem}-add-node`}
        onclick={() => run(model.addNode)}>{t('sel.addNode')}</button>
    {/if}
    <button
      type="button"
      role="menuitem"
      class={item}
      data-testid={`${TID.contextMenuItem}-fit`}
      onclick={() => run(fit)}>{t('sel.fit')}</button>
  {:else}
    {#if (model.object && !model.object.noRename) || (model.edge && model.edges?.can.label)}
      <button
        type="button"
        role="menuitem"
        class={item}
        data-testid={`${TID.contextMenuItem}-rename`}
        onclick={() => run(requestRename)}
        >{model.edge ? t('sel.renameLabel') : t('sel.rename')}</button>
    {/if}
    {#if model.syntax || model.canColorEdge}
      <button
        type="button"
        role="menuitem"
        class={item}
        aria-expanded={sub === 'color'}
        data-testid={`${TID.contextMenuItem}-color`}
        onclick={() => (sub = sub === 'color' ? undefined : 'color')}
        >{model.edge ? t('sel.edgeColor') : t('sel.color')} ▸</button>
      {#if sub === 'color'}
        <div class="px-2 py-1">
          {#if model.edge}
            <ColorSwatches
              mode="line"
              compact
              current={model.edgeColor}
              onpick={(color) => run(() => model.setEdgeColor(color))}
              testID={`${TID.contextMenuItem}-color`} />
          {:else}
            <ColorSwatches
              mode="fill"
              compact
              current={model.color}
              onpick={(swatch) => run(() => model.setColor(swatch))}
              testID={`${TID.contextMenuItem}-color`} />
          {/if}
        </div>
      {/if}
    {/if}
    {#if model.node?.shape !== undefined && !model.node.icon}
      <button
        type="button"
        role="menuitem"
        class={item}
        aria-expanded={sub === 'shape'}
        data-testid={`${TID.contextMenuItem}-shape`}
        onclick={() => (sub = sub === 'shape' ? undefined : 'shape')}>{t('sel.shape')} ▸</button>
      {#if sub === 'shape'}
        {#each nodeShapes as shape (shape)}
          <button
            type="button"
            role="menuitem"
            class={[item, 'pl-6']}
            aria-current={model.node.shape === shape}
            data-testid={`${TID.contextMenuItem}-shape-${shape}`}
            onclick={() => run(() => model.setShape(shape))}>{t(`add.shape.${shape}`)}</button>
        {/each}
      {/if}
    {/if}
    {#if model.edge && (model.edges?.can.styles.length ?? 0) > 0}
      <button
        type="button"
        role="menuitem"
        class={item}
        aria-expanded={sub === 'style'}
        data-testid={`${TID.contextMenuItem}-style`}
        onclick={() => (sub = sub === 'style' ? undefined : 'style')}
        >{t('sel.edgeStyle')} ▸</button>
      {#if sub === 'style'}
        {#each edgeStyles.filter( (style) => model.edges?.can.styles.includes(style) ) as style (style)}
          <button
            type="button"
            role="menuitem"
            class={[item, 'pl-6']}
            data-testid={`${TID.contextMenuItem}-style-${style}`}
            onclick={() => run(() => model.setEdgeStyle(style))}
            >{t(`edit.edgeStyle.${style}`)}</button>
        {/each}
      {/if}
    {/if}
    {#if model.edge && model.edges?.can.reverse}
      <button
        type="button"
        role="menuitem"
        class={item}
        data-testid={`${TID.contextMenuItem}-reverse`}
        onclick={() => run(model.reverse)}>{t('sel.reverse')}</button>
    {/if}
    {#if model.canAddAfter}
      <button
        type="button"
        role="menuitem"
        class={item}
        data-testid={`${TID.contextMenuItem}-add-after`}
        onclick={() => run(model.addAfter)}>{t('sel.addAfter')}</button>
    {/if}
    {#if model.canConnect}
      <button
        type="button"
        role="menuitem"
        class={item}
        data-testid={`${TID.contextMenuItem}-connect`}
        onclick={() => run(startConnect)}>{t('sel.connect')}</button>
    {/if}
    {#if (model.object && !model.object.noDelete) || model.edge}
      <div class="my-1 h-px bg-border"></div>
      <button
        type="button"
        role="menuitem"
        class={[item, 'text-destructive']}
        data-testid={`${TID.contextMenuItem}-delete`}
        onclick={() => run(() => model.remove())}>{t('sel.delete')}</button>
    {/if}
  {/if}
</div>
