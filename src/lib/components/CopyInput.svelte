<script lang="ts">
  import CopyButton from '$/components/CopyButton.svelte';
  import { Input } from '$/components/ui/input';
  import type { InputType } from '$/types';
  import { t } from '$/i18n';
  import { copyToClipboard } from '$/util/util';

  // Local: `copyTestID` and `compact` for the share and export dialogs' one-line rows;
  // the field is read-only there (it shows a link to copy, not something to edit).
  let {
    compact = false,
    copyTestID,
    label = t('actions.copy'),
    testID,
    title,
    type = 'url',
    value
  }: {
    compact?: boolean;
    copyTestID?: string;
    label?: string;
    testID?: string;
    title?: string;
    type?: InputType;
    value: string;
  } = $props();
</script>

<div class={['flex w-full min-w-0 items-center', compact ? 'gap-1' : 'gap-2']}>
  <Input
    {type}
    {value}
    {title}
    readonly={compact}
    class={compact ? 'h-7 min-w-0 px-2 text-xs' : undefined}
    data-testid={testID}
    onclick={(event) => {
      event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
    }} />

  <CopyButton
    onclick={() => copyToClipboard(value)}
    {label}
    testID={copyTestID}
    size={compact ? 'sm' : 'default'}
    variant={compact ? 'outline' : 'default'} />
</div>
