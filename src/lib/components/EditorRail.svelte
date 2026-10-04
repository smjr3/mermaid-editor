<script lang="ts" module>
  export type RailTarget =
    'expand' | 'code' | 'config' | 'layout' | 'colors' | 'icons' | 'samples' | 'actions';
</script>

<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Component } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import SamplesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import IconsIcon from '~icons/material-symbols/category-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download';
  import OpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';
  import LayoutIcon from '~icons/material-symbols/view-quilt-outline-rounded';

  // Local: what stays of the editor column while it is collapsed — one icon per
  // section; each expands the column and opens that section.
  let { onopen }: { onopen: (target: RailTarget) => void } = $props();

  const items: { target: RailTarget; label: string; icon: Component; class?: string }[] = [
    { icon: CodeIcon, label: t('editor.textTab'), target: 'code' },
    { icon: GearIcon, label: t('editor.configTab'), target: 'config' },
    { icon: LayoutIcon, label: t('layout.title'), target: 'layout' },
    { icon: PaletteIcon, label: t('colors.title'), target: 'colors' },
    { icon: IconsIcon, label: t('icons.title'), target: 'icons' },
    { icon: SamplesIcon, label: t('preset.title'), target: 'samples' },
    { class: 'rotate-180', icon: DownloadIcon, label: t('actions.title'), target: 'actions' }
  ];
</script>

<nav
  class="flex w-12 shrink-0 flex-col items-center gap-1 border-t border-r bg-card py-2"
  aria-label={t('editor.rail')}
  data-testid={TID.editorRail}>
  <Button
    variant="ghost"
    size="icon"
    title={t('editor.showPane')}
    aria-label={t('editor.showPane')}
    data-testid={TID.editorRailExpand}
    onclick={() => onopen('expand')}>
    <OpenIcon />
  </Button>
  <div class="my-1 h-px w-6 bg-border"></div>
  {#each items as item (item.target)}
    {@const Icon = item.icon}
    <Button
      variant="ghost"
      size="icon"
      title={item.label}
      aria-label={item.label}
      data-testid={`${TID.editorRail}-${item.target}`}
      onclick={() => onopen(item.target)}>
      <Icon class={item.class} />
    </Button>
  {/each}
</nav>
