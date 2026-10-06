<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { addArchEdge, addArchGroup, addArchService, type Placement } from '$/util/diagramEdit';
  import { architectureParts, type DiagramObject } from '$/util/mermaid';
  import { inputState, updateCode } from '$/util/state.svelte';
  import { settledState } from '$/util/settledState.svelte';

  // Local: the Add card for architecture diagrams — groups, services joined on a
  // chosen side, and edges between services (diagramEdit.ts).
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

  const apply = (code: string, name: string) => {
    updateCode(code, { updateDiagram: true });
    message = t('add.done', { name });
  };
  const onAddGroup = () => {
    const name = groupName.trim() || t('add.arch.groupDefault');
    const { code, id } = addArchGroup(inputState.code, {
      icon: groupIcon,
      label: name,
      parent: groups.some((item) => item.id === parent) ? parent : undefined
    });
    apply(code, name);
    groupName = '';
    group = id;
  };
  const onAddService = () => {
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
    apply(code, name);
    serviceName = '';
    // The next service most likely follows this one.
    from = id;
  };
  const onAddEdge = () => {
    const known = (id: string) => services.some((service) => service.id === id);
    if (!known(edgeFrom) || !known(edgeTo) || edgeFrom === edgeTo) {
      message = t('add.arch.edgeChoose');
      return;
    }
    updateCode(
      addArchEdge(inputState.code, { arrow, from: edgeFrom, place: edgePlace, to: edgeTo }),
      {
        updateDiagram: true
      }
    );
    message = t('add.arch.edgeDone');
  };

  const selectClass =
    'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
  const labelClass = 'w-24 shrink-0 text-xs text-muted-foreground';
  const name = (item: DiagramObject) =>
    item.label === item.id ? item.label : `${item.label} (${item.id})`;
</script>

{#snippet iconOptions()}
  {#each standardIcons as icon (icon)}
    <option value={icon}>{t(`add.arch.icon.${icon}`)}</option>
  {/each}
{/snippet}

{#snippet placeSelect(value: Placement, onchange: (next: Placement) => void, testID: string)}
  <select
    {value}
    class={selectClass}
    data-testid={testID}
    onchange={(event) => onchange(event.currentTarget.value as Placement)}>
    {#each places as option (option)}
      <option value={option}>{t(`add.arch.place.${option}`)}</option>
    {/each}
  </select>
{/snippet}

<div class="flex flex-col gap-1">
  <span class="font-semibold">{t('add.arch.service')}</span>
  <div class="flex gap-1">
    <Input
      bind:value={serviceName}
      placeholder={t('add.arch.serviceDefault')}
      aria-label={t('add.arch.serviceName')}
      data-testid={TID.addArchServiceName}
      onkeydown={(event) => event.key === 'Enter' && onAddService()} />
    <Button size="sm" class="h-9" data-testid={TID.addArchServiceButton} onclick={onAddService}
      >{t('add.arch.serviceButton')}</Button>
  </div>
  <div class="flex items-center gap-1">
    <span class={labelClass}>{t('add.arch.icon')}</span>
    <select bind:value={serviceIcon} class={selectClass} data-testid={TID.addArchServiceIcon}>
      {@render iconOptions()}
      <option value="other">{t('add.arch.iconOther')}</option>
    </select>
  </div>
  {#if serviceIcon === 'other'}
    <Input
      bind:value={otherIcon}
      placeholder={t('add.arch.iconOtherHint')}
      aria-label={t('add.arch.iconOther')}
      data-testid={TID.addArchServiceOtherIcon} />
  {/if}
  <div class="flex items-center gap-1">
    <span class={labelClass}>{t('add.arch.inGroup')}</span>
    <select bind:value={group} class={selectClass} data-testid={TID.addArchServiceGroup}>
      <option value="">{t('add.arch.noGroup')}</option>
      {#each groups as item (item.id)}
        <option value={item.id}>{name(item)}</option>
      {/each}
    </select>
  </div>
  <div class="flex items-center gap-1">
    <span class={labelClass}>{t('add.arch.from')}</span>
    <select bind:value={from} class={selectClass} data-testid={TID.addArchServiceFrom}>
      <option value="">{t('add.noArrow')}</option>
      {#each services as item (item.id)}
        <option value={item.id}>{name(item)}</option>
      {/each}
    </select>
  </div>
  {#if from}
    <div class="flex items-center gap-1">
      <span class={labelClass}>{t('add.arch.placement')}</span>
      {@render placeSelect(place, (next) => (place = next), TID.addArchServicePlace)}
    </div>
  {/if}
  <label class="flex items-center gap-1 text-xs text-muted-foreground">
    <input type="checkbox" bind:checked={arrow} data-testid={TID.addArchArrow} />
    {t('add.arch.arrow')}
  </label>
</div>

<div class="flex flex-col gap-1">
  <span class="font-semibold">{t('add.arch.group')}</span>
  <div class="flex gap-1">
    <Input
      bind:value={groupName}
      placeholder={t('add.arch.groupDefault')}
      aria-label={t('add.arch.groupName')}
      data-testid={TID.addArchGroupName}
      onkeydown={(event) => event.key === 'Enter' && onAddGroup()} />
    <Button size="sm" class="h-9" data-testid={TID.addArchGroupButton} onclick={onAddGroup}
      >{t('add.arch.groupButton')}</Button>
  </div>
  <div class="flex items-center gap-1">
    <span class={labelClass}>{t('add.arch.icon')}</span>
    <select bind:value={groupIcon} class={selectClass} data-testid={TID.addArchGroupIcon}>
      {@render iconOptions()}
    </select>
  </div>
  <div class="flex items-center gap-1">
    <span class={labelClass}>{t('add.arch.inGroup')}</span>
    <select bind:value={parent} class={selectClass} data-testid={TID.addArchGroupParent}>
      <option value="">{t('add.arch.noGroup')}</option>
      {#each groups as item (item.id)}
        <option value={item.id}>{name(item)}</option>
      {/each}
    </select>
  </div>
</div>

{#if services.length > 1}
  <div class="flex flex-col gap-1">
    <span class="font-semibold">{t('add.arch.edge')}</span>
    <div class="flex items-center gap-1">
      <span class={labelClass}>{t('add.arch.edgeFrom')}</span>
      <select bind:value={edgeFrom} class={selectClass} data-testid={TID.addArchEdgeFrom}>
        <option value=""></option>
        {#each services as item (item.id)}
          <option value={item.id}>{name(item)}</option>
        {/each}
      </select>
    </div>
    <div class="flex items-center gap-1">
      <span class={labelClass}>{t('add.arch.edgeTo')}</span>
      <select bind:value={edgeTo} class={selectClass} data-testid={TID.addArchEdgeTo}>
        <option value=""></option>
        {#each services as item (item.id)}
          <option value={item.id}>{name(item)}</option>
        {/each}
      </select>
    </div>
    <div class="flex items-center gap-1">
      <span class={labelClass}>{t('add.arch.placement')}</span>
      {@render placeSelect(edgePlace, (next) => (edgePlace = next), TID.addArchEdgePlace)}
    </div>
    <div>
      <Button size="sm" variant="outline" data-testid={TID.addArchEdgeButton} onclick={onAddEdge}
        >{t('add.arch.edgeButton')}</Button>
    </div>
  </div>
{/if}

{#if message}
  <p role="status" class="text-muted-foreground" data-testid={TID.addMessage}>{message}</p>
{/if}
