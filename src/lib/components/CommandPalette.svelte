<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { TID } from '$/constants';
  import { locale, switchLocale, t } from '$/i18n';
  import { nextLocale } from '$/i18n/translate';
  import { searchCommands, type Command, type CommandAction } from '$/util/commands';
  import { startGuide } from '$/util/onboarding.svelte';
  import { click, clickByText, focus, openCard } from '$/util/uiBus';
  import { codeHistory } from '$/util/undoStack.svelte';
  import { tick } from 'svelte';
  import SearchIcon from '~icons/material-symbols/search';

  // Local: a command palette (Ctrl+K / ⌘K, or the search button in the header). Lists
  // the editor's actions by Japanese label and matches English keywords too; running
  // an entry opens the right tools card and focuses or presses the control, or does
  // the action itself. The registry and matcher are in util/commands.ts.
  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement | null>(null);

  const results = $derived(searchCommands(query));
  const label = (command: Command) => command[locale === 'ja' ? 'ja' : 'en'];
  const altLabel = (command: Command) => command[locale === 'ja' ? 'en' : 'ja'];

  $effect(() => {
    // A new query starts from the best match.
    void query;
    active = 0;
  });

  $effect(() => {
    if (open) {
      void tick().then(() => input?.focus());
    }
  });

  const pressByLabel = (name: string) =>
    document.querySelector<HTMLElement>(`[aria-label="${name}"]`)?.click();

  const runAction = (name: CommandAction) => {
    switch (name) {
      case 'undo': {
        codeHistory.undo();
        break;
      }
      case 'redo': {
        codeHistory.redo();
        break;
      }
      case 'theme': {
        void click(TID.themeToggleButton);
        break;
      }
      case 'locale': {
        switchLocale(nextLocale(locale));
        break;
      }
      case 'help': {
        void click(TID.helpButton);
        break;
      }
      case 'share': {
        void click(TID.shareButton);
        break;
      }
      case 'history': {
        pressByLabel(t('editor.historyToggle'));
        break;
      }
      case 'guide': {
        startGuide();
        break;
      }
    }
  };

  const run = async (command: Command) => {
    open = false;
    const { target } = command;
    if (target.kind === 'action') {
      runAction(target.action);
      return;
    }
    if (!(await openCard(target.card))) return;
    if (target.click) await click(target.click);
    if (target.clickLabel) await clickByText(t(target.clickLabel));
    if (target.focus) await focus(target.focus);
  };

  const onInputKeydown = (event: KeyboardEvent) => {
    // Enter that confirms an IME conversion (typing Japanese) must not run a command.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      active = results.length > 0 ? (active + 1) % results.length : 0;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      active = results.length > 0 ? (active - 1 + results.length) % results.length : 0;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[active];
      if (command) void run(command);
    }
  };

  const onWindowKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      // Before Monaco, which would take Ctrl+K as the start of a chord.
      event.preventDefault();
      event.stopPropagation();
      // Not over another dialog (the help, a template form): one dialog at a time.
      if (!open && document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      query = '';
      open = !open;
    }
  };

  $effect(() => {
    window.addEventListener('keydown', onWindowKeydown, true);
    return () => window.removeEventListener('keydown', onWindowKeydown, true);
  });

  $effect(() => {
    // Keep the highlighted entry in view while moving with the arrow keys.
    if (open) {
      document
        .querySelector(`[data-testid="${TID.commandItem}"][aria-selected="true"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  });
</script>

<Button
  variant="ghost"
  size="sm"
  title={t('command.button')}
  aria-label={t('command.button')}
  data-testid={TID.commandButton}
  onclick={() => {
    query = '';
    open = true;
  }}>
  <SearchIcon class="size-5" />
</Button>

<Dialog.Root bind:open>
  <Dialog.Content
    class="top-[20%] flex max-h-[70vh] translate-y-0 flex-col gap-3 p-4 sm:max-w-lg"
    data-testid={TID.commandPalette}
    onCloseAutoFocus={(event) => event.preventDefault()}>
    <Dialog.Header class="sr-only">
      <Dialog.Title>{t('command.title')}</Dialog.Title>
      <Dialog.Description>{t('command.hint')}</Dialog.Description>
    </Dialog.Header>
    <div class="flex items-center gap-2 border-b pr-6 pb-2">
      <SearchIcon class="size-5 shrink-0 text-muted-foreground" />
      <input
        bind:this={input}
        bind:value={query}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="command-list"
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined}
        placeholder={t('command.placeholder')}
        autocomplete="off"
        spellcheck="false"
        class="w-full bg-transparent py-1 outline-none placeholder:text-muted-foreground"
        data-testid={TID.commandInput}
        onkeydown={onInputKeydown} />
    </div>
    <ul id="command-list" role="listbox" class="min-h-0 flex-1 overflow-y-auto">
      {#each results as command, index (command.id)}
        <li
          id={`command-${command.id}`}
          role="option"
          aria-selected={index === active}
          data-testid={TID.commandItem}
          data-command={command.id}
          class={[
            'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm',
            index === active && 'bg-accent text-accent-foreground'
          ]}
          onmousemove={() => (active = index)}
          onclick={() => void run(command)}
          onkeydown={null}>
          <span>{label(command)}</span>
          <span class="text-xs opacity-70">{altLabel(command)}</span>
        </li>
      {:else}
        <li class="px-3 py-6 text-center text-sm text-muted-foreground">{t('command.empty')}</li>
      {/each}
    </ul>
    <p class="text-xs text-muted-foreground">{t('command.hint')}</p>
  </Dialog.Content>
</Dialog.Root>
