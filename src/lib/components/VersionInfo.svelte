<script lang="ts">
  import Privacy from '$/components/Privacy.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { env } from '$/util/env';
  import { version as mermaidVersion } from 'mermaid/package.json';
  import { name, repository, version } from '../../../package.json';

  // Local: the "Version & about" page of the How-to-use dialog — what the toolbar and the
  // hamburger menu used to carry (mermaid version, privacy, links to the project).
  const repositoryUrl = repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
</script>

<dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
  <dt class="text-muted-foreground">{t('about.appVersion')}</dt>
  <dd data-testid={TID.appVersion}>{name} v{version}</dd>
  <dt class="text-muted-foreground">{t('about.mermaidVersion')}</dt>
  <dd data-testid={TID.mermaidVersion}>v{mermaidVersion}</dd>
</dl>
<ul class="mb-3 flex list-none flex-col gap-1 pl-0 text-sm">
  <li>
    <a
      class="underline"
      href={repositoryUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={TID.aboutRepoLink}>{t('about.repository')}</a>
  </li>
  <li>
    <a class="underline" href={env.docsUrl} target="_blank" rel="noopener noreferrer"
      >{t('about.docs')}</a>
  </li>
  {#if !env.hidePrivacyPolicy}
    <li class="flex items-center gap-2" data-testid={TID.privacyButton}>
      <Privacy />
      {t('about.privacy')}
    </li>
  {/if}
</ul>
