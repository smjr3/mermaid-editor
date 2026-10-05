/**
 * Local: the "How to use" dialog (HelpButton.svelte). Kept out of the message
 * catalogue because it is prose, not UI strings; both languages carry the same
 * sections in the same order (helpContent.test.ts).
 */
import type { Locale } from '$/i18n/messages';

export interface HelpSection {
  id: string;
  title: string;
  items: string[];
}

export const helpContent: Record<Locale, HelpSection[]> = {
  en: [
    {
      id: 'basics',
      items: [
        'Write the diagram on the left; the picture on the right follows as you type.',
        'Drag the picture to move it, and use the wheel or the buttons at its top right to zoom.',
        'Your work is kept in this browser; History (clock icon) brings back earlier versions.'
      ],
      title: 'The basics'
    },
    {
      id: 'start',
      items: [
        'Samples: pick a diagram type to load a ready-made example to edit; 業務テンプレート holds Japanese business templates (approval flow, swimlanes, gantt, org chart, …).',
        'Add: type a name and press a button to add a lane, node, participant, task, … without writing the syntax.',
        'The Docs tab opens the mermaid documentation for the kind of diagram you are writing.'
      ],
      title: 'Starting a diagram'
    },
    {
      id: 'add',
      items: [
        'Works for flowcharts, swimlanes, architecture, sequence, state, class, ER, mindmap, gantt, pie, kanban, timeline, C4 and block diagrams.',
        'Choose where it goes (lane, group, section, column, …), its shape, and what it is joined from; "Connect" joins two existing shapes.',
        'What you just added becomes the next "from", so a flow can be built step by step.'
      ],
      title: 'Adding shapes'
    },
    {
      id: 'layout',
      items: [
        'Direction: top to bottom or left to right; "Fit to view" picks the one that shows larger.',
        'Layout engine: Standard, or ELK for compact layouts of large diagrams.',
        'Spacing: compact, normal or wide.'
      ],
      title: 'Layout'
    },
    {
      id: 'colours',
      items: [
        'Theme and line colour for the whole diagram.',
        'Colours per lane, per shape (node, state, class, entity, …) and per arrow: choose from the list, or click it in the picture.',
        'Text per shape: bold, font size and text colour; C4 elements take a text colour only.',
        '"Any colour" picks freely; colours you picked are offered again next time.'
      ],
      title: 'Colours'
    },
    {
      id: 'icons',
      items: [
        'Icons: search by name and click an icon to insert its name at the cursor.',
        'A green dot marks mermaid’s standard icons (they render anywhere); others need this editor or the same icon packs.',
        'Architecture diagrams use them as service(icon)[Name].',
        '"Icon licences and trademarks" in the Icons card lists each set\'s licence; logos (™) stay their owners\' trademarks.'
      ],
      title: 'Icons'
    },
    {
      id: 'export',
      items: [
        'Actions: download PNG or SVG, a standalone HTML page, an HTML tag, or a GitLab-ready SVG with Markdown.',
        'Share: the link holds the whole diagram, so whoever opens it sees the same thing.'
      ],
      title: 'Export and share'
    },
    {
      id: 'tips',
      items: [
        'F2 on a name renames it everywhere in the diagram.',
        'The button at the top of the editor folds the left side to icons; "Hide the tools" gives the code more room.',
        'The sun / moon button switches dark mode; the Config tab holds the mermaid settings.',
        'An error shows in red with its line; Ctrl+Z (Cmd+Z) undoes, and History goes further back.',
        'The undo / redo arrows above the code take back the last change, including what the Add, Colours and Layout cards wrote.'
      ],
      title: 'Tips'
    }
  ],
  ja: [
    {
      id: 'basics',
      items: [
        '左にコードを書くと、右の図がすぐに変わります。',
        '図はドラッグで動かし、マウスホイールや右上のボタンで拡大・縮小できます。',
        '作業内容はこのブラウザに保存されます。時計のアイコン（履歴）で前の状態に戻せます。'
      ],
      title: '基本'
    },
    {
      id: 'start',
      items: [
        '「サンプル図」で図の種類を選ぶと、ひな形が入るので書き換えて使えます。「業務テンプレート」には稟議・承認フロー、スイムレーン、工程表、組織図などの日本語のひな形があります。',
        '「追加」で名前を入れてボタンを押すと、レーン・ノード・登場人物・タスクなどを書き方を知らなくても足せます。',
        '「ドキュメント」タブで、今書いている図の書き方（Mermaid公式）を開けます。'
      ],
      title: '図を作り始める'
    },
    {
      id: 'add',
      items: [
        'フローチャート・スイムレーン・アーキテクチャ・シーケンス・状態・クラス・ER・マインドマップ・ガント・円グラフ・カンバン・タイムライン・C4・ブロック図で使えます。',
        '入れる場所（レーン・グループ・セクション・列など）、形、つなぐ元を選べます。「つなぐ」で、ある2つの図形の間に矢印を引けます。',
        '追加した直後のものが次の「つなぐ元」になるので、流れを順に作れます。'
      ],
      title: '要素の追加'
    },
    {
      id: 'layout',
      items: [
        '向き：上→下 か 左→右。「画面に合わせる」で大きく表示できる向きを自動で選びます。',
        '配置方式：標準 か ELK（大きな図を詰めて配置）。',
        '間隔：詰める・標準・広く。'
      ],
      title: 'レイアウト'
    },
    {
      id: 'colours',
      items: [
        'テーマと線の色で、図全体の見た目を変えられます。',
        'レーン・図形（ノード・状態・クラス・エンティティなど）・矢印ごとに色を付けられます。一覧から選ぶか、図をクリックして選びます。',
        '図形ごとに文字を太字にしたり、文字サイズや文字の色を変えられます（C4 の要素は文字の色のみ）。',
        '「自由に選ぶ」で好きな色を選べ、選んだ色は次から色の丸に並びます。'
      ],
      title: '配色'
    },
    {
      id: 'icons',
      items: [
        '「アイコン」で名前を検索し、クリックするとカーソル位置にアイコン名が入ります。',
        '緑の印は Mermaid 標準のアイコンで、どこでも表示できます。ほかはこのエディタか同じアイコン集が必要です。',
        'アーキテクチャ図では service ID(アイコン名)[表示名] の形で使います。',
        '「アイコンの利用条件」でアイコン集ごとのライセンスを確認できます。ロゴ（™）の商標は各社のものです。'
      ],
      title: 'アイコン'
    },
    {
      id: 'export',
      items: [
        '「操作」から PNG・SVG・HTMLページ・HTMLタグ・GitLab用（SVGとMarkdown）を保存できます。',
        '「共有」のリンクには図がまるごと入っているので、開いた人も同じ図を見られます。'
      ],
      title: '書き出しと共有'
    },
    {
      id: 'tips',
      items: [
        '名前の上で F2 を押すと、図の中のその名前をまとめて変えられます。',
        'エディタ上部のボタンで左側をアイコンだけに、「ツールを隠す」でコードを広く使えます。',
        '太陽／月のボタンでダークモードを切り替えます。「設定」タブには Mermaid の設定があります。',
        'エラーは赤字で行番号とともに出ます。Ctrl+Z（Mac は Cmd+Z）で元に戻し、もっと前は履歴から戻せます。',
        'コードの上にある「元に戻す」「やり直す」の矢印で、直前の変更を取り消せます。「追加」「色」「レイアウト」で書き込んだ内容も戻せます。'
      ],
      title: '便利な操作と困ったとき'
    }
  ]
};
