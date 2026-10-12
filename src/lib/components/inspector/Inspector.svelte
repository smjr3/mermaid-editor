<script module lang="ts">
  // The focus request last acted on: a request is acted on once, also when the
  // inspector was folded and mounts again to act on it.
  let handledFocus = 0;
</script>

<script lang="ts">
  import DiagramSettings from '$/components/inspector/DiagramSettings.svelte';
  import EdgeSection from '$/components/inspector/EdgeSection.svelte';
  import LaneSection from '$/components/inspector/LaneSection.svelte';
  import NameField from '$/components/inspector/NameField.svelte';
  import NodeSection from '$/components/inspector/NodeSection.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { codeHealth, describe } from '$/util/codeHealth.svelte';
  import { headerLine } from '$/util/diagramEdit';
  import { editorUi } from '$/util/editorUi.svelte';
  import { clearSelection, selection } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { inputState } from '$/util/state.svelte';
  import { tick, untrack } from 'svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import HelpIcon from '~icons/material-symbols/help-outline-rounded';
  import CollapseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';

  // Local: the inspector, the right column of /edit. With nothing selected it shows
  // 図全体 (DiagramSettings); with an object or arrow selected in the diagram, a
  // breadcrumb 「図全体 › 図形 / 矢印 / レーン / タスク」 with ✕, and that selection's rows
  // (NodeSection, EdgeSection, LaneSection). While the code is broken it says why and
  // the rows that edit the code are disabled (theme and config rows stay available).
  // The right-click menu asks for a control through `focusInspector` (editorUi.svelte.ts).
  let { oncollapse }: { oncollapse: () => void } = $props();

  let panel: HTMLDivElement | undefined = $state();

  const object = $derived(selection.current ? model.object : undefined);
  const edge = $derived(selection.current ? model.edge : undefined);
  const crumb = $derived.by((): MessageKey | undefined => {
    if (edge) return 'insp.crumb.edge';
    if (!object) return undefined;
    if (model.kind === 'gantt') return object.group ? 'insp.crumb.section' : 'insp.crumb.task';
    if (object.group) {
      return /^\s*swimlane-beta\b/.test(headerLine(inputState.code))
        ? 'insp.crumb.lane'
        : 'insp.crumb.group';
    }
    return 'insp.crumb.node';
  });

  // The 名前 (or ラベル) row, here rather than in the sections: a node added from a lane
  // (＋追加) has its rename open while the selection moves from the lane to the node.
  const hasName = $derived(
    edge
      ? !!model.edges?.can.label
      : !!object && (!object.noRename || model.draftLabel !== undefined)
  );

  // A mistake typed a moment ago is usually being typed: wait before saying so.
  let blocked = $state(false);
  $effect(() => {
    if (!codeHealth.broken) {
      blocked = false;
      return;
    }
    const timer = setTimeout(() => (blocked = true), 1000);
    return () => clearTimeout(timer);
  });
  const reason = $derived(
    codeHealth.description ? describe(codeHealth.description) : t('recover.unknown')
  );

  // The right-click menu's 色を変える / 形を変える / 名前を変更: focus that control, once the
  // selection's rows are there.
  $effect(() => {
    const request = editorUi.focus;
    if (!request || request.seq === handledFocus) return;
    handledFocus = request.seq;
    untrack(() => {
      let tries = 0;
      const find = () => {
        const target = panel?.querySelector<HTMLElement>(`[data-insp-focus="${request.target}"]`);
        if (!target) {
          if (++tries < 20) requestAnimationFrame(find);
          return;
        }
        const control = target.matches('input, select, button')
          ? target
          : target.querySelector<HTMLElement>('input, select, button');
        control?.scrollIntoView({ block: 'nearest' });
        control?.focus();
      };
      void tick().then(find);
    });
  });
</script>

<div class="flex h-full min-h-0 flex-col bg-card" data-testid={TID.inspPanel} bind:this={panel}>
  <div class="flex h-9 shrink-0 items-center gap-1 border-b border-border px-3">
    <div class="flex min-w-0 flex-1 items-center gap-1 text-sm" data-testid={TID.inspCrumb}>
      {#if crumb}
        <button
          type="button"
          class="shrink-0 text-muted-foreground hover:text-foreground hover:underline"
          title={t('insp.backToRoot')}
          data-testid={TID.inspCrumbRoot}
          onclick={clearSelection}>{t('ws.inspectorRoot')}</button>
        <span class="text-muted-foreground" aria-hidden="true">›</span>
        <span class="truncate font-semibold" data-crumb={crumb}>{t(crumb)}</span>
      {:else}
        <span class="truncate font-semibold" data-testid={TID.inspCrumbRoot}
          >{t('ws.inspectorRoot')}</span>
      {/if}
    </div>
    <!-- The keys and mouse actions on the selection, as a tooltip. -->
    <span
      class="flex size-7 shrink-0 cursor-help items-center justify-center text-muted-foreground"
      role="img"
      title={t('sel.keys')}
      aria-label={`${t('sel.keysLabel')}: ${t('sel.keys')}`}
      data-testid={TID.selectionHint}><HelpIcon /></span>
    {#if crumb}
      <Button
        variant="ghost"
        size="sm"
        class="size-7 p-0"
        title={t('insp.close')}
        aria-label={t('insp.close')}
        data-testid={TID.inspClose}
        onclick={clearSelection}><CloseIcon /></Button>
    {/if}
    <Button
      variant="ghost"
      size="sm"
      class="size-7 p-0"
      data-testid={TID.inspCollapse}
      title={t('ws.inspectorCollapse')}
      aria-label={t('ws.inspectorCollapse')}
      onclick={oncollapse}>
      <CollapseIcon />
    </Button>
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
    {#if blocked}
      <div
        role="status"
        class="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
        data-testid={TID.inspBlocked}>
        <ErrorIcon class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <span>{reason} {t('insp.blocked')}</span>
      </div>
    {/if}

    {#if crumb}
      <fieldset disabled={blocked} class="contents">
        {#if hasName}
          <div class="border-b border-border px-3 pt-2 pb-1">
            <NameField
              focusKey={edge ? 'label' : 'name'}
              label={edge ? t('sel.label') : t('sel.name')}
              testID={edge ? TID.inspEdgeLabel : TID.inspName} />
          </div>
        {/if}
        {#if edge}
          <EdgeSection />
        {:else if object?.group}
          <LaneSection />
        {:else}
          <NodeSection />
        {/if}
      </fieldset>
      {#if model.message}
        <p
          role="status"
          class="px-3 py-1 text-xs text-muted-foreground"
          data-testid={TID.inspStatus}>
          {model.message}
        </p>
      {/if}
    {:else}
      <DiagramSettings {blocked} />
      <p class="px-3 py-2 text-xs text-muted-foreground" data-testid={TID.inspTip}>
        {t(model.kind === 'gantt' ? 'insp.tipGantt' : 'insp.tip')}
      </p>
    {/if}
  </div>
</div>
