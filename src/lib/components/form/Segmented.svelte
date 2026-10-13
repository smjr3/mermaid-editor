<script lang="ts">
  // Local: a one-line segmented choice. Each item carries `data-testid="${testID}-${value}"`
  // and `aria-pressed`, so tests pick an option by its value, never by its text. `dense`
  // sizes the items by their text with less padding, for rows whose labels would not fit
  // in equal widths (向き's five, 線's 見えない) in the inspector's default width.
  interface Option {
    disabled?: boolean;
    label: string;
    title?: string;
    value: string;
  }

  let {
    ariaLabel,
    dense = false,
    full = false,
    onchange,
    options,
    testID,
    value = $bindable()
  }: {
    ariaLabel: string;
    dense?: boolean;
    full?: boolean;
    onchange?: (value: string) => void;
    options: Option[];
    testID: string;
    value: string;
  } = $props();

  const pick = (option: Option) => {
    if (option.disabled || option.value === value) return;
    value = option.value;
    onchange?.(option.value);
  };
</script>

<div
  class={[
    'inline-flex h-7 min-w-0 items-stretch rounded-md border border-input bg-background p-0.5',
    full && 'w-full'
  ]}
  role="group"
  aria-label={ariaLabel}
  data-testid={testID}>
  {#each options as option (option.value)}
    <button
      type="button"
      class={[
        'min-w-0 truncate rounded-sm text-xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50',
        dense ? 'px-1' : 'px-2',
        full && (dense ? 'flex-auto' : 'flex-1'),
        option.value === value
          ? 'bg-muted font-semibold text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      ]}
      aria-pressed={option.value === value}
      disabled={option.disabled}
      title={option.title}
      data-testid={`${testID}-${option.value}`}
      onclick={() => pick(option)}>
      {option.label}
    </button>
  {/each}
</div>
