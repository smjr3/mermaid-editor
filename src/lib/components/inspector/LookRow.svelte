<script lang="ts">
  import FieldRow, { labelColumn } from '$/components/form/FieldRow.svelte';
  import SwitchRow from '$/components/form/SwitchRow.svelte';
  import ColorRow from '$/components/inspector/ColorRow.svelte';
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import {
    getLineColor,
    getTheme,
    setLineColor,
    setTheme,
    themeChoices,
    type ThemeChoice
  } from '$/util/colors';
  import { fontChoices, getDiagramFont, setDiagramFont, type FontChoice } from '$/util/diagramFont';
  import { inputState, updateCodeStore, updateConfig } from '$/util/state.svelte';
  import {
    applyThemePreset,
    getThemePreset,
    presetOf,
    themePresets,
    type ThemePresetId
  } from '$/util/themePresets';
  import CheckIcon from '~icons/material-symbols/check-rounded';

  // Local: 図全体's first row, 「見た目 │ ●●●●● テーマ名  変更…」. The dots and the name say
  // which look the diagram has (a named theme, one of mermaid's built-in themes, or 標準);
  // 変更… opens a popover with the controls that used to be the top of 図全体: the twelve
  // named themes as cards (themePresets.ts), the built-in theme, フォント (diagramFont.ts),
  // 手描き風 (the editor's state) and 線の色 (colors.ts). All of them are config, so they
  // stay available while the code is broken. A popover, not a collapsible section: one
  // row while working, the whole choice when asked for.
  let open = $state(false);

  const preset = $derived(presetOf(inputState.mermaid));
  const theme = $derived(getTheme(inputState.mermaid));
  const isCustomTheme = $derived(
    preset === 'standard' &&
      theme !== 'auto' &&
      !(themeChoices as readonly string[]).includes(theme)
  );
  const builtin = $derived(
    preset === 'standard' && (themeChoices as readonly string[]).includes(theme) ? theme : 'auto'
  );
  const font = $derived(getDiagramFont(inputState.mermaid));
  const lineColor = $derived(getLineColor(inputState.mermaid));
  const entry = $derived(getThemePreset(preset));
  // What the row names: the named theme, else the built-in theme, else 標準.
  const name = $derived.by(() => {
    if (preset !== 'standard') return t(entry.name);
    if (isCustomTheme) return theme;
    return builtin === 'auto' ? t(entry.name) : t(`colors.theme.${builtin as ThemeChoice}`);
  });

  // A named theme replaces the theme, its variables and CSS as a whole; a font chosen
  // here is kept over the preset's own (diagramFont.ts).
  const applyPreset = (id: ThemePresetId) => {
    const next = applyThemePreset(inputState.mermaid, id);
    updateConfig(font === 'default' || font === 'custom' ? next : setDiagramFont(next, font));
  };
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

  const selectClass =
    'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs text-foreground';
  const muted = 'min-w-0 truncate text-xs text-muted-foreground';
</script>

<FieldRow label={t('insp.look')}>
  <span class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
    {#each entry.swatches as color, index (index)}
      <span
        class="size-2.5 shrink-0 rounded-full border border-black/20 dark:border-white/30"
        style:background-color={color}></span>
    {/each}
  </span>
  <span class="min-w-0 flex-1 truncate text-xs" title={name} data-testid={TID.inspLookName}
    >{name}</span>
  <Popover.Root bind:open>
    <Popover.Trigger
      class="inline-flex h-7 shrink-0 items-center rounded-md border border-input bg-background px-2 text-xs whitespace-nowrap hover:bg-muted aria-expanded:bg-muted"
      title={t('insp.lookHint')}
      aria-label={`${t('insp.look')}: ${t('insp.lookChange')}`}
      data-testid={TID.lookPopover}>{t('insp.lookChange')}</Popover.Trigger>
    <Popover.Content
      align="end"
      class="w-[21rem] max-w-[calc(100vw-2rem)] p-3"
      data-selection-ui
      data-testid={TID.inspLookContent}>
      <div class="flex flex-col gap-1" use:labelColumn>
        <!-- テーマ: the named themes as cards, the current one ringed and ticked. -->
        <div
          class="mb-1 grid grid-cols-3 gap-1"
          role="group"
          aria-label={t('colors.presets')}
          title={t('colors.presetsHint')}
          data-testid={TID.inspThemePreset}>
          {#each themePresets as item (item.id)}
            {@const active = preset === item.id}
            <button
              type="button"
              aria-pressed={active}
              data-active={active}
              data-testid={`${TID.inspThemePreset}-${item.id}`}
              title={`${t(item.name)}: ${t(item.description)}`}
              class={[
                'flex min-w-0 flex-col gap-0.5 rounded-md border px-1.5 py-1 text-left transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-400'
                  : 'border-border'
              ]}
              onclick={() => applyPreset(item.id)}>
              <!-- The swatches and the check share a row, so the name below has the card's
                   whole width and wraps rather than being cut (QA 2026-10-13). -->
              <span class="flex items-center gap-0.5" aria-hidden="true">
                {#each item.swatches as color, index (index)}
                  <span
                    class="size-2.5 shrink-0 rounded-full border border-black/20 dark:border-white/30"
                    style:background-color={color}></span>
                {/each}
                {#if active}
                  <CheckIcon class="ml-auto size-3 shrink-0 text-sky-600 dark:text-sky-400" />
                {/if}
              </span>
              <span class="text-[11px] leading-tight font-semibold break-words"
                >{t(item.name)}</span>
            </button>
          {/each}
        </div>
        <FieldRow label={t('insp.builtin')}>
          <select
            class={selectClass}
            value={isCustomTheme ? theme : builtin}
            aria-label={t('colors.builtinThemes')}
            title={isCustomTheme ? t('colors.themeCustom', { theme }) : t('insp.builtinHint')}
            data-testid={TID.inspBuiltinTheme}
            onchange={(event) => applyTheme(event.currentTarget.value as ThemeChoice)}>
            <option value="auto">{t('insp.builtinNone')}</option>
            {#if isCustomTheme}
              <option value={theme} disabled>{theme}</option>
            {/if}
            {#each themeChoices as id (id)}
              <option value={id}>{t(`colors.theme.${id}`)}</option>
            {/each}
          </select>
        </FieldRow>
        {#if isCustomTheme}
          <p class={muted} title={t('colors.themeCustom', { theme })}>
            {t('colors.themeCustom', { theme })}
          </p>
        {/if}
        <FieldRow label={t('insp.font')}>
          <select
            class={selectClass}
            value={font}
            aria-label={t('insp.font')}
            data-testid={TID.inspFont}
            onchange={(event) =>
              updateConfig(
                setDiagramFont(inputState.mermaid, event.currentTarget.value as FontChoice)
              )}>
            {#if font === 'custom'}
              <option value="custom" disabled>{t('insp.font.custom')}</option>
            {/if}
            {#each fontChoices as choice (choice)}
              <option value={choice}>{t(`insp.font.${choice}`)}</option>
            {/each}
          </select>
        </FieldRow>
        <SwitchRow
          label={t('toolbar.handDrawn')}
          checked={!!inputState.rough}
          testID={TID.roughToggle}
          onchange={(rough) => updateCodeStore({ rough })} />
        <FieldRow label={t('colors.line')}>
          <ColorRow
            mode="line"
            current={lineColor}
            label={t('colors.line')}
            noneLabel={t('colors.lineDefault')}
            testID={TID.inspLineColor}
            onpick={(color) => updateConfig(setLineColor(inputState.mermaid, color))} />
        </FieldRow>
      </div>
    </Popover.Content>
  </Popover.Root>
</FieldRow>
