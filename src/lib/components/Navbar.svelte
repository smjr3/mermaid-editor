<script lang="ts" module>
  import { t } from '$/i18n';
  import { logEvent, logMermaidChartClick } from '$lib/util/stats';
  import { version } from 'mermaid/package.json';

  void logEvent('version', {
    mermaidVersion: version
  });
</script>

<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import GuideTour from '$/components/GuideTour.svelte';
  import HelpButton from '$/components/HelpButton.svelte';
  import ResetAllButton from '$/components/ResetAllButton.svelte';
  import ThemeIcon from '$/components/ThemeIcon.svelte';
  import UndoRedoButtons from '$/components/UndoRedoButtons.svelte';
  import { Button } from '$/components/ui/button';
  import * as Popover from '$/components/ui/popover';
  import { Separator } from '$/components/ui/separator';
  import { Toggle } from '$/components/ui/toggle';
  import { TID } from '$/constants';
  import { openDialog, type NewDialogTab } from '$/util/editorUi.svelte';
  import { env } from '$/util/env';
  import { mode, setMode } from 'mode-watcher';
  import { dismissPromotion, getActivePromotion } from '$lib/util/promos/promo.svelte';
  import { untrack, type ComponentProps, type Snippet } from 'svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import DownloadIcon from '~icons/material-symbols/download';
  import ExpandIcon from '~icons/material-symbols/expand-more-rounded';
  import HistoryIcon from '~icons/material-symbols/history';
  import NewIcon from '~icons/material-symbols/note-add-outline-rounded';
  import ShareIcon from '~icons/material-symbols/share';
  import GithubIcon from '~icons/mdi/github';
  import DropdownNavMenu from './DropdownNavMenu.svelte';

  // Local: the editor's header — the app name, undo/redo, then 新規 ▾ (形式から作る… /
  // サンプルから作る…), 共有 and 書き出す, and after a divider 使い方, 履歴, 初期化 and
  // light/dark. `children` holds what a deployment switches on (Mermaid Chart links).
  interface Props {
    children?: Snippet;
    hidePromotion?: boolean;
    historyOpen?: boolean;
  }

  let { children, hidePromotion = false, historyOpen = $bindable(false) }: Props = $props();

  type Links = ComponentProps<typeof DropdownNavMenu>['links'];

  const githubLinks: Links = [
    { title: 'Mermaid JS', href: 'https://github.com/mermaid-js/mermaid' },
    {
      title: 'Mermaid Live Editor',
      href: 'https://github.com/mermaid-js/mermaid-live-editor'
    },
    {
      title: 'Mermaid CLI',
      href: 'https://github.com/mermaid-js/mermaid-cli'
    }
  ];

  const themeLabel = $derived(
    mode.current === 'dark' ? t('toolbar.switchToLight') : t('toolbar.switchToDark')
  );

  let activePromotion = $state(untrack(() => (hidePromotion ? undefined : getActivePromotion())));

  const trackBannerClick = () => {
    if (!activePromotion) {
      return;
    }
    logEvent('bannerClick', {
      promotion: activePromotion.id
    });
    logMermaidChartClick('banner');
  };

  let newMenuOpen = $state(false);
  const openNew = (tab: NewDialogTab) => {
    newMenuOpen = false;
    openDialog('new', tab);
  };
  const newItems: { label: string; tab: NewDialogTab; testID: string }[] = [
    { label: t('ws.newFromType'), tab: 'type', testID: TID.wsNewFromType },
    { label: t('ws.newFromSample'), tab: 'sample', testID: TID.wsNewFromSample }
  ];
</script>

{#if activePromotion}
  <div class="top-bar z-10 flex h-fit w-full bg-primary">
    <div
      class="flex grow"
      role="button"
      tabindex="0"
      onclick={trackBannerClick}
      onkeypress={trackBannerClick}>
      <activePromotion.component {closeBanner} />
    </div>
    {#snippet closeBanner()}
      <Button
        title={t('nav.dismissBanner')}
        variant="ghost"
        class="hover:bg-transparent hover:text-[#261A56]"
        size="sm"
        onclick={() => {
          dismissPromotion(activePromotion?.id);
          activePromotion = undefined;
        }}>
        <CloseIcon />
      </Button>
    {/snippet}
  </div>
{/if}

<nav
  class="z-50 flex h-[46px] shrink-0 items-center gap-2 border-b border-border px-3"
  data-testid={TID.headerBar}>
  <a
    href={resolve('/', {})}
    class="flex items-center gap-2 font-semibold whitespace-nowrap text-accent"
    data-testid={TID.appIcon}>
    <img class="size-6" src={asset('/favicon.svg')} alt="" />
    {t('nav.appTitle')}
  </a>
  <div class="ml-2 flex items-center">
    <UndoRedoButtons />
  </div>
  <div class="flex-1"></div>
  <div
    class="flex items-center gap-1"
    role="group"
    aria-label={t('ws.headerActions')}
    data-testid={TID.wsHeaderActions}>
    <Popover.Root bind:open={newMenuOpen}>
      <Popover.Trigger
        class="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-muted [&_svg]:size-5"
        data-testid={TID.wsNewMenu}>
        <NewIcon />
        {t('ws.newMenu')}
        <ExpandIcon />
      </Popover.Trigger>
      <Popover.Content align="end" class="flex w-56 flex-col p-1">
        {#each newItems as item (item.tab)}
          <button
            type="button"
            class="rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            data-testid={item.testID}
            onclick={() => openNew(item.tab)}>
            {item.label}
          </button>
        {/each}
      </Popover.Content>
    </Popover.Root>
    <Button
      variant="outline"
      size="sm"
      class="[&_svg]:size-5"
      data-testid={TID.wsShareButton}
      onclick={() => openDialog('share')}>
      <ShareIcon />
      {t('ws.share')}
    </Button>
    <Button
      variant="accent"
      size="sm"
      class="[&_svg]:size-5"
      data-testid={TID.wsExportButton}
      onclick={() => openDialog('export')}>
      <DownloadIcon class="rotate-180" />
      {t('ws.export')}
    </Button>
  </div>
  {#if env.isEnabledCommunityLinks}
    <DropdownNavMenu icon={GithubIcon} links={githubLinks} />
  {/if}
  {@render children?.()}
  <Separator orientation="vertical" class="mx-1 h-6" />
  <div class="flex items-center gap-1">
    <HelpButton />
    <GuideTour />
    <Toggle
      bind:pressed={historyOpen}
      size="sm"
      data-testid={TID.wsHistoryButton}
      title={t('editor.historyToggle')}
      aria-label={t('editor.historyToggle')}>
      <HistoryIcon />
    </Toggle>
    <ResetAllButton />
    <Button
      variant="ghost"
      size="icon"
      class="size-8"
      data-testid={TID.themeToggleButton}
      title={themeLabel}
      aria-label={themeLabel}
      onclick={() => setMode(mode.current === 'dark' ? 'light' : 'dark')}>
      <ThemeIcon />
    </Button>
  </div>
</nav>
