<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import CloseIcon from '~icons/material-symbols/left-panel-close-outline-rounded';
  import OpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';

  // Local: collapses or expands the whole editor column (desktop).
  let { collapsed, ontoggle }: { collapsed: boolean; ontoggle: () => void } = $props();
  const label = $derived(collapsed ? t('editor.showPane') : t('editor.hidePane'));
</script>

<Button
  variant="ghost"
  size="sm"
  data-testid={TID.editorPaneToggle}
  aria-pressed={collapsed}
  title={label}
  aria-label={label}
  onclick={ontoggle}>
  {#if collapsed}<OpenIcon />{:else}<CloseIcon />{/if}
</Button>
