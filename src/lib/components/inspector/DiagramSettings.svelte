<script lang="ts">
  import AiIconPrompt from '$/components/AiIconPrompt.svelte';
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import SwitchRow from '$/components/form/SwitchRow.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import IconPicker from '$/components/IconPicker.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import UnknownIcons from '$/components/UnknownIcons.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import { applyToolEdit, editsBlocked, type ToolEditResult } from '$/util/codeHealth.svelte';
  import {
    colorAll,
    colorAllGroups,
    getLineColor,
    getTheme,
    listGroups,
    parsePresets,
    setEdgeColor,
    setLineColor,
    setTheme,
    swatches,
    themeChoices,
    type Swatch,
    type ThemeChoice
  } from '$/util/colors';
  import { fontChoices, getDiagramFont, setDiagramFont, type FontChoice } from '$/util/diagramFont';
  import { headerLine } from '$/util/diagramEdit';
  import { editKind } from '$/util/diagramModify';
  import { getTitle, setTitle, titleShown } from '$/util/diagramTitle';
  import { displayName } from '$/util/displayName';
  import { env } from '$/util/env';
  import { diagramOptions, setDiagramOption, type DiagramOption } from '$/util/diagramOptions';
  import {
    directionUnsupportedKey,
    elkCycles,
    elkModelOrders,
    elkPlacements,
    getElkOptions,
    getFullDirection,
    getLayoutOptions,
    pickDirection,
    setDirection,
    setElkOptions,
    setLayoutOptions,
    viewBoxSize,
    type Direction,
    type ElkOptions,
    type FullDirection,
    type LayoutOptions,
    type Size
  } from '$/util/layout';
  import {
    diagramEdges,
    diagramObjects,
    render,
    type DiagramEdge,
    type DiagramObjects
  } from '$/util/mermaid';
  import { select, selection } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import { inputState, updateCodeStore, updateConfig } from '$/util/state.svelte';
  import { parseConfigObject } from '$/util/stateGuard';
  import {
    applyThemePreset,
    presetOf,
    themePresets,
    type ThemePresetId
  } from '$/util/themePresets';
  import type { MermaidConfig } from 'mermaid';
  import CheckIcon from '~icons/material-symbols/check-rounded';

  // Local: the inspector's 図全体 — what applies to the whole diagram, each a one-line
  // row: the theme (12 named ones, mermaid's built-in themes), the layout (direction,
  // engine, spacing: layout.ts), colours written in the code (line colour, lanes, every
  // object, every arrow: colors.ts), the title (diagramTitle.ts), the font
  // (diagramFont.ts), the hand-drawn look, the icons (the picker and the pack dialogs,
  // the unknown names, the AI briefing), the type's own options (diagramOptions.ts) and,
  // for diagrams whose parts cannot be clicked,
  // a list to select one. Rows the diagram type has no use for are left out, or say why.
  // `blocked`: the code is broken, so the rows that edit the code are disabled; the
  // config rows (theme, engine, spacing, line colour, font, hand-drawn) stay available.
  let { blocked = false }: { blocked?: boolean } = $props();

  // ---- Theme (config) ----
  const preset = $derived(presetOf(inputState.mermaid));
  const theme = $derived(getTheme(inputState.mermaid));
  const isCustomTheme = $derived(
    preset === 'standard' &&
      theme !== 'auto' &&
      !(themeChoices as readonly string[]).includes(theme)
  );
  const builtin = $derived(
    preset === 'standard' && (themeChoices as readonly string[]).includes(theme) ? theme : 'auto'
  );
  const font = $derived(getDiagramFont(inputState.mermaid));
  // A named theme replaces the theme, its variables and CSS as a whole; a font chosen
  // here is kept over the preset's own (diagramFont.ts).
  const applyPreset = (id: ThemePresetId) => {
    const next = applyThemePreset(inputState.mermaid, id);
    updateConfig(font === 'default' || font === 'custom' ? next : setDiagramFont(next, font));
  };
  // A built-in theme over a named one drops the named one's variables and CSS first.
  const applyTheme = (next: ThemeChoice) =>
    updateConfig(
      setTheme(
        preset === 'standard'
          ? inputState.mermaid
          : applyThemePreset(inputState.mermaid, 'standard'),
        next
      )
    );
  const lineColor = $derived(getLineColor(inputState.mermaid));

  // ---- Layout (code and config) ----
  const direction = $derived(getFullDirection(inputState.code));
  const options = $derived(getLayoutOptions(inputState.mermaid));
  const elk = $derived(getElkOptions(inputState.mermaid));
  // What the 向き choice shows: the code's direction, or 自動 while it is being worked out.
  let directionValue = $derived<string>(direction ?? 'TB');
  let message = $state('');
  let busy = $state(false);
  const refusals: Partial<Record<ToolEditResult, MessageKey>> = {
    blocked: 'recover.blocked',
    refused: 'edit.breaks',
    stale: 'edit.stale'
  };
  const refusal = (result: ToolEditResult) => {
    const key = refusals[result];
    return key ? t(key) : '';
  };
  const applyDirection = async (next: FullDirection): Promise<boolean> => {
    message = '';
    const result = await applyToolEdit(setDirection(inputState.code, next), {
      resetPanZoom: true
    });
    message = refusal(result);
    directionValue = getFullDirection(inputState.code) ?? next;
    return result === 'applied' || result === 'unchanged';
  };
  const applyOptions = (next: Partial<LayoutOptions>) => {
    message = '';
    updateConfig(setLayoutOptions(inputState.mermaid, { ...options, ...next }));
  };
  const config = (): MermaidConfig => {
    try {
      return parseConfigObject(inputState.mermaid) as MermaidConfig;
    } catch {
      return {};
    }
  };
  let probe = 0;
  const measure = async (next: Direction): Promise<Size | undefined> => {
    probe++;
    const { svg } = await render(
      config(),
      setDirection(inputState.code, next),
      `layout-probe-${probe}`
    );
    return viewBoxSize(svg);
  };
  // Draws the diagram both ways and keeps the one that shows largest in the view.
  const fitToView = async () => {
    // Local: the broken code cannot be drawn either way (codeHealth.svelte.ts).
    if (editsBlocked()) {
      message = t('recover.blocked');
      directionValue = direction ?? 'TB';
      return;
    }
    busy = true;
    message = '';
    try {
      const view = document.querySelector(`#view`)?.getBoundingClientRect();
      const size = view && view.width > 0 && view.height > 0 ? view : { height: 900, width: 1600 };
      const [tb, lr] = [await measure('TB'), await measure('LR')];
      if (!tb || !lr) throw new Error('no size');
      const chosen = pickDirection({ LR: lr, TB: tb }, size);
      if (await applyDirection(chosen)) {
        message = t(chosen === 'LR' ? 'layout.fitChoseLR' : 'layout.fitChoseTB');
      }
    } catch {
      message = t('layout.fitFailed');
    } finally {
      busy = false;
      directionValue = getFullDirection(inputState.code) ?? 'TB';
    }
  };
  const onDirection = (value: string) => {
    if (value === 'fit') void fitToView();
    else void applyDirection(value as FullDirection);
  };

  // ---- Local: the type's own options (diagramOptions.ts): code ones are checked and
  // refused while the code is broken, config ones always apply. ----
  const typeOptions = $derived(diagramOptions(inputState.code, inputState.mermaid));
  const applyOption = async (option: DiagramOption, value: string) => {
    if (option.value === value) return;
    message = '';
    const change = setDiagramOption(inputState.code, inputState.mermaid, option.key, value);
    if (!change) {
      message = t('edit.breaks');
      return;
    }
    if ('config' in change) updateConfig(change.config);
    else message = refusal(await applyToolEdit(change.code));
  };
  const optionLabel = (option: DiagramOption, value: string) => {
    const key = `${option.label}.${value}`;
    return key in messages.en ? t(key as MessageKey) : value;
  };

  // ---- Title (code) ----
  const title = $derived(getTitle(inputState.code));
  const showsTitle = $derived(titleShown(inputState.code));
  let titleText = $derived(title);
  const applyTitle = async (next: string) => {
    if (next.trim() === title.trim()) return;
    const result = await applyToolEdit(setTitle(inputState.code, next));
    message =
      result === 'applied'
        ? t(next.trim() ? 'layout.titleDone' : 'layout.titleRemoved')
        : refusal(result);
    if (result !== 'applied') titleText = title;
  };

  // ---- Colours in the code (colors.ts) ----
  const presets = parsePresets(env.colorPresets);
  const presetSwatches: Swatch[] = presets ?? swatches;
  const groups = $derived(listGroups(inputState.code));
  let objects = $state<DiagramObjects | undefined>();
  let edges = $state<DiagramEdge[]>([]);
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    let stale = false;
    void Promise.all([diagramObjects(code), diagramEdges(code)]).then(([found, foundEdges]) => {
      if (stale) return;
      objects = found;
      edges = foundEdges;
    });
    return () => {
      stale = true;
    };
  });
  const objectIds = $derived((objects?.items ?? []).map(({ id }) => id));
  // Class diagrams need a property without a hyphen first in a style statement (colors.ts).
  const objectSyntax = $derived(objects?.kind === 'class' ? 'class' : (objects?.syntax ?? 'style'));
  const showLanes = $derived(groups.length > 0 || objects?.kind === 'flowchart');
  const applyCode = async (code: string) => {
    message = refusal(await applyToolEdit(code));
  };
  const clearEdges = () =>
    applyCode(
      edges.reduce((code, { index }) => setEdgeColor(code, index, undefined), inputState.code)
    );

  // ---- The parts, for diagrams that cannot be clicked (selectionModel's lists) ----
  const kind = $derived(editKind(inputState.code));
  const objectsKey = $derived(
    kind === 'flowchart' && /^\s*swimlane-beta\b/.test(headerLine(inputState.code))
      ? 'edit.objects.swimlane'
      : (`edit.objects.${kind}` as MessageKey)
  );
  const items = $derived(model.objects?.items ?? []);
  const edgeItems = $derived(model.edges?.items ?? []);
  const selectedId = $derived(selection.current?.type === 'node' ? selection.current.id : '');
  const selectedEdge = $derived(
    selection.current?.type === 'edge' ? String(selection.current.index) : ''
  );

  // ---- Icons ----
  let iconsOpen = $state(false);
  let packsOpen = $state(false);
  let iconMessage = $state('');
  // The picker's state outlives the dialog, as the card's did.
  let pickerMode = $state<'search' | 'browse'>('search');
  let pickerPack = $state('all');
  let pickerQuery = $state('');
  let pickerSource = $state('cat:servers');
  let pickerPage = $state(0);

  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const smallButton = 'h-7 px-2 text-xs';
  const muted = 'min-w-0 truncate text-xs text-muted-foreground';
</script>

<!-- テーマ: the named themes, then mermaid's built-in ones. Config only: always available. -->
<PanelGroup>
  <div
    class="grid grid-cols-3 gap-1"
    role="group"
    aria-label={t('colors.presets')}
    title={t('colors.presetsHint')}
    data-testid={TID.inspThemePreset}>
    {#each themePresets as entry (entry.id)}
      {@const active = preset === entry.id}
      <button
        type="button"
        aria-pressed={active}
        data-active={active}
        data-testid={`${TID.inspThemePreset}-${entry.id}`}
        title={`${t(entry.name)}: ${t(entry.description)}`}
        class={[
          'flex min-w-0 flex-col gap-0.5 rounded-md border px-1.5 py-1 text-left transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-400'
            : 'border-border'
        ]}
        onclick={() => applyPreset(entry.id)}>
        <!-- The swatches and the check share a row, so the name below has the card's
             whole width and wraps rather than being cut (QA 2026-10-13). -->
        <span class="flex items-center gap-0.5" aria-hidden="true">
          {#each entry.swatches as color, index (index)}
            <span
              class="size-2.5 shrink-0 rounded-full border border-black/20 dark:border-white/30"
              style:background-color={color}></span>
          {/each}
          {#if active}
            <CheckIcon class="ml-auto size-3 shrink-0 text-sky-600 dark:text-sky-400" />
          {/if}
        </span>
        <span class="text-[11px] leading-tight font-semibold break-words">{t(entry.name)}</span>
      </button>
    {/each}
  </div>
  <FieldRow label={t('insp.builtin')}>
    <select
      class={selectClass}
      value={isCustomTheme ? theme : builtin}
      aria-label={t('colors.builtinThemes')}
      title={isCustomTheme ? t('colors.themeCustom', { theme }) : t('insp.builtinHint')}
      data-testid={TID.inspBuiltinTheme}
      onchange={(event) => applyTheme(event.currentTarget.value as ThemeChoice)}>
      <option value="auto">{t('insp.builtinNone')}</option>
      {#if isCustomTheme}
        <option value={theme} disabled>{theme}</option>
      {/if}
      {#each themeChoices as id (id)}
        <option value={id}>{t(`colors.theme.${id}`)}</option>
      {/each}
    </select>
  </FieldRow>
  {#if isCustomTheme}
    <p class={muted} title={t('colors.themeCustom', { theme })}>
      {t('colors.themeCustom', { theme })}
    </p>
  {/if}
</PanelGroup>

<!-- 向き・配置・間隔: the direction is in the code, the engine and spacing in the config. -->
<PanelGroup>
  {#if direction}
    <fieldset disabled={blocked || busy} class="contents">
      <FieldRow label={t('layout.direction')}>
        <Segmented
          bind:value={directionValue}
          dense
          full
          ariaLabel={t('layout.direction')}
          testID={TID.inspDirection}
          options={[
            { label: t('layout.directionTB'), value: 'TB' },
            { label: t('layout.directionBT'), value: 'BT' },
            { label: t('layout.directionLR'), value: 'LR' },
            { label: t('layout.directionRL'), value: 'RL' },
            { label: t('insp.directionFit'), title: t('layout.fitHint'), value: 'fit' }
          ]}
          onchange={onDirection} />
      </FieldRow>
    </fieldset>
    <FieldRow label={t('insp.engine')}>
      <Segmented
        value={options.engine}
        full
        ariaLabel={t('layout.engine')}
        testID={TID.inspEngine}
        options={[
          { label: t('layout.engineDagre'), value: 'dagre' },
          { label: t('insp.engineElk'), title: t('layout.engineElkHint'), value: 'elk' }
        ]}
        onchange={(engine) => applyOptions({ engine: engine as LayoutOptions['engine'] })} />
    </FieldRow>
    <FieldRow label={t('layout.spacing')}>
      <Segmented
        value={options.spacing}
        full
        ariaLabel={t('layout.spacing')}
        testID={TID.inspSpacing}
        options={(['compact', 'normal', 'wide'] as const).map((spacing) => ({
          disabled: options.engine === 'elk',
          label: t(`layout.spacing.${spacing}`),
          title: options.engine === 'elk' ? t('layout.spacingElkNote') : undefined,
          value: spacing
        }))}
        onchange={(spacing) => applyOptions({ spacing: spacing as LayoutOptions['spacing'] })} />
    </FieldRow>
    {#if options.engine === 'elk'}
      <!-- ELK's own options (mermaid's `elk` config): how nodes are placed, merged arrows. -->
      <FieldRow label={t('insp.elkPlacement')}>
        <select
          class={selectClass}
          value={elk.placement}
          aria-label={t('insp.elkPlacement')}
          title={t('insp.elkPlacementHint')}
          data-testid={TID.inspElkPlacement}
          onchange={(event) =>
            updateConfig(
              setElkOptions(inputState.mermaid, {
                placement: event.currentTarget.value as ElkOptions['placement']
              })
            )}>
          <option value="">{t('insp.elkPlacement.default')}</option>
          {#each elkPlacements as placement (placement)}
            <option value={placement}>{t(`insp.elkPlacement.${placement}`)}</option>
          {/each}
        </select>
      </FieldRow>
      <FieldRow label={t('insp.elkCycle')}>
        <select
          class={selectClass}
          value={elk.cycle}
          aria-label={t('insp.elkCycle')}
          title={t('insp.elkCycleHint')}
          data-testid={TID.inspElkCycle}
          onchange={(event) =>
            updateConfig(
              setElkOptions(inputState.mermaid, {
                cycle: event.currentTarget.value as ElkOptions['cycle']
              })
            )}>
          <option value="">{t('insp.elkPlacement.default')}</option>
          {#each elkCycles as cycle (cycle)}
            <option value={cycle}>{t(`insp.elkCycle.${cycle}`)}</option>
          {/each}
        </select>
      </FieldRow>
      <FieldRow label={t('insp.elkOrder')}>
        <select
          class={selectClass}
          value={elk.modelOrder}
          aria-label={t('insp.elkOrder')}
          title={t('insp.elkOrderHint')}
          data-testid={TID.inspElkOrder}
          onchange={(event) =>
            updateConfig(
              setElkOptions(inputState.mermaid, {
                modelOrder: event.currentTarget.value as ElkOptions['modelOrder']
              })
            )}>
          <option value="">{t('insp.elkPlacement.default')}</option>
          {#each elkModelOrders as order (order)}
            <option value={order}>{t(`insp.elkOrder.${order}`)}</option>
          {/each}
        </select>
      </FieldRow>
      <SwitchRow
        label={t('insp.elkMerge')}
        checked={elk.mergeEdges}
        testID={TID.inspElkMerge}
        onchange={(mergeEdges) =>
          updateConfig(setElkOptions(inputState.mermaid, { mergeEdges }))} />
    {/if}
  {:else}
    <FieldRow label={t('layout.direction')}>
      <span
        class={muted}
        title={`${t(directionUnsupportedKey(inputState.code))} ${t('layout.noEngine')}`}
        data-testid={TID.layoutNoEngine}>{t(directionUnsupportedKey(inputState.code))}</span>
    </FieldRow>
  {/if}
</PanelGroup>

<!-- The type's own options (diagramOptions.ts): curve, look, numbering, a gantt's days … -->
{#if typeOptions.length > 0}
  <PanelGroup>
    {#each typeOptions as option (option.key)}
      <fieldset disabled={blocked && !option.config} class="contents">
        {#if option.kind === 'switch'}
          <SwitchRow
            label={t(option.label)}
            checked={option.value === 'on'}
            testID={`${TID.inspOption}-${option.key}`}
            onchange={(on) => void applyOption(option, on ? 'on' : 'off')} />
        {:else}
          <FieldRow label={t(option.label)}>
            {#if option.kind === 'choice'}
              <select
                class={selectClass}
                value={option.value}
                aria-label={t(option.label)}
                title={t(option.label)}
                data-testid={`${TID.inspOption}-${option.key}`}
                onchange={(event) => void applyOption(option, event.currentTarget.value)}>
                {#each option.options ?? [] as value (value)}
                  <option {value}>{optionLabel(option, value)}</option>
                {/each}
              </select>
            {:else}
              <input
                class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                type={option.kind}
                min={option.kind === 'number' ? 1 : undefined}
                value={option.value}
                placeholder={t('opt.empty')}
                aria-label={t(option.label)}
                title={t(option.label)}
                data-testid={`${TID.inspOption}-${option.key}`}
                onkeydown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                onchange={(event) => void applyOption(option, event.currentTarget.value)} />
            {/if}
          </FieldRow>
        {/if}
      </fieldset>
    {/each}
  </PanelGroup>
{/if}

<!-- 線の色 (config), then the colours written in the code: lanes, objects, arrows. -->
<PanelGroup>
  <FieldRow label={t('colors.line')}>
    <ColorRow
      mode="line"
      current={lineColor}
      label={t('colors.line')}
      noneLabel={t('colors.lineDefault')}
      testID={TID.inspLineColor}
      onpick={(color) => updateConfig(setLineColor(inputState.mermaid, color))} />
  </FieldRow>
  <fieldset disabled={blocked} class="contents">
    {#if showLanes}
      <FieldRow label={t('insp.lanes')}>
        {#if groups.length > 0}
          <Button
            size="sm"
            variant="outline"
            class={smallButton}
            data-testid={TID.inspLanesAuto}
            onclick={() => applyCode(colorAllGroups(inputState.code, false, presetSwatches))}
            >{t('insp.colorEach')}</Button>
          <Button
            size="sm"
            variant="outline"
            class={smallButton}
            data-testid={TID.inspLanesClear}
            onclick={() => applyCode(colorAllGroups(inputState.code, true))}
            >{t('insp.colorClear')}</Button>
        {:else}
          <span class={muted} title={t('colors.groupsNone')}>{t('colors.groupsNone')}</span>
        {/if}
      </FieldRow>
    {/if}
    {#if objects && objects.items.length > 0}
      <FieldRow label={t('insp.objects')}>
        <Button
          size="sm"
          variant="outline"
          class={smallButton}
          title={t(`colors.objects.${objects.kind}`)}
          data-testid={TID.inspNodesAuto}
          onclick={() =>
            applyCode(colorAll(inputState.code, objectIds, objectSyntax, false, presetSwatches))}
          >{t('insp.colorEach')}</Button>
        <Button
          size="sm"
          variant="outline"
          class={smallButton}
          data-testid={TID.inspNodesClear}
          onclick={() => applyCode(colorAll(inputState.code, objectIds, objectSyntax, true))}
          >{t('insp.colorClear')}</Button>
      </FieldRow>
    {/if}
    {#if edges.length > 0}
      <FieldRow label={t('insp.edges')}>
        <Button
          size="sm"
          variant="outline"
          class={smallButton}
          title={t('colors.edgesHint')}
          data-testid={TID.inspEdgesReset}
          onclick={clearEdges}>{t('colors.edgesClear')}</Button>
      </FieldRow>
    {/if}
    {#if !objects && groups.length === 0}
      <p class={muted} title={t('colors.objectsNone')}>{t('colors.objectsNone')}</p>
    {/if}
  </fieldset>
</PanelGroup>

<!-- タイトル (code), フォント (config), 手描き風 (the editor's state). -->
<PanelGroup>
  <FieldRow label={t('layout.diagramTitle')}>
    {#if showsTitle}
      <fieldset disabled={blocked} class="flex min-w-0 flex-1 items-center gap-1">
        <input
          bind:value={titleText}
          class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
          placeholder={t('insp.titleNone')}
          aria-label={t('layout.diagramTitle')}
          title={t('layout.titlePlaceholder')}
          data-testid={TID.inspTitle}
          onkeydown={(event) => {
            if (event.key === 'Enter') void applyTitle(titleText);
            if (event.key === 'Escape') titleText = title;
          }}
          onblur={() => void applyTitle(titleText)} />
        {#if title}
          <Button
            size="sm"
            variant="ghost"
            class={smallButton}
            data-testid={TID.inspTitleRemove}
            onclick={() => {
              titleText = '';
              void applyTitle('');
            }}>{t('layout.titleRemove')}</Button>
        {/if}
      </fieldset>
    {:else}
      <span class={muted} title={t('layout.titleUnsupported')}>{t('layout.titleUnsupported')}</span>
    {/if}
  </FieldRow>
  <FieldRow label={t('insp.font')}>
    <select
      class={selectClass}
      value={font}
      aria-label={t('insp.font')}
      data-testid={TID.inspFont}
      onchange={(event) =>
        updateConfig(setDiagramFont(inputState.mermaid, event.currentTarget.value as FontChoice))}>
      {#if font === 'custom'}
        <option value="custom" disabled>{t('insp.font.custom')}</option>
      {/if}
      {#each fontChoices as choice (choice)}
        <option value={choice}>{t(`insp.font.${choice}`)}</option>
      {/each}
    </select>
  </FieldRow>
  <SwitchRow
    label={t('toolbar.handDrawn')}
    checked={!!inputState.rough}
    testID={TID.roughToggle}
    onchange={(rough) => updateCodeStore({ rough })} />
</PanelGroup>

<!-- アイコン: the picker and the packs (dialogs), unknown names, the AI briefing. -->
<PanelGroup>
  <FieldRow label={t('icons.title')}>
    <Button
      size="sm"
      variant="outline"
      class={smallButton}
      data-testid={TID.inspIconBrowse}
      onclick={() => {
        iconMessage = '';
        iconsOpen = true;
      }}>{t('insp.iconBrowse')}</Button>
    <Button
      size="sm"
      variant="outline"
      class={smallButton}
      data-testid={TID.inspIconPacks}
      onclick={() => (packsOpen = true)}>{t('insp.iconPacks')}</Button>
  </FieldRow>
  {#if iconMessage}
    <p role="status" class="text-xs text-muted-foreground" data-testid={TID.inspIconMessage}>
      {iconMessage}
    </p>
  {/if}
  <fieldset disabled={blocked} class="contents">
    <UnknownIcons />
  </fieldset>
  <AiIconPrompt />
</PanelGroup>

<!-- 要素: the parts in a list, for diagrams whose parts cannot be clicked. -->
<PanelGroup>
  {#if !kind}
    <FieldRow label={t('insp.elements')}>
      <span class={muted} title={t('edit.unsupported')}>{t('edit.unsupported')}</span>
    </FieldRow>
  {:else if items.length === 0}
    <FieldRow label={t('insp.elements')}>
      <span class={muted}>{t('edit.objectsNone')}</span>
    </FieldRow>
  {:else}
    <FieldRow label={t('insp.elements')}>
      <select
        class={selectClass}
        value={selectedId}
        aria-label={t(objectsKey)}
        title={t('edit.objectsHint')}
        data-testid={TID.inspObjectSelect}
        onchange={(event) => {
          const id = event.currentTarget.value;
          if (id) select({ id, type: 'node' });
        }}>
        <option value="" disabled>{t(objectsKey)}</option>
        {#each items as object (object.id)}
          <option value={object.id}
            >{object.line === undefined
              ? displayName(object.label, object.id, items)
              : object.label.replaceAll(' ', ' ')}</option>
        {/each}
      </select>
    </FieldRow>
  {/if}
  {#if model.edges && kind}
    <FieldRow label={t('insp.edges')}>
      {#if edgeItems.length === 0}
        <span class={muted} title={t(model.edges.unsure ? 'edit.edgesUnsure' : 'edit.edgesNone')}
          >{t(model.edges.unsure ? 'edit.edgesUnsure' : 'edit.edgesNone')}</span>
      {:else}
        <select
          class={selectClass}
          value={selectedEdge}
          aria-label={t('edit.edges')}
          title={t('edit.edgesHint')}
          data-testid={TID.inspEdgeSelect}
          onchange={(event) => {
            const index = event.currentTarget.value;
            if (index !== '') select({ index: Number(index), type: 'edge' });
          }}>
          <option value="" disabled>{t('edit.edges')}</option>
          {#each edgeItems as item (item.index)}
            <option value={String(item.index)}>{item.title}</option>
          {/each}
        </select>
      {/if}
    </FieldRow>
  {/if}
</PanelGroup>

{#if message}
  <p role="status" class="px-3 py-1 text-xs text-muted-foreground" data-testid={TID.inspMessage}>
    {message}
  </p>
{/if}

<Dialog.Root bind:open={iconsOpen}>
  <Dialog.Content class="flex h-[85vh] flex-col sm:max-w-5xl" data-testid={TID.inspIconDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('icons.pickTitle')}</Dialog.Title>
    </Dialog.Header>
    <IconPicker
      bind:mode={pickerMode}
      bind:pack={pickerPack}
      bind:query={pickerQuery}
      bind:source={pickerSource}
      bind:page={pickerPage}
      onchosen={(text) => {
        iconMessage = text;
        iconsOpen = false;
      }} />
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={packsOpen}>
  <Dialog.Content
    class="flex max-h-[85vh] flex-col sm:max-w-xl"
    data-testid={TID.inspIconPacksDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('insp.iconPacksTitle')}</Dialog.Title>
    </Dialog.Header>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <IconPacks />
    </div>
  </Dialog.Content>
</Dialog.Root>
