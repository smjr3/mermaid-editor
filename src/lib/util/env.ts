export const env = {
  analyticsUrl: import.meta.env.MERMAID_ANALYTICS_URL ?? '',
  // Local: a palette of border colours for the Colours card, as `#rrggbb,…` (colors.ts).
  colorPresets: import.meta.env.MERMAID_COLOR_PRESETS ?? '',
  docsUrl: import.meta.env.MERMAID_DOCS_URL ?? 'https://mermaid.js.org',
  domain: import.meta.env.MERMAID_DOMAIN ?? '',
  hidePrivacyPolicy: import.meta.env.MERMAID_HIDE_PRIVACY_POLICY === 'true',
  // Local: extra icon packs this deployment hosts, as `prefix=url,…` (customIcons.ts).
  iconPacks: import.meta.env.MERMAID_ICON_PACKS ?? '',
  isEnabledAiFeatures: import.meta.env.MERMAID_IS_ENABLED_AI_FEATURES === 'true',
  isEnabledCommunityLinks: import.meta.env.MERMAID_IS_ENABLED_COMMUNITY_LINKS === 'true',
  isEnabledMermaidChartLinks: import.meta.env.MERMAID_IS_ENABLED_MERMAID_CHART_LINKS === 'true',
  krokiRendererUrl: import.meta.env.MERMAID_KROKI_RENDERER_URL ?? '',
  locale: import.meta.env.MERMAID_LOCALE,
  privacyPolicyUrl: import.meta.env.MERMAID_PRIVACY_POLICY_URL ?? '',
  rendererUrl: import.meta.env.MERMAID_RENDERER_URL ?? ''
} as const;

export const MCBaseURL = env.isEnabledMermaidChartLinks
  ? 'https://mermaid.ai' // 'http://localhost:5174'
  : 'https://example.com';
