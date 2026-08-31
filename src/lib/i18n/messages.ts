/**
 * UI message catalogue.
 *
 * Deliberately a plain object rather than an i18n framework. Paraglide and the
 * like want a build plugin and, in their SvelteKit form, ownership of locale
 * routing — machinery this fork has no use for, since it ships one locale and
 * builds a static site served from a fixed subpath. What the framework would buy
 * us is that UI strings live in one place, and that is what this file is.
 *
 * `en` holds upstream's original wording, so nothing is lost and the editor can
 * be built in English by setting MERMAID_LOCALE=en.
 */

export const messages = {
  en: {
    'actions.copyImage': 'Copy Image',
    'actions.copyMarkdown': 'Copy Markdown',
    'actions.gistPlaceholder': 'Enter Gist URL',
    'actions.loadGist': 'Load Gist',
    'actions.pngSize': 'PNG size',
    'actions.sizeAuto': 'Auto',
    'actions.sizeHeight': 'Height',
    'actions.sizeWidth': 'Width',
    'actions.title': 'Actions',
    'editor.configTab': 'Config',
    'editor.docsTab': 'Docs',
    'editor.syntaxError': 'Syntax error',
    'editor.textTab': 'Code',
    'error.returnHome': 'Return to Home',
    'menu.darkMode': 'Dark Mode',
    'menu.documentation': 'Documentation',
    'menu.duplicate': 'Duplicate',
    'menu.mermaidJs': 'Mermaid.js',
    'menu.new': 'New',
    'nav.dismissBanner': 'Dismiss banner',
    'panzoom.fullScreen': 'Full Screen',
    'panzoom.resetView': 'Reset view',
    'panzoom.zoomIn': 'Zoom in',
    'panzoom.zoomOut': 'Zoom out',
    'toolbar.backgroundGrid': 'Background Grid',
    'toolbar.handDrawn': 'Hand-Drawn',
    'toolbar.privacySecurity': 'Privacy & Security'
  },
  ja: {
    'actions.copyImage': '画像をコピー',
    'actions.copyMarkdown': 'Markdown をコピー',
    'actions.gistPlaceholder': 'Gist の URL を入力',
    'actions.loadGist': 'Gist を読み込む',
    'actions.pngSize': 'PNG サイズ',
    'actions.sizeAuto': '自動',
    'actions.sizeHeight': '高さ',
    'actions.sizeWidth': '幅',
    'actions.title': '操作',
    'editor.configTab': '設定',
    'editor.docsTab': 'ドキュメント',
    'editor.syntaxError': '構文エラー',
    'editor.textTab': 'コード',
    'error.returnHome': 'ホームに戻る',
    'menu.darkMode': 'ダークモード',
    'menu.documentation': 'ドキュメント',
    'menu.duplicate': '複製',
    'menu.mermaidJs': 'Mermaid.js',
    'menu.new': '新規',
    'nav.dismissBanner': 'バナーを閉じる',
    'panzoom.fullScreen': '全画面',
    'panzoom.resetView': '表示をリセット',
    'panzoom.zoomIn': '拡大',
    'panzoom.zoomOut': '縮小',
    'toolbar.backgroundGrid': '背景グリッド',
    'toolbar.handDrawn': '手描き風',
    'toolbar.privacySecurity': 'プライバシーとセキュリティ'
  }
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)['en'];
