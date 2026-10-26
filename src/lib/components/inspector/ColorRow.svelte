<script lang="ts">
  import { t } from '$/i18n';
  import { colorRecent } from '$/util/colorRecent.svelte';
  import { lineColors, parsePresets, swatches, tint, type Swatch } from '$/util/colors';
  import { env } from '$/util/env';

  // Local: one row of colour buttons for the inspector: the theme's colour (none), the
  // palette (a deployment's MERMAID_COLOR_PRESETS, or the built-in one), ＋好きな色 (any
  // colour, remembered in colorRecent.svelte.ts) and the last three colours picked freely.
  // `fill` mode picks a fill with its border (an object, a lane); `line` mode one colour
  // (a border, a text colour, an arrow, the line colour). The none button, the palette
  // and ＋ share one line whatever the panel's width: each grows to 20px and shrinks to
  // fit (QA 2026-10-24: at 16px ＋ wrapped onto a line of its own); the recent colours
  // follow on the next line when there is no room.
  type Props = {
    testID: string;
    label: string;
    /** What the none button says (default: the theme's colour). */
    noneLabel?: string;
  } & (
    | {
        mode: 'fill';
        current: Swatch | undefined;
        onpick: (swatch: Swatch | undefined) => void;
      }
    | {
        mode: 'line';
        current: string | undefined;
        onpick: (color: string | undefined) => void;
      }
  );
  let props: Props = $props();

  const presets = parsePresets(env.colorPresets);
  const palette: (Swatch & { name?: string })[] = presets ?? swatches;
  const lines = presets ? presets.map(({ stroke }) => stroke) : lineColors;
  const same = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

  interface Dot {
    key: string;
    fill: string;
    stroke: string;
    label: string;
    active: boolean;
    pick: () => void;
  }
  const pickColor = (color: string) => {
    if (props.mode === 'fill') props.onpick({ fill: tint(color), stroke: color });
    else props.onpick(color);
  };
  const isActive = (color: string, fill?: string) =>
    props.mode === 'fill'
      ? same(props.current?.stroke, color) &&
        (fill === undefined || same(props.current?.fill, fill))
      : same(props.current, color);
  const dots = $derived.by((): Dot[] => {
    if (props.mode === 'fill') {
      const { onpick } = props;
      return palette.map((swatch) => ({
        active: isActive(swatch.stroke, swatch.fill),
        fill: swatch.fill,
        key: swatch.name ?? swatch.stroke,
        label: swatch.name
          ? t(`colors.swatch.${swatch.name}` as 'colors.swatch.blue')
          : swatch.stroke,
        pick: () => onpick(swatch),
        stroke: swatch.stroke
      }));
    }
    return lines.map((color) => ({
      active: isActive(color),
      fill: color,
      key: color,
      label: color,
      pick: () => pickColor(color),
      stroke: color
    }));
  });
  // The colours picked freely that the palette does not already offer, latest first.
  const recents = $derived(
    colorRecent.list
      .filter((color) =>
        props.mode === 'fill'
          ? !palette.some(({ stroke }) => same(stroke, color))
          : !lines.some((line) => same(line, color))
      )
      .slice(0, 3)
  );
  const isNone = $derived(props.current === undefined);
  const pickedValue = $derived.by(() => {
    const color = props.mode === 'fill' ? props.current?.stroke : props.current;
    return color && /^#[\da-f]{6}$/i.test(color) ? color : '#3b73c9';
  });
  const pickAny = (color: string) => {
    colorRecent.remember(color);
    pickColor(color);
  };
  const dot = 'size-4 shrink-0 rounded-full border-2 outline-offset-1';
  // A palette dot: up to 20px, shrinking with the row rather than wrapping.
  const fitDot =
    'aspect-square max-w-5 min-w-3.5 flex-1 basis-0 rounded-full border-2 outline-offset-1';
  // The none button: a circle struck through, as colour pickers mark "no colour".
  const struck =
    'linear-gradient(to top right, transparent calc(50% - 1px), var(--color-muted-foreground) calc(50% - 1px), var(--color-muted-foreground) calc(50% + 1px), transparent calc(50% + 1px))';
</script>

<div
  class="flex min-w-0 flex-wrap items-center gap-x-[3px] gap-y-1"
  role="group"
  aria-label={props.label}
  data-testid={props.testID}>
  <div class="flex w-full min-w-0 items-center gap-[3px]">
    <button
      type="button"
      class={[fitDot, 'border-border bg-background', isNone && 'outline-2 outline-foreground']}
      style:background-image={struck}
      title={props.noneLabel ?? t('insp.colorNone')}
      aria-label={props.noneLabel ?? t('insp.colorNone')}
      aria-pressed={isNone}
      data-testid={`${props.testID}-none`}
      onclick={() => props.onpick(undefined)}></button>
    {#each dots as item (item.key)}
      <button
        type="button"
        class={[fitDot, item.active && 'outline-2 outline-foreground']}
        style:background-color={item.fill}
        style:border-color={item.stroke}
        title={item.label}
        aria-label={item.label}
        aria-pressed={item.active}
        data-testid={`${props.testID}-${item.key}`}
        onclick={item.pick}></button>
    {/each}
    <label
      class="relative flex aspect-square max-w-5 min-w-3.5 flex-1 basis-0 cursor-pointer items-center justify-center rounded-full border border-input text-xs leading-none text-muted-foreground hover:bg-muted"
      title={t('insp.colorAny')}>
      ＋
      <input
        type="color"
        class="absolute inset-0 size-full cursor-pointer opacity-0"
        value={pickedValue}
        aria-label={`${props.label}: ${t('insp.colorAny')}`}
        data-testid={`${props.testID}-custom`}
        onchange={(event) => pickAny(event.currentTarget.value)} />
    </label>
  </div>
  {#if recents.length > 0}
    {#each recents as color, index (color)}
      <button
        type="button"
        class={[dot, isActive(color) && 'outline-2 outline-foreground']}
        style:background-color={props.mode === 'fill' ? tint(color) : color}
        style:border-color={color}
        title={t('insp.colorRecent', { color })}
        aria-label={t('insp.colorRecent', { color })}
        aria-pressed={isActive(color)}
        data-color={color}
        data-testid={`${props.testID}-recent-${index}`}
        onclick={() => pickColor(color)}></button>
    {/each}
  {/if}
</div>
