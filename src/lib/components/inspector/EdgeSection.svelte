<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { EdgeStyle } from '$/util/diagramModify';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';

  // Local: the inspector for a selected arrow (or message, relation, transition, …):
  // where it goes, its line, arrowhead and colour, turning it round and deleting it —
  // what the diagram type's arrow syntax allows (`model.edges.can`), through the
  // selection model (selectionModel.svelte.ts). Its label (also the inline rename) is
  // the inspector's own row (Inspector.svelte).
  const edge = $derived(model.edge);
  const can = $derived(model.edges?.can);
  const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick'];
</script>

{#if edge}
  <PanelGroup>
    <FieldRow label={t('insp.edgeEnds')}>
      <span class="truncate text-sm font-semibold" title={edge.title} data-testid={TID.inspEdgeEnds}
        >{edge.title}</span>
    </FieldRow>
    {#if can && can.styles.length > 0}
      <FieldRow label={t('insp.edgeStyle')}>
        <Segmented
          value={edge.style}
          full
          ariaLabel={t('sel.edgeStyle')}
          testID={TID.inspEdgeStyle}
          options={edgeStyles
            .filter((style) => can.styles.includes(style))
            .map((style) => ({ label: t(`edit.edgeStyle.${style}`), value: style }))}
          onchange={(style) => void model.setEdgeStyle(style as EdgeStyle)} />
      </FieldRow>
    {/if}
    {#if can?.head}
      <FieldRow label={t('sel.head')}>
        <Segmented
          value={edge.head ? 'on' : 'off'}
          full
          ariaLabel={t('sel.head')}
          testID={TID.inspEdgeHead}
          options={[
            { label: t('edit.edgeHeadOn'), value: 'on' },
            { label: t('edit.edgeHeadOff'), value: 'off' }
          ]}
          onchange={(head) => void model.setEdgeHead(head === 'on')} />
      </FieldRow>
    {/if}
    {#if model.canColorEdge}
      <FieldRow label={t('sel.color')}>
        <div class="contents" data-insp-focus="color">
          <ColorRow
            mode="line"
            current={model.edgeColor}
            label={t('sel.edgeColor')}
            noneLabel={t('colors.edgeDefault')}
            testID={TID.inspEdgeColor}
            onpick={model.setEdgeColor} />
        </div>
      </FieldRow>
    {/if}
    <div class="flex items-center gap-1">
      {#if can?.reverse}
        <Button
          size="sm"
          variant="outline"
          class="h-7 px-2 text-xs"
          data-testid={TID.inspEdgeReverse}
          onclick={() => void model.reverse()}>{t('insp.edgeReverse')}</Button>
      {/if}
      <span class="flex-1"></span>
      <Button
        size="sm"
        variant="ghost"
        class="size-7 p-0 text-destructive"
        title={`${t('edit.edgeDelete')} (Delete)`}
        aria-label={t('edit.edgeDelete')}
        data-testid={TID.inspDelete}
        onclick={() => void model.remove()}><DeleteIcon /></Button>
    </div>
  </PanelGroup>
{/if}
