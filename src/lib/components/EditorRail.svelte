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
    | 'actions'
    | 'ai';

  /** Which side of the window a rail sits on. */
  export type RailSide = 'left' | 'right';
  /** Which pane a rail stands in for. */
  export type RailKind = 'code' | 'tools';
</script>

<script lang="ts">
  import StyleCodeIcon from '$/components/StyleCodeIcon.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Component } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import AiIcon from '~icons/material-symbols/auto-awesome-outline-rounded';
  import SamplesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import IconsIcon from '~icons/material-symbols/category-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download';
  import LeftOpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';
  import RightOpenIcon from '~icons/material-symbols/right-panel-open-outline-rounded';
  import AddIcon from '~icons/material-symbols/add-box-outline-rounded';
  import EditIcon from '~icons/material-symbols/edit-square-outline-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';
  import LayoutIcon from '~icons/material-symbols/view-quilt-outline-rounded';

  // Local: what stays of a side pane while it is collapsed — one icon per section;
  // each expands the pane and opens that section. A code rail stands in for the code
  // pane (code, config), a tools rail for the tools pane (its sections, grouped by the
  // tab they are in: 作る, 直す, 出す; each opens its tab and section). Each rail sits on
  // its pane's side, which the "swap panes" setting changes (toolsPane.svelte.ts).
  let {
    kind,
    onopen,
    side
  }: { kind: RailKind; onopen: (target: RailTarget) => void; side: RailSide } = $props();

  interface Item {
    target: RailTarget;
    label: string;
    icon: Component;
    class?: string;
    /** The first item of a tab: a divider goes before it. */
    first?: boolean;
  }
  const codeItems: Item[] = [
    { icon: CodeIcon, label: t('editor.textTab'), target: 'code' },
    { icon: StyleCodeIcon, label: t('editor.configTabTooltip'), target: 'config' }
  ];
  const toolItems: Item[] = [
    { icon: SamplesIcon, label: t('preset.title'), target: 'samples' },
    { icon: AddIcon, label: t('add.title'), target: 'add' },
    { first: true, icon: EditIcon, label: t('edit.title'), target: 'edit' },
    { icon: PaletteIcon, label: t('colors.title'), target: 'colors' },
    { icon: LayoutIcon, label: t('layout.title'), target: 'layout' },
    { icon: IconsIcon, label: t('icons.title'), target: 'icons' },
    {
      class: 'rotate-180',
      first: true,
      icon: DownloadIcon,
      label: t('actions.title'),
      target: 'actions'
    },
    { icon: AiIcon, label: t('ai.title'), target: 'ai' }
  ];

  const left = $derived(side === 'left');
  const code = $derived(kind === 'code');
  const items = $derived(code ? codeItems : toolItems);
  const testId = $derived(code ? TID.editorRail : TID.toolsRail);
  const expandLabel = $derived(code ? t('editor.showPane') : t('tools.showPane'));
  const OpenIcon = $derived(left ? LeftOpenIcon : RightOpenIcon);
</script>

<nav
  class={[
    'flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-t bg-card py-2',
    left ? 'border-r' : 'border-l'
  ]}
  aria-label={code ? t('editor.rail') : t('tools.rail')}
  data-side={side}
  data-testid={testId}>
  <Button
    variant="ghost"
    size="icon"
    title={expandLabel}
    aria-label={expandLabel}
    data-testid={code ? TID.editorRailExpand : TID.toolsRailExpand}
    onclick={() => onopen('expand')}>
    <OpenIcon />
  </Button>
  <div class="my-1 h-px w-6 shrink-0 bg-border"></div>
  {#each items as item (item.target)}
    {@const Icon = item.icon}
    {#if item.first}
      <div class="my-1 h-px w-6 shrink-0 bg-border"></div>
    {/if}
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
