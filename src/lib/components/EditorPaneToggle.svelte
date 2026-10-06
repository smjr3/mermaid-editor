<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import LeftCloseIcon from '~icons/material-symbols/left-panel-close-outline-rounded';
  import LeftOpenIcon from '~icons/material-symbols/left-panel-open-outline-rounded';
  import RightCloseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';
  import RightOpenIcon from '~icons/material-symbols/right-panel-open-outline-rounded';

  // Local: collapses or expands the whole editor column (desktop). Its icon points to
  // the side the column sits on, which the "swap panes" setting changes.
  let {
    collapsed,
    ontoggle,
    side = 'left'
  }: { collapsed: boolean; ontoggle: () => void; side?: 'left' | 'right' } = $props();
  const label = $derived(collapsed ? t('editor.showPane') : t('editor.hidePane'));
  const OpenIcon = $derived(side === 'left' ? LeftOpenIcon : RightOpenIcon);
  const CloseIcon = $derived(side === 'left' ? LeftCloseIcon : RightCloseIcon);
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
