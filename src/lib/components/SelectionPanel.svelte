<script lang="ts">
  import ColorSwatches from '$/components/ColorSwatches.svelte';
  import IconChooser from '$/components/IconChooser.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import { textSizeChoices, type TextSize } from '$/util/colors';
  import type { DetailField } from '$/util/diagramDetails';
  import { nodeShapes, type NodeShape } from '$/util/diagramEdit';
  import type { EdgeStyle } from '$/util/diagramModify';
  import { clearSelection, selection, startConnect } from '$/util/selection.svelte';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';
  import HelpIcon from '~icons/material-symbols/help-outline-rounded';

  // Local: the "選択中" panel at the top of the 直す tab — the full controls for what
  // is selected in the diagram (selection.svelte.ts): its text, colour and text style,
  // shape, lane or group, icon, members (class, ER) and properties (gantt, pie), new
  // objects after it and arrows from it; for an arrow its label, line, head, colour
  // and direction. Every control is one of the selection model's edits
  // (selectionModel.svelte.ts), the Edit and Colours cards' own functions; what the
  // diagram type has no edit for is left out. With nothing selected it says how to
  // select, and its help names the keys.
  let name = $derived(model.label);
  let moveTo = $derived(model.node?.lane ?? model.service?.group ?? '');
  let choosingIcon = $state(false);
  let selectedMember = $state('');
  const member = $derived(
    model.members?.find(({ id }) => id === selectedMember) ?? model.members?.[0]
  );
  const values = (fields: DetailField[] | undefined) =>
    Object.fromEntries((fields ?? []).map(({ key, value }) => [key, value]));
  let fieldValues = $derived<Record<string, string>>(values(model.fields));
  let memberValues = $derived<Record<string, string>>(values(member?.fields));
  $effect(() => {
    void selection.current;
    choosingIcon = false;
  });

  const optionText = (label: MessageKey, option: string) => {
    const key = `${label}.${option}`;
    return key in messages.en ? t(key as MessageKey) : option;
  };
  const shown = (label: string, id: string) => {
    const text = label.trim();
    return text === id || text === '' ? id : `${text} (${id})`;
  };
  const choice = (active: boolean) => (active ? 'default' : 'outline');
  const selectClass =
    'h-9 min-w-0 w-full rounded-md border border-input bg-background px-1 text-sm text-foreground';
  const row = 'flex items-center gap-1';
  const label = 'w-20 shrink-0 text-xs text-muted-foreground';
  const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick'];
</script>

{#snippet detailField(field: DetailField, value: string, set: (value: string) => void)}
  <label class={row}>
    <span class={label}>{t(field.label)}</span>
    {#if field.kind === 'choice' || field.kind === 'item'}
      <select class={selectClass} {value} onchange={(event) => set(event.currentTarget.value)}>
        {#if field.kind === 'item'}
          <option value="">{t('add.none')}</option>
          {#each field.choices ?? [] as option (option.id)}
            <option value={option.id}>{shown(option.label, option.id)}</option>
          {/each}
        {:else}
          {#each field.options ?? [] as option (option)}
            <option value={option}>{optionText(field.label, option)}</option>
          {/each}
        {/if}
      </select>
    {:else}
      <Input
        class="h-9"
        type={field.kind === 'text' ? 'text' : field.kind}
        {value}
        oninput={(event) => set(event.currentTarget.value)} />
    {/if}
  </label>
{/snippet}

<section
  class="flex max-h-[55%] shrink-0 flex-col overflow-y-auto border-b border-border bg-card text-sm"
  aria-label={t('sel.title')}
  data-testid={TID.selectionPanel}>
  <div class="flex h-9 shrink-0 items-center justify-between gap-2 bg-muted/60 px-2">
    <span class="flex min-w-0 items-center gap-1 font-semibold">
      {t('sel.title')}
      {#if model.object || model.edge}
        <span class="truncate font-normal" data-testid={`${TID.selectionPanel}-name`}
          >: {model.edge
            ? `${t('sel.edge')} ${model.edge.title}`
            : shown(model.object?.label ?? '', model.object?.id ?? '')}</span>
      {/if}
    </span>
    <span class="flex shrink-0 items-center">
      <span
        class="flex size-7 cursor-help items-center justify-center text-muted-foreground"
        role="img"
        title={t('sel.keys')}
        aria-label={`${t('sel.keysLabel')}: ${t('sel.keys')}`}
        data-testid={TID.selectionHint}><HelpIcon /></span>
      {#if selection.current}
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          title={t('sel.clear')}
          aria-label={t('sel.clear')}
          onclick={clearSelection}><CloseIcon /></Button>
      {/if}
    </span>
  </div>

  {#if !model.object && !model.edge}
    <p class="px-2 py-1.5 text-xs text-muted-foreground">{t('sel.hint')}</p>
  {:else}
    <div class="flex flex-col gap-2 p-2">
      {#if model.object}
        {@const object = model.object}
        {#if !object.noRename}
          <form
            class="flex gap-1"
            onsubmit={(event) => {
              event.preventDefault();
              void model.rename(name);
            }}>
            <Input
              bind:value={name}
              class="h-9"
              aria-label={t('sel.name')}
              placeholder={t('sel.name')}
              data-testid={`${TID.selectionPanel}-rename`} />
            <Button
              type="submit"
              size="sm"
              class="h-9"
              data-testid={`${TID.selectionPanel}-rename-button`}>{t('sel.rename')}</Button>
          </form>
        {/if}

        {#if model.syntax}
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">{t('sel.color')}</span>
            <ColorSwatches
              mode="fill"
              current={model.color}
              onpick={model.setColor}
              testID={`${TID.selectionPanel}-color`} />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">{t('sel.text')}</span>
            {#if model.textStyle}
              {@const style = model.textStyle}
              <div class="flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  variant={choice(style.bold)}
                  aria-pressed={style.bold}
                  data-testid={`${TID.selectionPanel}-bold`}
                  onclick={() => model.setTextStyle({ bold: !style.bold })}>{t('sel.bold')}</Button>
                <select
                  class="h-8 rounded-md border border-input bg-background px-1 text-sm text-foreground"
                  value={style.size}
                  aria-label={t('sel.size')}
                  data-testid={`${TID.selectionPanel}-size`}
                  onchange={(event) =>
                    model.setTextStyle({ size: event.currentTarget.value as TextSize })}>
                  {#each textSizeChoices as size (size)}
                    <option value={size}>{t(`colors.textSize.${size}`)}</option>
                  {/each}
                </select>
                <Button size="sm" variant="outline" onclick={model.resetText}
                  >{t('colors.textReset')}</Button>
              </div>
            {/if}
            <ColorSwatches
              mode="line"
              current={model.textColor}
              onpick={model.setTextColor}
              testID={`${TID.selectionPanel}-text-color`} />
          </div>
        {/if}

        {#if model.node?.shape !== undefined && !model.node.icon}
          <div class={row}>
            <span class={label}>{t('sel.shape')}</span>
            <select
              class={selectClass}
              value={model.node.shape}
              aria-label={t('sel.shape')}
              data-testid={`${TID.selectionPanel}-shape`}
              onchange={(event) => void model.setShape(event.currentTarget.value as NodeShape)}>
              {#if model.node.shape === 'other'}
                <option value="other" disabled>{t('edit.shapeOther')}</option>
              {/if}
              {#each nodeShapes as shape (shape)}
                <option value={shape}>{t(`add.shape.${shape}`)}</option>
              {/each}
            </select>
          </div>
        {/if}

        {#if model.node || model.service}
          <div class={row}>
            <span class={label}>{t('sel.moveTo')}</span>
            <select
              class={selectClass}
              bind:value={moveTo}
              aria-label={t('sel.moveTo')}
              data-testid={`${TID.selectionPanel}-move`}>
              <option value="">{t(model.service ? 'edit.noGroup' : 'edit.noLane')}</option>
              {#each model.groups as group (group.id)}
                <option value={group.id}>{shown(group.label, group.id)}</option>
              {/each}
            </select>
            <Button
              size="sm"
              variant="outline"
              class="h-9"
              data-testid={`${TID.selectionPanel}-move-button`}
              onclick={() => void model.moveTo(moveTo)}>{t('sel.move')}</Button>
          </div>
          <div class="flex flex-col gap-1">
            <div class={row}>
              <span class={label}>{t('sel.icon')}</span>
              <span class="min-w-0 flex-1 truncate text-xs"
                >{(model.node?.icon ?? model.service?.icon)
                  ? t('edit.iconCurrent', { icon: model.node?.icon ?? model.service?.icon ?? '' })
                  : t('edit.iconNone')}</span>
              {#if model.node?.icon}
                <Button size="sm" variant="outline" onclick={() => void model.setIcon('')}
                  >{t('edit.iconClear')}</Button>
              {/if}
              <Button
                size="sm"
                variant={choice(choosingIcon)}
                data-testid={`${TID.selectionPanel}-icon`}
                onclick={() => (choosingIcon = !choosingIcon)}>{t('sel.iconChoose')}</Button>
            </div>
            {#if choosingIcon}
              <IconChooser standard={!!model.service} onpick={(icon) => void model.setIcon(icon)} />
            {/if}
          </div>
        {/if}

        {#if model.fields && model.fields.length > 0}
          <div class="flex flex-col gap-1">
            {#each model.fields as field (field.key)}
              {@render detailField(
                field,
                fieldValues[field.key] ?? '',
                (value) => (fieldValues = { ...fieldValues, [field.key]: value })
              )}
            {/each}
            <div>
              <Button size="sm" onclick={() => void model.setFields(fieldValues)}
                >{t('edit.propsApply')}</Button>
            </div>
          </div>
        {/if}

        {#if model.members && model.kind}
          <div class="flex flex-col gap-1">
            <span class="font-semibold">{t(`edit.members.${model.kind}` as MessageKey)}</span>
            {#if model.members.length === 0}
              <p class="text-xs text-muted-foreground">{t('edit.membersNone')}</p>
            {:else}
              <select
                class={selectClass}
                value={member?.id ?? ''}
                aria-label={t(`edit.members.${model.kind}` as MessageKey)}
                data-testid={`${TID.selectionPanel}-member`}
                onchange={(event) => (selectedMember = event.currentTarget.value)}>
                {#each model.members as option (option.id)}
                  <option value={option.id}>{option.label}</option>
                {/each}
              </select>
              {#if member}
                {#each member.fields as field (field.key)}
                  {@render detailField(
                    field,
                    memberValues[field.key] ?? '',
                    (value) => (memberValues = { ...memberValues, [field.key]: value })
                  )}
                {/each}
                <div class="flex flex-wrap gap-1">
                  <Button size="sm" onclick={() => void model.setMember(member, memberValues)}
                    >{t('edit.memberApply')}</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onclick={() => void model.setMember(member, undefined)}
                    >{t('edit.memberDelete')}</Button>
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <div class="flex flex-wrap gap-1">
          {#if model.canAddAfter}
            <Button
              size="sm"
              variant="outline"
              title="Enter"
              data-testid={`${TID.selectionPanel}-add-after`}
              onclick={() => void model.addAfter()}>{t('sel.addAfter')}</Button>
            <Button size="sm" variant="outline" title="Tab" onclick={() => void model.addBranch()}
              >{t('sel.addBranch')}</Button>
          {/if}
          {#if model.canConnect}
            <Button
              size="sm"
              variant={choice(!!selection.connectFrom)}
              data-testid={`${TID.selectionPanel}-connect`}
              onclick={startConnect}>{t('sel.connect')}</Button>
          {/if}
          {#if !object.noDelete}
            <Button
              size="sm"
              variant="outline"
              title="Delete"
              data-testid={`${TID.selectionPanel}-delete`}
              onclick={() => void model.remove()}>{t('sel.delete')}</Button>
            {#if object.group}
              <Button size="sm" variant="outline" onclick={() => void model.remove(true)}
                >{t('sel.deleteKeep')}</Button>
            {/if}
          {/if}
        </div>
      {:else if model.edge}
        {@const edge = model.edge}
        {#if model.edges?.can.label}
          <form
            class="flex gap-1"
            onsubmit={(event) => {
              event.preventDefault();
              void model.rename(name);
            }}>
            <Input
              bind:value={name}
              class="h-9"
              aria-label={t('sel.label')}
              placeholder={t('sel.label')}
              data-testid={`${TID.selectionPanel}-label`} />
            <Button type="submit" size="sm" class="h-9">{t('sel.renameLabel')}</Button>
          </form>
        {/if}
        {#if (model.edges?.can.styles.length ?? 0) > 0}
          <div class={row}>
            <span class={label}>{t('sel.edgeStyle')}</span>
            <div class="flex flex-wrap gap-1">
              {#each edgeStyles.filter( (style) => model.edges?.can.styles.includes(style) ) as style (style)}
                <Button
                  size="sm"
                  variant={choice(edge.style === style)}
                  data-testid={`${TID.selectionPanel}-style-${style}`}
                  onclick={() => void model.setEdgeStyle(style)}
                  >{t(`edit.edgeStyle.${style}`)}</Button>
              {/each}
            </div>
          </div>
        {/if}
        {#if model.edges?.can.head}
          <div class={row}>
            <span class={label}>{t('sel.head')}</span>
            <div class="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={choice(edge.head)}
                onclick={() => void model.setEdgeHead(true)}>{t('edit.edgeHeadOn')}</Button>
              <Button
                size="sm"
                variant={choice(!edge.head)}
                onclick={() => void model.setEdgeHead(false)}>{t('edit.edgeHeadOff')}</Button>
            </div>
          </div>
        {/if}
        {#if model.canColorEdge}
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">{t('sel.edgeColor')}</span>
            <ColorSwatches
              mode="line"
              current={model.edgeColor}
              onpick={model.setEdgeColor}
              testID={`${TID.selectionPanel}-edge-color`} />
          </div>
        {/if}
        <div class="flex flex-wrap gap-1">
          {#if model.edges?.can.reverse}
            <Button
              size="sm"
              variant="outline"
              data-testid={`${TID.selectionPanel}-reverse`}
              onclick={() => void model.reverse()}>{t('sel.reverse')}</Button>
          {/if}
          <Button
            size="sm"
            variant="outline"
            data-testid={`${TID.selectionPanel}-delete`}
            onclick={() => void model.remove()}>{t('sel.delete')}</Button>
        </div>
      {/if}
      {#if model.message}
        <p role="status" class="text-xs text-muted-foreground" data-testid={TID.selectionMessage}>
          {model.message}
        </p>
      {/if}
    </div>
  {/if}
</section>
