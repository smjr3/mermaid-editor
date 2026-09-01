<script lang="ts">
  import { t } from '$/i18n';
  import FloatingToolbar from '$/components/FloatingToolbar.svelte';
  import Privacy from '$/components/Privacy.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import { TID } from '$/constants';
  import { env } from '$/util/env';
  import { version } from 'mermaid/package.json';
  import { mode, setMode } from 'mode-watcher';
  import ThemeIcon from './ThemeIcon.svelte';
</script>

<FloatingToolbar>
  <span class="text-sm font-semibold opacity-60">v{version}</span>
  {#if !env.hidePrivacyPolicy}
    <Button variant="ghost" size="icon" title={t('toolbar.privacySecurity')}>
      <Privacy />
    </Button>

    <Separator orientation="vertical" />
  {/if}
  <Button
    variant="ghost"
    size="icon"
    data-testid={TID.themeToggleButton}
    title={mode.current === 'dark' ? t('toolbar.switchToLight') : t('toolbar.switchToDark')}
    class="[&_svg]:size-5"
    onclick={() => setMode(mode.current === 'dark' ? 'light' : 'dark')}>
    <ThemeIcon />
  </Button>
</FloatingToolbar>
