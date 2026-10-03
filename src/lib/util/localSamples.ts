import type { SampleExample } from './mermaid';

/**
 * Sample diagrams this fork adds to the "Sample Diagrams" card.
 *
 * `@mermaid-js/examples` has no swimlane entry, yet swimlane support is the
 * reason this fork exists. "System Architecture" shows the bundled icon packs
 * (iconPacks.ts), which upstream's architecture samples do not use. Kept in its own file so `Preset.svelte` gains one
 * spread rather than a block of code, and an upstream merge touches neither.
 * Drop an entry once `@mermaid-js/examples` ships one under the same name.
 */
export const localSamples: Record<string, SampleExample[]> = {
  'System Architecture': [
    {
      code: `architecture-beta
  group dmz(tabler:shield)[DMZ]
  group app(tabler:server-2)[Application]

  service users(tabler:users)[Users]
  service fw(tabler:firewall-check)[Firewall]
  service lb(tabler:load-balancer)[Load balancer] in dmz
  service web(tabler:server)[Web servers] in app
  service db(tabler:database)[Database] in app

  users:R --> L:fw
  fw:R --> L:lb
  lb:R --> L:web
  web:B --> T:db`,
      isDefault: true,
      title: 'Web System'
    },
    {
      code: `architecture-beta
  group office(tabler:building)[Office]

  service internet(tabler:world)[Internet]
  service router(tabler:router)[Router] in office
  service switch(tabler:switch)[Switch] in office
  service ap(tabler:wifi)[Wi-Fi] in office
  service pc(tabler:device-desktop)[PCs] in office
  service printer(tabler:printer)[Printer] in office
  service laptop(tabler:device-laptop)[Laptops] in office

  internet:R --> L:router
  router:R --> L:switch
  switch:R --> L:pc
  switch:B --> T:printer
  switch:T --> B:ap
  ap:R --> L:laptop`,
      title: 'Office Network'
    },
    {
      code: `architecture-beta
  group cloud(lucide:cloud)[Cloud]

  service user(tabler:user)[User]
  service gw(lucide:shield)[API gateway] in cloud
  service app(lucide:container)[Containers] in cloud
  service db(lucide:database)[Database] in cloud
  service files(lucide:hard-drive)[Storage] in cloud

  user:R --> L:gw
  gw:R --> L:app
  app:B --> T:db
  app:R --> L:files`,
      title: 'Cloud (generic)'
    }
  ],
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
