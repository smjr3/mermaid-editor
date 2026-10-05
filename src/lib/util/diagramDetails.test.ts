import { messages } from '$/i18n/messages';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import {
  classMembers,
  deleteClassMember,
  deleteEntityAttribute,
  entityAttributes,
  fromGanttDate,
  objectFields,
  parseMember,
  setClassMember,
  setEntityAttribute,
  setObjectFields,
  type Member
} from './diagramDetails';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;
const values = (member: Member) =>
  Object.fromEntries(member.fields.map(({ key, value }) => [key, value]));
const labelsKnown = (members: Member[]) => {
  for (const member of members) {
    for (const field of member.fields) {
      const keys = [field.label, ...(field.options ?? []).map((o) => `${field.label}.${o}`)];
      for (const catalogue of Object.values(messages)) {
        for (const key of keys) expect(catalogue, key).toHaveProperty([key]);
      }
    }
  }
};

describe('class members', () => {
  const code = `classDiagram
  class Order {
    <<entity>>
    +int id
    -total: Money
    +discount(rate: int) Money
    +create()$
  }
  Order : #String note
  Order <|-- Special : extends
  style Order fill:#fff`;

  it('reads both kinds of member, written either way', () => {
    expect(parseMember('+String name')).toMatchObject({
      kind: 'attribute',
      name: 'name',
      type: 'String',
      typeFirst: true,
      visibility: 'public'
    });
    expect(parseMember('-total: Money')).toMatchObject({ name: 'total', type: 'Money' });
    expect(parseMember('#run(x: int) : bool')).toMatchObject({
      args: 'x: int',
      kind: 'method',
      name: 'run',
      type: 'bool',
      visibility: 'protected'
    });
    expect(parseMember('create()$')).toMatchObject({
      classifier: '$',
      name: 'create',
      visibility: 'none'
    });
  });

  it('lists the members of a class, in its body and in statements', () => {
    const members = classMembers(code, 'Order');
    expect(members.map(({ label, line }) => [line, label])).toEqual([
      [3, '+int id'],
      [4, '-total: Money'],
      [5, '+discount(rate: int) Money'],
      [6, '+create()$'],
      [8, '#String note']
    ]);
    expect(values(members[2])).toEqual({
      args: 'rate: int',
      name: 'discount',
      type: 'Money',
      visibility: 'public'
    });
    expect(classMembers(code, 'Special')).toEqual([]);
    labelsKnown(members);
  });

  it('changes a member in place, keeping how it was written', async () => {
    const renamed = setClassMember(code, 'Order', 3, { name: 'orderId', visibility: 'private' });
    expect(renamed?.split('\n')[3]).toBe('    -int orderId');
    const method = setClassMember(code, 'Order', 5, { args: '', type: 'void' });
    expect(method?.split('\n')[5]).toBe('    +discount() void');
    const statement = setClassMember(code, 'Order', 8, { type: 'Note: long' });
    expect(statement?.split('\n')[8]).toBe('  Order : #Notelong note');
    const kept = setClassMember(code, 'Order', 6, { name: 'make' });
    expect(kept?.split('\n')[6]).toBe('    +make()$');
    for (const result of [renamed, method, statement, kept]) {
      await expect(typeOf(result ?? '')).resolves.toBe('classDiagram');
    }
    expect(setClassMember(code, 'Order', 2, { name: 'x' })).toBeUndefined();
  });

  it('deletes a member, leaving an empty body that still parses', async () => {
    let result = code;
    for (const line of [8, 6, 5, 4, 3]) result = deleteClassMember(result, 'Order', line) ?? '';
    expect(result).toBe(
      'classDiagram\n  class Order {\n    <<entity>>\n  }\n  Order <|-- Special : extends\n  style Order fill:#fff'
    );
    await expect(typeOf(result)).resolves.toBe('classDiagram');
    expect(deleteClassMember(code, 'Order', 9)).toBeUndefined();
  });
});

describe('ER attributes', () => {
  const code = `erDiagram
  ORDER["注文"] {
    int id PK "番号"
    int customer_id PK, FK
    string note
  }
  ORDER ||--o{ LINE : has`;

  it('lists the attributes of an entity', () => {
    const attributes = entityAttributes(code, 'ORDER');
    expect(attributes.map(({ label }) => label)).toEqual([
      'int id PK "番号"',
      'int customer_id PK, FK',
      'string note'
    ]);
    expect(values(attributes[1])).toEqual({
      comment: '',
      key: 'PKFK',
      name: 'customer_id',
      type: 'int'
    });
    expect(entityAttributes(code, 'LINE')).toEqual([]);
    labelsKnown(attributes);
  });

  it('changes and deletes an attribute', async () => {
    const changed = setEntityAttribute(code, 'ORDER', 4, {
      comment: '備考 "自由"',
      key: 'UK',
      name: 'メモ',
      type: 'text'
    });
    expect(changed?.split('\n')[4]).toBe(`    text メモ UK "備考 '自由'"`);
    await expect(typeOf(changed ?? '')).resolves.toBe('er');
    const deleted = deleteEntityAttribute(code, 'ORDER', 2);
    expect(deleted).not.toContain('int id PK');
    await expect(typeOf(deleted ?? '')).resolves.toBe('er');
    expect(setEntityAttribute(code, 'ORDER', 6, { name: 'x' })).toBeUndefined();
  });
});

describe('gantt task fields', () => {
  const code = `gantt
  dateFormat YYYY-MM-DD
  section Plan
    Spec : a1, 2024-01-01, 3d
    Review : crit, vert, 2d
    Code : done, b1, after a1, 2024-01-10`;
  const task = (line: number) => ({ id: `L${line}`, label: '', line });
  const fieldsOf = (text: string, line: number) =>
    Object.fromEntries(
      (objectFields(text, 'gantt', task(line)) ?? []).map((f) => [f.key, f.value])
    );

  it('reads dates in the chart format', () => {
    expect(fromGanttDate(code, '2024-01-10')).toBe('2024-01-10');
    expect(fromGanttDate('gantt\n  dateFormat DD.MM.YYYY', '05.02.2024')).toBe('2024-02-05');
    expect(fromGanttDate('gantt\n  dateFormat X', '86400')).toBe('1970-01-02');
    expect(fromGanttDate(code, 'after a1')).toBeUndefined();
  });

  it('shows a task’s start, predecessor, length, status and marks', () => {
    expect(fieldsOf(code, 3)).toEqual({
      after: '',
      crit: 'no',
      days: '3',
      milestone: 'no',
      start: '2024-01-01',
      status: 'none'
    });
    expect(fieldsOf(code, 4)).toMatchObject({ crit: 'yes', days: '2', start: '' });
    expect(fieldsOf(code, 5)).toMatchObject({ after: 'L3', days: '', status: 'done' });
    expect(objectFields(code, 'gantt', { ...task(2), group: true })).toBeUndefined();
    const choices = objectFields(code, 'gantt', task(5))?.find((f) => f.key === 'after')?.choices;
    expect(choices).toEqual([
      { id: 'L3', label: 'Spec' },
      { id: 'L4', label: 'Review' }
    ]);
  });

  it('changes only what was changed, keeping other tags', async () => {
    const status = setObjectFields(code, 'gantt', task(4), {
      ...fieldsOf(code, 4),
      status: 'active'
    });
    expect(status?.split('\n')[4]).toBe('    Review : active, crit, vert, 2d');
    const length = setObjectFields(code, 'gantt', task(5), { ...fieldsOf(code, 5), days: '4' });
    expect(length?.split('\n')[5]).toBe('    Code : done, b1, after a1, 4d');
    const moved = setObjectFields(code, 'gantt', task(3), {
      ...fieldsOf(code, 3),
      start: '2024-03-04'
    });
    expect(moved?.split('\n')[3]).toBe('    Spec : a1, 2024-03-04, 3d');
    for (const result of [status, length, moved]) {
      await expect(typeOf(result ?? '')).resolves.toBe('gantt');
    }
  });

  it('makes a task follow another, giving it an id, or follow the previous task', async () => {
    const after = setObjectFields(code, 'gantt', task(5), { ...fieldsOf(code, 5), after: 'L4' });
    expect(after?.split('\n').slice(4)).toEqual([
      '    Review : crit, vert, t1, after a1, 2d',
      '    Code : done, b1, after t1, 2024-01-10'
    ]);
    // Clearing both: straight after the previous task, which a task with an id says with `after`.
    const cleared = setObjectFields(code, 'gantt', task(5), {
      ...fieldsOf(code, 5),
      after: '',
      start: ''
    });
    expect(cleared?.split('\n')[5]).toBe('    Code : done, b1, after t1, 2024-01-10');
    const marks = setObjectFields(code, 'gantt', task(3), {
      ...fieldsOf(code, 3),
      crit: 'yes',
      days: '0',
      milestone: 'yes'
    });
    expect(marks?.split('\n')[3]).toBe('    Spec : crit, milestone, a1, 2024-01-01, 0d');
    for (const result of [after, cleared, marks]) {
      await expect(typeOf(result ?? '')).resolves.toBe('gantt');
    }
  });
});

describe('pie slice value', () => {
  const code = 'pie\n  "Dogs" : 3\n  "Cats" : 2';
  it('shows and changes the value, refusing what is not a number of zero or more', async () => {
    const slice = { id: 'L1', label: 'Dogs', line: 1 };
    expect(objectFields(code, 'pie', slice)).toEqual([
      { key: 'value', kind: 'number', label: 'add.pie.value', value: '3' }
    ]);
    const changed = setObjectFields(code, 'pie', slice, { value: '12.5' });
    expect(changed).toBe('pie\n  "Dogs" : 12.5\n  "Cats" : 2');
    await expect(typeOf(changed ?? '')).resolves.toBe('pie');
    expect(setObjectFields(code, 'pie', slice, { value: '-1' })).toBeUndefined();
    expect(setObjectFields(code, 'pie', slice, { value: 'x' })).toBeUndefined();
  });
});
