<script lang="ts">
  import { t } from '$/i18n';
  import { packLicenses } from '$/util/iconLicenses';

  // Local: the licence table shown in the "How to use" dialog's licences section
  // (iconLicenses.ts), out of the way of the cards themselves.
  const linkClass = 'text-accent underline';
</script>

<table class="mb-3 w-full text-left text-sm">
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
          <a class={linkClass} href={pack.licenseUrl} target="_blank" rel="noopener noreferrer"
            >{pack.license}</a>
        </td>
        <td class="py-1 pr-2">{pack.holder}</td>
      </tr>
    {/each}
  </tbody>
</table>
