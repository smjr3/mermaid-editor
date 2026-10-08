<script lang="ts">
  // Local: the "名前を付けて保存" dialog for browsers without the File System
  // Access API (saveFile.ts). It asks for the name only; the browser decides the
  // folder (usually Downloads).
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { answerFileName, saveAsPrompt } from '$/util/saveAsPrompt.svelte';

  let name = $state('');
  let input = $state<HTMLInputElement | null>(null);
  const open = $derived(saveAsPrompt.request !== undefined);

  $effect(() => {
    const request = saveAsPrompt.request;
    if (!request) return;
    name = request.suggested;
    // Select the name without its extension, as desktop save dialogs do.
    setTimeout(() => {
      const dot = name.lastIndexOf('.');
      input?.focus();
      input?.setSelectionRange(0, dot > 0 ? dot : name.length);
    });
  });

  const save = (event: Event) => {
    event.preventDefault();
    if (name.trim()) answerFileName(name);
  };
</script>

<Dialog.Root
  {open}
  onOpenChange={(value) => {
    if (!value) answerFileName(undefined);
  }}>
  <Dialog.Content class="sm:max-w-md" data-testid={TID.saveAsDialog}>
    <Dialog.Header>
      <Dialog.Title>{t('saveAs.title')}</Dialog.Title>
      <Dialog.Description>{t('saveAs.description')}</Dialog.Description>
    </Dialog.Header>
    <form class="flex flex-col gap-4" onsubmit={save}>
      <label class="flex flex-col gap-1 text-sm">
        {t('saveAs.label')}
        <Input bind:ref={input} bind:value={name} data-testid={TID.saveAsInput} />
      </label>
      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          data-testid={TID.saveAsCancel}
          onclick={() => answerFileName(undefined)}>
          {t('saveAs.cancel')}
        </Button>
        <Button type="submit" disabled={!name.trim()} data-testid={TID.saveAsConfirm}>
          {t('saveAs.save')}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
