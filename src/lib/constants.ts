import type { State } from './types';

export const TID = {
  actionsCard: 'actions-card',
  aiHelpText: 'ai-help-text',
  aiRepairButton: 'ai-repair-button',
  copyMarkdown: 'copy-markdown',
  diagramDocumentationButton: 'diagram-documentation-button',
  downloadHTML: 'download-HTML',
  downloadPNG: 'download-PNG',
  downloadSVG: 'download-SVG',
  editorFocusToggle: 'editor-focus-toggle',
  editorPaneToggle: 'editor-pane-toggle',
  editorRail: 'editor-rail',
  editorRailExpand: 'editor-rail-expand',
  embedEditLink: 'embed-edit-link',
  embedErrorCard: 'embed-error-card',
  embedFooter: 'embed-footer',
  embedModeToggle: 'embed-mode-toggle',
  embedPreview: 'embed-preview',
  embedRenderError: 'embed-render-error',
  embedSaveLink: 'embed-save-link',
  embedSnippet: 'embed-snippet',
  embedToolbar: 'embed-toolbar',
  errorContainer: 'error-container',
  historyCard: 'history-card',
  historyRevisionsTab: 'history-revisions-tab',
  iconPackFiles: 'icon-pack-files',
  iconPackImport: 'icon-pack-import',
  iconPackList: 'icon-pack-list',
  iconPackPrefix: 'icon-pack-prefix',
  iconPacksCard: 'icon-packs-card',
  iconPickerEnlarge: 'icon-picker-enlarge',
  iconPickerLargePack: 'icon-picker-large-pack',
  iconPickerLargeResults: 'icon-picker-large-results',
  iconPickerLargeSearch: 'icon-picker-large-search',
  iconPickerMessage: 'icon-picker-message',
  iconPickerPack: 'icon-picker-pack',
  iconPickerResults: 'icon-picker-results',
  iconPickerSearch: 'icon-picker-search',
  layoutCard: 'layout-card',
  layoutDirectionLR: 'layout-direction-lr',
  layoutDirectionTB: 'layout-direction-tb',
  layoutEngineDagre: 'layout-engine-dagre',
  layoutEngineElk: 'layout-engine-elk',
  layoutFit: 'layout-fit',
  layoutMessage: 'layout-message',
  layoutSpacing: 'layout-spacing',
  localeToggleButton: 'locale-toggle-button',
  resetConfigButton: 'reset-config-button',
  sampleDiagramsCard: 'sample-diagrams-card',
  themeToggleButton: 'theme-toggle-button'
} as const;

export const C = {
  aiLiveEditor: 'ai_live_editor',
  editorChooserDismissedKey: 'mermaid-editor-chooser-dismissed',
  utmSource: 'mermaid_live_editor'
} as const;

export const MERMAID_THEMES = [
  'default',
  'neutral',
  'forest',
  'dark',
  'neo',
  'neo-dark',
  'redux',
  'redux-dark',
  'redux-color',
  'redux-dark-color'
] as const;

export const MERMAID_LOOKS = ['classic', 'handDrawn', 'neo'] as const;

export const defaultState: State = {
  code: `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
  `,
  grid: true,
  // Empty on purpose: mermaid picks its own theme, look and layout per diagram type.
  mermaid: '{}',
  panZoom: true,
  rough: false,
  updateDiagram: true
};
