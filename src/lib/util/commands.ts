/**
 * Local: the registry and matcher behind the command palette (CommandPalette.svelte,
 * Ctrl+K / ⌘K). Pure data and a small scorer, so both are unit-tested; the palette
 * and `uiBus.ts` do the opening and focusing.
 *
 * Each entry has a Japanese and an English label, keywords for matching (English
 * words people type, plus Japanese synonyms) and a target: a tools card to open
 * (optionally with a control to focus or click, by data-testid), or an action.
 */
import { TID } from '$/constants';
import { messages, type MessageKey } from '$/i18n/messages';
import { themePresets } from './themePresets';

export type CommandAction =
  'guide' | 'help' | 'history' | 'locale' | 'redo' | 'share' | 'theme' | 'undo';

export interface CardTarget {
  kind: 'card';
  /** data-testid of the card header to open. */
  card: string;
  /** data-testid of a control to focus once the card is open. */
  focus?: string;
  /** data-testid of a control to press once the card is open. */
  click?: string;
  /** A control to press, found by its text (for controls without a test id). */
  clickLabel?: MessageKey;
}

export type CommandTarget = CardTarget | { kind: 'action'; action: CommandAction };

export interface Command {
  id: string;
  ja: string;
  en: string;
  keywords: string[];
  target: CommandTarget;
}

const card = (cardId: string, more: Omit<CardTarget, 'card' | 'kind'> = {}): CommandTarget => ({
  card: cardId,
  kind: 'card',
  ...more
});
const action = (name: CommandAction): CommandTarget => ({ action: name, kind: 'action' });

export const commands: Command[] = [
  {
    en: 'New diagram',
    id: 'new',
    ja: '新しい図を作る',
    keywords: ['new', 'create', 'start', 'blank', '新規', '作成'],
    target: card(TID.sampleDiagramsCard, { click: TID.newDiagramToggle })
  },
  {
    en: 'Add shapes',
    id: 'add',
    ja: '要素を追加',
    keywords: [
      'add',
      'node',
      'lane',
      'box',
      'arrow',
      'connect',
      'shape',
      '追加',
      'ノード',
      'レーン'
    ],
    target: card(TID.addCard, { focus: TID.addNodeName })
  },
  {
    en: 'Edit shapes',
    id: 'edit',
    ja: '要素を編集',
    keywords: ['edit', 'rename', 'delete', 'remove', 'change', 'text', '編集', '削除', '名前'],
    target: card(TID.editCard, { focus: TID.editObjectSelect })
  },
  {
    en: 'Change colours',
    id: 'colors',
    ja: '色を変える',
    keywords: ['color', 'colour', 'colors', 'fill', 'style', 'paint', 'bold', '色', '塗り'],
    target: card(TID.colorsCard, { focus: TID.colorsNodeSelect })
  },
  {
    en: 'Change direction',
    id: 'layout',
    ja: '向きを変える',
    keywords: [
      'direction',
      'layout',
      'orientation',
      'horizontal',
      'vertical',
      'spacing',
      'elk',
      '向き',
      'レイアウト',
      '縦',
      '横'
    ],
    target: card(TID.layoutCard, { focus: TID.layoutDirectionTB })
  },
  {
    en: 'Find an icon',
    id: 'icons',
    ja: 'アイコンを探す',
    keywords: ['icon', 'icons', 'logo', 'search', 'aws', 'pack', 'アイコン', 'ロゴ', '検索'],
    target: card(TID.iconPacksCard, { focus: TID.iconPickerSearch })
  },
  {
    en: 'Save as PNG',
    id: 'png',
    ja: 'PNG で保存',
    keywords: ['png', 'image', 'download', 'export', 'save', 'picture', '画像', 'ダウンロード'],
    target: card(TID.actionsCard, { click: TID.downloadPNG })
  },
  {
    en: 'Save as SVG',
    id: 'svg',
    ja: 'SVG で保存',
    keywords: ['svg', 'vector', 'download', 'export', 'save', 'ダウンロード'],
    target: card(TID.actionsCard, { click: TID.downloadSVG })
  },
  {
    en: 'Copy image',
    id: 'copy-image',
    ja: '画像をコピー',
    keywords: ['copy', 'clipboard', 'image', 'paste', 'コピー', 'クリップボード', '画像'],
    target: card(TID.actionsCard, { clickLabel: 'actions.copyImage' })
  },
  {
    en: 'Save as HTML',
    id: 'html',
    ja: 'HTML で保存',
    keywords: ['html', 'page', 'standalone', 'download', 'export', 'offline', 'ダウンロード'],
    target: card(TID.actionsCard, { click: TID.downloadHTML })
  },
  {
    en: 'Share link',
    id: 'share',
    ja: '共有リンク',
    keywords: ['share', 'link', 'url', 'embed', 'iframe', '共有', 'リンク', '埋め込み'],
    target: action('share')
  },
  {
    en: 'How to use',
    id: 'help',
    ja: '使い方',
    keywords: ['help', 'guide', 'manual', 'docs', 'how', 'ヘルプ', '案内', 'マニュアル'],
    target: action('help')
  },
  {
    en: 'Replay the first-visit guide',
    id: 'guide',
    ja: '最初の案内をもう一度見る',
    keywords: ['guide', 'tour', 'onboarding', 'intro', 'welcome', 'tutorial', '案内', 'ツアー'],
    target: action('guide')
  },
  {
    en: 'Undo',
    id: 'undo',
    ja: '元に戻す',
    keywords: ['undo', 'back', 'revert', 'ctrl+z', '戻す', '取り消し'],
    target: action('undo')
  },
  {
    en: 'Redo',
    id: 'redo',
    ja: 'やり直す',
    keywords: ['redo', 'again', 'forward', 'ctrl+y', 'やり直し', '進む'],
    target: action('redo')
  },
  {
    en: 'Switch theme',
    id: 'theme',
    ja: 'テーマ切替',
    keywords: ['theme', 'dark', 'light', 'mode', 'ダーク', 'ライト', 'テーマ'],
    target: action('theme')
  },
  {
    en: 'Switch language',
    id: 'language',
    ja: '言語切替',
    keywords: ['language', 'locale', 'english', 'japanese', 'translate', '言語', '日本語', '英語'],
    target: action('locale')
  },
  {
    en: 'History',
    id: 'history',
    ja: '履歴',
    keywords: [
      'history',
      'timeline',
      'versions',
      'revisions',
      'restore',
      '履歴',
      'バージョン',
      '復元'
    ],
    target: action('history')
  },
  {
    en: 'Open samples',
    id: 'samples',
    ja: 'サンプルを開く',
    keywords: [
      'sample',
      'samples',
      'example',
      'examples',
      'template',
      'サンプル',
      '例',
      'テンプレート'
    ],
    target: card(TID.sampleDiagramsCard)
  },
  {
    en: 'Copy the description for AI',
    id: 'ai-icons',
    ja: 'AI用の説明をコピー',
    keywords: [
      'ai',
      'prompt',
      'copy',
      'icons',
      'chatgpt',
      'claude',
      'briefing',
      'プロンプト',
      '説明'
    ],
    target: card(TID.iconPacksCard, { focus: TID.aiCopyButton })
  },
  {
    en: 'Fix unknown icons',
    id: 'unknown-icons',
    ja: '不明なアイコンを直す',
    keywords: [
      'unknown',
      'broken',
      'missing',
      'fix',
      'icon',
      'icons',
      'replace',
      '不明',
      '壊れ',
      '直す'
    ],
    target: card(TID.iconPacksCard, { focus: TID.unknownIcons })
  }
];

// Local: one entry per named theme (themePresets.ts), 「テーマ: ネオン」, pressing its card.
const themeCommands: Command[] = themePresets.map(({ id, name }) => ({
  en: `Theme: ${messages.en[name]}`,
  id: `theme-${id}`,
  ja: `テーマ: ${messages.ja[name]}`,
  keywords: ['theme', 'design', 'style', 'look', 'テーマ', 'デザイン', '配色', id],
  target: card(TID.colorsCard, { click: `${TID.colorsThemePreset}-${id}` })
}));
commands.push(...themeCommands);

const normalize = (text: string): string =>
  text.normalize('NFKC').toLowerCase().replaceAll(/\s+/g, '');

/** Whether the letters of `needle` appear in `haystack` in order. */
const isSubsequence = (needle: string, haystack: string): boolean => {
  let at = 0;
  for (const char of haystack) {
    if (char === needle[at]) at++;
    if (at === needle.length) return true;
  }
  return needle.length === 0;
};

const scoreText = (query: string, text: string, weight: number): number => {
  const value = normalize(text);
  if (value === query) return 100 * weight;
  if (value.startsWith(query)) return 80 * weight;
  if (value.includes(query)) return 60 * weight;
  // A loose match is only allowed for queries long enough to mean something.
  if (query.length >= 3 && isSubsequence(query, value)) return 20 * weight;
  return 0;
};

/**
 * How well `query` fits `command`: 0 means no match. Labels count more than
 * keywords; exact, prefix, substring and in-order-letters matches rank in that order.
 */
export const scoreCommand = (query: string, command: Command): number => {
  const q = normalize(query);
  if (q === '') return 1;
  const label = Math.max(scoreText(q, command.ja, 1.5), scoreText(q, command.en, 1.5));
  const keyword = Math.max(0, ...command.keywords.map((word) => scoreText(q, word, 1)));
  return Math.max(label, keyword);
};

/** The commands that match `query`, best first (registry order breaks ties). */
export const searchCommands = (query: string, list: Command[] = commands): Command[] =>
  list
    .map((command, index) => ({ command, index, score: scoreCommand(query, command) }))
    .filter(({ score }) => score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .map(({ command }) => command);
