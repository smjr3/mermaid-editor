<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import IconChooser from '$/components/IconChooser.svelte';
  import TableEditor from '$/components/TableEditor.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { messages, type MessageKey } from '$/i18n/messages';
  import { pickedEdge, pickedObject } from '$/util/colors';
  import {
    deleteMember,
    objectFields,
    objectMembers,
    setMember,
    setObjectFields,
    type DetailField
  } from '$/util/diagramDetails';
  import { headerLine } from '$/util/diagramEdit';
  import {
    checkEdit,
    deleteEdge,
    deleteObject,
    editKind,
    editableEdges,
    editableObjects,
    flowNodeDetails,
    moveNodeToLane,
    moveService,
    renameObject,
    reverseEdge,
    serviceDetails,
    setEdgeHead,
    setEdgeLabel,
    setEdgeStyle,
    setNodeIcon,
    setNodeShape,
    setServiceIcon,
    type EdgeStyle,
    type EditEdge,
    type EditEdges,
    type EditKind,
    type EditObjects
  } from '$/util/diagramModify';
  import { nodeShapes, type NodeShape } from '$/util/diagramEdit';
  import { editsBlocked } from '$/util/codeHealth.svelte';
  import { inputState, updateCode } from '$/util/state.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import EditIcon from '~icons/material-symbols/edit-square-outline-rounded';

  // Local: rename and delete objects, and relabel, reverse, restyle and delete
  // arrows, without writing the syntax (diagramModify.ts). Every edit is checked
  // with mermaid's parse before it is applied.
  const kind = $derived(editKind(inputState.code));
  // A swimlane diagram's containers are lanes, a flowchart's are groups.
  const objectsKey = $derived(
    kind === 'flowchart' && /^\s*swimlane-beta\b/.test(headerLine(inputState.code))
      ? 'edit.objects.swimlane'
      : (`edit.objects.${kind}` as MessageKey)
  );

  // Objects and arrows come from the last valid code.
  let objects = $state<EditObjects | undefined>();
  let edges = $state<EditEdges | undefined>();
  let selected = $state('');
  let selectedEdge = $state(0);
  let message = $state('');
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    let stale = false;
    void Promise.all([editableObjects(code), editableEdges(code)]).then(([found, foundEdges]) => {
      if (stale) return;
      objects = found;
      edges = foundEdges;
      const items = found?.items ?? [];
      if (!items.some(({ id }) => id === selected)) selected = items[0]?.id ?? '';
      if (selectedEdge >= (foundEdges?.items.length ?? 0)) selectedEdge = 0;
    });
    return () => {
      stale = true;
    };
  });
  const items = $derived(objects?.items ?? []);
  const ids = $derived(items.map(({ id }) => id));
  const edgeItems = $derived(edges?.items ?? []);
  const edgeIds = $derived(edgeItems.map(({ id }) => id ?? ''));
  const selectedItem = $derived(items.find(({ id }) => id === selected));
  const edge = $derived(edgeItems[selectedEdge]);
  // The fields start from what is there (writable: typing replaces it until the choice changes).
  let newName = $derived(selectedItem?.label.trim() ?? '');
  let edgeLabel = $derived(edge?.label ?? '');

  // A flowchart node's shape, lane and icon; an architecture service's icon and group.
  const node = $derived(
    kind === 'flowchart' && selectedItem && !selectedItem.group
      ? flowNodeDetails(inputState.code, selectedItem.id)
      : undefined
  );
  const service = $derived(
    kind === 'architecture' && selectedItem && !selectedItem.group
      ? serviceDetails(inputState.code, selectedItem.id)
      : undefined
  );
  const groups = $derived(items.filter((item) => item.group && item.id !== selected));
  let moveTo = $derived(node?.lane ?? service?.group ?? '');

  // What is inside the object (class members, entity attributes) and its other
  // properties (a gantt task's dates and status, a pie slice's value): diagramDetails.ts.
  const fieldValues = (fields: DetailField[] | undefined) =>
    Object.fromEntries((fields ?? []).map(({ key, value }) => [key, value]));
  const props = $derived(
    kind && selectedItem ? objectFields(inputState.code, kind, selectedItem) : undefined
  );
  let propValues = $derived<Record<string, string>>(fieldValues(props));
  const members = $derived(
    kind && selectedItem ? objectMembers(inputState.code, kind, selectedItem.id) : undefined
  );
  let selectedMember = $state('');
  const member = $derived(members?.find(({ id }) => id === selectedMember) ?? members?.[0]);
  let memberValues = $derived<Record<string, string>>(fieldValues(member?.fields));

  // A click in the diagram picks the object or arrow under it (see pickedObject, pickedEdge).
  $effect(() => {
    const pick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : undefined;
      const svg = target?.closest('#view svg');
      if (!target || !svg?.id) return;
      for (
        let element: Element | null = target;
        element && element !== svg;
        element = element.parentElement
      ) {
        const picked = pickedEdge(
          { dataId: element.getAttribute('data-id'), id: element.id },
          edgeIds
        );
        if (picked !== undefined) {
          selectedEdge = picked;
          return;
        }
        const id = element.id ? pickedObject(element.id, svg.id, ids) : undefined;
        if (id) {
          selected = id;
          return;
        }
      }
    };
    document.addEventListener('click', pick);
    return () => document.removeEventListener('click', pick);
  });

  /** Applies the edit if mermaid still accepts the result as the same kind of diagram. */
  const apply = async (next: string | undefined, done: string) => {
    // Local: the lists are the last valid code's; the broken code cannot be checked.
    if (editsBlocked()) {
      message = t('recover.blocked');
      return;
    }
    const code = inputState.code;
    if (next === undefined || next === code) {
      message = t('edit.breaks');
      return;
    }
    if (!(await checkEdit(code, next))) {
      message = t('edit.breaks');
      return;
    }
    updateCode(next, { updateDiagram: true });
    message = done;
  };

  const onRename = () => {
    if (!kind || !selectedItem) return;
    const name = newName.trim();
    if (!name) return;
    void apply(
      renameObject(inputState.code, kind, selectedItem, name),
      t('edit.renamed', { name })
    );
  };
  const onDelete = (keepContents: boolean) => {
    if (!kind || !selectedItem) return;
    void apply(
      deleteObject(inputState.code, kind, selectedItem, { keepContents }),
      t('edit.deleted', { name: selectedItem.label.trim() })
    );
  };
  const onShape = (shape: NodeShape) => {
    if (!selectedItem) return;
    void apply(
      setNodeShape(inputState.code, selectedItem.id, shape),
      t('edit.changed', { name: selectedItem.label.trim() })
    );
  };
  const onMove = () => {
    if (!selectedItem) return;
    const next = service
      ? moveService(inputState.code, selectedItem.id, moveTo)
      : moveNodeToLane(inputState.code, selectedItem.id, moveTo);
    void apply(next, t('edit.moved', { name: selectedItem.label.trim() }));
  };
  const onIcon = (icon: string) => {
    if (!selectedItem) return;
    const next = service
      ? setServiceIcon(inputState.code, selectedItem.id, icon)
      : setNodeIcon(inputState.code, selectedItem.id, icon);
    void apply(next, t('edit.changed', { name: selectedItem.label.trim() }));
  };
  const onProps = () => {
    if (!kind || !selectedItem) return;
    void apply(
      setObjectFields(inputState.code, kind, selectedItem, propValues),
      t('edit.changed', { name: selectedItem.label.trim() })
    );
  };
  const onMember = (remove: boolean) => {
    if (!kind || !selectedItem || !member) return;
    const next = remove
      ? deleteMember(inputState.code, kind, selectedItem.id, member)
      : setMember(inputState.code, kind, selectedItem.id, member, memberValues);
    void apply(next, t(remove ? 'edit.deleted' : 'edit.changed', { name: member.label.trim() }));
  };
  const optionText = (label: MessageKey, option: string) => {
    const key = `${label}.${option}`;
    return key in messages.en ? t(key as MessageKey) : option;
  };
  const onEdge = (change: (kind: EditKind, edge: EditEdge) => string) => {
    if (!kind || !edge) return;
    void apply(change(kind, edge), t('edit.updated'));
  };

  const choice = (active: boolean) => (active ? 'default' : 'outline');
  const selectClass =
    'h-9 min-w-0 w-full rounded-md border border-input bg-background px-1 text-sm text-foreground';
  const shown = (label: string, id: string) => {
    const text = label.trim();
    return text === id || text === '' ? id : `${label} (${id})`;
  };
</script>

{#snippet detailField(
  field: DetailField,
  value: string,
  set: (value: string) => void,
  testID: string,
  submit: () => void
)}
  <label class="flex items-center gap-1">
    <span class="w-20 shrink-0 text-xs text-muted-foreground">{t(field.label)}</span>
    {#if field.kind === 'choice'}
      <select
        class={selectClass}
        {value}
        data-testid={testID}
        onchange={(event) => set(event.currentTarget.value)}>
        {#each field.options ?? [] as option (option)}
          <option value={option}>{optionText(field.label, option)}</option>
        {/each}
      </select>
    {:else if field.kind === 'item'}
      <select
        class={selectClass}
        {value}
        data-testid={testID}
        onchange={(event) => set(event.currentTarget.value)}>
        <option value="">{t('add.none')}</option>
        {#each field.choices ?? [] as choice (choice.id)}
          <option value={choice.id}>{shown(choice.label, choice.id)}</option>
        {/each}
      </select>
    {:else}
      <Input
        class="h-9"
        type={field.kind === 'text' ? 'text' : field.kind}
        {value}
        data-testid={testID}
        oninput={(event) => set(event.currentTarget.value)}
        onkeydown={(event) => event.key === 'Enter' && submit()} />
    {/if}
  </label>
{/snippet}

<Card title={t('edit.title')} testID={TID.editCard} isStackable icon={{ component: EditIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    {#if !kind}
      <p class="text-muted-foreground">{t('edit.unsupported')}</p>
    {:else}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t(objectsKey)}</span>
        {#if items.length === 0}
          <p class="text-muted-foreground">{t('edit.objectsNone')}</p>
        {:else}
          <select
            bind:value={selected}
            aria-label={t(objectsKey)}
            data-testid={TID.editObjectSelect}
            class={selectClass}>
            {#each items as object (object.id)}
              <option value={object.id}
                >{object.line === undefined
                  ? shown(object.label, object.id)
                  : object.label.replaceAll(' ', ' ')}</option>
            {/each}
          </select>
          <p class="text-xs text-muted-foreground">{t('edit.objectsHint')}</p>
          {#if selectedItem}
            {#if selectedItem.noRename}
              <p class="text-xs text-muted-foreground">{t('edit.noRename')}</p>
            {:else}
              <div class="flex gap-1">
                <Input
                  bind:value={newName}
                  placeholder={t('edit.newName')}
                  aria-label={t('edit.newName')}
                  data-testid={TID.editRenameInput}
                  onkeydown={(event) => event.key === 'Enter' && onRename()} />
                <Button size="sm" class="h-9" data-testid={TID.editRenameButton} onclick={onRename}
                  >{t('edit.rename')}</Button>
              </div>
            {/if}
            {#if props && props.length > 0}
              <div class="flex flex-col gap-1">
                {#each props as field (field.key)}
                  {@render detailField(
                    field,
                    propValues[field.key] ?? '',
                    (value) => (propValues = { ...propValues, [field.key]: value }),
                    `${TID.editProp}-${field.key}`,
                    onProps
                  )}
                {/each}
                <div>
                  <Button size="sm" data-testid={TID.editPropsButton} onclick={onProps}
                    >{t('edit.propsApply')}</Button>
                </div>
              </div>
            {/if}
            {#if node && node.shape !== undefined && !node.icon}
              <div class="flex items-center gap-1">
                <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('edit.shape')}</span>
                <select
                  value={node.shape}
                  aria-label={t('edit.shape')}
                  data-testid={TID.editShapeSelect}
                  class={selectClass}
                  onchange={(event) => onShape(event.currentTarget.value as NodeShape)}>
                  {#if node.shape === 'other'}
                    <option value="other" disabled>{t('edit.shapeOther')}</option>
                  {/if}
                  {#each nodeShapes as option (option)}
                    <option value={option}>{t(`add.shape.${option}`)}</option>
                  {/each}
                </select>
              </div>
            {:else if node?.icon}
              <p class="text-xs text-muted-foreground">{t('edit.shapeIcon')}</p>
            {/if}
            {#if node || service}
              <div class="flex items-center gap-1">
                <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('edit.moveTo')}</span>
                <select
                  bind:value={moveTo}
                  aria-label={t('edit.moveTo')}
                  data-testid={TID.editMoveSelect}
                  class={selectClass}>
                  <option value="">{t(service ? 'edit.noGroup' : 'edit.noLane')}</option>
                  {#each groups as group (group.id)}
                    <option value={group.id}>{shown(group.label, group.id)}</option>
                  {/each}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-9"
                  data-testid={TID.editMoveButton}
                  onclick={onMove}>{t('edit.moveButton')}</Button>
              </div>
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-1">
                  <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('edit.icon')}</span>
                  <span class="min-w-0 flex-1 truncate text-xs" data-testid={TID.editIconCurrent}
                    >{(node?.icon ?? service?.icon)
                      ? t('edit.iconCurrent', { icon: node?.icon ?? service?.icon ?? '' })
                      : t('edit.iconNone')}</span>
                  {#if node?.icon}
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={TID.editIconClear}
                      onclick={() => onIcon('')}>{t('edit.iconClear')}</Button>
                  {/if}
                </div>
                {#key selected}
                  <IconChooser standard={!!service} onpick={onIcon} />
                {/key}
              </div>
            {/if}
            {#if selectedItem.noDelete}
              <p class="text-xs text-muted-foreground">{t('edit.noDelete')}</p>
            {:else}
              <div class="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={TID.editDeleteButton}
                  onclick={() => onDelete(false)}
                  >{selectedItem.group ? t('edit.deleteWith') : t('edit.delete')}</Button>
                {#if selectedItem.group}
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={TID.editDeleteKeepButton}
                    onclick={() => onDelete(true)}>{t('edit.deleteKeep')}</Button>
                {/if}
              </div>
            {/if}
            {#if members}
              <div class="mt-1 flex flex-col gap-1">
                <span class="font-semibold">{t(`edit.members.${kind}` as MessageKey)}</span>
                {#if members.length === 0}
                  <p class="text-xs text-muted-foreground">{t('edit.membersNone')}</p>
                {:else}
                  <select
                    value={member?.id ?? ''}
                    aria-label={t(`edit.members.${kind}` as MessageKey)}
                    data-testid={TID.editMemberSelect}
                    class={selectClass}
                    onchange={(event) => (selectedMember = event.currentTarget.value)}>
                    {#each members as option (option.id)}
                      <option value={option.id}>{option.label}</option>
                    {/each}
                  </select>
                  {#if member}
                    {#each member.fields as field (field.key)}
                      {@render detailField(
                        field,
                        memberValues[field.key] ?? '',
                        (value) => (memberValues = { ...memberValues, [field.key]: value }),
                        `${TID.editMember}-${field.key}`,
                        () => onMember(false)
                      )}
                    {/each}
                    <div class="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        data-testid={TID.editMemberButton}
                        onclick={() => onMember(false)}>{t('edit.memberApply')}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={TID.editMemberDelete}
                        onclick={() => onMember(true)}>{t('edit.memberDelete')}</Button>
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          {/if}
        {/if}
      </div>

      {#if edges}
        <div class="flex flex-col gap-1">
          <span class="font-semibold">{t('edit.edges')}</span>
          {#if edgeItems.length === 0}
            <p class="text-muted-foreground">
              {t(edges.unsure ? 'edit.edgesUnsure' : 'edit.edgesNone')}
            </p>
          {:else}
            <select
              bind:value={selectedEdge}
              aria-label={t('edit.edges')}
              data-testid={TID.editEdgeSelect}
              class={selectClass}>
              {#each edgeItems as item (item.index)}
                <option value={item.index}>{item.title}</option>
              {/each}
            </select>
            <p class="text-xs text-muted-foreground">{t('edit.edgesHint')}</p>
            {#if edge}
              {#if edges.can.label}
                <div class="flex gap-1">
                  <Input
                    bind:value={edgeLabel}
                    placeholder={t('edit.edgeLabel')}
                    aria-label={t('edit.edgeLabel')}
                    data-testid={TID.editEdgeLabel}
                    onkeydown={(event) =>
                      event.key === 'Enter' &&
                      onEdge((k, e) => setEdgeLabel(inputState.code, k, e, edgeLabel))} />
                  <Button
                    size="sm"
                    class="h-9"
                    data-testid={TID.editEdgeLabelButton}
                    onclick={() => onEdge((k, e) => setEdgeLabel(inputState.code, k, e, edgeLabel))}
                    >{t('edit.edgeLabelButton')}</Button>
                </div>
              {/if}
              {#if edges.can.styles.length > 0}
                <div class="flex items-center gap-1">
                  <span class="w-20 shrink-0 text-xs text-muted-foreground"
                    >{t('edit.edgeStyle')}</span>
                  <div class="flex flex-wrap gap-1">
                    {#each edges.can.styles as style (style)}
                      <Button
                        size="sm"
                        variant={choice(edge.style === style)}
                        data-testid={`${TID.editEdgeStyle}-${style}`}
                        onclick={() =>
                          onEdge((k, e) => setEdgeStyle(inputState.code, k, e, style as EdgeStyle))}
                        >{t(`edit.edgeStyle.${style}`)}</Button>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if edges.can.head}
                <div class="flex items-center gap-1">
                  <span class="w-20 shrink-0 text-xs text-muted-foreground"
                    >{t('edit.edgeHead')}</span>
                  <div class="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={choice(edge.head)}
                      data-testid={`${TID.editEdgeHead}-on`}
                      onclick={() => onEdge((k, e) => setEdgeHead(inputState.code, k, e, true))}
                      >{t('edit.edgeHeadOn')}</Button>
                    <Button
                      size="sm"
                      variant={choice(!edge.head)}
                      data-testid={`${TID.editEdgeHead}-off`}
                      onclick={() => onEdge((k, e) => setEdgeHead(inputState.code, k, e, false))}
                      >{t('edit.edgeHeadOff')}</Button>
                  </div>
                </div>
              {/if}
              <div class="flex flex-wrap gap-1">
                {#if edges.can.reverse}
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={TID.editEdgeReverse}
                    onclick={() => onEdge((k, e) => reverseEdge(inputState.code, k, e))}
                    >{t('edit.edgeReverse')}</Button>
                {/if}
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={TID.editEdgeDelete}
                  onclick={() => onEdge((k, e) => deleteEdge(inputState.code, k, e))}
                  >{t('edit.edgeDelete')}</Button>
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      {#if message}
        <p role="status" class="text-muted-foreground" data-testid={TID.editMessage}>{message}</p>
      {/if}
    {/if}
  </div>
  <TableEditor />
</Card>
