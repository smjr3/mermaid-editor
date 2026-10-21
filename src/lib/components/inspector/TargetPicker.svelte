<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { displayName } from '$/util/displayName';
  import { objectsOfTab, type InspectorTab } from '$/util/inspectorTabs';
  import { isSelected, select, selectMany, type Selected } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';

  // Local: the list a tab of the inspector opens when nothing of its kind is selected
  // (Inspector.svelte): the objects of that kind (図形, レーン, タスク, トピック, …) or the
  // arrows, from the selection model's lists (the last valid code's, so it works while
  // the code is broken too). A click selects the item, and the panel shows its rows;
  // Ctrl/⌘+click adds it to (or takes it out of) the selection and keeps the list open
  // (the selected items are pressed); 「すべて選ぶ」 at the end selects the whole list. It
  // replaces the 要素 / 矢印 selects that sat at the bottom of 図全体.
  // `onpick`: the item is chosen (also when it was the selection already): the list closes.
  // `ontoggle`: a Ctrl/⌘+click (the inspector keeps the list open around it).
  let {
    onpick,
    ontoggle,
    tab
  }: { onpick?: () => void; ontoggle?: (next: Selected) => void; tab: InspectorTab } = $props();

  const items = $derived(model.objects?.items ?? []);
  const objects = $derived(objectsOfTab(model.code, tab.id, items));
  const edges = $derived(model.edges?.items ?? []);
  // Everything the list shows, for 「すべて選ぶ」.
  const listed = $derived.by((): Selected[] =>
    tab.id === 'edge'
      ? edges.map((edge) => ({ index: edge.index, type: 'edge' }))
      : objects.map((object) => ({ id: object.id, type: 'node' }))
  );
  const pick = (event: MouseEvent, next: Selected) => {
    if ((event.ctrlKey || event.metaKey) && ontoggle) {
      ontoggle(next);
      return;
    }
    select(next);
    onpick?.();
  };
  const pickAll = () => {
    selectMany(listed);
    onpick?.();
  };
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
              aria-pressed={isSelected({ index: edge.index, type: 'edge' })}
              title={edge.title}
              data-index={edge.index}
              data-testid={TID.inspPickItem}
              onclick={(event) => pick(event, { index: edge.index, type: 'edge' })}>
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
            aria-pressed={isSelected({ id: object.id, type: 'node' })}
            title={object.id}
            data-id={object.id}
            data-testid={TID.inspPickItem}
            onclick={(event) => pick(event, { id: object.id, type: 'node' })}>
            <span class="truncate whitespace-pre">{labelOf(object)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if listed.length > 1}
    <div class="mt-1 flex justify-end border-t border-border pt-1">
      <button
        type="button"
        class="h-6 rounded-md border border-input bg-background px-1.5 text-xs whitespace-nowrap hover:bg-muted"
        title={t('insp.pickAll')}
        data-testid={TID.inspPickAll}
        onclick={pickAll}>{t('insp.pickAll')}</button>
    </div>
  {/if}
</div>
