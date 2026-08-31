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
    'history.deleteAll': 'Delete all saved states',
    'history.deleteVersion': 'Delete this version',
    'history.download': 'Download history',
    'history.openNewTab': 'Open in new tab',
    'history.openRevisionNewTab': 'Open revision in new tab',
    'history.rename': 'Rename',
    'history.renameEntry': 'Rename entry',
    'history.restoreVersion': 'Restore this version',
    'history.save': 'Save current state',
    'history.tabRevisions': 'Revisions',
    'history.tabSaved': 'Saved',
    'history.tabTimeline': 'Timeline',
    'history.upload': 'Upload history',
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
    'preset.title': 'Sample Diagrams',
    'share.embedPreview': 'Embed preview',
    'share.iframe': 'iframe',
    'share.subtitle': 'Share your diagrams with others.',
    'share.themeDark': 'Dark',
    'share.themeLight': 'Light',
    'share.title': 'Share',
    'share.webComponent': 'Web component',
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
    'history.deleteAll': '保存した状態をすべて削除',
    'history.deleteVersion': 'このバージョンを削除',
    'history.download': '履歴をダウンロード',
    'history.openNewTab': '新しいタブで開く',
    'history.openRevisionNewTab': 'リビジョンを新しいタブで開く',
    'history.rename': '名前を変更',
    'history.renameEntry': '項目の名前を変更',
    'history.restoreVersion': 'このバージョンを復元',
    'history.save': '現在の状態を保存',
    'history.tabRevisions': 'リビジョン',
    'history.tabSaved': '保存済み',
    'history.tabTimeline': 'タイムライン',
    'history.upload': '履歴をアップロード',
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
    'preset.title': 'サンプル図',
    'share.embedPreview': '埋め込みプレビュー',
    'share.iframe': 'iframe',
    'share.subtitle': '作成した図を共有できます。',
    'share.themeDark': 'ダーク',
    'share.themeLight': 'ライト',
    'share.title': '共有',
    'share.webComponent': 'Web コンポーネント',
    'toolbar.backgroundGrid': '背景グリッド',
    'toolbar.handDrawn': '手描き風',
    'toolbar.privacySecurity': 'プライバシーとセキュリティ'
  }
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)['en'];
