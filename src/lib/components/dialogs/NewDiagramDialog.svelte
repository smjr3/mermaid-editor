<script lang="ts">
  import TemplateForms from '$/components/TemplateForms.svelte';
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { TID } from '$/constants';
  import { locale, t } from '$/i18n';
  import { closeDialog, editorUi, type NewDialogTab } from '$/util/editorUi.svelte';
  import type { Direction } from '$/util/layout';
  import { businessTemplatesName } from '$/util/localSamples';
  import { newTabHref } from '$/util/newTab';
  import { starter, starterKinds, type StarterId } from '$/util/newDiagram';
  import { sampleThumb, starterThumb, thumbSvg } from '$/util/newThumbs';
  import { sampleCatalog } from '$/util/sampleCatalog';
  import { sampleNameKeys } from '$/util/sampleNames';
  import { labelOf, templateForms } from '$/util/templateForms';
  import { templateDialog, templateNotice } from '$/util/templateNotice.svelte';
  import { thumbnail } from '$/util/templateThumbnails';
  import { logEvent } from '$lib/util/stats';
  import { cn } from '$lib/utils';
  import FormIcon from '~icons/material-symbols/dynamic-form-outline-rounded';
  import OpenIcon from '~icons/material-symbols/open-in-new-rounded';
  import SearchIcon from '~icons/material-symbols/search-rounded';

  // Local: the header's 新規 dialog — the one place to start a new diagram. Two tabs:
  // 形式から作る (an empty starter of one of the 21 kinds, newDiagram.ts: an optional
  // title and a direction) and サンプルから作る (every sample, by category, with a
  // search; a business template that has a form also offers it, TemplateForms.svelte).
  // Every result opens in a new browser tab, through the same link a shared diagram
  // uses, so the diagram in this tab stays as it is and nothing needs asking.
  const tabs: { id: NewDialogTab; label: string }[] = [
    { id: 'type', label: t('newDlg.tabType') },
    { id: 'sample', label: t('newDlg.tabSample') }
  ];

  let message = $state('');
  // The 空の… / サンプル links, to press from the title field's Enter key.
  let createLink: HTMLElement | null = $state(null);

  // The message of a form's result (TemplateForms.svelte) is shown here too.
  const shownMessage = $derived(message || templateNotice.message);
  $effect(() => {
    if (editorUi.dialog === 'new') {
      message = '';
      templateNotice.message = '';
    }
  });
  const switchTab = (tab: NewDialogTab) => {
    editorUi.newTab = tab;
    message = '';
    templateNotice.message = '';
  };

  // After the click has opened the link: a link taken out of the page does not navigate.
  const opened = (name: string, after?: () => void) => {
    setTimeout(() => {
      templateNotice.message = '';
      message = t('newDlg.opened', { name });
      after?.();
    });
  };

  // ---- 形式から作る -------------------------------------------------------------------
  let kind = $state<StarterId>('flowchart');
  let title = $state('');
  let direction = $state<Direction | undefined>();
  const current = $derived(starterKinds.find(({ id }) => id === kind) ?? starterKinds[0]);
  // Swimlanes read best left to right; everything else starts top to bottom.
  const shownDirection = $derived(direction ?? (kind === 'swimlane' ? 'LR' : 'TB'));
  const kindName = (id: StarterId) => t(`new.kind.${id}`);
  const starterHref = $derived(
    newTabHref(
      starter(kind, {
        direction: current.direction ? shownDirection : undefined,
        title: current.title ? title : ''
      })
    )
  );

  // ---- サンプルから作る ---------------------------------------------------------------
  const samples = sampleCatalog();
  const mainDiagrams = [
    // The Japanese business templates lead, for the users this fork serves.
    businessTemplatesName,
    'Flowchart',
    'Swimlane',
    'Class',
    'Sequence',
    'Entity Relationship',
    'State',
    'Mindmap'
  ];
  // The group names are mermaid's catalogue keys; the common ones are shown in Japanese.
  const shownName = (group: string) => {
    const key = sampleNameKeys[group];
    return key ? t(key) : group;
  };
  const groupOrder = [
    ...mainDiagrams.filter((key) => key in samples),
    ...Object.keys(samples)
      .filter((key) => !mainDiagrams.includes(key))
      .sort()
  ];
  const formOf = (group: string, sampleTitle: string) =>
    group === businessTemplatesName
      ? templateForms.find((template) => template.sample === sampleTitle)
      : undefined;

  const ALL = '';
  let category = $state(ALL);
  let query = $state('');
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replaceAll(/\s+/g, '');

  /** The samples to show, in category order, those that match the search. */
  const shown = $derived.by(() => {
    const words = query.split(/\s+/).map(normalize).filter(Boolean);
    return groupOrder
      .filter((group) => category === ALL || group === category)
      .flatMap((group) => {
        const name = `${group} ${shownName(group)}`;
        return samples[group]
          .filter(({ title: sampleTitle }) => {
            const text = normalize(`${name} ${sampleTitle}`);
            return words.every((word) => text.includes(word));
          })
          .map((example) => ({ example, form: formOf(group, example.title), group }));
      });
  });

  let picked = $state<{ group: string; title: string } | undefined>();
  // The chosen sample, or the first one shown when nothing is chosen or it is filtered out.
  const selected = $derived(
    shown.find(({ example, group }) => example.title === picked?.title && group === picked.group) ??
      shown[0]
  );

  // A rendered preview of the chosen sample (templateThumbnails.ts).
  let preview = $state<{ svg: string; for: string } | undefined>();
  $effect(() => {
    const sample = selected;
    if (editorUi.dialog !== 'new' || editorUi.newTab !== 'sample' || !sample) return;
    const code = sample.example.code;
    let live = true;
    void thumbnail('new-dialog', code).then((svg) => {
      if (live) preview = { for: code, svg };
    });
    return () => {
      live = false;
    };
  });
  const previewSvg = $derived(
    preview && preview.for === selected?.example.code ? preview : undefined
  );

  const choice = (active: boolean) => (active ? 'default' : 'outline');
</script>

<Dialog.Root
  open={editorUi.dialog === 'new'}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}>
  <Dialog.Content
    class="flex h-[min(40rem,90vh)] max-h-[90vh] flex-col gap-0 p-0 sm:max-w-5xl"
    data-testid={TID.newDlg}>
    <Dialog.Header class="px-4 pt-4 pb-2">
      <Dialog.Title>{t('newDlg.title')}</Dialog.Title>
      <Dialog.Description class="sr-only">{t('newDlg.note')}</Dialog.Description>
    </Dialog.Header>
    <div class="flex items-center gap-3 border-b border-border px-4 pb-2">
      <div class="flex gap-1" role="tablist" aria-label={t('newDlg.tabs')}>
        {#each tabs as tab (tab.id)}
          <button
            type="button"
            role="tab"
            aria-selected={editorUi.newTab === tab.id}
            class={cn(
              'rounded-md px-3 py-1.5 text-sm',
              editorUi.newTab === tab.id
                ? 'bg-accent/10 font-semibold text-accent'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid={`${TID.newDlgTab}-${tab.id}`}
            onclick={() => switchTab(tab.id)}>
            {tab.label}
          </button>
        {/each}
      </div>
      <span class="text-xs text-muted-foreground">{t('newDlg.note')}</span>
    </div>

    {#if editorUi.newTab === 'type'}
      <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem]" role="tabpanel">
        <div
          role="radiogroup"
          aria-label={t('newDlg.kinds')}
          class="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] content-start gap-2 overflow-y-auto p-3">
          {#each starterKinds as option (option.id)}
            <button
              type="button"
              role="radio"
              aria-checked={kind === option.id}
              class={cn(
                'flex flex-col gap-1.5 rounded-md border p-2 text-left',
                kind === option.id
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-border hover:border-muted-foreground'
              )}
              data-testid={TID.newDlgKind}
              data-kind={option.id}
              onclick={() => {
                kind = option.id;
                direction = undefined;
                message = '';
              }}>
              <span class="grid h-[4.5rem] place-items-center rounded bg-muted">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- a fixed drawing from newThumbs.ts -->
                {@html thumbSvg(starterThumb[option.id], 108)}
              </span>
              <span class="text-sm font-medium">{kindName(option.id)}</span>
            </button>
          {/each}
        </div>
        <aside class="flex min-h-0 flex-col gap-3 border-l border-border p-3">
          <!-- What scrolls when the window is low; the create button below always stays in view. -->
          <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
            <div
              class="grid h-32 shrink-0 place-items-center rounded-md bg-muted"
              data-testid={TID.newDlgPreview}>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- a fixed drawing from newThumbs.ts -->
              {@html thumbSvg(starterThumb[kind], 180)}
            </div>
            <div>
              <h3 class="text-base font-semibold">{kindName(kind)}</h3>
              <p class="text-sm text-muted-foreground">{t(`new.kind.${kind}.hint`)}</p>
            </div>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-semibold">{t('new.diagramTitle')}</span>
              {#if current.title}
                <Input
                  bind:value={title}
                  class="h-9"
                  placeholder={t('newDlg.titlePlaceholder')}
                  data-testid={TID.newDlgTitle}
                  onkeydown={(event) => event.key === 'Enter' && createLink?.click()} />
              {:else}
                <span class="text-xs text-muted-foreground">{t('layout.titleUnsupported')}</span>
              {/if}
            </label>
            {#if current.direction}
              <div class="flex flex-col gap-1 text-sm">
                <span class="font-semibold">{t('new.direction')}</span>
                <div class="flex gap-1">
                  {#each ['TB', 'LR'] as const as option (option)}
                    <Button
                      size="sm"
                      variant={choice(shownDirection === option)}
                      class="flex-1"
                      aria-pressed={shownDirection === option}
                      data-testid={`${TID.newDlgDirection}-${option}`}
                      onclick={() => (direction = option)}>{t(`layout.direction${option}`)}</Button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          <Button
            bind:ref={createLink}
            href={starterHref}
            target="_blank"
            rel="noopener"
            class="w-full shrink-0"
            data-testid={TID.newDlgCreate}
            onclick={() => {
              const name = kindName(kind);
              opened(name, () => (title = ''));
            }}>
            <OpenIcon />
            {t('newDlg.createType', { name: kindName(kind) })}
          </Button>
          {#if shownMessage}
            <p role="status" class="text-xs text-muted-foreground" data-testid={TID.newDlgMessage}>
              {shownMessage}
            </p>
          {/if}
        </aside>
      </div>
    {:else}
      <div class="grid min-h-0 flex-1 grid-cols-[10.5rem_minmax(0,1fr)_18rem]" role="tabpanel">
        <nav
          class="flex min-h-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2"
          aria-label={t('newDlg.samples')}>
          <label class="relative mb-2 flex items-center">
            <span class="sr-only">{t('newDlg.search')}</span>
            <SearchIcon class="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
            <Input
              type="search"
              class="h-9 pl-7 text-sm"
              placeholder={t('newDlg.search')}
              bind:value={query}
              data-testid={TID.newDlgSearch} />
          </label>
          {#each [ALL, ...groupOrder] as group (group)}
            <button
              type="button"
              class={cn(
                'rounded-md px-2.5 py-1.5 text-left text-sm',
                category === group
                  ? 'bg-accent/10 font-semibold text-accent'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              aria-pressed={category === group}
              data-testid={TID.newDlgCategory}
              data-category={group}
              onclick={() => (category = group)}>
              {group === ALL ? t('preset.categoryAll') : shownName(group)}
            </button>
          {/each}
        </nav>
        <div
          class="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] content-start gap-2 overflow-y-auto p-3">
          {#each shown as { example, form, group } (`${group}\n${example.title}`)}
            {@const on = selected?.example === example && selected.group === group}
            <button
              type="button"
              class={cn(
                'flex min-w-0 flex-col gap-1.5 rounded-md border p-2 text-left',
                on
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-border hover:border-muted-foreground'
              )}
              aria-pressed={on}
              data-testid={TID.newDlgSample}
              data-group={group}
              data-title={example.title}
              onclick={() => {
                picked = { group, title: example.title };
                message = '';
              }}>
              <span class="grid h-14 place-items-center rounded bg-muted">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- a fixed drawing from newThumbs.ts -->
                {@html thumbSvg(sampleThumb(group, form?.id), 72)}
              </span>
              <span class="text-sm leading-tight font-medium break-words">{example.title}</span>
              {#if form}
                <span class="self-start rounded bg-accent/10 px-1.5 text-[11px] text-accent"
                  >{t('newDlg.formTag')}</span>
              {/if}
            </button>
          {:else}
            <p class="col-span-full text-sm text-muted-foreground">{t('preset.noMatch')}</p>
          {/each}
        </div>
        <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
          {#if selected}
            {@const { example, form, group } = selected}
            <div
              class="grid h-36 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1 text-xs text-muted-foreground [&>svg]:h-full [&>svg]:max-w-full"
              data-testid={TID.newDlgPreview}>
              {#if previewSvg?.svg}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered by mermaid from the editor's own sample code -->
                {@html previewSvg.svg}
              {:else if previewSvg}
                {t('newDlg.previewEmpty')}
              {/if}
            </div>
            <div>
              <h3 class="text-base font-semibold break-words">{example.title}</h3>
              <p class="text-sm text-muted-foreground">
                {form
                  ? labelOf(form.description, locale)
                  : t('newDlg.sampleHint', { group: shownName(group) })}
              </p>
            </div>
            <Button
              href={newTabHref(example.code)}
              target="_blank"
              rel="noopener"
              class="mt-auto w-full"
              data-testid={TID.newDlgSampleStart}
              onclick={() => {
                logEvent('loadSampleDiagram', { diagramType: group, exampleTitle: example.title });
                opened(example.title);
              }}>
              <OpenIcon />
              {t('newDlg.sampleStart')}
            </Button>
            {#if form}
              <Button
                variant="outline"
                class="h-auto w-full whitespace-normal"
                data-testid={TID.newDlgSampleForm}
                data-form={form.id}
                onclick={() => (templateDialog.id = form.id)}>
                <FormIcon />
                {t('newDlg.sampleForm')}
              </Button>
              <p class="text-xs text-muted-foreground">{t('newDlg.formHint')}</p>
            {/if}
          {/if}
          {#if shownMessage}
            <p role="status" class="text-xs text-muted-foreground" data-testid={TID.newDlgMessage}>
              {shownMessage}
            </p>
          {/if}
        </aside>
      </div>
    {/if}
    <TemplateForms />
  </Dialog.Content>
</Dialog.Root>
