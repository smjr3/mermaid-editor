<script lang="ts" module>
  /** The classes of a form row's label and control (the add bar's popover forms). */
  export const rowClass = 'flex items-center gap-2';
  export const labelClass = 'w-24 shrink-0 text-xs text-muted-foreground';
  export const selectClass =
    'h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-sm text-foreground';
</script>

<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Popover from '$/components/ui/popover';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import type { Snippet } from 'svelte';
  import CloseIcon from '~icons/material-symbols/close-rounded';

  // Local: the frame of one add form in a popover of the add bar (InsertBar.svelte): its
  // title and ✕, the rows, the add button, and what the last add said (done, or why not).
  // The form stays open after an add, so several can be added in a row.
  let {
    children,
    formKey,
    message,
    onsubmit,
    submitLabel,
    title
  }: {
    children: Snippet;
    formKey: string;
    message: string;
    onsubmit: () => void;
    submitLabel: string;
    title: string;
  } = $props();
</script>

<!-- novalidate: a choice left empty is reported by the add itself, in its own words. -->
<form
  novalidate
  class="flex flex-col gap-2 text-sm"
  data-testid={TID.canvasAddForm}
  data-form={formKey}
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit();
  }}>
  <div class="flex items-center justify-between gap-2">
    <span class="truncate font-semibold">{title}</span>
    <Popover.Close
      class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&_svg]:size-4"
      title={t('canvas.formClose')}
      aria-label={t('canvas.formClose')}
      data-testid={TID.canvasAddFormClose}>
      <CloseIcon />
    </Popover.Close>
  </div>
  {@render children()}
  <div>
    <Button type="submit" size="sm" data-testid={TID.canvasAddFormSubmit}>{submitLabel}</Button>
  </div>
  {#if message}
    <p role="status" class="text-xs text-muted-foreground" data-testid={TID.canvasAddFormMessage}>
      {message}
    </p>
  {/if}
</form>
