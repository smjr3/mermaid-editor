<script lang="ts" module>
  import { t } from '$/i18n';
  import { logEvent, logMermaidChartClick } from '$lib/util/stats';
  import { version } from 'mermaid/package.json';

  void logEvent('version', {
    mermaidVersion: version
  });
</script>

<script lang="ts">
  import { resolve } from '$app/paths';
  import HelpButton from '$/components/HelpButton.svelte';
  import MainMenu from '$/components/MainMenu.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import { env } from '$/util/env';
  import { dismissPromotion, getActivePromotion } from '$lib/util/promos/promo.svelte';
  import { untrack, type ComponentProps, type Snippet } from 'svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import GithubIcon from '~icons/mdi/github';
  import DropdownNavMenu from './DropdownNavMenu.svelte';

  interface Props {
    mobileToggle?: Snippet;
    children: Snippet;
    hidePromotion?: boolean;
  }

  let { children, mobileToggle, hidePromotion = false }: Props = $props();

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

<nav class="z-50 flex items-center px-4 py-2 sm:px-6">
  <div class="flex flex-1 items-center gap-2">
    <MainMenu />
    <a href={resolve('/', {})} class="whitespace-nowrap text-accent">
      {t(mobileToggle ? 'nav.appTitleShort' : 'nav.appTitle')}
    </a>
  </div>
  <!-- Local: the guide to the editor, on every page and screen size. -->
  <div class="flex items-center">
    <HelpButton />
  </div>
  <div
    id="menu"
    class="hidden flex-nowrap items-center justify-between gap-3 overflow-hidden md:flex">
    {#if env.isEnabledCommunityLinks}
      <DropdownNavMenu icon={GithubIcon} links={githubLinks} />
      <Separator orientation="vertical" />
    {/if}
    {@render children()}
  </div>
  {@render mobileToggle?.()}
</nav>
