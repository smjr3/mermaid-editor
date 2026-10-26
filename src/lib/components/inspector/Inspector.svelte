<script module lang="ts">
  // The focus request last acted on: a request is acted on once, also when the
  // inspector was folded and mounts again to act on it.
  let handledFocus = 0;
</script>

<script lang="ts">
  import DiagramSettings from '$/components/inspector/DiagramSettings.svelte';
  import EdgeSection from '$/components/inspector/EdgeSection.svelte';
  import LaneSection from '$/components/inspector/LaneSection.svelte';
  import { labelColumn } from '$/components/form/FieldRow.svelte';
  import MultiSection from '$/components/inspector/MultiSection.svelte';
  import NameField from '$/components/inspector/NameField.svelte';
  import NodeSection from '$/components/inspector/NodeSection.svelte';
  import TargetPicker from '$/components/inspector/TargetPicker.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { codeHealth, describe } from '$/util/codeHealth.svelte';
  import { headerLine } from '$/util/diagramEdit';
  import { editorUi } from '$/util/editorUi.svelte';
  import { SELECTION_TAB, tabOfItems } from '$/util/inspectorMulti';
  import { inspectorTabs, tabOfSelection, type InspectorTabId } from '$/util/inspectorTabs';
  import { clearSelection, selection, toggleSelect, type Selected } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { inputState } from '$/util/state.svelte';
  import { tick, untrack } from 'svelte';
  import ErrorIcon from '~icons/material-symbols/error-outline-rounded';
  import HelpIcon from '~icons/material-symbols/help-outline-rounded';
  import CollapseIcon from '~icons/material-symbols/right-panel-close-outline-rounded';

  // Local: the inspector, the right column of /edit. Its first row switches the target:
  // 「図全体 │ 図形 │ 矢印 │ グループ」 for a flowchart, 「図全体 │ 参加者 │ メッセージ」 for a
  // sequence diagram, … (inspectorTabs.ts, the add bar's words). The tab of what is
  // selected is active; 図全体 clears the selection (as Esc does) and shows the whole
  // diagram's rows (DiagramSettings); a tab whose kind is not selected lists its items
  // (TargetPicker), and a click on one selects it and shows its rows (NodeSection,
  // EdgeSection, LaneSection). While the code is broken it says why and the rows that
  // edit the code are disabled (見た目 and the config rows stay available; the tabs and
  // the lists still work). The right-click menu asks for a control through
  // `focusInspector` (editorUi.svelte.ts).
  let { oncollapse }: { oncollapse: () => void } = $props();

  let panel: HTMLDivElement | undefined = $state();

  // ---- The target: which object (or arrow) the panel shows. ----
  // `model.code` is the code the lists were read from (the last valid one).
  const items = $derived(model.objects?.items ?? []);
  // Several items (Ctrl+click, a rubber band, 「同じものを選ぶ」): the panel shows the rows
  // that apply to all of them (MultiSection). Their tab is the kind's when they are of
  // one kind; a mixed selection gets 「選択」 beside 図全体 (inspectorMulti.ts).
  const multiple = $derived(selection.items.length > 1);
  const selectedTab = $derived(
    multiple
      ? tabOfItems(model.code, selection.items, items)
      : tabOfSelection(model.code, selection.current, items)
  );
  const tabs = $derived.by(() => {
    const own = inspectorTabs(model.code, items);
    return selectedTab === SELECTION_TAB
      ? [own[0], { id: SELECTION_TAB, label: 'insp.tab.selection' as const }, ...own.slice(1)]
      : own;
  });
  // The tab whose list is open, if any; a change of selection closes it — except a
  // Ctrl/⌘+click in the list itself (`holdPicker`), which adds to the selection and
  // keeps the list open for the next one.
  let picking = $state<InspectorTabId | undefined>();
  let holdPicker = false;
  $effect(() => {
    void selection.current;
    if (!untrack(() => holdPicker)) picking = undefined;
  });
  const onToggle = async (next: Selected) => {
    holdPicker = true;
    toggleSelect(next);
    await tick();
    holdPicker = false;
  };
  const pickerTab = $derived(tabs.find(({ id }) => id === picking && id !== 'all'));
  const activeTab = $derived(pickerTab?.id ?? selectedTab);
  // What the panel shows: the selection, unless a list is open over it. This is the one
  // place that decides which object the rows below are for.
  const shown = $derived(pickerTab ? undefined : selection.current);
  const object = $derived(shown && !multiple ? model.object : undefined);
  const edge = $derived(shown && !multiple ? model.edge : undefined);
  // The old breadcrumb's word for the selection, kept on the active tab (`data-crumb`).
  const crumb = $derived.by((): MessageKey | undefined => {
    if (shown && multiple) return 'insp.tab.selection';
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
  const onTab = (id: InspectorTabId) => {
    if (id === 'all') {
      picking = undefined;
      clearSelection();
      return;
    }
    // 「選択」 has no list: it shows the multi view again over an open list. A tab whose
    // list is open closes it (back to the rows of what was Ctrl+clicked in it).
    picking = id === SELECTION_TAB || picking === id ? undefined : id;
  };
  // The tabs from the keyboard: ← → move between them and open the one reached.
  const onTabKey = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onTab(next.id);
    panel
      ?.querySelector<HTMLElement>(`[data-testid="${TID.inspTab}"][data-tab="${next.id}"]`)
      ?.focus();
  };

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
      picking = undefined;
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
  <div class="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1 pl-2">
    <!-- The target switcher: one tab per kind the diagram type has. -->
    <div
      class="flex h-7 min-w-0 flex-1 items-stretch rounded-md border border-input bg-background p-0.5"
      role="tablist"
      aria-label={t('insp.tabs')}
      data-testid={TID.inspTabs}>
      {#each tabs as tab, index (tab.id)}
        {@const active = tab.id === activeTab}
        <button
          type="button"
          role="tab"
          class={[
            'min-w-0 flex-auto truncate rounded-sm px-1.5 text-xs whitespace-nowrap',
            active
              ? 'bg-muted font-semibold text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          ]}
          aria-selected={active}
          tabindex={active ? 0 : -1}
          title={tab.id === 'all'
            ? t('insp.backToRoot')
            : t('insp.tabHint', { kind: t(tab.label) })}
          data-tab={tab.id}
          data-crumb={active && crumb ? crumb : undefined}
          data-testid={TID.inspTab}
          onclick={() => onTab(tab.id)}
          onkeydown={(event) => onTabKey(event, index)}>{t(tab.label)}</button>
      {/each}
    </div>
    <!-- The keys and mouse actions on the selection, as a tooltip. -->
    <span
      class="flex size-7 shrink-0 cursor-help items-center justify-center text-muted-foreground"
      role="img"
      title={t('sel.keys')}
      aria-label={`${t('sel.keysLabel')}: ${t('sel.keys')}`}
      data-testid={TID.selectionHint}><HelpIcon /></span>
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

  <div class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto" use:labelColumn>
    {#if blocked}
      <div
        role="status"
        class="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
        data-testid={TID.inspBlocked}>
        <ErrorIcon class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <span>{reason} {t('insp.blocked')}</span>
      </div>
    {/if}

    {#if pickerTab}
      <TargetPicker tab={pickerTab} onpick={() => (picking = undefined)} ontoggle={onToggle} />
    {:else if shown && multiple}
      <MultiSection {blocked} />
      {#if model.message}
        <p
          role="status"
          class="px-3 py-1 text-xs text-muted-foreground"
          data-testid={TID.inspStatus}>
          {model.message}
        </p>
      {/if}
    {:else if edge || object}
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
      <!-- How to reach the parts' rows, first: at the end of 図全体 it fell below the fold
           (QA 2026-10-24). -->
      <p
        class="border-b border-border px-3 py-1.5 text-xs text-muted-foreground"
        data-testid={TID.inspTip}>
        {t(model.kind === 'gantt' ? 'insp.tipGantt' : 'insp.tip')}
      </p>
      <DiagramSettings {blocked} />
    {/if}
  </div>
</div>
