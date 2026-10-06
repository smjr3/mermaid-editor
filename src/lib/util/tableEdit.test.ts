import { messages } from '$/i18n/messages';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import {
  addRow,
  deleteRow,
  moveRow,
  parseTsv,
  pasteRows,
  readTable,
  setCell,
  tableKind,
  tableModel,
  type TableModel
} from './tableEdit';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;
const cells = (model: TableModel | undefined) => model?.rows.map((row) => row.cells) ?? [];
const column = (model: TableModel | undefined, key: string) =>
  model?.rows.map((row) => row.cells[key]) ?? [];

/** The result, checked to parse as the same type as the code it came from. */
const parsed = async (before: string, after: string | undefined) => {
  expect(after).toBeDefined();
  expect(after).not.toBe(before);
  await expect(typeOf(after ?? '')).resolves.toBe(await typeOf(before));
  return after ?? '';
};

const gantt = `gantt
    title Plan
    dateFormat YYYY-MM-DD
    section 計画
        調査        :done, research, 2024-03-01, 10d
        要件定義    :done, reqs, after research, 7d
    section 開発
        試作        :active, crit, proto, after reqs, 14d
        テスト      :5d
        リリース    :milestone, after proto, 0d`;

const kanban = `kanban
  todo[Todo]
    docs[資料作成]
    blog[ブログ]@{ priority: 'Low' }
  doing[作業中]
    renderer[描画の改善]@{ assigned: '山田', priority: 'High', ticket: 2038 }
  done[完了]`;

const timeline = `timeline
    title 沿革
    2002 : LinkedIn
    2004 : Facebook
         : Google
    section 後半
        2005 : YouTube`;

const pie = `pie title 内訳
    "開発" : 60
    "会議" : 25
    "その他" : 15`;

const er = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string id PK
        string email UK "ログインに使う"
        string name
    }
    ORDER {
        int id PK
    }`;

describe('tableKind', () => {
  it('names the five list-like types and nothing else', () => {
    expect(tableKind(gantt)).toBe('gantt');
    expect(tableKind(kanban)).toBe('kanban');
    expect(tableKind(timeline)).toBe('timeline');
    expect(tableKind(pie)).toBe('pie');
    expect(tableKind(er)).toBe('er');
    expect(tableKind('flowchart LR\n  A --> B')).toBeUndefined();
    expect(tableKind(`---\ntitle: x\n---\npie\n  "a" : 1`)).toBe('pie');
  });
});

describe('read model', () => {
  it('reads gantt tasks with their section, start, days, status and dependency', () => {
    const model = readTable(gantt);
    expect(model?.columns.map(({ key }) => key)).toEqual([
      'section',
      'task',
      'start',
      'days',
      'status',
      'after'
    ]);
    expect(column(model, 'task')).toEqual(['調査', '要件定義', '試作', 'テスト', 'リリース']);
    expect(column(model, 'section')).toEqual(['L3', 'L3', 'L6', 'L6', 'L6']);
    expect(column(model, 'start')).toEqual(['2024-03-01', '', '', '', '']);
    expect(column(model, 'days')).toEqual(['10', '7', '14', '5', '0']);
    expect(column(model, 'status')).toEqual(['done', 'done', 'active,crit', 'none', 'milestone']);
    expect(column(model, 'after')).toEqual(['', 'L4', 'L5', '', 'L7']);
    const status = model?.columns.find(({ key }) => key === 'status');
    expect(status?.options?.map(({ value }) => value)).toContain('active,crit');
  });

  it('reads kanban cards with their column, assignee and priority', () => {
    const model = readTable(kanban);
    expect(cells(model)).toEqual([
      { assignee: '', card: '資料作成', column: 'L1', priority: '' },
      { assignee: '', card: 'ブログ', column: 'L1', priority: 'Low' },
      { assignee: '山田', card: '描画の改善', column: 'L4', priority: 'High' }
    ]);
    const columns = model?.columns.find(({ key }) => key === 'column');
    expect(columns?.options?.map(({ text }) => text)).toEqual(['Todo', '作業中', '完了']);
  });

  it('reads timeline periods with every event, continued lines included', () => {
    expect(cells(readTable(timeline))).toEqual([
      { events: 'LinkedIn', period: '2002' },
      { events: 'Facebook / Google', period: '2004' },
      { events: 'YouTube', period: '2005' }
    ]);
  });

  it('reads pie slices', () => {
    expect(cells(readTable(pie))).toEqual([
      { label: '開発', value: '60' },
      { label: '会議', value: '25' },
      { label: 'その他', value: '15' }
    ]);
  });

  it('reads the attributes of the chosen entity', () => {
    expect(cells(readTable(er, 'CUSTOMER'))).toEqual([
      { comment: '', key: 'PK', name: 'id', type: 'string' },
      { comment: 'ログインに使う', key: 'UK', name: 'email', type: 'string' },
      { comment: '', key: 'none', name: 'name', type: 'string' }
    ]);
    expect(cells(readTable(er, 'ORDER'))).toHaveLength(1);
  });

  it('has a label in both languages for every column and option key', () => {
    for (const code of [gantt, kanban, timeline, pie, er]) {
      for (const col of readTable(code)?.columns ?? []) {
        const keys = [col.label, ...(col.options ?? []).flatMap(({ key }) => (key ? [key] : []))];
        for (const catalogue of Object.values(messages))
          for (const key of keys) expect(catalogue, key).toHaveProperty([key]);
      }
    }
  });

  it('reads through mermaid: entities named only in relationships, and nothing for broken code', async () => {
    const model = await tableModel(`erDiagram\n  A ||--o{ B : has\n  A {\n    string id\n  }`);
    expect(model?.entities?.map(({ id }) => id)).toEqual(['A', 'B']);
    expect(model?.entity).toBe('A');
    expect(cells(model)).toHaveLength(1);
    const b = await tableModel(`erDiagram\n  A ||--o{ B : has`, 'B');
    expect(b?.entity).toBe('B');
    expect(b?.rows).toEqual([]);
    expect(await tableModel('pie\n  "a" : x y')).toBeUndefined();
    const board = await tableModel(kanban);
    expect(column(board, 'assignee')).toEqual(['', '', '山田']);
  });
});

describe('cell edits', () => {
  it('renames a gantt task and changes its days, keeping its id and tags', async () => {
    let code = await parsed(gantt, setCell(gantt, 2, 'task', '試作: 第1版'));
    expect(code).toContain('試作 第1版 : active, crit, proto, after reqs, 14d');
    code = await parsed(code, setCell(code, 2, 'days', '20'));
    expect(code).toContain('試作 第1版 : active, crit, proto, after reqs, 20d');
  });

  it('changes a gantt start, dependency and status', async () => {
    let code = await parsed(gantt, setCell(gantt, 3, 'start', '2024-05-01'));
    expect(column(readTable(code), 'start')[3]).toBe('2024-05-01');
    code = await parsed(code, setCell(code, 3, 'after', 'L4'));
    expect(column(readTable(code), 'after')[3]).toBe('L4');
    expect(column(readTable(code), 'start')[3]).toBe('');
    code = await parsed(code, setCell(code, 3, 'status', 'crit'));
    expect(column(readTable(code), 'status')[3]).toBe('crit');
    code = await parsed(code, setCell(code, 2, 'status', 'done'));
    expect(column(readTable(code), 'status')[2]).toBe('done');
  });

  it('moves a gantt task to another section', async () => {
    const code = await parsed(gantt, setCell(gantt, 3, 'section', 'L3'));
    const model = readTable(code);
    expect(column(model, 'task')).toEqual(['調査', '要件定義', 'テスト', '試作', 'リリース']);
    expect(column(model, 'section')).toEqual(['L3', 'L3', 'L3', 'L7', 'L7']);
  });

  it('renames a kanban card and sets and clears its assignee and priority, keeping its ticket', async () => {
    let code = await parsed(kanban, setCell(kanban, 2, 'card', '描画[改善]'));
    expect(code).toContain(
      "renderer[\"描画[改善]\"]@{ assigned: '山田', priority: 'High', ticket: 2038 }"
    );
    code = await parsed(code, setCell(code, 2, 'assignee', "佐藤, 'B'"));
    expect(column(readTable(code), 'assignee')[2]).toBe('佐藤、 B');
    code = await parsed(code, setCell(code, 2, 'priority', ''));
    expect(code).toContain('renderer["描画[改善]"]@{ assigned: \'佐藤、 B\', ticket: 2038 }');
    code = await parsed(code, setCell(code, 0, 'priority', 'Very High'));
    expect(code).toContain("docs[資料作成]@{ priority: 'Very High' }");
    code = await parsed(code, setCell(code, 1, 'priority', ''));
    expect(code).toMatch(/blog\[ブログ\]\n/);
  });

  it('moves a kanban card to another column, empty ones included', async () => {
    let code = await parsed(kanban, setCell(kanban, 0, 'column', 'L6'));
    let model = readTable(code);
    expect(column(model, 'card')).toEqual(['ブログ', '描画の改善', '資料作成']);
    const done = model?.columns
      .find(({ key }) => key === 'column')
      ?.options?.find(({ text }) => text === '完了')?.value;
    expect(column(model, 'column')[2]).toBe(done);
    expect(code).toMatch(/done\[完了\]\n {4}docs\[資料作成\]$/);
    const todo = model?.columns
      .find(({ key }) => key === 'column')
      ?.options?.find(({ text }) => text === 'Todo')?.value;
    code = await parsed(code, setCell(code, 1, 'column', todo ?? ''));
    model = readTable(code);
    expect(column(model, 'card')).toEqual(['ブログ', '描画の改善', '資料作成']);
    expect(code).toContain("blog[ブログ]@{ priority: 'Low' }\n    renderer[");
  });

  it('gives a plain kanban card an id when it gets metadata', async () => {
    const board = 'kanban\n  Todo\n    [買い物]\n  Done';
    const code = await parsed(board, setCell(board, 0, 'assignee', '田中'));
    expect(column(readTable(code), 'assignee')).toEqual(['田中']);
    expect(column(readTable(code), 'card')).toEqual(['買い物']);
  });

  it('changes a timeline period and its events', async () => {
    let code = await parsed(
      timeline,
      setCell(timeline, 1, 'events', 'Facebook / Google / 社内SNS: 試行')
    );
    expect(code).toContain('2004 : Facebook : Google : 社内SNS： 試行');
    expect(code).not.toMatch(/^\s*: Google/m);
    code = await parsed(code, setCell(code, 0, 'period', '2002年'));
    expect(column(readTable(code), 'period')).toEqual(['2002年', '2004', '2005']);
    code = await parsed(code, setCell(code, 0, 'events', ''));
    expect(column(readTable(code), 'events')[0]).toBe('');
  });

  it('changes a pie label and value', async () => {
    let code = await parsed(pie, setCell(pie, 1, 'value', '30'));
    expect(code).toContain('"会議" : 30');
    code = await parsed(code, setCell(code, 1, 'label', '会議 "定例"'));
    expect(code).toContain(`"会議 '定例'" : 30`);
    expect(setCell(code, 1, 'value', '-3')).toBeUndefined();
  });

  it('changes an ER attribute', async () => {
    let code = await parsed(er, setCell(er, 2, 'key', 'FK', 'CUSTOMER'));
    expect(code).toContain('string name FK');
    code = await parsed(code, setCell(code, 2, 'comment', '氏名 "漢字"', 'CUSTOMER'));
    expect(code).toContain(`string name FK "氏名 '漢字'"`);
    code = await parsed(code, setCell(code, 2, 'type', 'varchar', 'CUSTOMER'));
    expect(code).toContain(`varchar name FK`);
  });
});

describe('rows', () => {
  it('adds a gantt row at the end of the last section and deletes one', async () => {
    let code = await parsed(gantt, addRow(gantt, { task: '新しいタスク' }));
    expect(column(readTable(code), 'task').at(-1)).toBe('新しいタスク');
    expect(column(readTable(code), 'section').at(-1)).toBe('L6');
    code = await parsed(code, deleteRow(code, 0));
    expect(column(readTable(code), 'task')).toEqual([
      '要件定義',
      '試作',
      'テスト',
      'リリース',
      '新しいタスク'
    ]);
  });

  it('adds a gantt row into a section by name, creating it when there is none', async () => {
    const code = await parsed(
      gantt,
      addRow(gantt, {
        days: '4',
        section: '運用',
        start: '2024/06/01',
        status: 'done',
        task: '保守'
      })
    );
    const model = readTable(code);
    expect(cells(model).at(-1)).toMatchObject({
      days: '4',
      start: '2024-06-01',
      status: 'done',
      task: '保守'
    });
    expect(code).toContain('section 運用');
  });

  it('adds rows of the other types', async () => {
    const board = await parsed(kanban, addRow(kanban, { assignee: '鈴木', card: '新しいカード' }));
    // Into the first column, after its cards.
    expect(cells(readTable(board))[2]).toMatchObject({
      assignee: '鈴木',
      card: '新しいカード',
      column: 'L1'
    });
    const time = await parsed(timeline, addRow(timeline, { period: '2010' }));
    expect(cells(readTable(time)).at(-1)).toEqual({ events: '', period: '2010' });
    const slices = await parsed(pie, addRow(pie, { label: '休憩' }));
    expect(cells(readTable(slices)).at(-1)).toEqual({ label: '休憩', value: '10' });
    const table = await parsed(er, addRow(er, { name: 'phone' }, 'CUSTOMER'));
    expect(cells(readTable(table, 'CUSTOMER')).at(-1)).toEqual({
      comment: '',
      key: 'none',
      name: 'phone',
      type: 'string'
    });
    const fresh = 'erDiagram\n  A ||--o{ B : has';
    const added = await parsed(fresh, addRow(fresh, { key: 'PK', name: 'id' }, 'B'));
    expect(cells(readTable(added, 'B'))).toEqual([
      { comment: '', key: 'PK', name: 'id', type: 'string' }
    ]);
  });

  it('deletes rows of the other types', async () => {
    const board = await parsed(kanban, deleteRow(kanban, 1));
    expect(column(readTable(board), 'card')).toEqual(['資料作成', '描画の改善']);
    const time = await parsed(timeline, deleteRow(timeline, 1));
    expect(column(readTable(time), 'period')).toEqual(['2002', '2005']);
    const slices = await parsed(pie, deleteRow(pie, 0));
    expect(column(readTable(slices), 'label')).toEqual(['会議', 'その他']);
    const table = await parsed(er, deleteRow(er, 0, 'CUSTOMER'));
    expect(column(readTable(table, 'CUSTOMER'), 'name')).toEqual(['email', 'name']);
  });
});

describe('reorder', () => {
  it('moves gantt tasks, keeping a start on the first task', async () => {
    let code = await parsed(gantt, moveRow(gantt, 1, -1));
    let model = readTable(code);
    expect(column(model, 'task')).toEqual(['要件定義', '調査', '試作', 'テスト', 'リリース']);
    code = await parsed(gantt, moveRow(gantt, 3, 1));
    model = readTable(code);
    expect(column(model, 'task')).toEqual(['調査', '要件定義', '試作', 'リリース', 'テスト']);
    const plain = `gantt\n  dateFormat YYYY-MM-DD\n  A : 2024-01-01, 3d\n  B : 2d`;
    code = await parsed(plain, moveRow(plain, 1, -1));
    expect(column(readTable(code), 'task')).toEqual(['B', 'A']);
    expect(column(readTable(code), 'start')[0]).toBe('2024-01-01');
    expect(moveRow(plain, 0, -1)).toBeUndefined();
    expect(moveRow(plain, 1, 1)).toBeUndefined();
  });

  it('moves kanban cards, timeline periods, pie slices and ER attributes', async () => {
    const board = await parsed(kanban, moveRow(kanban, 1, -1));
    expect(column(readTable(board), 'card')).toEqual(['ブログ', '資料作成', '描画の改善']);
    const time = await parsed(timeline, moveRow(timeline, 0, 1));
    expect(cells(readTable(time))).toEqual([
      { events: 'Facebook / Google', period: '2004' },
      { events: 'LinkedIn', period: '2002' },
      { events: 'YouTube', period: '2005' }
    ]);
    const slices = await parsed(pie, moveRow(pie, 2, -1));
    expect(column(readTable(slices), 'label')).toEqual(['開発', 'その他', '会議']);
    const table = await parsed(er, moveRow(er, 0, 1, 'CUSTOMER'));
    expect(column(readTable(table, 'CUSTOMER'), 'name')).toEqual(['email', 'id', 'name']);
  });
});

describe('TSV paste', () => {
  it('parses tab-separated rows as Excel copies them', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ]);
    expect(parseTsv('"x\ty"\t"say ""hi"""\n"two\nlines"\tz')).toEqual([
      ['x\ty', 'say "hi"'],
      ['two\nlines', 'z']
    ]);
    expect(parseTsv('')).toEqual([]);
    expect(parseTsv('\n\n')).toEqual([]);
    expect(parseTsv('要件定義：第1版\t3')).toEqual([['要件定義：第1版', '3']]);
  });

  it('appends pasted rows in column order, skipping a header row', async () => {
    const text =
      'セクション\tタスク\t開始日\t日数\t状態\t前のタスク\n開発\t設計: 詳細; 第2版 #1\t\t3\t完了\t調査\n運用\t移行\t2024/07/01\t2\tcrit\t';
    const code = await parsed(gantt, pasteRows(gantt, text));
    const added = cells(readTable(code)).slice(-2);
    expect(added[0]).toMatchObject({
      after: 'L4',
      days: '3',
      status: 'done',
      task: '設計 詳細, 第2版 1'
    });
    expect(added[1]).toMatchObject({
      days: '2',
      start: '2024-07-01',
      status: 'crit',
      task: '移行'
    });
  });

  it('pastes Japanese rows with separators into each type', async () => {
    const board = await parsed(
      kanban,
      pasteRows(kanban, '作業中\t見積[改訂]: 1,2\t田中, 一郎\t高\n検証\t試験\t\t')
    );
    expect(cells(readTable(board)).slice(-2)).toMatchObject([
      { assignee: '田中、 一郎', card: '見積改訂: 1,2', priority: 'High' },
      { card: '試験' }
    ]);
    expect(board).toContain('[検証]');
    const time = await parsed(timeline, pasteRows(timeline, '2024年4月\t入社式 / 研修: 前半'));
    expect(cells(readTable(time)).at(-1)).toEqual({
      events: '入社式 / 研修： 前半',
      period: '2024年4月'
    });
    const slices = await parsed(pie, pasteRows(pie, '交通費 "出張"\t1,234\n雑費\t5'));
    expect(cells(readTable(slices)).slice(-2)).toEqual([
      { label: "交通費 '出張'", value: '1234' },
      { label: '雑費', value: '5' }
    ]);
    const table = await parsed(
      er,
      pasteRows(er, 'varchar\t電話番号\tUK\t"市外局番, 含む"', 'CUSTOMER')
    );
    expect(cells(readTable(table, 'CUSTOMER')).at(-1)).toEqual({
      comment: '市外局番, 含む',
      key: 'UK',
      name: '電話番号',
      type: 'varchar'
    });
    expect(pasteRows(pie, '')).toBeUndefined();
  });
});
