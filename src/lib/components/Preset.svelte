<script lang="ts">
  import { defaultState, TID } from '$/constants';
  import { t } from '$/i18n';
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import NewDiagram from '$/components/NewDiagram.svelte';
  import TemplateForms from '$/components/TemplateForms.svelte';
  import { businessTemplatesName, localExamples, localSamples } from '$/util/localSamples';
  import { getSampleDiagrams, type SampleExample } from '$/util/mermaid';
  import { sampleNameKeys } from '$/util/sampleNames';
  import { templateForms } from '$/util/templateForms';
  import { templateDialog } from '$/util/templateNotice.svelte';
  import { updateCode } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import TemplatesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import FormIcon from '~icons/material-symbols/dynamic-form-outline-rounded';
  import SearchIcon from '~icons/material-symbols/search-rounded';

  // Local: the one place to start from something ready-made — "テンプレート" (upstream's
  // "Sample Diagrams" card). It lists, by category, this fork's business templates and
  // every diagram type's examples (upstream's catalogue, ZenUML and the local ones),
  // with a search box and a category choice instead of upstream's grid of chips. A
  // click loads the template into this tab; a business template that has a form also
  // offers "フォームで作る…", which opens that form (TemplateForms.svelte). "New
  // diagram…" above it opens an empty starter in a new tab.
  const extras: Record<string, SampleExample[]> = {
    ZenUML: [
      {
        title: 'Order Service',
        isDefault: true,
        code: `zenuml
    title Order Service
    @Actor Client #FFEBE6
    @Boundary OrderController #0747A6
    @EC2 <<BFF>> OrderService #E3FCEF
    group BusinessService {
      @Lambda PurchaseService
      @AzureFunction InvoiceService
    }

    @Starter(Client)
    // \`POST /orders\`
    OrderController.post(payload) {
      OrderService.create(payload) {
        order = new Order(payload)
        if(order != null) {
          par {
            PurchaseService.createPO(order)
            InvoiceService.createInvoice(order)
          }
        }
      }
    }
    `
      }
    ]
  };

  const samples = { ...getSampleDiagrams(), ...extras, ...localSamples };
  // Local: Japanese examples join their group's list, after its own default.
  for (const [name, list] of Object.entries(localExamples)) {
    samples[name] = [...(samples[name] ?? []), ...list];
  }
  // Local: what a template's form may replace without asking.
  const sampleCodes = [
    defaultState.code,
    ...Object.values(samples).flatMap((list) => list.map(({ code }) => code))
  ];

  const mainDiagrams = [
    // Local: the Japanese business templates lead, for the users this fork serves.
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

  const ALL = '';
  let category = $state(ALL);
  let query = $state('');

  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replaceAll(/\s+/g, '');
  const formOf = (group: string, title: string) =>
    group === businessTemplatesName
      ? templateForms.find((template) => template.sample === title)
      : undefined;

  /** The groups to show, each with the examples that match the search. */
  const shown = $derived.by(() => {
    const words = query.split(/\s+/).map(normalize).filter(Boolean);
    return groupOrder
      .filter((group) => category === ALL || group === category)
      .map((group) => {
        const name = `${group} ${shownName(group)}`;
        const examples = samples[group].filter(({ title }) => {
          const text = normalize(`${name} ${title}`);
          return words.every((word) => text.includes(word));
        });
        return { examples, group };
      })
      .filter(({ examples }) => examples.length > 0);
  });

  let message = $state('');
  const load = (group: string, example: SampleExample): void => {
    updateCode(example.code, {
      resetPanZoom: true,
      updateDiagram: true
    });
    message = t('preset.loaded', { name: example.title });
    logEvent('loadSampleDiagram', { diagramType: group, exampleTitle: example.title });
  };
</script>

<Card
  title={t('preset.title')}
  testID={TID.sampleDiagramsCard}
  isOpen
  isStackable
  icon={{ component: TemplatesIcon }}>
  <NewDiagram />
  <TemplateForms samples={sampleCodes} />
  <div class="flex flex-col gap-2 p-2 text-sm">
    <p class="text-xs text-muted-foreground">{t('preset.intro')}</p>
    <label class="relative flex items-center">
      <span class="sr-only">{t('preset.search')}</span>
      <SearchIcon class="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
      <Input
        type="search"
        class="h-9 pl-8"
        placeholder={t('preset.search')}
        bind:value={query}
        data-testid={TID.templateSearch} />
    </label>
    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-muted-foreground">{t('preset.category')}</span>
      <select
        class="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        bind:value={category}
        data-testid={TID.templateCategory}>
        <option value={ALL}>{t('preset.categoryAll')}</option>
        {#each groupOrder as group (group)}
          <option value={group}>{shownName(group)}</option>
        {/each}
      </select>
    </label>
    {#if message}
      <p role="status" class="text-xs text-muted-foreground" data-testid={TID.templatePickMessage}>
        {message}
      </p>
    {/if}
    <!-- On desktop the open card is the only scroll; on a phone the list is boxed in. -->
    <div class="flex max-h-80 flex-col gap-3 overflow-y-auto sm:max-h-none sm:overflow-visible">
      {#each shown as { group, examples } (group)}
        <section class="flex flex-col gap-1" aria-label={shownName(group)}>
          <h3
            class="sticky top-0 z-10 bg-card py-1 text-xs font-semibold text-muted-foreground"
            data-template-group={group}>
            {shownName(group)}
          </h3>
          {#each examples as example, index (example.title)}
            {@const form = formOf(group, example.title)}
            <div class="flex min-w-0 items-stretch gap-1">
              <button
                type="button"
                class="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-left break-words hover:bg-muted"
                data-testid={TID.templatePick}
                data-group={group}
                data-title={example.title}
                data-default={index === 0}
                onclick={() => load(group, example)}>
                {example.title}
              </button>
              {#if form}
                <Button
                  size="sm"
                  variant="outline"
                  class="h-auto shrink-0"
                  title={t('preset.fillForm')}
                  data-testid={`${TID.templateFormsItem}-${form.id}`}
                  onclick={() => (templateDialog.id = form.id)}>
                  <FormIcon />
                  {t('preset.fillForm')}
                </Button>
              {/if}
            </div>
          {/each}
        </section>
      {:else}
        <p class="text-muted-foreground">{t('preset.noMatch')}</p>
      {/each}
    </div>
  </div>
</Card>
