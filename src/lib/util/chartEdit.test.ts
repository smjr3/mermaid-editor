import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { checkAdd, specFor, type Values } from './addActions';
import { chartKind, type ChartKind } from './chartEdit';
import { objectFields, setObjectFields } from './diagramDetails';
import {
  checkEdit,
  deleteObject,
  editableObjects,
  editKind,
  renameObject,
  type EditObject
} from './diagramModify';
import { starter } from './newDiagram';
import { addRow, deleteRow, moveRow, readTable, setCell, tableKind } from './tableEdit';

/** The value, or a failed test when there is none. */
const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('missing');
  return value;
};

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

/** Runs an Add action; the result code, or the error key. */
const add = (code: string, actionId: string, values: Values) => {
  const action = specFor(code)?.actions.find(({ id }) => id === actionId);
  if (!action) throw new Error(`no action ${actionId}`);
  const result = action.apply(code, values);
  return 'error' in result ? { error: result.error } : { code: result.code };
};

const added = async (code: string, actionId: string, values: Values) => {
  const result = add(code, actionId, values);
  if (!('code' in result) || !result.code) throw new Error(`refused: ${JSON.stringify(result)}`);
  expect(await checkAdd(code, result.code)).toBe(true);
  return result.code;
};

const object = async (code: string, label: string): Promise<EditObject> => {
  const found = (await editableObjects(code))?.items.find((item) => item.label.trim() === label);
  if (!found) throw new Error(`no object ${label}`);
  return found;
};

const edited = async (before: string, after: string | undefined) => {
  expect(after).toBeDefined();
  expect(after).not.toBe(before);
  expect(await checkEdit(before, after ?? '')).toBe(true);
  return after ?? '';
};

describe('chart kinds', () => {
  it.each<[ChartKind, string]>([
    ['journey', 'journey'],
    ['xychart', 'xychart'],
    ['quadrant', 'quadrant'],
    ['sankey', 'sankey'],
    ['git', 'git'],
    ['packet', 'packet'],
    ['zenuml', 'zenuml']
  ])('%s starter is handled by the Add and Edit cards', async (kind, id) => {
    const code = starter(id as Parameters<typeof starter>[0]);
    expect(chartKind(code)).toBe(kind);
    expect(editKind(code)).toBe(kind);
    expect(specFor(code)?.actions.length).toBeGreaterThan(0);
    expect((await editableObjects(code))?.items.length).toBeGreaterThan(0);
  });
});

describe('user journey', () => {
  const code = starter('journey');

  it('adds a task with score and people into a section, and a section', async () => {
    const parts = await must(specFor(code)).parts(code);
    const morning = must(parts.sections.find(({ label }) => label === '朝'));
    const next = await added(code, 'task', {
      actors: '自分、上司',
      name: '日報: 書く',
      score: '5',
      section: morning.id
    });
    expect(next).toContain('    日報： 書く: 5: 自分, 上司\n  section 午後');
    const sectioned = await added(next, 'section', { name: '夜' });
    expect(sectioned.trimEnd().endsWith('section 夜')).toBe(true);
  });

  it('says what is missing', () => {
    expect(add(code, 'task', { name: ' ', score: '3' })).toEqual({ error: 'add.journey.needTask' });
    expect(add(code, 'section', { name: '' })).toEqual({ error: 'add.journey.needSection' });
  });

  it('renames, rescores and deletes tasks and sections', async () => {
    const task = await object(code, '出社する');
    const renamed = await edited(code, renameObject(code, 'journey', task, '在宅勤務'));
    expect(renamed).toContain('在宅勤務: 4: 自分');
    expect(objectFields(code, 'journey', task)?.map(({ key }) => key)).toEqual(['score', 'actors']);
    const scored = await edited(
      code,
      setObjectFields(code, 'journey', task, { actors: 'A, B', score: '1' })
    );
    expect(scored).toContain('出社する: 1: A, B');
    const section = await object(code, '朝');
    const gone = await edited(code, deleteObject(code, 'journey', section));
    expect(gone).not.toContain('出社する');
    const kept = await edited(code, deleteObject(code, 'journey', section, { keepContents: true }));
    expect(kept).toContain('出社する');
    expect(kept).not.toContain('section 朝');
  });

  it('is a table of tasks', async () => {
    expect(tableKind(code)).toBe('journey');
    const table = must(readTable(code));
    expect(table.rows.map(({ cells }) => cells.task)).toEqual([
      '出社する',
      'メールを確認する',
      '会議に出る'
    ]);
    const afternoon = must(
      must(table.columns[0].options).find(({ text }) => text === '午後')
    ).value;
    const moved = await edited(code, setCell(code, 0, 'section', afternoon));
    expect(must(readTable(moved)).rows.at(-1)?.cells.task).toBe('出社する');
    const scored = await edited(code, setCell(code, 1, 'score', '5'));
    expect(scored).toContain('メールを確認する: 5: 自分');
    const more = await edited(code, addRow(code, { score: '2', section: '夜', task: '帰宅' }));
    expect(more).toContain('section 夜\n    帰宅: 2');
    await edited(code, deleteRow(code, 2));
  });
});

describe('XY chart', () => {
  const code = starter('xychart');

  it('starts with named series that parse', async () => {
    await expect(typeOf(code)).resolves.toBe('xychart');
  });

  it('sets the axes and adds a series', async () => {
    const axes = await added(code, 'axes', {
      categories: 'Q1, Q2，Q3、Q4',
      xTitle: '四半期',
      yMax: '200',
      yMin: '0',
      yTitle: '件数'
    });
    expect(axes).toContain('x-axis "四半期" ["Q1", "Q2", "Q3", "Q4"]');
    expect(axes).toContain('y-axis "件数" 0 --> 200');
    const series = await added(axes, 'series', {
      kind: 'line',
      name: '予測',
      values: '１０, 20,30,40'
    });
    expect(series).toContain('line "予測" [10, 20, 30, 40]');
  });

  it('starts an empty chart', async () => {
    const empty = 'xychart-beta';
    const withAxes = add(empty, 'axes', { categories: 'a,b' });
    expect('code' in withAxes && withAxes.code).toContain('x-axis ["a", "b"]');
    const series = await added((withAxes as { code: string }).code, 'series', {
      kind: 'bar',
      name: '',
      values: '1,2'
    });
    expect(series).toContain('bar [1, 2]');
  });

  it('says what is missing or wrong', () => {
    expect(add(code, 'axes', { categories: '' })).toEqual({ error: 'add.xy.needCategories' });
    expect(add(code, 'axes', { categories: 'a', yMax: '1', yMin: '5' })).toEqual({
      error: 'add.xy.badRange'
    });
    expect(add(code, 'series', { kind: 'bar', values: '1, x' })).toEqual({
      error: 'add.xy.badValues'
    });
  });

  it('changes and deletes series and axes', async () => {
    const series = await object(code, '棒: 実績');
    const values = await edited(
      code,
      setObjectFields(code, 'xychart', series, { values: '1,2,3' })
    );
    expect(values).toContain('bar "実績" [1, 2, 3]');
    const line = await edited(code, setObjectFields(code, 'xychart', series, { kind: 'line' }));
    expect(line).toContain('line "実績" [40, 55, 70]');
    const renamed = await edited(code, renameObject(code, 'xychart', series, '売上'));
    expect(renamed).toContain('bar "売上"');
    const axis = await object(code, '横軸: 月');
    const categories = await edited(
      code,
      setObjectFields(code, 'xychart', axis, { categories: '7月, 8月, 9月' })
    );
    expect(categories).toContain('["7月", "8月", "9月"]');
    await edited(code, deleteObject(code, 'xychart', series));
  });

  it('is a table of series', async () => {
    const table = must(readTable(code));
    expect(table.rows.map(({ cells }) => cells.name)).toEqual(['実績', '目標']);
    const changed = await edited(code, setCell(code, 1, 'values', '9, 9, 9'));
    expect(changed).toContain('line "目標" [9, 9, 9]');
    const more = await edited(code, addRow(code, { kind: 'bar', name: '予算' }));
    expect(more).toContain('bar "予算" [0, 0, 0]');
  });
});

describe('quadrant chart', () => {
  const code = starter('quadrant');

  it('adds points and names axes and quadrants', async () => {
    const point = await added(code, 'point', { name: 'タスクC', x: '0.2', y: '０.４' });
    expect(point).toContain('タスクC: [0.2, 0.4]');
    const axes = await added(code, 'axes', { q1: '最優先', xHigh: '急ぎ' });
    expect(axes).toContain('x-axis 緊急度が低い --> 急ぎ');
    expect(axes).toContain('quadrant-1 最優先');
    const fresh = await added('quadrantChart', 'axes', { xLow: '低', yHigh: '高', yLow: '小' });
    expect(fresh).toContain('x-axis 低');
    expect(fresh).toContain('y-axis 小 --> 高');
  });

  it('says what is missing or wrong', () => {
    expect(add(code, 'point', { name: '', x: '0.5', y: '0.5' })).toEqual({
      error: 'add.quad.needName'
    });
    expect(add(code, 'point', { name: 'a', x: '1.5', y: '0.5' })).toEqual({
      error: 'add.quad.badPoint'
    });
    expect(add(code, 'axes', {})).toEqual({ error: 'add.quad.needAxes' });
    expect(add('quadrantChart', 'axes', { xHigh: '高' })).toEqual({ error: 'add.quad.needLow' });
  });

  it('moves, renames and deletes points; renames quadrants; changes axes', async () => {
    const point = await object(code, 'タスクA');
    const moved = await edited(code, setObjectFields(code, 'quadrant', point, { x: '0.1' }));
    expect(moved).toContain('タスクA: [0.1, 0.9]');
    expect(setObjectFields(code, 'quadrant', point, { x: '2' })).toBeUndefined();
    await edited(code, renameObject(code, 'quadrant', point, '別の名前'));
    await edited(code, deleteObject(code, 'quadrant', point));
    const quadrant = await object(code, '象限1: すぐやる');
    const renamed = await edited(code, renameObject(code, 'quadrant', quadrant, '今すぐ'));
    expect(renamed).toContain('quadrant-1 今すぐ');
    const axis = must(
      must(await editableObjects(code)).items.find(({ label }) => label.startsWith('横軸'))
    );
    const changed = await edited(code, setObjectFields(code, 'quadrant', axis, { high: '急ぎ' }));
    expect(changed).toContain('x-axis 緊急度が低い --> 急ぎ');
  });

  it('is a table of points', async () => {
    const table = must(readTable(code));
    expect(table.rows.map(({ cells }) => cells.name)).toEqual(['タスクA', 'タスクB']);
    await edited(code, setCell(code, 0, 'y', '0.25'));
    const more = await edited(code, addRow(code, { name: '新しい項目' }));
    expect(more).toContain('新しい項目: [0.5, 0.5]');
  });
});

describe('sankey', () => {
  const code = starter('sankey');

  it('adds a flow, quoting a name with a comma', async () => {
    const next = await added(code, 'flow', { from: 'Profit', to: 'Tax, local', value: '5' });
    expect(next.trimEnd().endsWith('Profit,"Tax, local",5')).toBe(true);
  });

  it('refuses names mermaid cannot read, and says why', () => {
    expect(add(code, 'flow', { from: '売上', to: 'Cost', value: '1' })).toEqual({
      error: 'add.sankey.ascii'
    });
    expect(add(code, 'flow', { from: '', to: 'Cost', value: '1' })).toEqual({
      error: 'add.sankey.needNames'
    });
    expect(add(code, 'flow', { from: 'A', to: 'A', value: '1' })).toEqual({
      error: 'add.sankey.same'
    });
    expect(add(code, 'flow', { from: 'A', to: 'B', value: '0' })).toEqual({
      error: 'add.sankey.badValue'
    });
  });

  it('renames a name everywhere, deletes it with its flows, changes a value', async () => {
    const node = await object(code, 'Sales');
    const renamed = await edited(code, renameObject(code, 'sankey', node, 'Revenue'));
    expect(renamed).toContain('Revenue,Cost,60\nRevenue,Profit,40');
    expect(renameObject(code, 'sankey', node, '売上')).toBeUndefined();
    const flow = await object(code, 'Sales → Cost (60)');
    const value = await edited(code, setObjectFields(code, 'sankey', flow, { value: '70' }));
    expect(value).toContain('Sales,Cost,70');
    const cost = await object(code, 'Cost');
    expect(deleteObject(code, 'sankey', cost)).not.toContain('Cost');
  });

  it('is a table of flows', async () => {
    const table = must(readTable(code));
    expect(table.rows.map(({ cells }) => cells.to)).toEqual(['Cost', 'Profit']);
    await edited(code, setCell(code, 0, 'to', 'Goods'));
    expect(setCell(code, 0, 'to', '原価')).toBeUndefined();
    const more = await edited(code, addRow(code, { from: 'Profit', to: 'Tax', value: '' }));
    expect(more).toContain('Profit,Tax,10');
  });
});

describe('git graph', () => {
  const code = starter('git');

  it('adds commits, branches (Japanese names quoted), merges and switches', async () => {
    const branched = await added(code, 'branch', { from: 'main', name: '修正 1' });
    expect(branched).toContain('branch "修正-1"');
    const committed = await added(branched, 'commit', {
      branch: '修正-1',
      name: 'バグを直す',
      tag: '',
      type: 'HIGHLIGHT'
    });
    expect(committed).toContain('commit id: "バグを直す" type: HIGHLIGHT');
    const merged = await added(committed, 'merge', { from: '修正-1', into: 'main', tag: 'v1.1' });
    expect(merged.trimEnd().split('\n').slice(-2)).toEqual([
      '  checkout main',
      '  merge "修正-1" tag: "v1.1"'
    ]);
    const switched = await added(merged, 'checkout', { branch: 'develop' });
    expect(switched.trimEnd().endsWith('checkout develop')).toBe(true);
  });

  it('says what is missing or wrong', () => {
    expect(add(code, 'commit', { name: '' })).toEqual({ error: 'add.git.needCommit' });
    expect(add(code, 'commit', { name: '最初の版' })).toEqual({
      error: 'add.git.duplicateCommit'
    });
    expect(add(code, 'branch', { name: 'develop' })).toEqual({ error: 'add.git.duplicateBranch' });
    expect(add(code, 'merge', { from: '', into: 'main' })).toEqual({
      error: 'add.git.chooseBranches'
    });
    expect(add(code, 'merge', { from: 'main', into: 'main' })).toEqual({
      error: 'add.git.sameBranch'
    });
    expect(add(code, 'checkout', { branch: 'main' })).toEqual({ error: 'add.git.alreadyThere' });
  });

  it('renames and deletes commits and branches, and tags a commit', async () => {
    const commit = await object(code, '機能を追加');
    const renamed = await edited(code, renameObject(code, 'git', commit, '機能A'));
    expect(renamed).toContain('commit id: "機能A"');
    const tagged = await edited(code, setObjectFields(code, 'git', commit, { tag: 'beta' }));
    expect(tagged).toContain('commit id: "機能を追加" tag: "beta"');
    const branch = await object(code, 'develop');
    const moved = await edited(code, renameObject(code, 'git', branch, '開発'));
    expect(moved).toContain('branch "開発"');
    expect(moved).toContain('merge "開発" tag: "v1.0"');
    const gone = await edited(code, deleteObject(code, 'git', branch));
    expect(gone).not.toMatch(/develop|機能を追加/);
    const main = await object(code, 'main');
    expect(main.noDelete && main.noRename).toBe(true);
  });
});

describe('packet', () => {
  const code = starter('packet');

  it('adds a field after the last one', async () => {
    const next = await added(code, 'field', { bits: '16', name: 'ウィンドウ' });
    expect(next).toContain('64-79: "ウィンドウ"');
    const single = await added(next, 'field', { bits: '1', name: 'フラグ' });
    expect(single).toContain('80: "フラグ"');
  });

  it('says what is missing or wrong', () => {
    expect(add(code, 'field', { bits: '8', name: '' })).toEqual({ error: 'add.packet.needName' });
    expect(add(code, 'field', { bits: '0', name: 'a' })).toEqual({ error: 'add.packet.badBits' });
  });

  it('renumbers the fields after a change of width, a delete or a move', async () => {
    const first = await object(code, '送信元ポート (0-15)');
    const wider = await edited(code, setObjectFields(code, 'packet', first, { bits: '8' }));
    expect(wider).toContain('0-7: "送信元ポート"\n  8-23: "宛先ポート"\n  24-55: "シーケンス番号"');
    const gone = await edited(code, deleteObject(code, 'packet', first));
    expect(gone).toContain('0-15: "宛先ポート"\n  16-47: "シーケンス番号"');
    await edited(code, renameObject(code, 'packet', first, '発信元'));
    const moved = await edited(code, moveRow(code, 0, 1));
    expect(moved).toContain('0-15: "宛先ポート"\n  16-31: "送信元ポート"');
    const plus = 'packet-beta\n  +8: "a"\n  8-15: "b"';
    const object2 = must(await editableObjects(plus)).items[0];
    expect(setObjectFields(plus, 'packet', object2, { bits: '4' })).toBe(
      'packet-beta\n  +4: "a"\n  4-11: "b"'
    );
  });

  it('is a table of fields', async () => {
    const table = must(readTable(code));
    expect(table.rows.map(({ cells }) => cells.bits)).toEqual(['16', '16', '32']);
    const changed = await edited(code, setCell(code, 1, 'bits', '8'));
    expect(changed).toContain('16-23: "宛先ポート"\n  24-55');
    await edited(code, addRow(code, { name: 'チェックサム' }));
  });
});

describe('ZenUML', () => {
  const code = starter('zenuml');

  it('adds participants among the declarations and messages at the end', async () => {
    const next = await added(code, 'participant', { kind: 'Database', name: '在庫 DB' });
    expect(next).toContain('  システム\n  @Database 在庫_DB\n');
    const message = await added(next, 'message', {
      from: 'システム',
      text: '在庫を確認',
      to: '在庫_DB'
    });
    expect(message.trimEnd().endsWith('システム->在庫_DB: 在庫を確認')).toBe(true);
  });

  it('says what is missing', () => {
    expect(add(code, 'participant', { name: ' ' })).toEqual({ error: 'add.zen.needName' });
    expect(add(code, 'participant', { name: '利用者' })).toEqual({ error: 'add.zen.duplicate' });
    expect(add(code, 'message', { from: '利用者', text: 'x', to: '' })).toEqual({
      error: 'add.choose'
    });
    expect(add(code, 'message', { from: '利用者', text: '', to: 'システム' })).toEqual({
      error: 'add.zen.needText'
    });
  });

  it('renames a participant everywhere and deletes it with its messages', async () => {
    const participant = await object(code, 'システム');
    const renamed = must(renameObject(code, 'zenuml', participant, '注文 システム'));
    expect(renamed).toContain('  注文_システム\n  利用者->注文_システム: 注文する');
    const gone = deleteObject(code, 'zenuml', participant);
    expect(gone).not.toContain('システム');
    const message = await object(code, '利用者 → システム: 注文する');
    expect(renameObject(code, 'zenuml', message, '発注する')).toContain(
      '利用者->システム: 発注する'
    );
  });
});
