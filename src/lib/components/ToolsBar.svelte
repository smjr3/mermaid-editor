<script lang="ts">
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { editorFocus } from '$/util/editorFocus.svelte';
  import ShowIcon from '~icons/material-symbols/keyboard-arrow-up-rounded';
  import HideIcon from '~icons/material-symbols/keyboard-arrow-down-rounded';

  // Local: the bar above the tool cards hides them ("focus on code") or brings
  // them back; it stays at the bottom of the column while they are hidden.
  const label = $derived(editorFocus.value ? t('editor.showTools') : t('editor.focus'));
</script>

<button
  type="button"
  class="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
  data-testid={TID.editorFocusToggle}
  aria-expanded={!editorFocus.value}
  title={label}
  onclick={() => (editorFocus.value = !editorFocus.value)}>
  <span>{label}</span>
  {#if editorFocus.value}<ShowIcon />{:else}<HideIcon />{/if}
</button>
