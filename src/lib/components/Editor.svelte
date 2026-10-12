<script lang="ts">
  import { t } from '$/i18n';
  import DesktopEditor from '$/components/DesktopEditor.svelte';
  import McWrapper from '$/components/McWrapper.svelte';
  import MermaidChartIcon from '$/components/MermaidChartIcon.svelte';
  import MobileEditor from '$/components/MobileEditor.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { env } from '$/util/env';
  import { updateCode, updateConfig, urls, validatedState } from '$lib/util/state.svelte';
  import { logMermaidChartClick } from '$lib/util/stats';
  import { debounce } from 'lodash-es';

  const { isMobile } = $props<{ isMobile: boolean }>();
  const onUpdate = (text: string) => {
    if (validatedState.current.editorMode === 'code') {
      updateCode(text);
    } else {
      updateConfig(text);
    }
  };

  let showError = $state(false);

  const showErrorDebounced = debounce(() => {
    showError = true;
  }, 3000);

  $effect(() => {
    if (validatedState.current.error) {
      showErrorDebounced();
    } else {
      showErrorDebounced.cancel();
      showError = false;
    }

    return () => {
      showErrorDebounced.cancel();
    };
  });
</script>

<div class="flex h-full flex-col">
  {#if isMobile}
    <MobileEditor {onUpdate} />
  {:else}
    <DesktopEditor {onUpdate} />
  {/if}
  {#if showError && validatedState.current.error instanceof Error}
    <!-- Local: the code pane's footer says what is wrong in one line (CodePane.svelte);
         this is mermaid's own message in full, under the editor. -->
    <div class="flex flex-col border-t border-border text-xs" data-testid={TID.errorContainer}>
      <p class="sr-only">{t('editor.syntaxError')}</p>
      {#if env.isEnabledMermaidChartLinks && validatedState.current.editorMode === 'code'}
        <div class="flex items-center justify-between gap-2 bg-slate-900 p-2 text-white">
          <p class="text-xs text-white/60" data-testid={TID.aiHelpText}>
            Create a free account to repair with AI
          </p>
          <McWrapper>
            <Button
              variant="accent"
              size="sm"
              data-testid={TID.aiRepairButton}
              href={urls.current.mermaidChart({ medium: 'ai_repair' }).save}
              target="_blank"
              onclick={() => logMermaidChartClick('aiRepair')}>
              <MermaidChartIcon />
              AI Repair
            </Button>
          </McWrapper>
        </div>
      {/if}
      <output class="max-h-24 overflow-auto bg-muted px-2 py-1" name="mermaid-error" for="editor">
        <pre class="whitespace-pre-wrap">{validatedState.current.error?.toString()}</pre>
      </output>
    </div>
  {/if}
</div>
