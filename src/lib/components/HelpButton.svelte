<script lang="ts">
  import IconLicenseTable from '$/components/IconLicenseTable.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { locale, t } from '$/i18n';
  import { helpContent } from '$/util/helpContent';
  import { startGuide } from '$/util/onboarding.svelte';
  import HelpIcon from '~icons/material-symbols/help-outline-rounded';

  // Local: a "How to use" button that opens a short guide to the editor's tools.
  const sections = helpContent[locale];
  let open = $state(false);
  let current = $state(sections[0].id);
  const section = $derived(sections.find(({ id }) => id === current) ?? sections[0]);
</script>

<Button
  variant="ghost"
  size="sm"
  class="gap-1"
  title={t('help.button')}
  aria-label={t('help.button')}
  data-testid={TID.helpButton}
  onclick={() => (open = true)}>
  <HelpIcon class="size-5" />
  <span class="hidden lg:inline">{t('help.button')}</span>
</Button>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[85vh] flex-col sm:max-w-3xl" data-testid={TID.helpDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('help.title')}</Dialog.Title>
      <Dialog.Description>{t('help.intro')}</Dialog.Description>
    </Dialog.Header>
    <div class="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
      <nav class="flex shrink-0 flex-wrap gap-1 sm:w-44 sm:flex-col" aria-label={t('help.title')}>
        {#each sections as item (item.id)}
          <Button
            size="sm"
            variant={item.id === current ? 'default' : 'ghost'}
            class="justify-start"
            data-testid={`${TID.helpSection}-${item.id}`}
            onclick={() => (current = item.id)}>{item.title}</Button>
        {/each}
      </nav>
      <section class="min-h-0 flex-1 overflow-y-auto" data-testid={TID.helpContent}>
        <h3 class="mb-2 font-semibold">{section.title}</h3>
        {#if section.id === 'licenses'}
          <IconLicenseTable />
        {/if}
        <ul class="flex list-disc flex-col gap-2 pl-5 text-sm">
          {#each section.items as point (point)}
            <li>{point}</li>
          {/each}
        </ul>
      </section>
    </div>
    <Button
      size="sm"
      variant="outline"
      class="self-start"
      data-testid={TID.guideRestart}
      onclick={() => {
        open = false;
        startGuide();
      }}>{t('guide.restart')}</Button>
  </Dialog.Content>
</Dialog.Root>
