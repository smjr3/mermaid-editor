<script lang="ts">
  import type { Tab } from '$/types';
  import { toggleSection, toolsAccordion } from '$/util/toolsPane.svelte';
  import type { Component, Snippet } from 'svelte';
  import { quintOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import CollapseAllIcon from '~icons/material-symbols/collapse-all-rounded';
  import Tabs from './Tabs.svelte';

  interface Props {
    isClosable?: boolean;
    isOpen?: boolean;
    isStackable?: boolean;
    /** Lets tests target this card's header without depending on its (translated) title. */
    testID?: string;
    tabs?: Tab[];
    activeTabID?: string;
    title?: string;
    icon?: {
      component: Component;
      class?: string;
    };
    onselect?: (tab: Tab) => void;
    actions?: Snippet;
    children: Snippet;
  }

  let {
    isClosable = true,
    isOpen = false,
    isStackable = false,
    testID,
    tabs = [],
    activeTabID = '',
    title,
    icon,
    onselect,
    actions,
    children
  }: Props = $props();

  // Local: in the desktop tools pane the tool cards are an accordion (toolsPane.svelte.ts):
  // one open at a time, the open one filling the pane and scrolling inside it; a
  // click on a header also shows the tab its section is in.
  const inAccordion = $derived(isStackable && !!testID && toolsAccordion.enabled);
  const shown = $derived(inAccordion ? toolsAccordion.open === testID : isOpen);

  const toggleCardOpen = () => {
    if (!isClosable) return;
    if (inAccordion) {
      toggleSection(testID ?? '');
    } else {
      isOpen = !isOpen;
    }
  };

  let isTabsShown = $derived(shown && tabs.length > 0);
</script>

<div
  class={[
    'card flex flex-col overflow-hidden rounded-2xl border-2 border-muted',
    shown && 'isOpen',
    inAccordion
      ? ['w-full', shown ? 'min-h-0 flex-1' : 'flex-none']
      : [
          'h-fit',
          shown && 'flex-grow',
          isStackable ? 'flex-1 group-has-[.isOpen]:w-full group-has-[.isOpen]:flex-none' : 'w-full'
        ]
  ]}>
  <div
    role="toolbar"
    tabindex="0"
    data-testid={testID}
    class={[
      'flex flex-none cursor-pointer items-center justify-between bg-muted p-2 whitespace-nowrap',
      inAccordion ? 'h-10' : 'h-11',
      isTabsShown && 'pb-1'
    ]}
    onclick={toggleCardOpen}
    onkeypress={toggleCardOpen}>
    {#if icon || title}
      <span role="menubar" tabindex="0" class="flex w-fit items-center gap-3">
        {#if icon}
          <icon.component class={icon.class} />
        {/if}
        {title}
      </span>
    {/if}
    {#if shown && tabs && tabs.length > 0}
      <Tabs {onselect} {tabs} {activeTabID} />
    {/if}

    {@render actions?.()}

    {#if shown && isClosable}
      <CollapseAllIcon />
    {/if}
  </div>
  {#if shown}
    <div
      class={inAccordion
        ? 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto'
        : 'flex-grow overflow-x-auto'}
      transition:slide={{ duration: inAccordion ? 0 : 400, easing: quintOut }}>
      {@render children()}
    </div>
  {/if}
</div>
