<script lang="ts">
  import AiIconPrompt from '$/components/AiIconPrompt.svelte';
  import FieldRow, { labelColumn } from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import SwitchRow from '$/components/form/SwitchRow.svelte';
  import IconPacks from '$/components/IconPacks.svelte';
  import IconPicker from '$/components/IconPicker.svelte';
  import LookRow from '$/components/inspector/LookRow.svelte';
  import UnknownIcons from '$/components/UnknownIcons.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import { applyToolEdit, editsBlocked, type ToolEditResult } from '$/util/codeHealth.svelte';
  import {
    colorAll,
    colorAllGroups,
    listGroups,
    parsePresets,
    setEdgeColor,
    swatches,
    type Swatch
  } from '$/util/colors';
  import { editKind } from '$/util/diagramModify';
  import { getTitle, setTitle, titleShown } from '$/util/diagramTitle';
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
  import { settledState } from '$/util/settledState.svelte';
  import { inputState, updateConfig } from '$/util/state.svelte';
  import { parseConfigObject } from '$/util/stateGuard';
  import type { MermaidConfig } from 'mermaid';

  // Local: the inspector's 図全体 — what applies to the whole diagram, each a one-line
  // row: 見た目 (the theme, the built-in theme, the font, the hand-drawn look and the line
  // colour, behind 変更…: LookRow.svelte), the layout (direction, engine, spacing:
  // layout.ts), the type's own options (diagramOptions.ts), colours written in the code
  // (lanes, every object, every arrow: colors.ts), the title (diagramTitle.ts) and the
  // icons (the picker and the pack dialogs, the unknown names, the AI briefing). What is
  // touched while working comes first (見た目, 向き, タイトル, 配置, 間隔); ELK's own options
  // and the accessible title and description sit behind 詳細 │ 変更… (a popover, as 見た目
  // does, not a collapsible section). The
  // parts themselves are picked from the tabs over the panel (Inspector.svelte). Rows the
  // diagram type has no use for are left out, or say why.
  // `blocked`: the code is broken, so the rows that edit the code are disabled; the
  // config rows (見た目, engine, spacing) stay available.
  let { blocked = false }: { blocked?: boolean } = $props();

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
  const allOptions = $derived(diagramOptions(inputState.code, inputState.mermaid));
  // The accessible title and description are rarely touched: they go behind 詳細.
  const accessibleKeys = new Set(['accTitle', 'accDescr']);
  const typeOptions = $derived(allOptions.filter(({ key }) => !accessibleKeys.has(key)));
  const accessibleOptions = $derived(allOptions.filter(({ key }) => accessibleKeys.has(key)));
  let detailsOpen = $state(false);
  // What 詳細 holds for this diagram, named on its row.
  const detailsSummary = $derived(
    [
      direction && options.engine === 'elk' ? t('insp.detailsElk') : '',
      accessibleOptions.length > 0 ? t('insp.detailsAccessible') : ''
    ]
      .filter(Boolean)
      .join('・')
  );
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

  const kind = $derived(editKind(inputState.code));

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

<!-- 見た目 (config, always available), then 向き・配置・間隔: the direction is in the code,
     the engine and spacing in the config. -->
<PanelGroup>
  <LookRow />
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
    {@render titleRow()}
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
  {:else}
    <FieldRow label={t('layout.direction')}>
      <span
        class={muted}
        title={`${t(directionUnsupportedKey(inputState.code))} ${t('layout.noEngine')}`}
        data-testid={TID.layoutNoEngine}>{t(directionUnsupportedKey(inputState.code))}</span>
    </FieldRow>
    {@render titleRow()}
  {/if}
  {#if (direction && options.engine === 'elk') || accessibleOptions.length > 0}
    {@render details()}
  {/if}
</PanelGroup>

<!-- The type's own options (diagramOptions.ts): curve, look, numbering, a gantt's days … -->
{#if typeOptions.length > 0}
  <PanelGroup>
    {#each typeOptions as option (option.key)}
      {@render optionRow(option)}
    {/each}
  </PanelGroup>
{/if}

<!-- The colours written in the code: lanes, objects, arrows (the line colour is in 見た目). -->
<PanelGroup>
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

<!-- The parts are picked from the tabs over the panel; a type the panel cannot edit says so. -->
{#if !kind}
  <PanelGroup>
    <FieldRow label={t('insp.elements')}>
      <span class={muted} title={t('edit.unsupported')}>{t('edit.unsupported')}</span>
    </FieldRow>
  </PanelGroup>
{/if}

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

{#snippet titleRow()}
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
{/snippet}

{#snippet optionRow(option: DiagramOption)}
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
{/snippet}

<!-- 詳細 │ 変更…: ELK's own options (mermaid's `elk` config: how nodes are placed, merged
     arrows) and the accessible title and description, in a popover as 見た目 has. -->
{#snippet details()}
  <FieldRow label={t('insp.details')}>
    <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={detailsSummary}
      >{detailsSummary}</span>
    <Popover.Root bind:open={detailsOpen}>
      <Popover.Trigger
        class="inline-flex h-7 shrink-0 items-center rounded-md border border-input bg-background px-2 text-xs whitespace-nowrap hover:bg-muted aria-expanded:bg-muted"
        title={t('insp.detailsHint')}
        aria-label={`${t('insp.details')}: ${t('insp.lookChange')}`}
        data-testid={TID.inspDetailsPopover}>{t('insp.lookChange')}</Popover.Trigger>
      <Popover.Content
        align="end"
        class="w-[21rem] max-w-[calc(100vw-2rem)] p-3"
        data-selection-ui
        data-testid={TID.inspDetailsContent}>
        <div class="flex flex-col gap-1" use:labelColumn>
          {#if direction && options.engine === 'elk'}
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
          {#each accessibleOptions as option (option.key)}
            {@render optionRow(option)}
          {/each}
        </div>
      </Popover.Content>
    </Popover.Root>
  </FieldRow>
{/snippet}
