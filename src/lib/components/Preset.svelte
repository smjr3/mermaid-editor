<script lang="ts">
  import { defaultState, TID } from '$/constants';
  import { t } from '$/i18n';
  import Card from '$/components/Card/Card.svelte';
  import { Button, buttonVariants } from '$/components/ui/button';
  import * as Popover from '$/components/ui/popover';
  import NewDiagram from '$/components/NewDiagram.svelte';
  import { businessTemplatesName, localExamples, localSamples } from '$/util/localSamples';
  import { getSampleDiagrams, type SampleExample } from '$/util/mermaid';
  import { sampleNameKeys } from '$/util/sampleNames';
  import { updateCode } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import { cn } from '$lib/utils';
  import ShapesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import ChevronDownIcon from '~icons/material-symbols/keyboard-arrow-down-rounded';

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
  // Local: what "New diagram" may replace without asking.
  const sampleCodes = [
    defaultState.code,
    ...Object.values(samples).flatMap((list) => list.map(({ code }) => code))
  ];

  const loadSampleDiagram = (diagramType: string, example: SampleExample): void => {
    updateCode(example.code, {
      resetPanZoom: true,
      updateDiagram: true
    });
    logEvent('loadSampleDiagram', { diagramType, exampleTitle: example.title });
  };

  const mainDiagrams = [
    // Local: the Japanese business templates lead, for the users this fork serves.
    businessTemplatesName,
    'Flowchart',
    'Class',
    'Sequence',
    'Entity Relationship',
    'State',
    'Mindmap'
  ];

  // The group names are mermaid's catalogue keys; the common ones are shown in Japanese.
  const shownName = (sample: string) => {
    const key = sampleNameKeys[sample];
    return key ? t(key) : sample;
  };

  const diagramOrder = [
    ...mainDiagrams,
    ...Object.keys(samples)
      .filter((key) => !mainDiagrams.includes(key))
      .sort()
  ];
</script>

<Card
  title={t('preset.title')}
  testID={TID.sampleDiagramsCard}
  isOpen
  isStackable
  icon={{ component: ShapesIcon }}>
  <NewDiagram samples={sampleCodes} />
  <!-- Local: a grid that fits the width (no sideways scroll); on desktop the open card
       is the only scroll, so the list is not boxed in. A long name wraps to two lines. -->
  <div
    class="grid h-fit max-h-52 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 overflow-y-auto p-2 sm:max-h-none sm:overflow-visible">
    {#each diagramOrder as sample (sample)}
      {@const examples = samples[sample]}
      <div class="flex min-w-0">
        <Button
          size="sm"
          title={shownName(sample)}
          class={cn(
            'line-clamp-2 block h-auto min-h-8 min-w-0 flex-grow py-1 leading-tight break-words whitespace-normal normal-case',
            examples.length > 1 && 'rounded-r-none'
          )}
          onclick={() => loadSampleDiagram(sample, examples[0])}>
          {shownName(sample)}
        </Button>
        {#if examples.length > 1}
          <Popover.Root>
            <Popover.Trigger
              aria-label={t('preset.chooseExample', { sample: shownName(sample) })}
              class={cn(
                buttonVariants({ size: 'sm' }),
                'h-auto rounded-l-none border-l border-primary-foreground/30 px-0.5 [&_svg]:size-5'
              )}>
              <ChevronDownIcon />
            </Popover.Trigger>
            <Popover.Content align="start" class="flex w-fit flex-col gap-1 p-1">
              {#each examples as example (example.title)}
                <Popover.Close
                  class={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'justify-start normal-case'
                  )}
                  onclick={() => loadSampleDiagram(sample, example)}>
                  {example.title}
                </Popover.Close>
              {/each}
            </Popover.Content>
          </Popover.Root>
        {/if}
      </div>
    {/each}
  </div>
</Card>
