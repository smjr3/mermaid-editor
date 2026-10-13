<script lang="ts">
  import ArchAddForms from '$/components/canvas/ArchAddForms.svelte';
  import FlowInsert from '$/components/canvas/FlowInsert.svelte';
  import SpecInsert from '$/components/canvas/SpecInsert.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { specFor } from '$/util/addActions';
  import { codeHealth } from '$/util/codeHealth.svelte';
  import { canAdd, isArchitecture } from '$/util/diagramEdit';
  import { headerOnly } from '$/util/insertActions';
  import { inputState } from '$/util/state.svelte';
  import { templateNotice } from '$/util/templateNotice.svelte';

  // Local: the add bar above the diagram. What it offers follows the diagram's type, read
  // from the code: flowchart and swimlane shapes, lanes and arrows (FlowInsert); groups,
  // services and connections for architecture (ArchAddForms); one button per add action
  // for the other types (SpecInsert, from addActions.ts and chartEdit.ts). While the code
  // has an error it says so instead: the forms work from the last valid code, and writing
  // into the broken code is refused anyway (codeHealth.svelte.ts).
  const architecture = $derived(isArchitecture(inputState.code));
  const spec = $derived(specFor(inputState.code));
  const flow = $derived(canAdd(inputState.code));

  // Types that only parse with a first item (an empty mindmap or kanban) stay open: that
  // first item is the way to a diagram. As the notice over the diagram does, a mistake
  // typed a moment ago is given a second before it closes the bar.
  const broken = $derived(codeHealth.broken && !(spec && headerOnly(inputState.code)));
  let blocked = $state(false);
  $effect(() => {
    if (!broken) {
      blocked = false;
      return;
    }
    const timer = setTimeout(() => (blocked = true), 1000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Wraps onto a second line rather than cutting off その他 ▾ in a narrow diagram column. -->
<div
  class="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 overflow-hidden"
  role="toolbar"
  aria-label={t('canvas.insertBar')}
  data-testid={TID.canvasInsertBar}>
  {#if blocked}
    <span class="truncate px-2 text-sm text-muted-foreground" data-testid={TID.canvasInsertBlocked}
      >{t('canvas.blocked')}</span>
  {:else if architecture}
    <ArchAddForms />
  {:else if spec}
    {#key spec.kind}
      <SpecInsert {spec} />
    {/key}
  {:else if flow}
    <FlowInsert />
  {:else}
    <span
      class="truncate px-2 text-sm text-muted-foreground"
      title={t('add.unsupported')}
      data-testid={TID.canvasInsertUnsupported}>{t('add.unsupported')}</span>
  {/if}
  {#if templateNotice.message}
    <span
      role="status"
      class="ml-2 truncate text-xs text-muted-foreground"
      title={templateNotice.message}
      data-testid={TID.templateFormsMessage}>{templateNotice.message}</span>
  {/if}
</div>
