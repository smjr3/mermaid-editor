<script lang="ts">
  import AiTools from '$/components/AiTools.svelte';
  import CodeErrorNotice from '$/components/CodeErrorNotice.svelte';
  import ColorControls from '$/components/ColorControls.svelte';
  import EditControls from '$/components/EditControls.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import LayoutControls from '$/components/LayoutControls.svelte';
  import SelectionPanel from '$/components/SelectionPanel.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import CollapseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';

  // Local: the inspector, the right column of /edit (W0 stub). Its header says 図全体 and
  // folds the column to its rail; under it, today's tool sections (the selection, then
  // add, layout, edit, colours, icons, unknown icons and the AI briefing), each a card
  // that opens on its own, so every feature stays reachable until the real panel lands.
  let { oncollapse }: { oncollapse: () => void } = $props();
</script>

<div class="flex h-full min-h-0 flex-col bg-card" data-testid={TID.inspPanel}>
  <div class="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
    <span class="truncate text-sm font-semibold" data-testid={TID.inspCrumbRoot}>
      {t('ws.inspectorRoot')}
    </span>
    <Button
      variant="ghost"
      size="sm"
      class="size-7 p-0"
      data-testid={TID.inspCollapse}
      title={t('ws.inspectorCollapse')}
      aria-label={t('ws.inspectorCollapse')}
      onclick={oncollapse}>
      <CollapseIcon />
    </Button>
  </div>
  <!-- A code error and the way back, above the tools (codeHealth.svelte.ts). -->
  <CodeErrorNotice testID={TID.toolsErrorNotice} compact />
  <div
    class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [&_.card]:flex-none [&_.card]:rounded-none [&_.card]:border-0 [&_.card]:border-b [&_.card]:border-border">
    <SelectionPanel />
    <LayoutControls />
    <EditControls />
    <ColorControls />
    <IconPacks />
    <AiTools />
  </div>
</div>
