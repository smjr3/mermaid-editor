<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { editorFocus } from '$/util/editorFocus.svelte';
  import CollapseIcon from '~icons/material-symbols/collapse-content-rounded';
  import ExpandIcon from '~icons/material-symbols/expand-content-rounded';

  const label = $derived(editorFocus.value ? t('editor.showTools') : t('editor.focus'));
</script>

<!-- Local: hides the tool cards under the editor so the code gets the whole column. -->
<Button
  variant="ghost"
  class="px-2"
  data-testid={TID.editorFocusToggle}
  aria-pressed={editorFocus.value}
  title={label}
  aria-label={label}
  onclick={() => (editorFocus.value = !editorFocus.value)}>
  {#if editorFocus.value}<CollapseIcon />{:else}<ExpandIcon />{/if}
</Button>
