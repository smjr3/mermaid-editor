<script lang="ts" module>
  export type RailTarget =
    | 'expand'
    | 'code'
    | 'config'
    | 'layout'
    | 'add'
    | 'edit'
    | 'colors'
    | 'icons'
    | 'samples'
    | 'actions';

  /** Which side pane a rail stands in for: the code pane (left) or the tools pane (right). */
  export type RailSide = 'left' | 'right';
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
  import LeftOpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';
  import RightOpenIcon from '~icons/material-symbols/right-panel-open-outline-rounded';
  import AddIcon from '~icons/material-symbols/add-box-outline-rounded';
  import EditIcon from '~icons/material-symbols/edit-square-outline-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';
  import LayoutIcon from '~icons/material-symbols/view-quilt-outline-rounded';

  // Local: what stays of a side pane while it is collapsed — one icon per section;
  // each expands the pane and opens that section. The left rail stands in for the
  // code pane (code, config), the right one for the tools pane (the tool cards).
  let { onopen, side = 'left' }: { onopen: (target: RailTarget) => void; side?: RailSide } =
    $props();

  interface Item {
    target: RailTarget;
    label: string;
    icon: Component;
    class?: string;
  }
  const codeItems: Item[] = [
    { icon: CodeIcon, label: t('editor.textTab'), target: 'code' },
    { icon: GearIcon, label: t('editor.configTab'), target: 'config' }
  ];
  const toolItems: Item[] = [
    { icon: LayoutIcon, label: t('layout.title'), target: 'layout' },
    { icon: AddIcon, label: t('add.title'), target: 'add' },
    { icon: EditIcon, label: t('edit.title'), target: 'edit' },
    { icon: PaletteIcon, label: t('colors.title'), target: 'colors' },
    { icon: IconsIcon, label: t('icons.title'), target: 'icons' },
    { icon: SamplesIcon, label: t('preset.title'), target: 'samples' },
    { class: 'rotate-180', icon: DownloadIcon, label: t('actions.title'), target: 'actions' }
  ];

  const left = $derived(side === 'left');
  const items = $derived(left ? codeItems : toolItems);
  const testId = $derived(left ? TID.editorRail : TID.toolsRail);
  const expandLabel = $derived(left ? t('editor.showPane') : t('tools.showPane'));
  const OpenIcon = $derived(left ? LeftOpenIcon : RightOpenIcon);
</script>

<nav
  class={[
    'flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-t bg-card py-2',
    left ? 'border-r' : 'border-l'
  ]}
  aria-label={left ? t('editor.rail') : t('tools.rail')}
  data-testid={testId}>
  <Button
    variant="ghost"
    size="icon"
    title={expandLabel}
    aria-label={expandLabel}
    data-testid={left ? TID.editorRailExpand : TID.toolsRailExpand}
    onclick={() => onopen('expand')}>
    <OpenIcon />
  </Button>
  <div class="my-1 h-px w-6 shrink-0 bg-border"></div>
  {#each items as item (item.target)}
    {@const Icon = item.icon}
    <Button
      variant="ghost"
      size="icon"
      title={item.label}
      aria-label={item.label}
      data-testid={`${testId}-${item.target}`}
      onclick={() => onopen(item.target)}>
      <Icon class={item.class} />
    </Button>
  {/each}
</nav>
