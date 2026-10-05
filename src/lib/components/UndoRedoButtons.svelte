<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { inputState, validatedState } from '$/util/state.svelte';
  import { codeHistory } from '$/util/undoStack.svelte';
  import RedoIcon from '~icons/material-symbols/redo-rounded';
  import UndoIcon from '~icons/material-symbols/undo-rounded';

  // Local: undo / redo for the diagram code, whichever editor or card changed
  // it (undoStack.svelte.ts). Every code change passes through the input
  // state, so this is where the history sees it.
  $effect(() => {
    codeHistory.record(inputState.code);
  });
</script>

<!-- Only on the code tab: these step through the code, which is what that tab shows. -->
{#if validatedState.current.editorMode === 'code'}
  <Button
    variant="ghost"
    size="sm"
    data-testid={TID.undoButton}
    title={t('editor.undo')}
    aria-label={t('editor.undo')}
    disabled={!codeHistory.canUndo}
    onclick={() => codeHistory.undo()}>
    <UndoIcon />
  </Button>
  <Button
    variant="ghost"
    size="sm"
    data-testid={TID.redoButton}
    title={t('editor.redo')}
    aria-label={t('editor.redo')}
    disabled={!codeHistory.canRedo}
    onclick={() => codeHistory.redo()}>
    <RedoIcon />
  </Button>
{/if}
