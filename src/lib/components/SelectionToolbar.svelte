<script lang="ts">
  import ColorSwatches from '$/components/ColorSwatches.svelte';
  import IconChooser from '$/components/IconChooser.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { textSizeChoices, type TextSize } from '$/util/colors';
  import { nodeShapes, type NodeShape } from '$/util/diagramEdit';
  import type { EdgeStyle } from '$/util/diagramModify';
  import { requestRename, selection, startConnect } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { showTab } from '$/util/toolsPane.svelte';
  import { untrack } from 'svelte';
  import AddIcon from '~icons/material-symbols/add-circle-outline-rounded';
  import ConnectIcon from '~icons/material-symbols/arrow-right-alt-rounded';
  import CheckIcon from '~icons/material-symbols/check-rounded';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import RenameIcon from '~icons/material-symbols/edit-outline-rounded';
  import BoldIcon from '~icons/material-symbols/format-bold-rounded';
  import IconIcon from '~icons/material-symbols/image-outline-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';
  import ReverseIcon from '~icons/material-symbols/swap-horiz-rounded';
  import MoreIcon from '~icons/material-symbols/tune-rounded';

  // Local: the PowerPoint-style mini toolbar that floats just above the selection
  // (SelectionLayer.svelte). Every button is one of the selection model's edits
  // (selectionModel.svelte.ts), the same functions as the Edit and Colours cards;
  // a control the diagram type has no edit for is left out.
  let {
    box,
    hostWidth,
    hostHeight
  }: {
    box: { x: number; y: number; width: number; height: number };
    hostWidth: number;
    hostHeight: number;
  } = $props();

  let width = $state(0);
  let height = $state(0);
  const gap = 10;
  const left = $derived(
    Math.max(4, Math.min(box.x + box.width / 2 - width / 2, hostWidth - width - 4))
  );
  // Above the selection; below it when there is no room above.
  const top = $derived.by(() => {
    const above = box.y - height - gap;
    if (above >= 4) return above;
    return Math.min(box.y + box.height + gap, Math.max(4, hostHeight - height - 4));
  });

  let open = $state<'color' | 'icon' | undefined>();
  // The inline rename is open while `selection.renaming` is set (here, F2, a double
  // click, the menu or a new node), so it survives this toolbar being re-created.
  // The text being typed lives in the model's draft (selectionModel.svelte.ts), so a
  // click on another node or the canvas still applies it to the object it was for.
  const renaming = $derived(selection.renaming && !model.object?.noRename);
  let form: HTMLFormElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  $effect(() => {
    void selection.current;
    if (!renaming || !input) return;
    const field = input;
    untrack(() => {
      model.startDraft();
      open = undefined;
      field.value = model.draft?.name ?? '';
      field.focus();
      field.select();
    });
  });
  // Leaving the field for anything but its own ✓ and ✕ applies what was typed.
  const onblur = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && form?.contains(event.relatedTarget)) return;
    void model.commitDraft();
  };

  // Another selection closes what was open.
  $effect(() => {
    void selection.current;
    untrack(() => (open = undefined));
  });

  const toggle = (which: 'color' | 'icon') => (open = open === which ? undefined : which);
  const more = () => {
    document.querySelector<HTMLElement>(`[data-testid="${TID.toolsRailExpand}"]`)?.click();
    showTab('fix');
  };
  const button =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted aria-pressed:bg-muted';
  const select =
    'h-8 max-w-28 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick'];
</script>

<div
  class="absolute z-20 flex max-w-[calc(100%-0.5rem)] flex-col gap-1 rounded-lg border bg-card p-1 text-sm shadow-lg"
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="toolbar"
  aria-label={t('sel.toolbar')}
  data-selection-ui
  data-testid={TID.selectionToolbar}
  bind:offsetWidth={width}
  bind:offsetHeight={height}>
  {#if renaming}
    <form
      bind:this={form}
      class="flex items-center gap-1"
      onsubmit={(event) => {
        event.preventDefault();
        void model.commitDraft();
      }}>
      <input
        bind:this={input}
        class="h-8 w-48 rounded-md border border-input bg-background px-2 text-sm"
        aria-label={model.edge ? t('sel.label') : t('sel.name')}
        data-testid={TID.selectionRename}
        oninput={(event) => {
          if (model.draft) model.draft.name = event.currentTarget.value;
        }}
        {onblur}
        onkeydown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            model.cancelDraft();
          }
        }} />
      <button
        type="submit"
        class={button}
        title={t('sel.apply')}
        aria-label={t('sel.apply')}
        data-testid={TID.selectionRenameButton}><CheckIcon /></button>
      <button
        type="button"
        class={button}
        title={t('sel.cancel')}
        aria-label={t('sel.cancel')}
        onclick={model.cancelDraft}><CloseIcon /></button>
    </form>
  {:else}
    <div class="flex flex-wrap items-center gap-0.5">
      {#if model.object && !model.object.noRename}
        <button
          type="button"
          class={button}
          title={`${t('sel.rename')} (F2)`}
          aria-label={t('sel.rename')}
          data-testid={`${TID.selectionToolbar}-rename`}
          onclick={requestRename}><RenameIcon /></button>
      {:else if model.edge && model.edges?.can.label}
        <button
          type="button"
          class={button}
          title={`${t('sel.renameLabel')} (F2)`}
          aria-label={t('sel.renameLabel')}
          data-testid={`${TID.selectionToolbar}-rename`}
          onclick={requestRename}><RenameIcon /></button>
      {/if}
      {#if model.syntax || model.canColorEdge}
        <button
          type="button"
          class={button}
          title={model.edge ? t('sel.edgeColor') : t('sel.color')}
          aria-label={model.edge ? t('sel.edgeColor') : t('sel.color')}
          aria-pressed={open === 'color'}
          data-testid={`${TID.selectionToolbar}-color`}
          onclick={() => toggle('color')}><PaletteIcon /></button>
      {/if}
      {#if model.textStyle}
        {@const style = model.textStyle}
        <button
          type="button"
          class={button}
          title={t('sel.bold')}
          aria-label={t('sel.bold')}
          aria-pressed={style.bold}
          data-testid={TID.selectionBold}
          onclick={() => model.setTextStyle({ bold: !style.bold })}><BoldIcon /></button>
        <select
          class={select}
          value={style.size}
          title={t('sel.size')}
          aria-label={t('sel.size')}
          data-testid={TID.selectionSize}
          onchange={(event) => model.setTextStyle({ size: event.currentTarget.value as TextSize })}>
          {#each textSizeChoices as size (size)}
            <option value={size}>{t(`colors.textSize.${size}`)}</option>
          {/each}
        </select>
      {/if}
      {#if model.node?.shape !== undefined && !model.node.icon}
        <select
          class={select}
          value={model.node.shape}
          title={t('sel.shape')}
          aria-label={t('sel.shape')}
          data-testid={TID.selectionShape}
          onchange={(event) => void model.setShape(event.currentTarget.value as NodeShape)}>
          {#if model.node.shape === 'other'}
            <option value="other" disabled>{t('edit.shapeOther')}</option>
          {/if}
          {#each nodeShapes as shape (shape)}
            <option value={shape}>{t(`add.shape.${shape}`)}</option>
          {/each}
        </select>
      {/if}
      {#if model.node || model.service}
        <button
          type="button"
          class={button}
          title={t('sel.icon')}
          aria-label={t('sel.icon')}
          aria-pressed={open === 'icon'}
          data-testid={TID.selectionIcon}
          onclick={() => toggle('icon')}><IconIcon /></button>
      {/if}
      {#if model.edge}
        {#if model.edges?.can.reverse}
          <button
            type="button"
            class={button}
            title={t('sel.reverse')}
            aria-label={t('sel.reverse')}
            data-testid={TID.selectionEdgeReverse}
            onclick={() => void model.reverse()}><ReverseIcon /></button>
        {/if}
        {#if (model.edges?.can.styles.length ?? 0) > 0}
          <select
            class={select}
            value={model.edge.style}
            title={t('sel.edgeStyle')}
            aria-label={t('sel.edgeStyle')}
            data-testid={TID.selectionEdgeStyle}
            onchange={(event) => void model.setEdgeStyle(event.currentTarget.value as EdgeStyle)}>
            {#each edgeStyles.filter( (style) => model.edges?.can.styles.includes(style) ) as style (style)}
              <option value={style}>{t(`edit.edgeStyle.${style}`)}</option>
            {/each}
          </select>
        {/if}
      {/if}
      {#if model.canAddAfter}
        <button
          type="button"
          class={[button, 'w-auto gap-1 px-2 text-xs']}
          title={`${t('sel.addAfter')} (Enter)`}
          data-testid={TID.selectionAddAfter}
          onclick={() => void model.addAfter()}><AddIcon />{t('sel.addAfter')}</button>
      {/if}
      {#if model.canConnect}
        <button
          type="button"
          class={button}
          title={t('sel.connect')}
          aria-label={t('sel.connect')}
          aria-pressed={!!selection.connectFrom}
          data-testid={TID.selectionConnect}
          onclick={startConnect}><ConnectIcon /></button>
      {/if}
      {#if (model.object && !model.object.noDelete) || model.edge}
        <button
          type="button"
          class={[button, 'hover:text-destructive']}
          title={`${t('sel.delete')} (Delete)`}
          aria-label={t('sel.delete')}
          data-testid={TID.selectionDelete}
          onclick={() => void model.remove()}><DeleteIcon /></button>
      {/if}
      <button
        type="button"
        class={button}
        title={t('sel.more')}
        aria-label={t('sel.more')}
        data-testid={`${TID.selectionToolbar}-more`}
        onclick={more}><MoreIcon /></button>
    </div>
    {#if open === 'color'}
      <div class="border-t px-1 pt-1">
        {#if model.edge}
          <ColorSwatches
            mode="line"
            compact
            current={model.edgeColor}
            onpick={model.setEdgeColor}
            testID={TID.selectionColor} />
        {:else}
          <ColorSwatches
            mode="fill"
            compact
            current={model.color}
            onpick={model.setColor}
            testID={TID.selectionColor} />
        {/if}
      </div>
    {:else if open === 'icon'}
      <div class="w-72 border-t px-1 pt-1">
        {#key selection.current}
          <IconChooser standard={!!model.service} onpick={(icon) => void model.setIcon(icon)} />
        {/key}
      </div>
    {/if}
  {/if}
</div>
