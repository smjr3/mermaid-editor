<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
    colorAllGroups,
    getGroupColor,
    getLineColor,
    getTheme,
    lineColors,
    listGroups,
    setGroupColor,
    setLineColor,
    setTheme,
    swatches,
    themeChoices,
    tint,
    type Swatch,
    type ThemeChoice
  } from '$/util/colors';
  import { inputState, updateCode, updateConfig } from '$/util/state.svelte';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  // Local: the theme, the line colour and lane colours (colors.ts). The theme and
  // line colour go in the config, lane colours in the code as `style` statements,
  // so a shared link keeps them.
  const theme = $derived(getTheme(inputState.mermaid));
  const lineColor = $derived(getLineColor(inputState.mermaid));
  const groups = $derived(listGroups(inputState.code));

  const applyTheme = (next: ThemeChoice) => updateConfig(setTheme(inputState.mermaid, next));
  const applyLine = (next: string | undefined) =>
    updateConfig(setLineColor(inputState.mermaid, next));
  const applyCode = (code: string) => updateCode(code, { updateDiagram: true });
  const applyGroup = (id: string, swatch: Swatch | undefined) =>
    applyCode(setGroupColor(inputState.code, id, swatch));

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
            {@const current = getGroupColor(inputState.code, group.id)}
            <li class="flex flex-col gap-1">
              <span class="truncate" title={group.id}>{group.label}</span>
              <div class="flex flex-wrap items-center gap-1.5">
                {@render dot(
                  'transparent',
                  'var(--border)',
                  current === undefined,
                  t('colors.groupClear'),
                  `${TID.colorsGroup}-${group.id}-none`,
                  () => applyGroup(group.id, undefined)
                )}
                {#each swatches as swatch (swatch.name)}
                  {@render dot(
                    swatch.fill,
                    swatch.stroke,
                    current?.stroke === swatch.stroke && current.fill === swatch.fill,
                    t(`colors.swatch.${swatch.name}`),
                    `${TID.colorsGroup}-${group.id}-${swatch.name}`,
                    () => applyGroup(group.id, swatch)
                  )}
                {/each}
                <input
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border bg-transparent"
                  value={current?.stroke && /^#[\da-f]{6}$/i.test(current.stroke)
                    ? current.stroke
                    : '#3b73c9'}
                  title={t('colors.custom')}
                  aria-label={`${group.label}: ${t('colors.custom')}`}
                  data-testid={`${TID.colorsGroup}-${group.id}-custom`}
                  onchange={(event) => {
                    const stroke = event.currentTarget.value;
                    applyGroup(group.id, { fill: tint(stroke), stroke });
                  }} />
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</Card>
