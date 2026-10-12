<script lang="ts">
  import FieldRow from './FieldRow.svelte';

  // Local: a FieldRow whose control is an on/off switch (role="switch").
  let {
    checked = $bindable(),
    label,
    onchange,
    testID
  }: {
    checked: boolean;
    label: string;
    onchange?: (checked: boolean) => void;
    testID: string;
  } = $props();

  const toggle = () => {
    checked = !checked;
    onchange?.(checked);
  };
</script>

<FieldRow {label}>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    data-testid={testID}
    class={[
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
      checked ? 'bg-accent' : 'bg-input'
    ]}
    onclick={toggle}>
    <span
      class={[
        'inline-block size-4 rounded-full bg-background shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      ]}></span>
  </button>
</FieldRow>
