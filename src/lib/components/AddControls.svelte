<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { listGroups } from '$/util/colors';
  import { addLane, addNode, canAdd } from '$/util/diagramEdit';
  import { diagramObjects, type DiagramObject } from '$/util/mermaid';
  import { inputState, updateCode, validatedState } from '$/util/state.svelte';
  import AddIcon from '~icons/material-symbols/add-box-outline-rounded';

  // Local: add a lane, or a node (in a lane, joined from another node), without
  // writing the syntax (diagramEdit.ts).
  const enabled = $derived(canAdd(inputState.code));
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

  let laneName = $state('');
  let nodeName = $state('');
  let lane = $state('');
  let from = $state('');
  let message = $state('');

  const apply = (code: string, name: string) => {
    updateCode(code, { updateDiagram: true });
    message = t('add.done', { name });
  };
  const onAddLane = () => {
    const name = laneName.trim() || t('add.laneDefault');
    const { code, id } = addLane(inputState.code, name);
    apply(code, name);
    laneName = '';
    lane = id;
  };
  const onAddNode = () => {
    const name = nodeName.trim() || t('add.nodeDefault');
    const { code, id } = addNode(inputState.code, {
      from: from || undefined,
      label: name,
      lane: lane || undefined
    });
    apply(code, name);
    nodeName = '';
    // The next node most likely follows this one.
    from = id;
  };

  const selectClass =
    'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
</script>

<Card title={t('add.title')} testID={TID.addCard} isStackable icon={{ component: AddIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    {#if !enabled}
      <p class="text-muted-foreground">{t('add.unsupported')}</p>
    {:else}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('add.lane')}</span>
        <div class="flex gap-1">
          <Input
            bind:value={laneName}
            placeholder={t('add.laneDefault')}
            aria-label={t('add.laneName')}
            data-testid={TID.addLaneName}
            onkeydown={(event) => event.key === 'Enter' && onAddLane()} />
          <Button size="sm" class="h-9" data-testid={TID.addLaneButton} onclick={onAddLane}
            >{t('add.laneButton')}</Button>
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
          <span class="w-20 shrink-0 text-xs text-muted-foreground">{t('add.nodeLane')}</span>
          <select bind:value={lane} class={selectClass} data-testid={TID.addNodeLane}>
            <option value="">{t('add.noLane')}</option>
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
      {#if message}
        <p role="status" class="text-muted-foreground" data-testid={TID.addMessage}>{message}</p>
      {/if}
    {/if}
  </div>
</Card>
