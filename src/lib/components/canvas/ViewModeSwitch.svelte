<script lang="ts" module>
  export type ViewMode = 'diagram' | 'table' | 'both';
</script>

<script lang="ts">
  import Segmented from '$/components/form/Segmented.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';

  // Local: 図 / 表 / 並べる for the diagrams that are a list at heart (gantt, kanban,
  // timeline, pie, the charts, an ER entity's attributes: tableEdit.ts) — the diagram, the
  // table editor, or the table under the diagram.
  let { value = $bindable() }: { value: ViewMode } = $props();

  const options: { label: string; value: ViewMode }[] = [
    { label: t('canvas.viewDiagram'), value: 'diagram' },
    { label: t('canvas.viewTable'), value: 'table' },
    { label: t('canvas.viewBoth'), value: 'both' }
  ];
</script>

<Segmented
  bind:value={() => value, (next) => (value = next as ViewMode)}
  {options}
  testID={TID.canvasViewMode}
  ariaLabel={t('canvas.viewMode')} />
