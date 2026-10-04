<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
    clearColors,
    colorAllGroups,
    getStyleColor,
    getLineColor,
    getTheme,
    lineColors,
    listGroups,
    setStyleColor,
    setLineColor,
    setTheme,
    swatches,
    themeChoices,
    tint,
    type Swatch,
    type ThemeChoice
  } from '$/util/colors';
  import { flowNodes } from '$/util/mermaid';
  import { inputState, updateCode, updateConfig, validatedState } from '$/util/state.svelte';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  // Local: the theme, the line colour, and lane and node colours (colors.ts). The
  // theme and line colour go in the config, lane and node colours in the code as
  // `style` statements, so a shared link keeps them.
  const theme = $derived(getTheme(inputState.mermaid));
  const lineColor = $derived(getLineColor(inputState.mermaid));
  const groups = $derived(listGroups(inputState.code));

  const applyTheme = (next: ThemeChoice) => updateConfig(setTheme(inputState.mermaid, next));
  const applyLine = (next: string | undefined) =>
    updateConfig(setLineColor(inputState.mermaid, next));
  const applyCode = (code: string) => updateCode(code, { updateDiagram: true });
  const applyColor = (id: string, swatch: Swatch | undefined) =>
    applyCode(setStyleColor(inputState.code, id, swatch));

  // Nodes come from mermaid's own parse of the last valid code.
  let nodes = $state<{ id: string; label: string }[]>([]);
  let selected = $state('');
  $effect(() => {
    const { code, error } = validatedState.current;
    if (error) return;
    let stale = false;
    void flowNodes(code).then((found) => {
      if (stale) return;
      nodes = found;
      if (!found.some(({ id }) => id === selected)) selected = found[0]?.id ?? '';
    });
    return () => {
      stale = true;
    };
  });
  const selectedNode = $derived(nodes.find(({ id }) => id === selected));

  // A click on a node in the diagram picks it (mermaid ids it `<svg>-flowchart-<id>-<n>`).
  $effect(() => {
    const pick = (event: MouseEvent) => {
      const node = (event.target as Element | null)?.closest?.('#view .node');
      const id = node && /-flowchart-(.+)-\d+$/.exec(node.id)?.[1];
      if (id && nodes.some((candidate) => candidate.id === id)) selected = id;
    };
    document.addEventListener('click', pick);
    return () => document.removeEventListener('click', pick);
  });

  const choice = (active: boolean) => (active ? 'default' : 'outline');
  const isCustomTheme = $derived(
    theme !== 'auto' && !(themeChoices as readonly string[]).includes(theme)
  );
</script>

{#snippet dot(
  fill: string,
  stroke: string,
  active: boolean,
  label: string,
  testID: string,
  onclick: () => void
)}
  <button
    type="button"
    class={[
      'size-6 shrink-0 rounded-full border-2 outline-offset-2',
      active && 'outline-2 outline-foreground'
    ]}
    style:background-color={fill}
    style:border-color={stroke}
    title={label}
    aria-label={label}
    aria-pressed={active}
    data-testid={testID}
    {onclick}></button>
{/snippet}

{#snippet palette(id: string, label: string, testID: string)}
  {@const current = getStyleColor(inputState.code, id)}
  <div class="flex flex-wrap items-center gap-1.5">
    {@render dot(
      'transparent',
      'var(--border)',
      current === undefined,
      t('colors.groupClear'),
      `${testID}-none`,
      () => applyColor(id, undefined)
    )}
    {#each swatches as swatch (swatch.name)}
      {@render dot(
        swatch.fill,
        swatch.stroke,
        current?.stroke === swatch.stroke && current.fill === swatch.fill,
        t(`colors.swatch.${swatch.name}`),
        `${testID}-${swatch.name}`,
        () => applyColor(id, swatch)
      )}
    {/each}
    <input
      type="color"
      class="h-6 w-8 cursor-pointer rounded border bg-transparent"
      value={current?.stroke && /^#[\da-f]{6}$/i.test(current.stroke) ? current.stroke : '#3b73c9'}
      title={t('colors.custom')}
      aria-label={`${label}: ${t('colors.custom')}`}
      data-testid={`${testID}-custom`}
      onchange={(event) => {
        const stroke = event.currentTarget.value;
        applyColor(id, { fill: tint(stroke), stroke });
      }} />
  </div>
{/snippet}

<Card
  title={t('colors.title')}
  testID={TID.colorsCard}
  isStackable
  icon={{ component: PaletteIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('colors.theme')}</span>
      <div class="flex flex-wrap gap-1">
        {#each ['auto', ...themeChoices] as const as id (id)}
          <Button
            size="sm"
            variant={choice(theme === id)}
            data-testid={`${TID.colorsTheme}-${id}`}
            onclick={() => applyTheme(id)}>{t(`colors.theme.${id}`)}</Button>
        {/each}
      </div>
      <p class="text-xs text-muted-foreground">
        {isCustomTheme ? t('colors.themeCustom', { theme }) : t('colors.themeAutoHint')}
      </p>
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('colors.line')}</span>
      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={choice(lineColor === undefined)}
          data-testid={TID.colorsLineDefault}
          onclick={() => applyLine(undefined)}>{t('colors.lineDefault')}</Button>
        {#each lineColors as color (color)}
          {@render dot(color, color, lineColor === color, color, `${TID.colorsLine}-${color}`, () =>
            applyLine(color)
          )}
        {/each}
        <input
          type="color"
          class="h-6 w-8 cursor-pointer rounded border bg-transparent"
          value={lineColor ?? '#333333'}
          title={t('colors.custom')}
          aria-label={`${t('colors.line')}: ${t('colors.custom')}`}
          data-testid={TID.colorsLineCustom}
          onchange={(event) => applyLine(event.currentTarget.value)} />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('colors.groups')}</span>
      {#if groups.length === 0}
        <p class="text-muted-foreground">{t('colors.groupsNone')}</p>
      {:else}
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsGroupsAuto}
            onclick={() => applyCode(colorAllGroups(inputState.code))}
            >{t('colors.groupsAuto')}</Button>
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsGroupsClear}
            onclick={() => applyCode(colorAllGroups(inputState.code, true))}
            >{t('colors.groupsClear')}</Button>
        </div>
        <ul class="flex flex-col gap-2">
          {#each groups as group (group.id)}
            <li class="flex flex-col gap-1">
              <span class="truncate" title={group.id}>{group.label}</span>
              {@render palette(group.id, group.label, `${TID.colorsGroup}-${group.id}`)}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if nodes.length > 0}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('colors.nodes')}</span>
        <select
          bind:value={selected}
          aria-label={t('colors.nodes')}
          data-testid={TID.colorsNodeSelect}
          class="h-9 rounded-md border border-input bg-background px-1 text-sm text-foreground">
          {#each nodes as node (node.id)}
            <option value={node.id}
              >{getStyleColor(inputState.code, node.id) ? '● ' : ''}{node.label}{node.label ===
              node.id
                ? ''
                : ` (${node.id})`}</option>
          {/each}
        </select>
        {#if selectedNode}
          {@render palette(selectedNode.id, selectedNode.label, TID.colorsNode)}
        {/if}
        <p class="text-xs text-muted-foreground">{t('colors.nodesHint')}</p>
        <div>
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsNodesClear}
            onclick={() =>
              applyCode(
                clearColors(
                  inputState.code,
                  nodes.map(({ id }) => id)
                )
              )}>{t('colors.nodesClear')}</Button>
        </div>
      </div>
    {/if}
  </div>
</Card>
