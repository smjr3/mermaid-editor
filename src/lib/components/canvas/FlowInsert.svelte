<script lang="ts">
  import AddFormFrame, {
    labelClass,
    rowClass,
    selectClass
  } from '$/components/canvas/AddFormFrame.svelte';
  import { beginConnect, connecting, stopConnect } from '$/components/canvas/connectMode.svelte';
  import InsertItems, { type InsertEntry } from '$/components/canvas/InsertItems.svelte';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { applyToolEdit, type ToolEditResult } from '$/util/codeHealth.svelte';
  import { listGroups } from '$/util/colors';
  import {
    addEdge,
    addLane,
    addNode,
    headerLine,
    nodeShapes,
    type NodeShape
  } from '$/util/diagramEdit';
  import { editableEdges } from '$/util/diagramModify';
  import { displayName } from '$/util/displayName';
  import { insertLane, insertShape } from '$/util/insertActions';
  import { diagramObjects, type DiagramObject } from '$/util/mermaid';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import { inputState } from '$/util/state.svelte';
  import ConnectIcon from '~icons/material-symbols/arrow-right-alt-rounded';
  import CircleIcon from '~icons/material-symbols/circle-outline';
  import DiamondIcon from '~icons/material-symbols/diamond-outline-rounded';
  import StadiumIcon from '~icons/material-symbols/pill-outline';
  import RectIcon from '~icons/material-symbols/rectangle-outline-rounded';
  import RoundedIcon from '~icons/material-symbols/rounded-corner';
  import LaneIcon from '~icons/material-symbols/view-week-outline-rounded';

  // Local: the add bar of a flowchart or swimlane diagram. 処理 / 分岐 / 開始・終了 / レーン add
  // at once (insertActions.ts): joined after the selected shape, into the selected lane, or
  // on their own, then selected with their name open for typing (selectionModel.insert).
  // 矢印 joins two shapes by clicking them. Under その他: the other shapes, and the Add
  // card's forms — a shape with its name, shape, lane and the shape it is joined from; a
  // named lane; an arrow between two existing shapes with a label.
  // `inline` / `moreLabel`: how many entries sit on the bar and what the menu of the rest is
  // called (InsertItems.svelte); none on the bar while the selection's commands take it.
  let { inline = 5, moreLabel }: { inline?: number; moreLabel?: string } = $props();
  const lanes = $derived(/^\s*swimlane-beta\b/.test(headerLine(inputState.code)));
  // Swimlane diagrams have lanes; a flowchart's `subgraph` is a group.
  const word = $derived(lanes ? 'lane' : 'group');
  const groups = $derived(listGroups(inputState.code));
  let nodes = $state<DiagramObject[]>([]);
  // The arrows there are, so the same arrow is not added twice.
  let edges = $state<{ from: string; to: string; label: string }[]>([]);
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    let stale = false;
    void diagramObjects(code).then((found) => {
      if (!stale) nodes = found?.kind === 'flowchart' ? found.items : [];
    });
    void editableEdges(code).then((found) => {
      if (!stale) edges = found?.kind === 'flowchart' ? found.items : [];
    });
    return () => {
      stale = true;
    };
  });

  // ---- One click: a shape or a lane, selected afterwards ----

  /** The selected flowchart object a new shape is joined from or put into. */
  const selected = () => (model.kind === 'flowchart' ? model.object : undefined);
  const defaultLabel = (shape: NodeShape) => {
    if (shape === 'diamond') return t('canvas.defaultDecision');
    // 開始・終了: a start on its own, an end after something.
    if (shape === 'stadium') return t(selected() ? 'canvas.defaultEnd' : 'canvas.defaultStart');
    return t('canvas.defaultProcess');
  };
  const addShape = (shape: NodeShape) => {
    stopConnect();
    void model.insert(insertShape(inputState.code, shape, defaultLabel(shape), selected()));
  };
  const addLaneNow = () => {
    stopConnect();
    void model.insert(insertLane(inputState.code, t(`add.${word}Default`)));
  };
  const toggleConnect = () => {
    if (connecting()) {
      stopConnect();
      return;
    }
    beginConnect(model.canConnect && model.kind === 'flowchart');
  };

  // ---- The Add card's forms ----

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
    stale: 'edit.stale',
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
    // The next shape most likely goes into the new lane.
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
    // A second arrow between the same nodes only makes sense with another label.
    const text = edgeLabel.trim();
    const same = (edge: { from: string; to: string; label: string }) =>
      edge.from === edgeFrom && edge.to === edgeTo && (!text || edge.label.trim() === text);
    if (edges.some(same)) {
      const name = (id: string) => nodes.find((node) => node.id === id)?.label.trim() || id;
      message = t('sel.alreadyConnected', { from: name(edgeFrom), to: name(edgeTo) });
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

  const entries = $derived<InsertEntry[]>([
    {
      icon: RectIcon,
      key: 'rect',
      label: t('canvas.process'),
      run: () => addShape('rect'),
      title: t('canvas.insertHint')
    },
    {
      icon: DiamondIcon,
      key: 'diamond',
      label: t('canvas.decision'),
      run: () => addShape('diamond'),
      title: t('canvas.insertHint')
    },
    {
      icon: StadiumIcon,
      key: 'stadium',
      label: t('canvas.terminal'),
      run: () => addShape('stadium'),
      title: t('canvas.insertHint')
    },
    {
      icon: LaneIcon,
      key: 'lane',
      label: t(lanes ? 'canvas.lane' : 'canvas.group'),
      run: addLaneNow
    },
    {
      icon: ConnectIcon,
      key: 'connect',
      label: t('canvas.connect'),
      pressed: connecting(),
      run: toggleConnect,
      title: t('canvas.connectHint')
    },
    {
      icon: RoundedIcon,
      key: 'rounded',
      label: t('add.shape.rounded'),
      run: () => addShape('rounded')
    },
    {
      icon: CircleIcon,
      key: 'circle',
      label: t('add.shape.circle'),
      run: () => addShape('circle')
    },
    { form: true, key: 'node', label: t('canvas.nodeForm') },
    { form: true, key: 'laneForm', label: t(lanes ? 'canvas.laneForm' : 'canvas.groupForm') },
    ...(nodes.length > 1 ? [{ form: true, key: 'edge', label: t('canvas.edgeForm') }] : [])
  ]);

  const name = (node: DiagramObject) => displayName(node.label, node.id, nodes);
</script>

{#snippet nodeOptions()}
  {#each nodes as node (node.id)}
    <option value={node.id}>{name(node)}</option>
  {/each}
{/snippet}

<InsertItems {entries} {inline} {moreLabel}>
  {#snippet form(key)}
    {#if key === 'node'}
      <AddFormFrame
        formKey="node"
        title={t('add.node')}
        submitLabel={t('add.nodeButton')}
        {message}
        onsubmit={() => void onAddNode()}>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.nodeName')}</span>
          <Input
            class="h-8 min-w-0 flex-1"
            bind:value={nodeName}
            placeholder={t('add.nodeDefault')}
            data-testid={TID.canvasAddFormField}
            data-key="name" />
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.nodeShape')}</span>
          <select
            bind:value={shape}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="shape">
            {#each nodeShapes as option (option)}
              <option value={option}>{t(`add.shape.${option}`)}</option>
            {/each}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t(lanes ? 'add.nodeLane' : 'add.nodeGroup')}</span>
          <select
            bind:value={lane}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="lane">
            <option value="">{t(lanes ? 'add.noLane' : 'add.noGroup')}</option>
            {#each groups as group (group.id)}
              <option value={group.id}>{group.label}</option>
            {/each}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.nodeFrom')}</span>
          <select
            bind:value={from}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="from">
            <option value="">{t('add.noArrow')}</option>
            {@render nodeOptions()}
          </select>
        </label>
      </AddFormFrame>
    {:else if key === 'laneForm'}
      <AddFormFrame
        formKey="lane"
        title={t(`add.${word}`)}
        submitLabel={t(`add.${word}Button`)}
        {message}
        onsubmit={() => void onAddLane()}>
        <label class={rowClass}>
          <span class={labelClass}>{t(`add.${word}Name`)}</span>
          <Input
            class="h-8 min-w-0 flex-1"
            bind:value={laneName}
            placeholder={t(`add.${word}Default`)}
            data-testid={TID.canvasAddFormField}
            data-key="name" />
        </label>
      </AddFormFrame>
    {:else if key === 'edge'}
      <AddFormFrame
        formKey="edge"
        title={t('add.arch.edge')}
        submitLabel={t('add.connectButton')}
        {message}
        onsubmit={() => void onAddEdge()}>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.f.from')}</span>
          <select
            bind:value={edgeFrom}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="from">
            <option value=""></option>
            {@render nodeOptions()}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.f.to')}</span>
          <select
            bind:value={edgeTo}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="to">
            <option value=""></option>
            {@render nodeOptions()}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.f.text')}</span>
          <Input
            class="h-8 min-w-0 flex-1"
            bind:value={edgeLabel}
            placeholder={t('add.f.text')}
            data-testid={TID.canvasAddFormField}
            data-key="label" />
        </label>
      </AddFormFrame>
    {/if}
  {/snippet}
</InsertItems>
