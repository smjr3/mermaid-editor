<script lang="ts">
  import AddFormFrame, {
    labelClass,
    rowClass,
    selectClass
  } from '$/components/canvas/AddFormFrame.svelte';
  import InsertItems, { type InsertEntry } from '$/components/canvas/InsertItems.svelte';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { MessageKey } from '$/i18n/messages';
  import { applyToolEdit, type ToolEditResult } from '$/util/codeHealth.svelte';
  import { addArchEdge, addArchGroup, addArchService, type Placement } from '$/util/diagramEdit';
  import { displayName } from '$/util/displayName';
  import { architectureParts, type DiagramObject } from '$/util/mermaid';
  import { settledState } from '$/util/settledState.svelte';
  import { inputState } from '$/util/state.svelte';
  import GroupIcon from '~icons/material-symbols/check-box-outline-blank';
  import EdgeIcon from '~icons/material-symbols/arrow-right-alt-rounded';
  import ServiceIcon from '~icons/material-symbols/category-outline-rounded';

  // Local: the add bar of an architecture diagram — グループ (nested if chosen), サービス
  // (an icon, a group, and joined on a chosen side of another service) and 接続 between
  // two services (diagramEdit.ts), each a form in a popover. The values live here, so a
  // new group is chosen for the next service and the next service follows the last one.
  // `inline` / `moreLabel`: how many entries sit on the bar and what the menu of the rest is
  // called (InsertItems.svelte); none on the bar while the selection's commands take it.
  let { inline = 5, moreLabel }: { inline?: number; moreLabel?: string } = $props();
  let groups = $state<DiagramObject[]>([]);
  let services = $state<DiagramObject[]>([]);
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    let stale = false;
    void architectureParts(code).then((found) => {
      if (stale) return;
      groups = found.groups;
      services = found.services;
    });
    return () => {
      stale = true;
    };
  });

  // mermaid's built-in icons; any other `prefix:name` from the icon packs works too.
  const standardIcons = ['server', 'database', 'disk', 'internet', 'cloud'] as const;
  const places = ['right', 'down', 'left', 'up'] as const;

  let groupName = $state('');
  let groupIcon = $state('cloud');
  let parent = $state('');
  let serviceName = $state('');
  let serviceIcon = $state('server');
  let otherIcon = $state('');
  let group = $state('');
  let from = $state('');
  let place = $state<Placement>('right');
  let arrow = $state(true);
  let edgeFrom = $state('');
  let edgeTo = $state('');
  let edgePlace = $state<Placement>('right');
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
  const onAddGroup = async () => {
    const name = groupName.trim() || t('add.arch.groupDefault');
    const { code, id } = addArchGroup(inputState.code, {
      icon: groupIcon,
      label: name,
      parent: groups.some((item) => item.id === parent) ? parent : undefined
    });
    if (!(await apply(code, name))) return;
    groupName = '';
    group = id;
  };
  const onAddService = async () => {
    const name = serviceName.trim() || t('add.arch.serviceDefault');
    const icon = serviceIcon === 'other' ? otherIcon.trim() : serviceIcon;
    // A group or service deleted in the code may still be chosen here.
    const { code, id } = addArchService(inputState.code, {
      arrow,
      from: services.some((service) => service.id === from) ? from : undefined,
      group: groups.some((item) => item.id === group) ? group : undefined,
      icon,
      label: name,
      place
    });
    if (!(await apply(code, name))) return;
    serviceName = '';
    // The next service most likely follows this one.
    from = id;
  };
  const onAddEdge = async () => {
    const known = (id: string) => services.some((service) => service.id === id);
    if (!known(edgeFrom) || !known(edgeTo) || edgeFrom === edgeTo) {
      message = t('add.arch.edgeChoose');
      return;
    }
    const result = await applyToolEdit(
      addArchEdge(inputState.code, { arrow, from: edgeFrom, place: edgePlace, to: edgeTo })
    );
    message = result === 'applied' ? t('add.arch.edgeDone') : t(said[result]);
  };

  const name = (item: DiagramObject) => displayName(item.label, item.id, [...groups, ...services]);
  const entries: InsertEntry[] = [
    { form: true, icon: GroupIcon, key: 'group', label: t('add.arch.group') },
    { form: true, icon: ServiceIcon, key: 'service', label: t('add.arch.service') },
    { form: true, icon: EdgeIcon, key: 'edge', label: t('add.arch.edge') }
  ];
</script>

{#snippet iconOptions()}
  {#each standardIcons as icon (icon)}
    <option value={icon}>{icon}</option>
  {/each}
{/snippet}

{#snippet itemOptions(items: DiagramObject[])}
  {#each items as item (item.id)}
    <option value={item.id}>{name(item)}</option>
  {/each}
{/snippet}

{#snippet placeSelect(value: Placement, onchange: (next: Placement) => void)}
  <select
    {value}
    class={selectClass}
    data-testid={TID.canvasAddFormField}
    data-key="place"
    onchange={(event) => onchange(event.currentTarget.value as Placement)}>
    {#each places as option (option)}
      <option value={option}>{t(`add.arch.place.${option}`)}</option>
    {/each}
  </select>
{/snippet}

{#snippet arrowCheck()}
  <label class="flex items-center gap-1 text-xs text-muted-foreground">
    <input
      type="checkbox"
      bind:checked={arrow}
      data-testid={TID.canvasAddFormField}
      data-key="arrow" />
    {t('add.arch.arrow')}
  </label>
{/snippet}

<InsertItems {entries} {inline} {moreLabel}>
  {#snippet form(key)}
    {#if key === 'group'}
      <AddFormFrame
        formKey="group"
        title={t('add.arch.group')}
        submitLabel={t('add.arch.groupButton')}
        {message}
        onsubmit={() => void onAddGroup()}>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.groupName')}</span>
          <Input
            class="h-8 min-w-0 flex-1"
            bind:value={groupName}
            placeholder={t('add.arch.groupDefault')}
            data-testid={TID.canvasAddFormField}
            data-key="name" />
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.icon')}</span>
          <select
            bind:value={groupIcon}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="icon">
            {@render iconOptions()}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.inGroup')}</span>
          <select
            bind:value={parent}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="parent">
            <option value="">{t('add.arch.noGroup')}</option>
            {@render itemOptions(groups)}
          </select>
        </label>
      </AddFormFrame>
    {:else if key === 'service'}
      <AddFormFrame
        formKey="service"
        title={t('add.arch.service')}
        submitLabel={t('add.arch.serviceButton')}
        {message}
        onsubmit={() => void onAddService()}>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.serviceName')}</span>
          <Input
            class="h-8 min-w-0 flex-1"
            bind:value={serviceName}
            placeholder={t('add.arch.serviceDefault')}
            data-testid={TID.canvasAddFormField}
            data-key="name" />
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.icon')}</span>
          <select
            bind:value={serviceIcon}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="icon">
            {@render iconOptions()}
            <option value="other">{t('add.arch.iconOther')}</option>
          </select>
        </label>
        {#if serviceIcon === 'other'}
          <label class={rowClass}>
            <span class={labelClass}>{t('add.arch.iconOther')}</span>
            <Input
              class="h-8 min-w-0 flex-1"
              bind:value={otherIcon}
              placeholder={t('add.arch.iconOtherHint')}
              data-testid={TID.canvasAddFormField}
              data-key="otherIcon" />
          </label>
        {/if}
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.inGroup')}</span>
          <select
            bind:value={group}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="group">
            <option value="">{t('add.arch.noGroup')}</option>
            {@render itemOptions(groups)}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.from')}</span>
          <select
            bind:value={from}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="from">
            <option value="">{t('add.noArrow')}</option>
            {@render itemOptions(services)}
          </select>
        </label>
        {#if from}
          <label class={rowClass}>
            <span class={labelClass}>{t('add.arch.placement')}</span>
            {@render placeSelect(place, (next) => (place = next))}
          </label>
        {/if}
        {@render arrowCheck()}
      </AddFormFrame>
    {:else if key === 'edge'}
      <AddFormFrame
        formKey="edge"
        title={t('add.arch.edge')}
        submitLabel={t('add.arch.edgeButton')}
        {message}
        onsubmit={() => void onAddEdge()}>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.edgeFrom')}</span>
          <select
            bind:value={edgeFrom}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="from">
            <option value=""></option>
            {@render itemOptions(services)}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.edgeTo')}</span>
          <select
            bind:value={edgeTo}
            class={selectClass}
            data-testid={TID.canvasAddFormField}
            data-key="to">
            <option value=""></option>
            {@render itemOptions(services)}
          </select>
        </label>
        <label class={rowClass}>
          <span class={labelClass}>{t('add.arch.placement')}</span>
          {@render placeSelect(edgePlace, (next) => (edgePlace = next))}
        </label>
        {@render arrowCheck()}
      </AddFormFrame>
    {/if}
  {/snippet}
</InsertItems>
