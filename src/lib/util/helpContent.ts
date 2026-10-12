/**
 * Local: the "How to use" dialog (HelpButton.svelte). Kept out of the message
 * catalogue because it is prose, not UI strings; both languages carry the same
 * sections in the same order (helpContent.test.ts).
 *
 * It describes the /edit layout: code | diagram | inspector, the add bar above the
 * diagram, and 新規 / 共有 / 書き出す in the header.
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
        'The screen has three columns: the code on the left, the diagram in the middle and the settings panel on the right; the picture follows every change. Add shapes with the add bar above the diagram, and change what you selected (its name, colour, shape, …) in the panel. With nothing selected, the panel shows the whole diagram (theme, direction, title, …).',
        'Drag the picture to move it; use the wheel or − / + at the bottom right of the diagram to zoom, and "Fit" to show all of it. The button beside them turns the background grid on or off.',
        'Your work is kept in this browser. History (the clock in the header) brings back earlier versions: saved and timeline entries, import and export, rename, restore and delete.',
        'The header holds Undo and Redo on the left and New ▾, Share and Export on the right, then How to use, History, Reset and the light / dark switch. The button at the top of the code pane or of the settings panel folds it to a thin strip; the button on the strip opens it again. Widths you drag the dividers to are remembered.'
      ],
      title: 'The basics'
    },
    {
      id: 'start',
      items: [
        'New ▾ → "From a diagram type…": choose a type (each has a one-line description), an optional title and, where the type has one, a direction, and press "Create an empty …" for a small starter, opened in a new tab so the diagram here stays.',
        'New ▾ → "From a sample…": find a sample by category on the left or by searching, select it to see it on the right, and press "Start with this sample" to open it in a new tab. 業務テンプレート holds Japanese business templates (approval flow, swimlanes, gantt, org chart, …), and every diagram type has examples.',
        'Samples marked as fillable offer "Fill in lanes and steps first…": change the lanes, steps, tasks, people, … and add or remove rows before the diagram is drawn (in a new tab).',
        'The add bar adds a lane, node, participant, task, … without writing the syntax.',
        'You can also write in the Code tab of the code pane (with completion). The Config JSON tab holds the diagram’s settings (the mermaid config).'
      ],
      title: 'Starting a diagram'
    },
    {
      id: 'add',
      items: [
        'The add bar changes with the type of diagram. Flowcharts and swimlanes: Process, Decision, Start / end, Lane, Arrow and More ▾ (other shapes, a group, joining two existing shapes). Architecture: group, service and connection. Sequence, state, class, ER, mindmap, gantt, pie, kanban, timeline, C4, block, requirement, journey, XY, quadrant, sankey, git, packet and ZenUML diagrams have buttons of their own.',
        'With a shape selected, what you add is joined to it by an arrow; with nothing selected, it is added on its own. What you just added becomes the selection, so a flow can be built step by step.',
        'Arrow: click the shape it starts from, then the one it goes to (Cancel stops).',
        'Sequence diagrams also take a note over or beside participants, and an empty "if" (alt), "repeat" (loop) or "optional" (opt) block after a chosen message, to fill in the code.',
        'Inside objects: attributes and methods of a class (with visibility and type), attributes of an ER entity (type, key, comment), composite states, C4 boundaries around an element, requirements, elements and their relationships, and the first topic of an empty mindmap. Gantt tasks take a status, critical and milestone marks and "after task".'
      ],
      title: 'Adding shapes'
    },
    {
      id: 'edit',
      items: [
        'Click a shape, an arrow or a lane in the picture to select it: the top of the settings panel shows "Whole diagram › Shape" (or Arrow, Lane, Task) and the panel switches to its settings; ✕, Escape or a click on the empty canvas clears. Double-click to rename; right-click for Rename, Change colour, Change shape, Add next, Draw an arrow from here and Delete.',
        'A shape: name, shape, colour (switch between fill, border and text, then pick the theme colour, one of eight, any colour or a recent one), text (size, bold, reset), icon, lane, ID (changing it renames it everywhere in the diagram), the arrows that touch it, and + Next, + Branch, Arrow and Delete.',
        'An arrow: from and to, label, line (solid, dotted, thick), arrowheads (end, both, none), colour, reverse and delete.',
        'A lane: name, colour, how many shapes it holds with a button to add one, and delete (keeping or with what is inside). Architecture services: change the icon, or move the service to another group.',
        'A change that would break the diagram is not made; the panel says so instead.',
        'Diagrams whose parts cannot be clicked (gantt, kanban, pie, …) list them in the settings panel to choose from. Class members, ER attributes, gantt tasks (section, start, predecessor, days, status and marks) and pie values can be changed too; sections, composite states, C4 boundaries and nested blocks can go with or without what is inside.',
        'Table-shaped diagrams (gantt tasks, kanban cards, timeline periods, pie slices, the attributes of an ER entity, …) switch between Diagram, Table and Both above the picture: change a cell and leave it or press Enter, add, delete or move rows, move a card to another column, and paste rows copied from Excel to add them.'
      ],
      title: 'Changing and deleting'
    },
    {
      id: 'layout',
      items: [
        'Direction (Whole diagram in the settings panel): top to bottom, left to right, or automatic, which picks the one that shows larger.',
        'Layout: Standard, or ELK for compact layouts of large diagrams.',
        'Spacing: compact, normal or wide (ELK ignores it).',
        'Title: shown above flowcharts, swimlanes, sequence, state, class, ER, gantt, pie, timeline and C4 diagrams; mindmaps, kanban, architecture and block diagrams show none. Rows a diagram type cannot use are not shown.'
      ],
      title: 'Layout'
    },
    {
      id: 'colours',
      items: [
        'Theme (Whole diagram): twelve designs for the whole diagram (modern, neon, pastel, business, high contrast, …) as cards. The theme you choose goes into shared links and exports.',
        'Standard picks one of mermaid’s eight built-in themes (none by default). Line colour sets the colour of every line, Font the typeface, and Hand-drawn draws the picture as if by hand, exports included.',
        'Lanes, shapes (node, state, class, entity, …) and arrows: select one, then use Colour in the panel. Lanes colours every lane or none at once; Arrows puts every arrow back to its own colour.',
        'Text per shape: bold, font size and text colour; C4 elements take a text colour only.',
        '"+" picks any colour; colours you picked are offered again as recent ones.'
      ],
      title: 'Colours'
    },
    {
      id: 'icons',
      items: [
        'Icons (Whole diagram) → "Find and insert": search by name and click an icon to insert its name at the cursor. With a shape selected, Icon in the panel gives it an icon or removes it.',
        'Don’t know the name? Browse icons by category (servers, network equipment, security, Microsoft 365, AWS / Azure / Google Cloud, …) or a whole pack 200 at a time, and click one to insert it. "Icon packs" imports SVG or Iconify JSON packs.',
        'A green dot marks mermaid’s standard icons (they render anywhere); others need this editor or the same icon packs.',
        'Architecture diagrams use them as service(icon)[Name].',
        'Licences and trademarks of the icon sets: see "Icon licences" in this guide; logos show ™ in the picker.',
        'Asking an AI: "Copy a briefing for an AI" (Whole diagram) gives it the syntax and real icon names (collect the ones you want in the picker first); names it still invents are counted under unknown icons, with "Replace with suggestions".'
      ],
      title: 'Icons'
    },
    {
      id: 'export',
      items: [
        'Export in the header: with a preview on the left, choose PNG image, SVG, draw.io, Visio, HTML, for Markdown or Copy image, set the file name and save (or copy).',
        'Pasting into PowerPoint, Word or an e-mail: choose the resolution (standard, high, highest) and the background (white, transparent, theme colour); the choice is remembered in this browser. draw.io keeps shapes, arrows and text as separate elements; Visio holds the picture as one image.',
        'Share in the header: the link to edit and the view-only link hold the whole diagram, so whoever opens them sees the same thing; it also makes embed code (an iframe or a web component).'
      ],
      title: 'Export and share'
    },
    {
      id: 'licenses',
      items: [
        'The bundled icon sets and their licences are listed above; the links open each set and its licence text.',
        'These licences cover the artwork. MIT, ISC and Apache-2.0 ask that the notice travels with a copy of the icons; this site carries it in NOTICE and THIRD-PARTY-LICENSES.md. CC0 asks nothing.',
        'A logo or brand icon (™ in the picker) shows a trademark that belongs to its owner, whatever the artwork licence says. Naming a product in an architecture diagram is the use owners generally allow; marketing material needs their brand guidelines.',
        'Icon sets added by whoever hosts this site (vendor packs such as AWS, Azure or Google Cloud, hosted packs) and packs you import follow their own terms, which this editor does not know.'
      ],
      title: 'Icon licences'
    },
    {
      id: 'tips',
      items: [
        'In the code, F2 on a name renames that ID everywhere in the diagram (the line under the code says so too).',
        'Keys on a selected shape (when you are not typing): Enter adds the next node (type its name, Enter again), Tab adds a branch beside it, Delete deletes, F2 renames, the arrow keys move along the arrows, Escape clears.',
        'Fold the settings panel away if you only write code, or the code pane if you only work on the picture; this browser remembers what is folded and how wide each column is.',
        'The sun / moon button at the right of the header switches the app to dark mode (the diagram looks the same). Reset in the header returns everything to the starting diagram (History is kept). If the config (JSON) breaks, "Reset config" on the Config JSON tab puts it back.',
        'When the code has a mistake, the line under the code and a notice over the picture say which line, and the picture stays as it last was. "Revert to the last valid state" puts that code back (Undo brings your change back again); the add bar and the panel wait until the code is fixed, though theme and other settings still work.',
        'Undo and Redo in the header (Ctrl+Z / Ctrl+Y, Cmd on a Mac) take back the last change, including what the add bar and the panel wrote; History goes further back.'
      ],
      title: 'Tips'
    },
    {
      id: 'about',
      items: [
        'This editor is a fork of Mermaid Live Editor. Your diagrams are kept in this browser and are not sent anywhere.'
      ],
      title: 'Version & about'
    }
  ],
  ja: [
    {
      id: 'basics',
      items: [
        '画面は左から「コード」「図」「設定パネル」の3列です。どこを変えても図はすぐに変わります。図の上の追加バーで図形を足し、右の設定パネルで選んだものの名前・色・形などを変えます。何も選んでいないとき、設定パネルには「図全体」（テーマ・向き・タイトルなど）が出ます。',
        '図はドラッグで動かし、マウスホイールか図の右下の − ／ ＋ で拡大・縮小、「全体」で図全体を表示します。隣のボタンで背景のグリッドを切り替えます。',
        '作業内容はこのブラウザに保存されます。ヘッダーの時計のアイコン（履歴）で前の状態に戻せます（保存済み・タイムライン、読み込み・書き出し、名前の変更、復元、削除）。',
        'ヘッダーの左に「元に戻す」「やり直す」、右に「新規 ▾」「共有」「書き出す」と、使い方・履歴・初期化・ライト／ダークのボタンがあります。コード欄と設定パネルは上部のボタンで細い帯にたため、帯のボタンで元に戻せます。境目をドラッグした幅は記憶されます。'
      ],
      title: '基本'
    },
    {
      id: 'start',
      items: [
        'ヘッダーの「新規 ▾」→「形式から作る…」で、図の種類（それぞれ一行の説明付き）を選び、タイトル（任意）と向き（対応する種類のみ）を決めて「空の○○を作る」を押すと、小さなひな形が新しいタブで開きます（今の画面の図はそのまま残ります）。',
        '「新規 ▾」→「サンプルから作る…」で、左のカテゴリか検索でサンプルを探し、選ぶと右に詳細が出ます。「このサンプルで始める」で新しいタブに開きます。「業務テンプレート」には稟議・承認フロー、スイムレーン、工程表、組織図などの日本語のひな形があり、図の種類ごとの例もそろっています。',
        '「入力して作れる」印のサンプルは「レーンや手順を入力してから作る…」で、レーン・手順・作業・参加者などの欄を書き換えたり行を足したりしてから図にできます（新しいタブで開きます）。',
        '追加バーのボタンで、書き方を知らなくてもレーン・図形・参加者・タスクなどを足せます。',
        'コード欄の「コード」タブに直接書くこともできます（入力補完あり）。「設定 JSON」タブには図の設定（Mermaid の config）があります。'
      ],
      title: '図を作り始める'
    },
    {
      id: 'add',
      items: [
        '追加バーの中身は図の種類で変わります。フローチャートとスイムレーンは「処理」「分岐」「開始・終了」「レーン」「矢印」「その他 ▾」（ほかの形・グループ・既存の2つをつなぐ）。アーキテクチャはグループ・サービス・接続。シーケンス・状態・クラス・ER・マインドマップ・ガント・円グラフ・カンバン・タイムライン・C4・ブロック図・要件図・ジャーニー・XY・4象限・サンキー・Git・パケット・ZenUML にもそれぞれのボタンがあります。',
        '図形を選んでいるときは、追加したものがその図形から矢印でつながります。選んでいなければ単独で足されます。追加した直後のものが選ばれるので、流れを順に作れます。',
        '「矢印」は、つなぐ元の図形、つなぐ先の図形の順にクリックします（「やめる」で中止）。',
        'シーケンス図では、参加者の上や横に置くノートと、選んだメッセージの後に入れる空の枠（条件分岐 alt・繰り返し loop・任意 opt）も追加できます。中身はコードで書き足します。',
        '中身も足せます：クラスの属性・メソッド（公開範囲と型つき）、ER 図のエンティティの属性（型・キー・コメント）、入れ子の状態、C4 の境界（要素を囲む）、要件図の要件・要素・関係、空のマインドマップの最初の話題。ガントのタスクには状況・重要・マイルストーンと「前のタスク」を付けられます。'
      ],
      title: '要素の追加'
    },
    {
      id: 'edit',
      items: [
        '図の中の図形・矢印・レーンをクリックすると選ばれ、設定パネルの上に「図全体 › 図形」（矢印・レーン・タスク）と出て、その設定に変わります。✕ か Esc、何もないところのクリックで選択を解除します。ダブルクリックで名前を変更、右クリックで「名前を変更・色を変える・形を変える・次の処理を追加・ここから矢印を引く・削除」のメニューが出ます。',
        '図形：名前、形、色（塗り・枠・文字を切り替えて、テーマの色・8色・好きな色・最近使った色から）、文字（大きさ・太字・元に戻す）、アイコン、入れるレーン、ID（変えると図の中の使用箇所もまとめて変わります）、つながっている矢印の一覧、「＋次」「＋分岐」「矢印」「削除」。',
        '矢印：つなぐ元と先、ラベル、線（実線・点線・太線）、矢じり（先・両方・なし）、色、向きの反転、削除。',
        'レーン：名前、色、入っている図形の数と追加、削除（中身は残す・中身ごと）。アーキテクチャ図のサービスは、アイコンの変更と別のグループへの移動ができます。',
        '図が壊れる変更は行われず、パネルにその旨が表示されます。',
        'クリックで選べない図（ガント・カンバン・円グラフなど）は、設定パネルの一覧から要素を選びます。クラスの属性・メソッド、ER 図の属性、ガントのタスク（区分・開始日・前のタスク・日数・状況・印）、円グラフの値なども変えられます。セクション・入れ子の状態・C4 の境界・入れ子のブロックは、中身ごとか中身を残して削除できます。',
        'ガントのタスク・カンバンのカード・タイムラインの期間・円グラフの項目・ER 図のエンティティの属性など表の形の図は、図の上の「図 ／ 表 ／ 並べる」で表として編集できます。セルを書き換えて離れるか Enter で反映、行の追加・削除・上下の移動、カードの別の列への移動ができ、Excel でコピーした行を貼り付けると行として追加されます。'
      ],
      title: '変更と削除'
    },
    {
      id: 'layout',
      items: [
        '設定パネルの「図全体」の「向き」：上→下・左→右・自動（大きく表示できる向きを自動で選びます）。',
        '「配置」：標準 か ELK（大きな図を詰めて配置）。',
        '「間隔」：詰める・標準・広く（ELK のときは効きません）。',
        '「タイトル」：フローチャート・スイムレーン・シーケンス・状態・クラス・ER・ガント・円グラフ・タイムライン・C4 の図の上に表示されます。マインドマップ・カンバン・アーキテクチャ・ブロック図には表示されません。図の種類で使えない項目はパネルに出ません。'
      ],
      title: 'レイアウト'
    },
    {
      id: 'colours',
      items: [
        '「図全体」のテーマ：モダン・ネオン・パステル・ビジネス・ハイコントラストなど 12 種類のカードから、図全体の見た目を選べます。選んだテーマは共有リンクや書き出しにも残ります。',
        '「標準」で Mermaid の組み込みテーマ 8 種から選べます（既定は「使わない」）。「線の色」で図全体の線の色を、「フォント」で文字の書体を変えられます。「手描き風」をオンにすると手で描いたような線になり、書き出しにも反映されます。',
        'レーン・図形（状態・クラス・エンティティなども）・矢印は、選んでから設定パネルの「色」で色を付けます。「レーン」の色分け・色なしでまとめて塗り分け、「矢印」の「すべて元の色に」で矢印の色を戻せます。',
        '図形ごとに文字を太字にしたり、文字サイズや文字の色を変えられます（C4 の要素は文字の色のみ）。',
        '「＋」で好きな色を選べ、選んだ色は次から最近使った色として並びます。'
      ],
      title: '配色'
    },
    {
      id: 'icons',
      items: [
        '「図全体」の「アイコン」の「探して挿入」で名前を検索し、クリックするとカーソル位置にアイコン名が入ります。図形を選んでいるときは、設定パネルの「アイコン」でその図形に付けたり外したりできます。',
        '名前が分からないときは、分類（サーバー・ネットワーク機器・セキュリティ・Microsoft 365・AWS / Azure / Google Cloud など）ごと、またはアイコン集をまるごと 200 個ずつ見て、クリックで入れられます。「アイコン集」では SVG や Iconify JSON のアイコン集を取り込めます。',
        '緑の印は Mermaid 標準のアイコンで、どこでも表示できます。ほかはこのエディタか同じアイコン集が必要です。',
        'アーキテクチャ図では service ID(アイコン名)[表示名] の形で使います。',
        'アイコン集のライセンスや商標については、この使い方の「アイコンの利用条件」を参照してください。ロゴは一覧に ™ が付きます。',
        'AI に描かせるときは「図全体」の「AI用の説明をコピー」で書き方と実在するアイコン名を渡せます（使いたいアイコンは先に一覧で集めておく）。それでも AI が作ってしまった名前は不明なアイコンの件数に出て、「候補に置換」で置き換えられます。'
      ],
      title: 'アイコン'
    },
    {
      id: 'export',
      items: [
        'ヘッダーの「書き出す」で、左のプレビューを見ながら PNG画像・SVG・draw.io・Visio・HTML・Markdown用・画像をコピー から形式を選び、ファイル名を決めて保存（またはコピー）します。',
        'PowerPoint・Word・メールに貼るときは、解像度（標準・高画質・最高画質）と背景（白・透明・テーマの色）を選べます。選んだ内容はこのブラウザに記憶されます。draw.io は図形・矢印・文字が別々の要素として、Visio は図が 1 枚の画像として入ります。',
        'ヘッダーの「共有」の編集用リンクと表示用リンクには図がまるごと入っているので、開いた人も同じ図を見られます。埋め込み（iframe・Web コンポーネント）のコードも作れます。'
      ],
      title: '書き出しと共有'
    },
    {
      id: 'licenses',
      items: [
        '同梱アイコン集とそのライセンスは上の表のとおりです。リンクから各アイコン集とライセンス本文を開けます。',
        'これらのライセンスは絵柄に対するものです。MIT・ISC・Apache-2.0 はアイコンの複製に表示文を添えることを求めており、このサイトでは NOTICE と THIRD-PARTY-LICENSES.md がその役目です。CC0 は何も求めません。',
        'ロゴやブランドのアイコン（一覧で ™ 付き）は、絵柄のライセンスとは別に、その商標の権利が各社にあります。構成図で製品名を示す用途は一般に認められていますが、宣伝資料などに使う場合はブランドガイドラインに従ってください。',
        'このサイトの運営者が追加したアイコン集（AWS・Azure・Google Cloud などのベンダー配布分や、サイトに置かれたもの）と、自分で取り込んだアイコン集は、それぞれの配布元の条件に従います。このエディタはその内容を把握していません。'
      ],
      title: 'アイコンの利用条件'
    },
    {
      id: 'tips',
      items: [
        'コード欄で名前の上にカーソルを置いて F2 を押すと、図の中のその ID をまとめて変えられます（コード欄の下にも案内が出ています）。',
        '図形を選択中のキー操作（入力中でないとき）：Enter で次の図形を追加（名前を入れて Enter）、Tab で横に分岐を追加、Delete で削除、F2 で名前を変更、矢印キーで矢印をたどる、Esc で選択を解除。',
        'コードだけ書くときは設定パネルを、図だけ触るときはコード欄をたたむと図を広く使えます。たたんだ状態と各列の幅はこのブラウザに記憶されます。',
        'ヘッダー右端の太陽／月のボタンでアプリのダークモードを切り替えます（図の見た目は変わりません）。ヘッダーの「初期化」で図と設定を最初の状態に戻せます（履歴は残ります）。設定（JSON）が壊れたときは「設定 JSON」タブの「設定をリセット」で戻せます。',
        'コードに誤りがあると、コード欄の下と図の上のお知らせに何行目かが出て、図は直前の正しい状態のまま残ります。「直前の正しい状態に戻す」でそのコードに戻せます（「元に戻す」で変更前に戻ることもできます）。コードが直るまで追加バーと設定パネルは図を変更しません（テーマなどの設定は変えられます）。',
        'ヘッダーの「元に戻す」「やり直す」（Ctrl+Z ／ Ctrl+Y、Mac は Cmd）で直前の変更を取り消せます。追加バーや設定パネルで変えた内容も戻せます。もっと前は履歴から戻せます。'
      ],
      title: '便利な操作と困ったとき'
    },
    {
      id: 'about',
      items: [
        'このエディタは Mermaid Live Editor を元にしたフォークです。作った図はこのブラウザに保存され、外部に送られません。'
      ],
      title: 'バージョン情報'
    }
  ]
};
