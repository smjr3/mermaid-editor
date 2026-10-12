<script lang="ts">
  import Editor from '$/components/Editor.svelte';
  import ResetConfigButton from '$/components/ResetConfigButton.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { EditorMode } from '$/types';
  import { codeHealth, describe } from '$/util/codeHealth.svelte';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';
  import CollapseIcon from '~icons/material-symbols/left-panel-close-outline-rounded';

  // Local: the code column of /edit: the コード / 設定 JSON tabs, 設定をリセット on the JSON
  // tab only, the button that folds the column to its rail, the editor, and a one-line
  // footer (the error, or that there is none and F2 renames an ID everywhere). The header
  // is a size container: in a narrow column 設定をリセット shows its icon only.
  let { oncollapse }: { oncollapse: () => void } = $props();

  const tabs: { id: EditorMode; title: string; tooltip?: string }[] = [
    { id: 'code', title: t('editor.textTab') },
    { id: 'config', title: t('editor.configTab'), tooltip: t('editor.configTabTooltip') }
  ];
  const mode = $derived(validatedState.current.editorMode ?? 'code');
  const error = $derived(validatedState.current.error instanceof Error);
  const footer = $derived.by(() => {
    // F2 renames an ID in the diagram code; the config tab has no IDs to rename.
    if (!error) return mode === 'config' ? t('ws.codeFooterConfigOk') : t('ws.codeFooterOk');
    if (codeHealth.description) return describe(codeHealth.description);
    if (codeHealth.configBroken) return t('recover.config');
    return t('ws.codeFooterError');
  });
</script>

<div class="flex h-full min-h-0 flex-col bg-card">
  <div class="@container flex h-9 shrink-0 items-center gap-1 border-b border-border px-1">
    <div
      class="flex min-w-0 flex-1 items-center gap-1"
      role="tablist"
      aria-label={t('ws.codeTabs')}>
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          role="tab"
          aria-selected={mode === tab.id}
          title={tab.tooltip}
          class={[
            'flex h-7 shrink-0 items-center rounded-md px-2 text-sm whitespace-nowrap',
            mode === tab.id
              ? 'bg-muted font-semibold text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          ]}
          data-testid={`${TID.wsCodeTab}-${tab.id}`}
          onclick={() => updateCodeStore({ editorMode: tab.id })}>
          {tab.title}
        </button>
      {/each}
    </div>
    <ResetConfigButton />
    <Button
      variant="ghost"
      size="sm"
      class="size-7 p-0"
      data-testid={TID.wsCodeCollapse}
      title={t('ws.codeCollapse')}
      aria-label={t('ws.codeCollapse')}
      onclick={oncollapse}>
      <CollapseIcon />
    </Button>
  </div>
  <div class="min-h-0 flex-1">
    <Editor isMobile={false} />
  </div>
  <div
    class={[
      'shrink-0 truncate border-t border-border px-2 py-1 text-xs',
      error ? 'text-destructive' : 'text-muted-foreground'
    ]}
    title={footer}
    data-testid={TID.wsCodeFooter}
    data-error={error}>
    {footer}
  </div>
</div>
