import type { SampleExample } from './mermaid';

/**
 * Sample diagrams this fork adds to the "Sample Diagrams" card.
 *
 * `@mermaid-js/examples` has no swimlane entry, yet swimlane support is the
 * reason this fork exists. "Cloud Architecture" shows the bundled icon packs
 * (iconPacks.ts), which upstream's architecture samples do not use. Kept in its own file so `Preset.svelte` gains one
 * spread rather than a block of code, and an upstream merge touches neither.
 * Drop an entry once `@mermaid-js/examples` ships one under the same name.
 */
export const localSamples: Record<string, SampleExample[]> = {
  'Cloud Architecture': [
    {
      code: `architecture-beta
  group aws(logos:aws)[AWS]

  service user(mdi:account)[User]
  service cdn(logos:aws-cloudfront)[CloudFront] in aws
  service api(logos:aws-api-gateway)[API Gateway] in aws
  service fn(logos:aws-lambda)[Lambda] in aws
  service db(logos:aws-dynamodb)[DynamoDB] in aws
  service files(logos:aws-s3)[S3] in aws

  user:R --> L:cdn
  cdn:R --> L:api
  api:R --> L:fn
  fn:B --> T:db
  fn:R --> L:files`,
      isDefault: true,
      title: 'AWS'
    },
    {
      code: `architecture-beta
  group azure(logos:microsoft-azure)[Azure]

  service user(mdi:account)[User]
  service web(mdi:web)[App Service] in azure
  service fn(simple-icons:azurefunctions)[Functions] in azure
  service sql(simple-icons:microsoftsqlserver)[SQL Database] in azure

  user:R --> L:web
  web:R --> L:fn
  fn:B --> T:sql`,
      title: 'Azure'
    },
    {
      code: `architecture-beta
  group gcp(logos:google-cloud)[Google Cloud]

  service user(mdi:account)[User]
  service run(logos:google-cloud-run)[Cloud Run] in gcp
  service queue(simple-icons:googlepubsub)[Pub/Sub] in gcp
  service fn(logos:google-cloud-functions)[Cloud Functions] in gcp
  service bq(simple-icons:googlebigquery)[BigQuery] in gcp

  user:R --> L:run
  run:R --> L:queue
  queue:R --> L:fn
  fn:B --> T:bq`,
      title: 'Google Cloud'
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
