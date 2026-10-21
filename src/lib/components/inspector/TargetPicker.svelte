<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { displayName } from '$/util/displayName';
  import { objectsOfTab, type InspectorTab } from '$/util/inspectorTabs';
  import { select, selection } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';

  // Local: the list a tab of the inspector opens when nothing of its kind is selected
  // (Inspector.svelte): the objects of that kind (図形, レーン, タスク, トピック, …) or the
  // arrows, from the selection model's lists (the last valid code's, so it works while
  // the code is broken too). A click selects the item, and the panel shows its rows. It
  // replaces the 要素 / 矢印 selects that sat at the bottom of 図全体.
  // `onpick`: the item is chosen (also when it was the selection already): the list closes.
  let { onpick, tab }: { onpick?: () => void; tab: InspectorTab } = $props();

  const items = $derived(model.objects?.items ?? []);
  const objects = $derived(objectsOfTab(model.code, tab.id, items));
  const edges = $derived(model.edges?.items ?? []);
  const selectedId = $derived(selection.current?.type === 'node' ? selection.current.id : '');
  const selectedEdge = $derived(selection.current?.type === 'edge' ? selection.current.index : -1);
  const labelOf = (object: (typeof items)[number]) =>
    object.line === undefined
      ? displayName(object.label, object.id, items)
      : object.label.replaceAll(' ', ' ');
  const item =
    'flex w-full min-w-0 items-center rounded px-2 py-1 text-left text-xs hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-pressed:bg-muted aria-pressed:font-semibold';
</script>

<div class="flex flex-col px-2 py-2" data-testid={TID.inspPicker} data-tab={tab.id}>
  {#if tab.id === 'edge'}
    {#if edges.length === 0}
      <p
        class="px-2 py-1 text-xs text-muted-foreground"
        title={t(model.edges?.unsure ? 'edit.edgesUnsure' : 'edit.edgesNone')}>
        {t(model.edges?.unsure ? 'edit.edgesUnsure' : 'edit.edgesNone')}
      </p>
    {:else}
      <ul class="flex flex-col" aria-label={t('insp.pickEdges')}>
        {#each edges as edge (edge.index)}
          <li>
            <button
              type="button"
              class={item}
              aria-pressed={edge.index === selectedEdge}
              title={edge.title}
              data-index={edge.index}
              data-testid={TID.inspPickItem}
              onclick={() => {
                select({ index: edge.index, type: 'edge' });
                onpick?.();
              }}>
              <span class="truncate">{edge.title}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if objects.length === 0}
    <p class="px-2 py-1 text-xs text-muted-foreground">{t('edit.objectsNone')}</p>
  {:else}
    <ul class="flex flex-col" aria-label={t('insp.pick', { kind: t(tab.label) })}>
      {#each objects as object (object.id)}
        <li>
          <button
            type="button"
            class={item}
            aria-pressed={object.id === selectedId}
            title={object.id}
            data-id={object.id}
            data-testid={TID.inspPickItem}
            onclick={() => {
              select({ id: object.id, type: 'node' });
              onpick?.();
            }}>
            <span class="truncate whitespace-pre">{labelOf(object)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
