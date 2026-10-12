/**
 * Local: every sample the editor offers, by group — upstream's catalogue
 * (`@mermaid-js/examples`), ZenUML (which the catalogue lacks), this fork's local
 * samples (business templates, swimlanes, …) and the Japanese examples that join their
 * group's list after its own default (`localSamples.ts`). Extracted from Preset.svelte so
 * the 新規 dialog and the tests read the same list.
 */
import { localExamples, localSamples } from './localSamples';
import { getSampleDiagrams, type SampleExample } from './mermaid';

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

let cache: Record<string, SampleExample[]> | undefined;

/** The samples by group (the group name is the catalogue key, e.g. 'Flowchart'). */
export const sampleCatalog = (): Record<string, SampleExample[]> => {
  if (cache) return cache;
  const samples = { ...getSampleDiagrams(), ...extras, ...localSamples };
  // Japanese examples join their group's list, after its own default.
  for (const [name, list] of Object.entries(localExamples)) {
    samples[name] = [...(samples[name] ?? []), ...list];
  }
  cache = samples;
  return samples;
};

/** A group's sample by title, or the group's first (default) one. */
export const findSample = (group: string, title?: string): SampleExample | undefined => {
  const list = sampleCatalog()[group] ?? [];
  return title === undefined ? list[0] : list.find((example) => example.title === title);
};
