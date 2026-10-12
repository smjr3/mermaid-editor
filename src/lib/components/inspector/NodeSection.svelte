<script lang="ts">
  import FieldRow from '$/components/form/FieldRow.svelte';
  import PanelGroup from '$/components/form/PanelGroup.svelte';
  import Segmented from '$/components/form/Segmented.svelte';
  import IconChooser from '$/components/IconChooser.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import ObjectFields from '$/components/inspector/ObjectFields.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { textSizeChoices, type TextSize } from '$/util/colors';
  import type { NodeShape } from '$/util/diagramEdit';
  import { iconForms, iconPositions } from '$/util/diagramModify';
  import { displayName } from '$/util/displayName';
  import { flowShapeNames, type FlowShapeName } from '$/util/flowShapes';
  import { select, selection, startConnect } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import ConnectIcon from '~icons/material-symbols/arrow-right-alt-rounded';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import ResetIcon from '~icons/material-symbols/format-clear-rounded';

  // Local: the inspector for a selected object (a node, state, class, participant,
  // service, topic, task, …), each a one-line row: its name (also the inline rename),
  // shape, colour (fill, border or text) and text style, icon, lane or group, id
  // (renamed everywhere, as F2 does), its properties and members (ObjectFields), the
  // arrows to and from it, and ＋次 / ＋分岐 / 矢印 / 削除. Every control is one of the
  // selection model's edits (selectionModel.svelte.ts); what the diagram type has no
  // edit for is left out.
  type Target = 'fill' | 'stroke' | 'text';
  let target = $state<Target>('fill');

  const object = $derived(model.object);
  const icon = $derived(model.node?.icon ?? model.service?.icon);
  let changingIcon = $state(false);
  let idText = $derived(object?.id ?? '');
  $effect(() => {
    void selection.current;
    changingIcon = false;
  });

  const items = $derived(model.objects?.items ?? []);
  const nameOf = (id: string) =>
    displayName(items.find((item) => item.id === id)?.label ?? id, id, items);
  // The arrows into and out of the object, in the order they are written.
  const links = $derived(
    object
      ? (model.edges?.items ?? []).filter(({ from, to }) => from === object.id || to === object.id)
      : []
  );
  const applyId = () => {
    if (idText.trim() && idText.trim() !== object?.id) void model.renameId(idText);
    else idText = object?.id ?? '';
  };
  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const smallButton = 'h-7 px-2 text-xs';
  // The 形 row: the Add card's five under their names, then every other mermaid shape.
  const commonShapes: [FlowShapeName, NodeShape][] = [
    ['rect', 'rect'],
    ['rounded', 'rounded'],
    ['diam', 'diamond'],
    ['circle', 'circle'],
    ['stadium', 'stadium']
  ];
  const moreShapes = flowShapeNames.filter(
    (name) => !commonShapes.some(([common]) => common === name)
  );
</script>

{#if object}
  <PanelGroup>
    <!-- The 名前 row is the inspector's own (Inspector.svelte), so that it outlives a
         change of selection while a rename is open. -->
    {#if object.noRename}
      <FieldRow label={t('sel.name')}>
        <span class="truncate text-xs text-muted-foreground">{t('edit.noRename')}</span>
      </FieldRow>
    {/if}

    {#if model.node && (model.node.shape !== undefined || model.node.icon)}
      <FieldRow label={t('sel.shape')}>
        {#if model.node.icon || model.node.shape === undefined}
          <span class="truncate text-xs text-muted-foreground" title={t('edit.shapeIcon')}
            >{t('edit.shapeIcon')}</span>
        {:else}
          <!-- Every shape mermaid draws (flowShapes.ts): the Add card's five first, then the rest. -->
          <select
            class={selectClass}
            value={model.node.shapeName ?? 'other'}
            aria-label={t('sel.shape')}
            data-insp-focus="shape"
            data-testid={TID.inspShape}
            onchange={(event) => void model.setShapeName(event.currentTarget.value)}>
            {#if !model.node.shapeName}
              <option value="other" disabled>{t('edit.shapeOther')}</option>
            {/if}
            {#each commonShapes as [name, shape] (name)}
              <option value={name}>{t(`add.shape.${shape}`)}</option>
            {/each}
            <optgroup label={t('insp.shapeMore')}>
              {#each moreShapes as name (name)}
                <option value={name}>{t(`shape.${name}` as MessageKey)}</option>
              {/each}
            </optgroup>
          </select>
        {/if}
      </FieldRow>
    {/if}

    {#if model.syntax}
      <FieldRow label={t('sel.color')}>
        <div class="contents" data-insp-focus="color">
          <Segmented
            bind:value={target}
            full
            ariaLabel={t('sel.color')}
            testID={TID.inspColorTarget}
            options={[
              { label: t('insp.colorFill'), value: 'fill' },
              { label: t('insp.colorStroke'), value: 'stroke' },
              { label: t('insp.colorText'), value: 'text' }
            ]} />
        </div>
      </FieldRow>
      <FieldRow label="">
        {#if target === 'fill'}
          <ColorRow
            mode="fill"
            current={model.color}
            label={t('insp.colorFill')}
            testID={TID.inspColor}
            onpick={model.setColor} />
        {:else if target === 'stroke'}
          <ColorRow
            mode="line"
            current={model.stroke}
            label={t('insp.colorStroke')}
            testID={TID.inspColor}
            onpick={model.setStroke} />
        {:else}
          <ColorRow
            mode="line"
            current={model.textColor}
            label={t('sel.textColor')}
            noneLabel={t('colors.textColorDefault')}
            testID={TID.inspColor}
            onpick={model.setTextColor} />
        {/if}
      </FieldRow>
      <FieldRow label={t('sel.text')}>
        {#if model.textStyle}
          {@const style = model.textStyle}
          <Segmented
            value={style.size}
            ariaLabel={t('sel.size')}
            testID={TID.inspTextSize}
            options={textSizeChoices.map((size) => ({
              label: t(`colors.textSize.${size}`),
              value: size
            }))}
            onchange={(size) => model.setTextStyle({ size: size as TextSize })} />
          <button
            type="button"
            class={[
              'flex size-7 shrink-0 items-center justify-center rounded-md border border-input text-sm font-bold',
              style.bold
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            ]}
            title={t('sel.bold')}
            aria-label={t('sel.bold')}
            aria-pressed={style.bold}
            data-testid={TID.inspTextBold}
            onclick={() => model.setTextStyle({ bold: !style.bold })}>B</button>
        {:else}
          <span class="min-w-0 truncate text-xs text-muted-foreground" title={t('colors.textC4')}
            >{t('colors.textC4')}</span>
        {/if}
        <Button
          size="sm"
          variant="ghost"
          class="ml-auto size-7 shrink-0 p-0"
          title={t('colors.textReset')}
          aria-label={t('colors.textReset')}
          data-testid={TID.inspTextReset}
          onclick={model.resetText}><ResetIcon /></Button>
      </FieldRow>
    {/if}
  </PanelGroup>

  <PanelGroup>
    {#if model.node || model.service}
      <FieldRow label={t('sel.icon')}>
        {#if icon}
          <span
            class="min-w-0 truncate rounded-md border border-border px-1.5 py-0.5 font-mono text-xs"
            title={t('edit.iconCurrent', { icon })}
            data-testid={TID.inspIconCurrent}>{icon}</span>
          <Button
            size="sm"
            variant="outline"
            class={smallButton}
            aria-pressed={changingIcon}
            onclick={() => (changingIcon = !changingIcon)}>{t('insp.iconChange')}</Button>
          {#if model.node?.icon}
            <Button
              size="sm"
              variant="outline"
              class={smallButton}
              data-testid={TID.inspIconClear}
              onclick={() => void model.setIcon('')}>{t('insp.iconClear')}</Button>
          {/if}
        {:else}
          <div class="min-w-0 flex-1" data-insp-focus="icon">
            {#key selection.current}
              <IconChooser
                standard={!!model.service}
                searchTestID={TID.inspIcon}
                resultTestID={TID.inspIconResult}
                onpick={(chosen) => void model.setIcon(chosen)} />
            {/key}
          </div>
        {/if}
      </FieldRow>
      {#if icon && changingIcon}
        <FieldRow label="">
          <div class="min-w-0 flex-1" data-insp-focus="icon">
            <IconChooser
              standard={!!model.service}
              searchTestID={TID.inspIcon}
              resultTestID={TID.inspIconResult}
              onpick={(chosen) => {
                changingIcon = false;
                void model.setIcon(chosen);
              }} />
          </div>
        </FieldRow>
      {/if}
      {#if model.node?.icon}
        <!-- mermaid's icon shape: a background behind the icon, the label above or below. -->
        <FieldRow label={t('insp.iconForm')}>
          <Segmented
            value={model.node.form ?? 'none'}
            full
            ariaLabel={t('insp.iconForm')}
            testID={TID.inspIconForm}
            options={iconForms.map((form) => ({ label: t(`insp.iconForm.${form}`), value: form }))}
            onchange={(form) => void model.setIconOptions({ form })} />
        </FieldRow>
        <FieldRow label={t('insp.iconPos')}>
          <Segmented
            value={model.node.pos ?? 'b'}
            full
            ariaLabel={t('insp.iconPos')}
            testID={TID.inspIconPos}
            options={iconPositions.map((pos) => ({ label: t(`insp.iconPos.${pos}`), value: pos }))}
            onchange={(pos) => void model.setIconOptions({ pos })} />
        </FieldRow>
      {/if}
      <FieldRow label={model.service ? t('insp.group') : t('insp.lane')}>
        <select
          class={selectClass}
          value={model.node?.lane ?? model.service?.group ?? ''}
          aria-label={t('sel.moveTo')}
          data-testid={TID.inspLane}
          onchange={(event) => void model.moveTo(event.currentTarget.value)}>
          <option value="">{t(model.service ? 'edit.noGroup' : 'edit.noLane')}</option>
          {#each model.groups as group (group.id)}
            <option value={group.id}>{displayName(group.label, group.id, items)}</option>
          {/each}
        </select>
      </FieldRow>
    {/if}
    {#if model.canRenameId}
      <FieldRow label={t('insp.id')}>
        <input
          bind:value={idText}
          class="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs"
          aria-label={t('insp.id')}
          title={t('insp.idHint')}
          data-testid={TID.inspId}
          onkeydown={(event) => {
            if (event.isComposing) return;
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              idText = object.id;
              event.currentTarget.blur();
            }
          }}
          onblur={applyId} />
      </FieldRow>
    {/if}
    <ObjectFields />
  </PanelGroup>

  <PanelGroup>
    {#if links.length > 0}
      <ul class="flex flex-col" aria-label={t('insp.links')} data-testid={TID.inspLinks}>
        {#each links as link (link.index)}
          <li>
            <button
              type="button"
              class="flex w-full min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
              data-index={link.index}
              data-testid={TID.inspLink}
              onclick={() => select({ index: link.index, type: 'edge' })}>
              <span class="min-w-0 flex-1 truncate"
                >{link.from === object.id
                  ? `→ ${nameOf(link.to)}`
                  : `← ${nameOf(link.from)}`}</span>
              {#if link.label}
                <small class="max-w-[40%] truncate text-muted-foreground">{link.label}</small>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="flex flex-wrap items-center gap-1">
      {#if model.canAddAfter}
        <Button
          size="sm"
          variant="outline"
          class={smallButton}
          title={`${t('sel.addAfter')} (Enter)`}
          data-testid={TID.inspAddNext}
          onclick={() => void model.addAfter()}>{t('insp.addNext')}</Button>
        <Button
          size="sm"
          variant="outline"
          class={smallButton}
          title={`${t('sel.addBranch')} (Tab)`}
          data-testid={TID.inspAddBranch}
          onclick={() => void model.addBranch()}>{t('insp.addBranch')}</Button>
      {/if}
      {#if model.canConnect}
        <Button
          size="sm"
          variant={selection.connectFrom ? 'default' : 'outline'}
          class={smallButton}
          title={t('sel.connect')}
          aria-pressed={!!selection.connectFrom}
          data-testid={TID.inspConnect}
          onclick={startConnect}><ConnectIcon />{t('insp.connect')}</Button>
      {/if}
      <span class="flex-1"></span>
      {#if object.noDelete}
        <span class="text-xs text-muted-foreground">{t('edit.noDelete')}</span>
      {:else}
        <Button
          size="sm"
          variant="ghost"
          class="size-7 p-0 text-destructive"
          title={`${t('insp.deleteNode')} (Delete)`}
          aria-label={t('insp.deleteNode')}
          data-testid={TID.inspDelete}
          onclick={() => void model.remove()}><DeleteIcon /></Button>
      {/if}
    </div>
  </PanelGroup>
{/if}
