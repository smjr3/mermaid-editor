<script lang="ts">
  import { t } from '$/i18n';
  import { addRecent, lineColors, parsePresets, swatches, tint, type Swatch } from '$/util/colors';
  import { env } from '$/util/env';
  import { persisted } from '$/util/persist.svelte';

  // Local: the Colours card's colour buttons for the selection (mini toolbar, "選択中"
  // panel, right-click menu): the deployment's palette (MERMAID_COLOR_PRESETS) or the
  // built-in one, the colours this browser picked freely ("any colour", shared with
  // the Colours card through `colorRecent`), and a picker for any colour.
  // `fill` mode picks a fill with its border (an object); `line` mode one colour
  // (an arrow, a text colour).
  type Props =
    | {
        mode: 'fill';
        current: Swatch | undefined;
        onpick: (swatch: Swatch | undefined) => void;
        testID: string;
        compact?: boolean;
      }
    | {
        mode: 'line';
        current: string | undefined;
        onpick: (color: string | undefined) => void;
        testID: string;
        compact?: boolean;
      };
  let props: Props = $props();

  const presets = parsePresets(env.colorPresets);
  const palette: (Swatch & { name?: string })[] = presets ?? swatches;
  const lines = presets ? presets.map(({ stroke }) => stroke) : lineColors;
  const recent = persisted<string[]>('colorRecent', []);
  const recents = $derived(
    Array.isArray(recent.value)
      ? recent.value.filter((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))
      : []
  );
  const same = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

  interface Dot {
    key: string;
    fill: string;
    stroke: string;
    label: string;
    active: boolean;
    pick: () => void;
  }
  const dots = $derived.by((): Dot[] => {
    if (props.mode === 'fill') {
      const { current, onpick } = props;
      const own = palette.map((swatch): Dot => ({
        active: same(current?.stroke, swatch.stroke) && same(current?.fill, swatch.fill),
        fill: swatch.fill,
        key: swatch.name ?? swatch.stroke,
        label: swatch.name
          ? t(`colors.swatch.${swatch.name}` as 'colors.swatch.blue')
          : swatch.stroke,
        pick: () => onpick(swatch),
        stroke: swatch.stroke
      }));
      const free = recents
        .filter((color) => !palette.some(({ stroke }) => same(stroke, color)))
        .map((color): Dot => ({
          active: same(current?.stroke, color),
          fill: tint(color),
          key: `recent-${color}`,
          label: color,
          pick: () => onpick({ fill: tint(color), stroke: color }),
          stroke: color
        }));
      return [...own, ...free];
    }
    const { current, onpick } = props;
    return [...lines, ...recents.filter((color) => !lines.includes(color))].map((color) => ({
      active: same(current, color),
      fill: color,
      key: color,
      label: color,
      pick: () => onpick(color),
      stroke: color
    }));
  });
  const isNone = $derived(props.current === undefined);
  const pickedValue = $derived(
    props.mode === 'fill'
      ? props.current?.stroke && /^#[\da-f]{6}$/i.test(props.current.stroke)
        ? props.current.stroke
        : '#3b73c9'
      : (props.current ?? '#333333')
  );
  const pickAny = (color: string) => {
    recent.value = addRecent(recents, color);
    if (props.mode === 'fill') props.onpick({ fill: tint(color), stroke: color });
    else props.onpick(color);
  };
</script>

<div class="flex flex-wrap items-center gap-1.5">
  <button
    type="button"
    class={[
      'shrink-0 rounded-full border-2 border-dashed border-border outline-offset-2',
      props.compact ? 'size-5' : 'size-6',
      isNone && 'outline-2 outline-foreground'
    ]}
    title={t('sel.colorNone')}
    aria-label={t('sel.colorNone')}
    aria-pressed={isNone}
    data-testid={`${props.testID}-none`}
    onclick={() => props.onpick(undefined)}></button>
  {#each dots as dot (dot.key)}
    <button
      type="button"
      class={[
        'shrink-0 rounded-full border-2 outline-offset-2',
        props.compact ? 'size-5' : 'size-6',
        dot.active && 'outline-2 outline-foreground'
      ]}
      style:background-color={dot.fill}
      style:border-color={dot.stroke}
      title={dot.label}
      aria-label={dot.label}
      aria-pressed={dot.active}
      data-testid={`${props.testID}-${dot.key}`}
      onclick={dot.pick}></button>
  {/each}
  <label
    class="flex cursor-pointer items-center gap-1 rounded-md border px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted"
    title={t('sel.colorAny')}>
    <input
      type="color"
      class="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
      value={pickedValue}
      aria-label={t('sel.colorAny')}
      data-testid={`${props.testID}-custom`}
      onchange={(event) => pickAny(event.currentTarget.value)} />
    {#if !props.compact}{t('sel.colorAny')}{/if}
  </label>
</div>
