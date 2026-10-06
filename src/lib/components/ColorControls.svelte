<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
    addRecent,
    colorAll,
    colorAllGroups,
    getEdgeColor,
    getLineColor,
    getObjectColor,
    getTextColor,
    getTextStyle,
    getTheme,
    lineColors,
    listGroups,
    parsePresets,
    pickedEdge,
    pickedObject,
    resetTextStyle,
    setEdgeColor,
    setLineColor,
    setObjectColor,
    setTextColor,
    setTextStyle,
    setTheme,
    swatches,
    textSizeChoices,
    themeChoices,
    tint,
    type ColorSyntax,
    type Swatch,
    type SwatchName,
    type TextSize,
    type ThemeChoice
  } from '$/util/colors';
  import { env } from '$/util/env';
  import {
    diagramEdges,
    diagramObjects,
    type DiagramEdge,
    type DiagramObjects
  } from '$/util/mermaid';
  import { persisted } from '$/util/persist.svelte';
  import { applyToolEdit } from '$/util/codeHealth.svelte';
  import { notify } from '$/util/notify';
  import {
    applyThemePreset,
    presetOf,
    themePresets,
    type ThemePresetId
  } from '$/util/themePresets';
  import { inputState, updateConfig } from '$/util/state.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import CheckIcon from '~icons/material-symbols/check-circle-rounded';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  // Local: the theme, the line colour, and lane, object and edge colours
  // (colors.ts). The theme and line colour go in the config, the rest in the code
  // (`style`, `linkStyle`, or C4's `UpdateElementStyle`), so a shared link keeps them.
  const theme = $derived(getTheme(inputState.mermaid));
  const lineColor = $derived(getLineColor(inputState.mermaid));
  const groups = $derived(listGroups(inputState.code));

  // The buttons: a deployment's palette (MERMAID_COLOR_PRESETS) or the built-in
  // one, then the colours this browser picked freely.
  const presets = parsePresets(env.colorPresets);
  const presetSwatches: (Swatch & { name?: SwatchName })[] = presets ?? swatches;
  const lineChoices = presets ? presets.map(({ stroke }) => stroke) : lineColors;
  const recent = persisted<string[]>('colorRecent', []);
  // Whatever an older or hand-edited store holds, only a list of colours is used.
  const recents = $derived(
    Array.isArray(recent.value)
      ? recent.value.filter((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))
      : []
  );
  const remember = (color: string) => (recent.value = addRecent(recents, color));

  // Local: a named theme (themePresets.ts) replaces the theme, its variables and CSS as a whole.
  const preset = $derived(presetOf(inputState.mermaid));
  const applyPreset = (id: ThemePresetId) => updateConfig(applyThemePreset(inputState.mermaid, id));
  // A built-in theme over a named one drops the named one's variables and CSS first.
  const applyTheme = (next: ThemeChoice) =>
    updateConfig(
      setTheme(
        preset === 'standard'
          ? inputState.mermaid
          : applyThemePreset(inputState.mermaid, 'standard'),
        next
      )
    );
  const applyLine = (next: string | undefined) =>
    updateConfig(setLineColor(inputState.mermaid, next));
  // Local: checked, and refused while the code has an error (codeHealth.svelte.ts).
  const applyCode = (code: string) =>
    void applyToolEdit(code).then((result) => {
      if (result === 'refused') notify(t('edit.breaks'));
    });
  const applyColor = (id: string, swatch: Swatch | undefined, syntax: ColorSyntax = 'style') =>
    applyCode(setObjectColor(inputState.code, id, swatch, syntax));

  // Objects and edges come from mermaid's own parse of the last valid code.
  let objects = $state<DiagramObjects | undefined>();
  let edges = $state<DiagramEdge[]>([]);
  let selected = $state('');
  let selectedEdge = $state(0);
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    let stale = false;
    void Promise.all([diagramObjects(code), diagramEdges(code)]).then(([found, foundEdges]) => {
      if (stale) return;
      objects = found;
      edges = foundEdges;
      const items = found?.items ?? [];
      if (!items.some(({ id }) => id === selected)) selected = items[0]?.id ?? '';
      if (selectedEdge >= foundEdges.length) selectedEdge = 0;
    });
    return () => {
      stale = true;
    };
  });
  const items = $derived(objects?.items ?? []);
  const ids = $derived(items.map(({ id }) => id));
  const edgeIds = $derived(edges.map(({ id }) => id));
  const selectedItem = $derived(items.find(({ id }) => id === selected));
  const showLanes = $derived(groups.length > 0 || objects?.kind === 'flowchart');

  // A click in the diagram picks the object or edge under it (see pickedObject, pickedEdge).
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
        const edge = pickedEdge(
          { dataId: element.getAttribute('data-id'), id: element.id },
          edgeIds
        );
        if (edge !== undefined) {
          selectedEdge = edge;
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

  const choice = (active: boolean) => (active ? 'default' : 'outline');
  const isCustomTheme = $derived(
    preset === 'standard' &&
      theme !== 'auto' &&
      !(themeChoices as readonly string[]).includes(theme)
  );
  const same = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
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

{#snippet picker(value: string, label: string, testID: string, onpick: (color: string) => void)}
  <label
    class="flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">
    <input
      type="color"
      class="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
      {value}
      aria-label={label}
      data-testid={testID}
      onchange={(event) => {
        const color = event.currentTarget.value;
        remember(color);
        onpick(color);
      }} />
    {t('colors.custom')}
  </label>
{/snippet}

<!-- Colours for an area (lane, node, …): fill plus border. -->
{#snippet palette(id: string, label: string, testID: string, syntax: ColorSyntax = 'style')}
  {@const current = getObjectColor(inputState.code, id, syntax)}
  <div class="flex flex-wrap items-center gap-1.5">
    {@render dot(
      'transparent',
      'var(--border)',
      current === undefined,
      t('colors.groupClear'),
      `${testID}-none`,
      () => applyColor(id, undefined, syntax)
    )}
    {#each presetSwatches as swatch (swatch.stroke)}
      {@render dot(
        swatch.fill,
        swatch.stroke,
        same(current?.stroke, swatch.stroke) && same(current?.fill, swatch.fill),
        swatch.name ? t(`colors.swatch.${swatch.name}`) : swatch.stroke,
        `${testID}-${swatch.name ?? swatch.stroke}`,
        () => applyColor(id, swatch, syntax)
      )}
    {/each}
    {#each recents.filter((color) => !presetSwatches.some( ({ stroke }) => same(stroke, color) )) as color (color)}
      {@render dot(
        tint(color),
        color,
        same(current?.stroke, color) && same(current?.fill, tint(color)),
        color,
        `${testID}-recent-${color}`,
        () => applyColor(id, { fill: tint(color), stroke: color }, syntax)
      )}
    {/each}
    {@render picker(
      current?.stroke && /^#[\da-f]{6}$/i.test(current.stroke) ? current.stroke : '#3b73c9',
      `${label}: ${t('colors.custom')}`,
      `${testID}-custom`,
      (color) => applyColor(id, { fill: tint(color), stroke: color }, syntax)
    )}
  </div>
{/snippet}

<!-- Colours for a line: one colour. -->
{#snippet strokes(
  current: string | undefined,
  noneLabel: string,
  label: string,
  testID: string,
  apply: (color: string | undefined) => void
)}
  <div class="flex flex-wrap items-center gap-1.5">
    <Button
      size="sm"
      variant={choice(current === undefined)}
      data-testid={`${testID}-default`}
      onclick={() => apply(undefined)}>{noneLabel}</Button>
    {#each [...lineChoices, ...recents.filter((color) => !lineChoices.includes(color))] as color (color)}
      {@render dot(color, color, same(current, color), color, `${testID}-${color}`, () =>
        apply(color)
      )}
    {/each}
    {@render picker(
      current ?? '#333333',
      `${label}: ${t('colors.custom')}`,
      `${testID}-custom`,
      apply
    )}
  </div>
{/snippet}

<Card
  title={t('colors.title')}
  testID={TID.colorsCard}
  isStackable
  icon={{ component: PaletteIcon }}>
  <div class="flex min-w-fit flex-col gap-3 p-2 text-sm">
    <div class="flex flex-col gap-1">
      <span class="font-semibold" id="theme-presets-label">{t('colors.presets')}</span>
      <div
        class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5"
        role="group"
        aria-labelledby="theme-presets-label"
        data-testid={TID.colorsThemePreset}>
        {#each themePresets as entry (entry.id)}
          {@const active = preset === entry.id}
          <button
            type="button"
            aria-pressed={active}
            data-active={active}
            data-testid={`${TID.colorsThemePreset}-${entry.id}`}
            title={t(entry.description)}
            class={[
              'flex min-w-0 flex-col gap-1 rounded-md border p-2 text-left transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-400'
                : 'border-border'
            ]}
            onclick={() => applyPreset(entry.id)}>
            <span class="flex items-start justify-between gap-1">
              <span class="min-w-0 text-xs leading-tight font-semibold break-words"
                >{t(entry.name)}</span>
              {#if active}
                <CheckIcon
                  class="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                  aria-hidden="true" />
              {/if}
            </span>
            <span class="flex gap-1" aria-hidden="true">
              {#each entry.swatches as color, index (index)}
                <span
                  class="size-3 shrink-0 rounded-full border border-black/20 dark:border-white/30"
                  style:background-color={color}></span>
              {/each}
            </span>
            <span class="line-clamp-2 text-[11px] leading-snug text-muted-foreground"
              >{t(entry.description)}</span>
          </button>
        {/each}
      </div>
      <p class="text-xs text-muted-foreground">{t('colors.presetsHint')}</p>
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('colors.builtinThemes')}</span>
      <div class="flex flex-wrap gap-1">
        {#each ['auto', ...themeChoices] as const as id (id)}
          <Button
            size="sm"
            variant={choice(preset === 'standard' && theme === id)}
            data-testid={`${TID.colorsTheme}-${id}`}
            onclick={() => applyTheme(id)}>{t(`colors.theme.${id}`)}</Button>
        {/each}
      </div>
      {#if isCustomTheme || (preset === 'standard' && theme === 'auto')}
        <p class="text-xs text-muted-foreground">
          {isCustomTheme ? t('colors.themeCustom', { theme }) : t('colors.themeAutoHint')}
        </p>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <span class="font-semibold">{t('colors.line')}</span>
      {@render strokes(
        lineColor,
        t('colors.lineDefault'),
        t('colors.line'),
        TID.colorsLine,
        applyLine
      )}
    </div>

    {#if !objects && groups.length === 0}
      <p class="text-muted-foreground">{t('colors.objectsNone')}</p>
    {/if}

    {#if showLanes}
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
              onclick={() => applyCode(colorAllGroups(inputState.code, false, presetSwatches))}
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
    {/if}

    {#if objects && items.length > 0}
      <!-- Class diagrams need a property without a hyphen first in a style statement (colors.ts). -->
      {@const syntax = objects.kind === 'class' ? 'class' : objects.syntax}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t(`colors.objects.${objects.kind}`)}</span>
        <select
          bind:value={selected}
          aria-label={t(`colors.objects.${objects.kind}`)}
          data-testid={TID.colorsNodeSelect}
          class="h-9 rounded-md border border-input bg-background px-1 text-sm text-foreground">
          {#each items as object (object.id)}
            <option value={object.id}
              >{getObjectColor(inputState.code, object.id, syntax)
                ? '● '
                : ''}{object.label}{object.label === object.id ? '' : ` (${object.id})`}</option>
          {/each}
        </select>
        {#if selectedItem}
          {@render palette(selectedItem.id, selectedItem.label, TID.colorsNode, syntax)}
        {/if}
        <p class="text-xs text-muted-foreground">{t('colors.objectsHint')}</p>
        <div class="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsNodesAuto}
            onclick={() => applyCode(colorAll(inputState.code, ids, syntax, false, presetSwatches))}
            >{t('colors.groupsAuto')}</Button>
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsNodesClear}
            onclick={() => applyCode(colorAll(inputState.code, ids, syntax, true))}
            >{t('colors.groupsClear')}</Button>
        </div>

        <!-- Text of the chosen object: bold and size (font-weight, font-size in the same
             style statement; not a thing in C4's UpdateElementStyle) and its colour. -->
        {#if selectedItem}
          {@const textStyle = getTextStyle(inputState.code, selectedItem.id, syntax)}
          <div class="mt-1 flex flex-col gap-1 border-t pt-2" data-testid={TID.colorsText}>
            <span class="font-semibold">{t('colors.text')}</span>
            {#if syntax === 'c4'}
              <p class="text-xs text-muted-foreground">{t('colors.textC4')}</p>
            {:else}
              <div class="flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  variant={choice(textStyle.bold)}
                  aria-pressed={textStyle.bold}
                  data-testid={TID.colorsTextBold}
                  onclick={() =>
                    applyCode(
                      setTextStyle(
                        inputState.code,
                        selectedItem.id,
                        { bold: !textStyle.bold },
                        syntax
                      )
                    )}>{t('colors.textBold')}</Button>
                <select
                  value={textStyle.size}
                  aria-label={t('colors.textSize')}
                  data-testid={TID.colorsTextSize}
                  class="h-8 rounded-md border border-input bg-background px-1 text-sm text-foreground"
                  onchange={(event) =>
                    applyCode(
                      setTextStyle(
                        inputState.code,
                        selectedItem.id,
                        { size: event.currentTarget.value as TextSize },
                        syntax
                      )
                    )}>
                  {#each textSizeChoices as size (size)}
                    <option value={size}>{t(`colors.textSize.${size}`)}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <span class="text-xs text-muted-foreground">{t('colors.textColor')}</span>
            {@render strokes(
              getTextColor(inputState.code, selectedItem.id, syntax),
              t('colors.textColorDefault'),
              t('colors.textColor'),
              TID.colorsTextColor,
              (color) => applyCode(setTextColor(inputState.code, selectedItem.id, color, syntax))
            )}
            <div>
              <Button
                size="sm"
                variant="outline"
                data-testid={TID.colorsTextReset}
                onclick={() => applyCode(resetTextStyle(inputState.code, selectedItem.id, syntax))}
                >{t('colors.textReset')}</Button>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if edges.length > 0}
      <div class="flex flex-col gap-1">
        <span class="font-semibold">{t('colors.edges')}</span>
        <select
          bind:value={selectedEdge}
          aria-label={t('colors.edges')}
          data-testid={TID.colorsEdgeSelect}
          class="h-9 rounded-md border border-input bg-background px-1 text-sm text-foreground">
          {#each edges as edge (edge.id)}
            <option value={edge.index}
              >{getEdgeColor(inputState.code, edge.index) ? '● ' : ''}{edge.label}</option>
          {/each}
        </select>
        {@render strokes(
          getEdgeColor(inputState.code, selectedEdge),
          t('colors.edgeDefault'),
          t('colors.edges'),
          TID.colorsEdge,
          (color) => applyCode(setEdgeColor(inputState.code, selectedEdge, color))
        )}
        <p class="text-xs text-muted-foreground">{t('colors.edgesHint')}</p>
        <div>
          <Button
            size="sm"
            variant="outline"
            data-testid={TID.colorsEdgesClear}
            onclick={() =>
              applyCode(
                edges.reduce(
                  (code, { index }) => setEdgeColor(code, index, undefined),
                  inputState.code
                )
              )}>{t('colors.edgesClear')}</Button>
        </div>
      </div>
    {/if}
  </div>
</Card>
