<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { listGroups } from '$/util/colors';
  import AddActions from '$/components/AddActions.svelte';
  import ArchitectureAdd from '$/components/ArchitectureAdd.svelte';
  import { specFor } from '$/util/addActions';
  import {
    addEdge,
    addLane,
    addNode,
    canAdd,
    headerLine,
    isArchitecture,
    nodeShapes,
    type NodeShape
  } from '$/util/diagramEdit';
  import { diagramObjects, type DiagramObject } from '$/util/mermaid';
  import { templateNotice } from '$/util/templateNotice.svelte';
  import { applyToolEdit, type ToolEditResult } from '$/util/codeHealth.svelte';
  import { inputState, validatedState } from '$/util/state.svelte';
  import AddIcon from '~icons/material-symbols/add-box-outline-rounded';

  // Local: add a lane, or a node (in a lane, joined from another node), without
  // writing the syntax (diagramEdit.ts); architecture diagrams get ArchitectureAdd, the rest AddActions.
  const enabled = $derived(canAdd(inputState.code));
  const architecture = $derived(isArchitecture(inputState.code));
  const spec = $derived(specFor(inputState.code));
  const groups = $derived(listGroups(inputState.code));
  let nodes = $state<DiagramObject[]>([]);
  $effect(() => {
    const { code, error } = validatedState.current;
    if (error) return;
    let stale = false;
    void diagramObjects(code).then((found) => {
      if (!stale) nodes = found?.kind === 'flowchart' ? found.items : [];
    });
    return () => {
      stale = true;
    };
  });

  // Swimlane diagrams have lanes; a flowchart's `subgraph` is a group.
  const word = $derived(/^\s*swimlane-beta\b/.test(headerLine(inputState.code)) ? 'lane' : 'group');
  let laneName = $state('');
  let nodeName = $state('');
  let lane = $state('');
  let from = $state('');
  let shape = $state<NodeShape>('rect');
  let edgeFrom = $state('');
  let edgeTo = $state('');
  let edgeLabel = $state('');
  let message = $state('');

  // Local: checked and refused while the code has an error (codeHealth.svelte.ts).
  const said: Record<Exclude<ToolEditResult, 'applied'>, MessageKey> = {
    blocked: 'recover.blocked',
    refused: 'add.breaks',
    unchanged: 'add.breaks'
  };
  const apply = async (code: string, name: string): Promise<boolean> => {
    const result = await applyToolEdit(code);
    message = result === 'applied' ? t('add.done', { name }) : t(said[result]);
    return result === 'applied';
  };
  const onAddLane = async () => {
    const name = laneName.trim() || t(`add.${word}Default`);
    const { code, id } = addLane(inputState.code, name);
    if (!(await apply(code, name))) return;
    laneName = '';
    lane = id;
  };
  const onAddNode = async () => {
    const name = nodeName.trim() || t('add.nodeDefault');
    // A lane or node deleted in the code may still be chosen here.
    const { code, id } = addNode(inputState.code, {
      from: nodes.some((node) => node.id === from) ? from : undefined,
      label: name,
      lane: groups.some((group) => group.id === lane) ? lane : undefined,
      shape
    });
    if (!(await apply(code, name))) return;
    nodeName = '';
    // The next node most likely follows this one.
    from = id;
  };

  const onAddEdge = async () => {
    const known = (id: string) => nodes.some((node) => node.id === id);
    if (!known(edgeFrom) || !known(edgeTo)) {
      message = t('add.choose');
      return;
    }
    const result = await applyToolEdit(
      addEdge(inputState.code, { from: edgeFrom, label: edgeLabel, to: edgeTo })
    );
    if (result !== 'applied') {
      message = t(said[result]);
      return;
    }
    message = t('add.arch.edgeDone');
    edgeLabel = '';
  };

  const selectClass =
    'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
</script>

<Card title={t('add.title')} testID={TID.addCard} isStackable icon={{ component: AddIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    {#if templateNotice.message}
      <p role="status" class="text-muted-foreground" data-testid={TID.templateFormsMessage}>
        {templateNotice.message}
      </p>
    {/if}
    {#if architecture}
      <ArchitectureAdd />
    {:else if spec}
      {#key spec.kind}
        <AddActions {spec} />
      {/key}
    {:else if !enabled}
      <p class="text-muted-foreground">{t('add.unsupported')}</p>
    {:else}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t(`add.${word}`)}</span>
        <div class="flex gap-1">
          <Input
            bind:value={laneName}
            placeholder={t(`add.${word}Default`)}
            aria-label={t(`add.${word}Name`)}
            data-testid={TID.addLaneName}
            onkeydown={(event) => event.key === 'Enter' && onAddLane()} />
          <Button size="sm" class="h-9" data-testid={TID.addLaneButton} onclick={onAddLane}
            >{t(`add.${word}Button`)}</Button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('add.node')}</span>
        <div class="flex gap-1">
          <Input
            bind:value={nodeName}
            placeholder={t('add.nodeDefault')}
            aria-label={t('add.nodeName')}
            data-testid={TID.addNodeName}
            onkeydown={(event) => event.key === 'Enter' && onAddNode()} />
          <Button size="sm" class="h-9" data-testid={TID.addNodeButton} onclick={onAddNode}
            >{t('add.nodeButton')}</Button>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('add.nodeShape')}</span>
          <select bind:value={shape} class={selectClass} data-testid={TID.addNodeShape}>
            {#each nodeShapes as option (option)}
              <option value={option}>{t(`add.shape.${option}`)}</option>
            {/each}
          </select>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-20 shrink-0 text-xs text-muted-foreground"
            >{t(`add.node${word === 'lane' ? 'Lane' : 'Group'}`)}</span>
          <select bind:value={lane} class={selectClass} data-testid={TID.addNodeLane}>
            <option value="">{t(`add.no${word === 'lane' ? 'Lane' : 'Group'}`)}</option>
            {#each groups as group (group.id)}
              <option value={group.id}>{group.label}</option>
            {/each}
          </select>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('add.nodeFrom')}</span>
          <select bind:value={from} class={selectClass} data-testid={TID.addNodeFrom}>
            <option value="">{t('add.noArrow')}</option>
            {#each nodes as node (node.id)}
              <option value={node.id}
                >{node.label}{node.label === node.id ? '' : ` (${node.id})`}</option>
            {/each}
          </select>
        </div>
      </div>
      {#if nodes.length > 1}
        <div class="flex flex-col gap-1">
          <span class="font-semibold">{t('add.arch.edge')}</span>
          <div class="flex items-center gap-1">
            <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('add.f.from')}</span>
            <select bind:value={edgeFrom} class={selectClass} data-testid={TID.addEdgeFrom}>
              <option value=""></option>
              {#each nodes as node (node.id)}
                <option value={node.id}
                  >{node.label}{node.label === node.id ? '' : ` (${node.id})`}</option>
              {/each}
            </select>
          </div>
          <div class="flex items-center gap-1">
            <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('add.f.to')}</span>
            <select bind:value={edgeTo} class={selectClass} data-testid={TID.addEdgeTo}>
              <option value=""></option>
              {#each nodes as node (node.id)}
                <option value={node.id}
                  >{node.label}{node.label === node.id ? '' : ` (${node.id})`}</option>
              {/each}
            </select>
          </div>
          <div class="flex gap-1">
            <Input
              bind:value={edgeLabel}
              placeholder={t('add.f.text')}
              aria-label={t('add.f.text')}
              data-testid={TID.addEdgeLabel}
              onkeydown={(event) => event.key === 'Enter' && onAddEdge()} />
            <Button
              size="sm"
              variant="outline"
              class="h-9"
              data-testid={TID.addEdgeButton}
              onclick={onAddEdge}>{t('add.connectButton')}</Button>
          </div>
        </div>
      {/if}
      {#if message}
        <p role="status" class="text-muted-foreground" data-testid={TID.addMessage}>{message}</p>
      {/if}
    {/if}
  </div>
</Card>
