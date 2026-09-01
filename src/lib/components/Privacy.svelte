<script lang="ts">
  import ExternalLinkWrapper from '$/components/ExternalLinkWrapper.svelte';
  import * as Dialog from '$/components/ui/dialog';
  import { t } from '$/i18n';
  import { env } from '$/util/env';
  import { isOnMermaidLive } from '$/util/migration/domainMigration';
  import ShieldIcon from '~icons/material-symbols/shield-lock-outline-rounded';
</script>

{#if env.privacyPolicyUrl}
  <a href={env.privacyPolicyUrl} target="_blank">
    <ShieldIcon />
  </a>
{:else}
  <Dialog.Root>
    <Dialog.Trigger>
      <ShieldIcon />
    </Dialog.Trigger>
    <Dialog.Content class="max-h-full overflow-hidden overflow-y-auto p-12">
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2 text-xl">
          <ShieldIcon class="size-8 text-green-700" />
          {t('privacy.dataSecurity')}
        </Dialog.Title>
      </Dialog.Header>

      {#if isOnMermaidLive()}
        <p class="text-xl font-semibold">{t('privacy.heading')}</p>
        <p>{t('privacy.body')}</p>
        <p>
          {t('privacy.hostedIntro')}<a
            href="https://github.com/mermaid-js/mermaid-live-editor/deployments"
            class="underline"
            target="_blank">{t('privacy.githubPages')}</a
          >{t('privacy.hostedMid')}<a
            href="https://web.dev/explore/progressive-web-apps"
            target="_blank">{t('privacy.pwa')}</a
          >{t('privacy.hostedEnd')}
        </p>
        <p>
          {t('privacy.analyticsIntro')}<a
            href="https://p.mermaid.live/mermaid.live"
            class="underline"
            target="_blank">{t('privacy.publiclyAvailable')}</a
          >{t('privacy.analyticsEnd')}
        </p>
        <ExternalLinkWrapper domain="example.com" isVisible>
          <p class="text-left">{t('privacy.externalServices')}</p>
        </ExternalLinkWrapper>
      {:else}
        <p>{t('privacy.noPolicy')}</p>
        <p>
          {t('privacy.selfHostIntro')}
          <code class="rounded bg-muted px-1.5 py-0.5 text-sm">MERMAID_PRIVACY_POLICY_URL</code>
          {t('privacy.selfHostEnvVar')}
          <code class="rounded bg-muted px-1.5 py-0.5 text-sm">MERMAID_HIDE_PRIVACY_POLICY</code>
          {t('privacy.selfHostTo')}
          <code class="rounded bg-muted px-1.5 py-0.5 text-sm">true</code>
          {t('privacy.selfHostHide')}
        </p>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}
