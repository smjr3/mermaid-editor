<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import ObjectFields from '$/components/inspector/ObjectFields.svelte';
  import SelectSameRow from '$/components/inspector/SelectSameRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { selectionModel as model } from '$/util/selectionModel.svelte';

  // Local: the inspector for a selected lane, group, subgraph, composite state,
  // boundary or section: its name (also the inline rename), colour, how many objects it
  // holds with ＋追加 (a new one inside it, renamed at once), its id, and deleting it
  // with or without what is inside (selectionModel.svelte.ts).
  const object = $derived(model.object);
  let idText = $derived(object?.id ?? '');
  const applyId = () => {
    if (idText.trim() && idText.trim() !== object?.id) void model.renameId(idText);
    else idText = object?.id ?? '';
  };
  const smallButton = 'h-7 px-2 text-xs';
</script>

{#if object}
  <PanelGroup>
    <!-- The 名前 row is the inspector's own (Inspector.svelte), so that it outlives a
         change of selection while a rename is open. -->
    {#if object.noRename}
      <FieldRow label={t('sel.name')}>
        <span class="truncate text-xs text-muted-foreground">{t('edit.noRename')}</span>
      </FieldRow>
    {/if}
    {#if model.syntax}
      <FieldRow label={t('sel.color')}>
        <div class="contents" data-insp-focus="color">
          <ColorRow
            mode="fill"
            current={model.color}
            label={t('sel.color')}
            noneLabel={t('colors.groupClear')}
            testID={TID.inspColor}
            onpick={model.setColor} />
        </div>
      </FieldRow>
    {/if}
    <FieldRow label={t('insp.laneObjects')}>
      <span class="text-xs text-muted-foreground" data-testid={TID.inspLaneCount}
        >{t('insp.laneCount', { count: String(object.members?.length ?? 0) })}</span>
      {#if model.canAddAfter}
        <Button
          size="sm"
          variant="outline"
          class={['ml-auto', smallButton]}
          data-testid={TID.inspLaneAdd}
          onclick={() => void model.addAfter()}>{t('insp.laneAdd')}</Button>
      {/if}
    </FieldRow>
    {#if model.canRenameId}
      <FieldRow label={t('insp.id')}>
        <input
          bind:value={idText}
          class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
          aria-label={t('insp.id')}
          title={t('insp.idHint')}
          data-testid={TID.inspId}
          onkeydown={(event) => {
            if (event.isComposing) return;
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              idText = object.id;
              event.currentTarget.blur();
            }
          }}
          onblur={applyId} />
      </FieldRow>
    {/if}
    <ObjectFields />
    <!-- 「同じものを選ぶ」 (同じレーン: the lane with what it holds), as the node rows have it. -->
    <SelectSameRow />
    <FieldRow label={t('sel.delete')}>
      {#if object.noDelete}
        <span class="text-xs text-muted-foreground">{t('edit.noDelete')}</span>
      {:else}
        <Button
          size="sm"
          variant="outline"
          class={['text-destructive', smallButton]}
          data-testid={TID.inspDeleteKeep}
          onclick={() => void model.remove(true)}>{t('insp.deleteKeep')}</Button>
        <Button
          size="sm"
          variant="outline"
          class={['text-destructive', smallButton]}
          data-testid={TID.inspDelete}
          onclick={() => void model.remove(false)}>{t('insp.deleteAll')}</Button>
      {/if}
    </FieldRow>
  </PanelGroup>
{/if}
