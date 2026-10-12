<script lang="ts">
  import NewDiagram from '$/components/NewDiagram.svelte';
  import Preset from '$/components/Preset.svelte';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { closeDialog, editorUi, type NewDialogTab } from '$/util/editorUi.svelte';

  // Local: the header's 新規 dialog (W0 stub). Two tabs, 形式 (today's "New diagram…"
  // form) and サンプル (today's templates card: search, categories, the forms), so both
  // keep working until the real dialog lands.
  const tabs: { id: NewDialogTab; label: string }[] = [
    { id: 'type', label: t('ws.newTabType') },
    { id: 'sample', label: t('ws.newTabSample') }
  ];
</script>

<Dialog.Root
  open={editorUi.dialog === 'new'}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}>
  <Dialog.Content class="flex max-h-[90vh] flex-col gap-3 sm:max-w-3xl" data-testid={TID.newDlg}>
    <Dialog.Header>
      <Dialog.Title>{t('ws.newTitle')}</Dialog.Title>
    </Dialog.Header>
    <div class="flex gap-1 border-b border-border" role="tablist" aria-label={t('ws.newTabs')}>
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          role="tab"
          aria-selected={editorUi.newTab === tab.id}
          class={[
            '-mb-px rounded-t-md border border-b-0 px-3 py-1.5 text-sm',
            editorUi.newTab === tab.id
              ? 'border-border bg-background font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]}
          data-testid={`${TID.newDlgTab}-${tab.id}`}
          onclick={() => (editorUi.newTab = tab.id)}>
          {tab.label}
        </button>
      {/each}
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
      {#if editorUi.newTab === 'type'}
        <NewDiagram />
      {:else}
        <Preset />
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
