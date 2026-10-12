<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { displayName } from '$/util/displayName';
  import { focusInspector } from '$/util/editorUi.svelte';
  import { requestRename, startConnect } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { onMount, tick } from 'svelte';

  // Local: the right-click menu over the diagram (SelectionLayer.svelte), a short cut to
  // the common edits, one line each with its key: 名前を変更 F2 / 色を変える / 形を変える /
  // 次の処理を追加 Enter / ここから矢印を引く / 削除 Del. 色 and 形 open the inspector at that
  // row (focusInspector), where every other change of the selection is. On an arrow:
  // its label, colour, turning it round and deleting it; on the empty canvas: add a node,
  // fit the diagram to the view. Arrow keys move, Enter or Space choose, Escape closes.
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
    // A wheel zooms the diagram under the menu, which would then point at nothing.
    const wheel = (event: WheelEvent) => {
      if (!(event.target instanceof Node) || !menu?.contains(event.target)) onclose();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('wheel', wheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('wheel', wheel, { capture: true });
    };
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
    'flex w-full items-center gap-4 rounded px-2 py-1.5 text-left text-sm whitespace-nowrap hover:bg-muted focus:bg-muted focus:outline-none';
</script>

<div
  bind:this={menu}
  class="absolute z-30 flex w-60 flex-col rounded-lg border bg-card p-1 shadow-lg"
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
  {#snippet entry(key: string, label: string, action: () => unknown, shortcut = '', danger = false)}
    <button
      type="button"
      role="menuitem"
      class={[item, danger && 'text-destructive']}
      data-testid={`${TID.contextMenuItem}-${key}`}
      onclick={() => run(action)}>
      <span class="flex-1 truncate">{label}</span>
      {#if shortcut}<kbd class="font-sans text-xs text-muted-foreground">{shortcut}</kbd>{/if}
    </button>
  {/snippet}
  {#if target === 'canvas'}
    {#if model.kind}
      {@render entry('add-node', t('sel.addNode'), model.addNode)}
    {/if}
    {@render entry('fit', t('sel.fit'), fit)}
  {:else}
    {#if model.object || model.edge}
      <div
        class="truncate px-2 py-1 text-xs text-muted-foreground"
        data-testid={`${TID.contextMenu}-name`}>
        {model.edge
          ? `${t('sel.edge')} ${model.edge.title}`
          : displayName(
              model.object?.label ?? '',
              model.object?.id ?? '',
              model.objects?.items ?? []
            )}
      </div>
    {/if}
    {#if (model.object && !model.object.noRename) || (model.edge && model.edges?.can.label)}
      {@render entry(
        'rename',
        model.edge ? t('sel.renameLabel') : t('canvas.menuRename'),
        requestRename,
        'F2'
      )}
    {/if}
    {#if model.syntax || model.canColorEdge}
      {@render entry('color', t('canvas.menuColor'), () => focusInspector('color'))}
    {/if}
    {#if model.node?.shape !== undefined && !model.node.icon}
      {@render entry('shape', t('canvas.menuShape'), () => focusInspector('shape'))}
    {/if}
    {#if model.edge && model.edges?.can.reverse}
      {@render entry('reverse', t('sel.reverse'), model.reverse)}
    {/if}
    {#if model.canAddAfter}
      {@render entry(
        'add-after',
        t(model.kind === 'flowchart' ? 'canvas.menuAddNext' : 'canvas.menuAddNextOther'),
        model.addAfter,
        'Enter'
      )}
    {/if}
    {#if model.canConnect}
      {@render entry('connect', t('canvas.menuConnect'), startConnect)}
    {/if}
    {#if (model.object && !model.object.noDelete) || model.edge}
      <div class="my-1 h-px bg-border"></div>
      {@render entry('delete', t('sel.delete'), () => model.remove(), 'Del', true)}
    {/if}
  {/if}
</div>
