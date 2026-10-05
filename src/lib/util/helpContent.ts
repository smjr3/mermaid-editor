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
        'Write the diagram on the left; the picture in the middle follows as you type. The tools (Layout, Add, Edit, Colours, Icons, Samples, Actions) are on the right.',
        'Drag the picture to move it, and use the wheel or the zoom buttons in the bar above it.',
        'Your work is kept in this browser; History (clock icon) brings back earlier versions.'
      ],
      title: 'The basics'
    },
    {
      id: 'start',
      items: [
        '"New diagram…" at the top of Samples: choose a type (each has a one-line description), a title and a direction, and press Create for a small starter to grow with Add and change with Edit.',
        'Samples: pick a diagram type to load a ready-made example to edit; 業務テンプレート holds Japanese business templates (approval flow, swimlanes, gantt, org chart, …).',
        'Add: type a name and press a button to add a lane, node, participant, task, … without writing the syntax.',
        'The Docs tab opens the mermaid documentation for the kind of diagram you are writing.'
      ],
      title: 'Starting a diagram'
    },
    {
      id: 'add',
      items: [
        'Works for flowcharts, swimlanes, architecture, sequence, state, class, ER, mindmap, gantt, pie, kanban, timeline, C4, block and requirement diagrams.',
        'Choose where it goes (lane, group, section, column, …), its shape, and what it is joined from; "Connect" joins two existing shapes.',
        'What you just added becomes the next "from", so a flow can be built step by step.',
        'Sequence diagrams also take a note over or beside participants, and an empty "if" (alt), "repeat" (loop) or "optional" (opt) block after a chosen message, to fill in the code.',
        'Inside objects: attributes and methods of a class (with visibility and type), attributes of an ER entity (type, key, comment), composite states, C4 boundaries around an element, requirements, elements and their relationships, and the first topic of an empty mindmap. Gantt tasks take a status, critical and milestone marks and "after task".'
      ],
      title: 'Adding shapes'
    },
    {
      id: 'edit',
      items: [
        'Edit: choose a shape (or click it in the picture) to change its text or delete it with every arrow that touches it; a lane or topic can go with or without what is inside.',
        'Choose an arrow (or click it) to change its label, turn it round, draw it solid, dotted or thick, with or without an arrowhead, or delete it.',
        'Flowchart and swimlane nodes: change the shape, move the node to another lane (or out of every lane; its arrows stay), and give it an icon by searching for one or remove it. Architecture services: change the icon, or move the service to another group.',
        'A change that would break the diagram is not made; the card says so instead.',
        'Class members and ER attributes: choose one under the class or entity to change or delete it. Gantt tasks: change the start, the predecessor, the days, the status and the marks; sections and composite states, C4 boundaries and nested blocks can go with or without what is inside. Pie slices: change the value.'
      ],
      title: 'Changing and deleting'
    },
    {
      id: 'layout',
      items: [
        'Direction: top to bottom or left to right; "Fit to view" picks the one that shows larger.',
        'Layout engine: Standard, or ELK for compact layouts of large diagrams.',
        'Spacing: compact, normal or wide.',
        'Title: shown above flowcharts, swimlanes, sequence, state, class, ER, gantt, pie, timeline and C4 diagrams; mindmaps, kanban, architecture and block diagrams show none.'
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
        'Don’t know the name? "Browse" shows icons by category (servers, network equipment, security, Microsoft 365, AWS / Azure / Google Cloud, …) or a whole pack 200 at a time; click one to insert it.',
        'A green dot marks mermaid’s standard icons (they render anywhere); others need this editor or the same icon packs.',
        'Architecture diagrams use them as service(icon)[Name].',
        'Licences and trademarks of the icon sets: see "Icon licences" in this guide; logos show ™ in the picker.',
        'Asking an AI: "Copy a briefing for an AI" gives it the syntax and real icon names (collect the ones you want in the picker first); names it still invents are listed under "Unknown icons" with a one-click replacement.'
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
      id: 'licenses',
      items: [
        'The bundled icon sets and their licences are listed above; the links open each set and its licence text.',
        'These licences cover the artwork. MIT, ISC and Apache-2.0 ask that the notice travels with a copy of the icons; this site carries it in NOTICE and THIRD-PARTY-LICENSES.md. CC0 asks nothing.',
        'A logo or brand icon (™ in the picker) shows a trademark that belongs to its owner, whatever the artwork licence says. Naming a product in an architecture diagram is the use owners generally allow; marketing material needs their brand guidelines.',
        'Icon sets added by your organisation (vendor packs such as AWS, Azure or Google Cloud, hosted packs) and packs you import follow their own terms, which this editor does not know.'
      ],
      title: 'Icon licences'
    },
    {
      id: 'tips',
      items: [
        'F2 on a name renames it everywhere in the diagram.',
        'The button at the top of the code or of the tools folds that side to a row of icons; click an icon to open it again. Fold the code away if you only use the tools, or the tools if you only write code.',
        'The sun / moon button in the bar above the picture switches dark mode; the Config tab holds the mermaid settings.',
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
        '左にコードを書くと、中央の図がすぐに変わります。右側にはツール（レイアウト・追加・編集・色・アイコン・サンプル図・操作）があります。',
        '図はドラッグで動かし、マウスホイールや図の上のバーのボタンで拡大・縮小できます。',
        '作業内容はこのブラウザに保存されます。時計のアイコン（履歴）で前の状態に戻せます。'
      ],
      title: '基本'
    },
    {
      id: 'start',
      items: [
        '「サンプル図」の上の「新しい図を作る…」で、図の種類（それぞれ一行の説明付き）・タイトル・向きを選んで「作成」を押すと、小さなひな形ができます。「追加」で要素を足し、「編集」で変えていきます。',
        '「サンプル図」で図の種類を選ぶと、ひな形が入るので書き換えて使えます。「業務テンプレート」には稟議・承認フロー、スイムレーン、工程表、組織図などの日本語のひな形があります。',
        '「追加」で名前を入れてボタンを押すと、レーン・ノード・参加者・タスクなどを書き方を知らなくても足せます。',
        '「ドキュメント」タブで、今書いている図の書き方（Mermaid公式）を開けます。'
      ],
      title: '図を作り始める'
    },
    {
      id: 'add',
      items: [
        'フローチャート・スイムレーン・アーキテクチャ・シーケンス・状態・クラス・ER・マインドマップ・ガント・円グラフ・カンバン・タイムライン・C4・ブロック図・要件図で使えます。',
        '入れる場所（レーン・グループ・セクション・列など）、形、接続元を選べます。「つなぐ」で、ある2つの図形の間に矢印を引けます。',
        '追加した直後のものが次の「接続元」になるので、流れを順に作れます。',
        'シーケンス図では、参加者の上や横に置くノートと、選んだメッセージの後に入れる空の枠（条件分岐 alt・繰り返し loop・任意 opt）も追加できます。中身はコードで書き足します。',
        '中身も足せます：クラスの属性・メソッド（公開範囲と型つき）、ER 図のエンティティの属性（型・キー・コメント）、入れ子の状態、C4 の境界（要素を囲む）、要件図の要件・要素・関係、空のマインドマップの最初の話題。ガントのタスクには状況・重要・マイルストーンと「前のタスク」を付けられます。'
      ],
      title: '要素の追加'
    },
    {
      id: 'edit',
      items: [
        '「編集」で図形を選ぶ（図をクリックしても選べます）と、表示名を変えたり、つながる矢印ごと削除したりできます。レーンやトピックは中身ごと、または中身を残して削除できます。',
        '矢印を選ぶ（クリックでも可）と、ラベルの変更、向きの反転、実線・点線・太線や矢じりの有無の切り替え、削除ができます。',
        'フローチャートとスイムレーンのノードは、形の変更、別のレーンへの移動（どのレーンにも入れないことも可。矢印はそのまま）、アイコンの検索・設定と取り外しができます。アーキテクチャ図のサービスは、アイコンの変更と別のグループへの移動ができます。',
        '図が壊れる変更は行われず、カードにその旨が表示されます。',
        'クラスの属性・メソッドと ER 図の属性は、クラスやエンティティを選ぶと下に一覧が出て、変更・削除できます。ガントのタスクは開始日・前のタスク・日数・状況・印を変えられます。セクション・入れ子の状態・C4 の境界・入れ子のブロックは、中身ごとか中身を残して削除できます。円グラフの項目は値を変えられます。'
      ],
      title: '変更と削除'
    },
    {
      id: 'layout',
      items: [
        '向き：上→下 か 左→右。「画面に合わせる」で大きく表示できる向きを自動で選びます。',
        '配置方式：標準 か ELK（大きな図を詰めて配置）。',
        '間隔：詰める・標準・広く。',
        'タイトル：フローチャート・スイムレーン・シーケンス・状態・クラス・ER・ガント・円グラフ・タイムライン・C4 の図の上に表示されます。マインドマップ・カンバン・アーキテクチャ・ブロック図には表示されません。'
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
        '名前が分からないときは「一覧から選ぶ」で、分類（サーバー・ネットワーク機器・セキュリティ・Microsoft 365・AWS / Azure / Google Cloud など）ごと、またはアイコン集をまるごと 200 個ずつ見て、クリックで入れられます。',
        '緑の印は Mermaid 標準のアイコンで、どこでも表示できます。ほかはこのエディタか同じアイコン集が必要です。',
        'アーキテクチャ図では service ID(アイコン名)[表示名] の形で使います。',
        'アイコン集のライセンスや商標については、この使い方の「アイコンの利用条件」を参照してください。ロゴは一覧に ™ が付きます。',
        'AI に描かせるときは「AI用の説明をコピー」で書き方と実在するアイコン名を渡せます（使いたいアイコンは先に一覧で集めておく）。それでも AI が作ってしまった名前は「コード内の不明なアイコン」に出て、1 クリックで置き換えられます。'
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
      id: 'licenses',
      items: [
        '同梱アイコン集とそのライセンスは上の表のとおりです。リンクから各アイコン集とライセンス本文を開けます。',
        'これらのライセンスは絵柄に対するものです。MIT・ISC・Apache-2.0 はアイコンの複製に表示文を添えることを求めており、このサイトでは NOTICE と THIRD-PARTY-LICENSES.md がその役目です。CC0 は何も求めません。',
        'ロゴやブランドのアイコン（一覧で ™ 付き）は、絵柄のライセンスとは別に、その商標の権利が各社にあります。構成図で製品名を示す用途は一般に認められていますが、宣伝資料などに使う場合はブランドガイドラインに従ってください。',
        '組織が追加したアイコン集（AWS・Azure・Google Cloud などのベンダー配布分や、サイトに置かれたもの）と、自分で取り込んだアイコン集は、それぞれの配布元の条件に従います。このエディタはその内容を把握していません。'
      ],
      title: 'アイコンの利用条件'
    },
    {
      id: 'tips',
      items: [
        '名前の上で F2 を押すと、図の中のその名前をまとめて変えられます。',
        'コードやツールの上部のボタンで、その側をアイコンだけにたためます。アイコンを押すと元に戻ります。ツールだけ使うならコードを、コードだけ書くならツールをたたむと広く使えます。',
        '図の上のバーにある太陽／月のボタンでダークモードを切り替えます。「設定」タブには Mermaid の設定があります。',
        'エラーは赤字で行番号とともに出ます。Ctrl+Z（Mac は Cmd+Z）で元に戻し、もっと前は履歴から戻せます。',
        'コードの上にある「元に戻す」「やり直す」の矢印で、直前の変更を取り消せます。「追加」「色」「レイアウト」で書き込んだ内容も戻せます。'
      ],
      title: '便利な操作と困ったとき'
    }
  ]
};
