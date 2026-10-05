<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { packLicenses } from '$/util/iconLicenses';
  import InfoIcon from '~icons/material-symbols/license-outline-rounded';

  // Local: one small link in the Icons card opens the terms of every bundled
  // icon set (iconLicenses.ts), so a user can check before an icon goes into
  // a document, without the card itself growing.
  let open = $state(false);
  const linkClass = 'text-accent underline';
</script>

<Button
  variant="link"
  size="sm"
  class="h-auto gap-1 p-0 text-sm"
  data-testid={TID.iconLicensesButton}
  onclick={() => (open = true)}>
  <InfoIcon class="size-4" />
  {t('icons.licenses')}
</Button>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex max-h-[85vh] flex-col sm:max-w-3xl"
    data-testid={TID.iconLicensesDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('icons.licensesTitle')}</Dialog.Title>
      <Dialog.Description>{t('icons.licensesIntro')}</Dialog.Description>
    </Dialog.Header>
    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
      <table class="w-full text-left">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th class="py-1 pr-2 font-medium">{t('icons.licensesPack')}</th>
            <th class="py-1 pr-2 font-medium">{t('icons.licensesLicense')}</th>
            <th class="py-1 pr-2 font-medium">{t('icons.licensesHolder')}</th>
          </tr>
        </thead>
        <tbody>
          {#each packLicenses as pack (pack.prefix)}
            <tr class="border-t border-border align-top">
              <td class="py-1 pr-2">
                <a class={linkClass} href={pack.url} target="_blank" rel="noopener noreferrer"
                  >{pack.title}</a>
                <div class="text-xs text-muted-foreground">
                  <code>{pack.prefix}</code>
                  {#if pack.logos}
                    · {t('icons.licensesLogos')}
                  {/if}
                </div>
              </td>
              <td class="py-1 pr-2">
                <a
                  class={linkClass}
                  href={pack.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer">{pack.license}</a>
              </td>
              <td class="py-1 pr-2">{pack.holder}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <ul class="flex list-disc flex-col gap-2 pl-5">
        <li>{t('icons.licensesArtwork')}</li>
        <li>{t('icons.licensesTrademark')}</li>
        <li>{t('icons.licensesOther')}</li>
      </ul>
    </div>
  </Dialog.Content>
</Dialog.Root>
