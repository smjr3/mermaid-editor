import type { SampleExample } from './mermaid';

/**
 * Sample diagrams this fork adds to the "Sample Diagrams" card.
 *
 * `@mermaid-js/examples` has no swimlane entry, yet swimlane support is the
 * reason this fork exists. Kept in its own file so `Preset.svelte` gains one
 * spread rather than a block of code, and an upstream merge touches neither.
 * Drop an entry once `@mermaid-js/examples` ships one under the same name.
 */
export const localSamples: Record<string, SampleExample[]> = {
  Swimlane: [
    {
      code: `swimlane-beta LR
  subgraph Customer
    A[Place order] --> B[Receive goods]
  end
  subgraph Shop
    C[Accept order] --> D{In stock?}
    D -->|Yes| E[Ship]
    D -->|No| F[Back-order]
  end
  subgraph Warehouse
    G[Pick and pack]
  end
  A --> C
  E --> G
  G --> B
  F --> A`,
      isDefault: true,
      title: 'Order Fulfilment'
    },
    {
      code: `swimlane-beta TB
  subgraph Requester
    A[Submit request] --> B[Revise]
  end
  subgraph Manager
    C{Approve?}
  end
  subgraph Finance
    D[Process payment] --> E[Notify requester]
  end
  A --> C
  C -->|No| B
  B --> C
  C -->|Yes| D`,
      title: 'Approval Workflow'
    }
  ]
};
