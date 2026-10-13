<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import DetailFieldRow from '$/components/inspector/DetailFieldRow.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { EdgeHead, EdgeStyle } from '$/util/diagramModify';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';

  // Local: the inspector for a selected arrow (or message, relation, transition, …):
  // where it goes, its line, arrowhead, its other properties (edgeFields: head shape,
  // length, animation, curve, kind, multiplicities, …) and colour, turning it round and
  // deleting it —
  // what the diagram type's arrow syntax allows (`model.edges.can`), through the
  // selection model (selectionModel.svelte.ts). Its label (also the inline rename) is
  // the inspector's own row (Inspector.svelte).
  const edge = $derived(model.edge);
  const can = $derived(model.edges?.can);
  const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick', 'invisible'];
  const applyField = (key: string, value: string) => {
    if (model.edgeFields.find((field) => field.key === key)?.value === value) return;
    void model.setEdgeFields({ [key]: value });
  };
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
          dense
          full
          ariaLabel={t('sel.edgeStyle')}
          testID={TID.inspEdgeStyle}
          options={edgeStyles
            .filter((style) => can.styles.includes(style))
            .map((style) => ({ label: t(`edit.edgeStyle.${style}`), value: style }))}
          onchange={(style) => void model.setEdgeStyle(style as EdgeStyle)} />
      </FieldRow>
    {/if}
    {#if can?.head && edge.style !== 'invisible'}
      <FieldRow label={t('sel.head')}>
        <Segmented
          value={edge.head}
          full
          ariaLabel={t('sel.head')}
          testID={TID.inspEdgeHead}
          options={[
            { label: t('edit.edgeHeadEnd'), value: 'end' },
            // Only where the type can draw a head at each end (not block, for one).
            ...(can.both ? [{ label: t('edit.edgeHeadBoth'), value: 'both' }] : []),
            { label: t('edit.edgeHeadOff'), value: 'none' }
          ]}
          onchange={(head) => void model.setEdgeHead(head as EdgeHead)} />
      </FieldRow>
    {/if}
    <!-- What else mermaid lets this type say about one arrow (edgeFields). -->
    {#each model.edgeFields as field (field.key)}
      <DetailFieldRow {field} apply={applyField} dataKey={field.key} testID={TID.inspEdgeField} />
    {/each}
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
