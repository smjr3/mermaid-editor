import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { specFor } from './addActions';
import { canAdd, isArchitecture } from './diagramEdit';
import { getTitle } from './diagramTitle';
import { businessTemplatesName, localSamples } from './localSamples';
import { isReplaceable } from './newDiagram';
import {
  addRow,
  defaultValues,
  generate,
  isTemplateCode,
  type FormValues,
  type ListField,
  type Row,
  type TemplateForm,
  templateForms
} from './templateForms';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

const expectedType: Record<string, string> = {
  approval: 'flowchart-v2',
  architecture: 'architecture',
  closing: 'sequence',
  expense: 'swimlane',
  gantt: 'gantt',
  hiring: 'timeline',
  kanban: 'kanban',
  org: 'flowchart-v2',
  support: 'swimlane'
};

const form = (id: string) => {
  const found = templateForms.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};
const rows = (values: FormValues, key: string) => values[key] as Row[];
const listField = (template: TemplateForm, key: string): ListField => {
  const field = template.fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'list') throw new Error(key);
  return field;
};

// Every id a generated diagram declares (nodes, lanes, groups, services, …).
const declaredIds = (code: string): string[] =>
  [
    ...code.matchAll(
      /^\s*(?:subgraph|group|service|participant)\s+([^\s([]+)|^\s*([A-Za-z]\w*)[[({]/gm
    )
  ].map((match) => match[1] ?? match[2]);

describe('template forms', () => {
  it('has one form for each business template, in the same order', () => {
    expect(templateForms.map(({ sample }) => sample)).toEqual(
      localSamples[businessTemplatesName].map(({ title }) => title)
    );
    expect(templateForms.map(({ id }) => id).sort()).toEqual(Object.keys(expectedType).sort());
  });

  describe.each(templateForms)('$id', (template) => {
    it('labels the template and every field in both languages', () => {
      for (const label of [template.name, template.description]) {
        expect(label.ja).toBeTruthy();
        expect(label.en).toBeTruthy();
      }
      for (const field of template.fields) {
        expect(field.label.ja).toBeTruthy();
        expect(field.label.en).toBeTruthy();
        if (field.kind === 'list') {
          for (const column of field.columns) {
            expect(column.label.ja).toBeTruthy();
            expect(column.label.en).toBeTruthy();
          }
        }
      }
    });

    it('has non-empty defaults for every list', () => {
      const values = defaultValues(template);
      for (const field of template.fields) {
        if (field.kind === 'list') expect(rows(values, field.key).length).toBeGreaterThan(0);
      }
    });

    it('generates code from its defaults that parses as the expected type', async () => {
      const code = generate(template, defaultValues(template));
      await expect(typeOf(code)).resolves.toBe(expectedType[template.id]);
    });

    it('gives the Add card something to do with the result', () => {
      const code = generate(template, defaultValues(template));
      const offered =
        (specFor(code)?.actions.length ?? 0) > 0 || canAdd(code) || isArchitecture(code);
      expect(offered).toBe(true);
    });

    it('generates ASCII, unique ids that no side letter starts', () => {
      const ids = declaredIds(generate(template, defaultValues(template)));
      if (template.id !== 'closing') {
        for (const id of ids) {
          expect(id).toMatch(/^[a-z]\w*$/);
          expect(id).not.toMatch(/^[RLTBrltb]/);
        }
      }
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('still parses with every list emptied', async () => {
      const values = defaultValues(template);
      for (const field of template.fields) {
        if (field.kind === 'list') values[field.key] = [];
      }
      const code = generate(template, values);
      await expect(typeOf(code)).resolves.toBe(expectedType[template.id]);
    });

    it('still parses with awkward Japanese text in every text box', async () => {
      const awkward = '「承認」"引用" [括弧] (丸) {波} | a:b; #1 <b>太字</b>';
      const values = defaultValues(template);
      for (const field of template.fields) {
        if (field.kind === 'text') values[field.key] = awkward;
        if (field.kind === 'list') {
          for (const row of rows(values, field.key)) {
            for (const column of field.columns) {
              if (column.kind === 'text' && !column.pattern) row[column.key] = awkward;
            }
          }
        }
      }
      const code = generate(template, values);
      await expect(typeOf(code)).resolves.toBe(expectedType[template.id]);
      expect(code).not.toContain('<b>');
    });

    // Local (error recovery): a text box holding only a bracket or a quote, or a
    // keyword of the diagram's grammar, generated code that did not parse.
    it.each([']', '[ ]', '"', 'click', 'Click here', 'section', '(', '{}'])(
      'still parses with %j in every text box',
      async (text) => {
        const values = defaultValues(template);
        for (const field of template.fields) {
          if (field.kind === 'text') values[field.key] = text;
          if (field.kind === 'list') {
            for (const row of rows(values, field.key)) {
              for (const column of field.columns) {
                if (column.kind === 'text' && !column.pattern) row[column.key] = text;
              }
            }
          }
        }
        await expect(typeOf(generate(template, values))).resolves.toBe(expectedType[template.id]);
      }
    );

    it('generated defaults count as replaceable template code', () => {
      const code = generate(template, defaultValues(template));
      expect(isTemplateCode(code)).toBe(true);
      expect(isTemplateCode(`${code}\n%% changed`)).toBe(false);
    });
  });

  it('gives each new row a fresh id', () => {
    const template = form('expense');
    const values = defaultValues(template);
    addRow(values, listField(template, 'lanes'));
    addRow(values, listField(template, 'lanes'));
    const ids = rows(values, 'lanes').map((row) => row._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps defaults separate between calls', () => {
    const template = form('expense');
    const first = defaultValues(template);
    rows(first, 'lanes')[0].name = 'changed';
    expect(rows(defaultValues(template), 'lanes')[0].name).not.toBe('changed');
  });

  describe('expense flow (swimlane)', () => {
    const template = form('expense');

    it('reproduces the sample: lanes, steps, the approval loop and the title', async () => {
      const code = generate(template, defaultValues(template));
      expect(code).toMatch(/^swimlane-beta LR/m);
      for (const text of [
        '申請者',
        '上長',
        '経理',
        '経費精算を申請',
        '内容を承認する?',
        '振込処理'
      ])
        expect(code).toContain(text);
      expect(code).toContain('-->|"承認"|');
      expect(code).toContain('-->|"差戻し"|');
      expect(getTitle(code)).toBe('経費精算フロー');
      await expect(typeOf(code)).resolves.toBe('swimlane');
    });

    it('places a step in the lane it names, and ignores empty rows', () => {
      const values = defaultValues(template);
      const lane = addRow(values, listField(template, 'lanes'));
      lane.name = '監査';
      rows(values, 'lanes').push({ _id: 'blank', name: '   ' });
      const step = addRow(values, listField(template, 'steps'));
      step.lane = lane._id;
      step.text = '監査記録';
      rows(values, 'steps').push({ _id: 'empty', kind: 'step', lane: lane._id, text: '' });
      const code = generate(template, values);
      const laneBlock = /subgraph (\w+) \["監査"\]\n([\s\S]*?)\n\s*end/.exec(code);
      expect(laneBlock?.[2]).toContain('監査記録');
      expect(code.match(/subgraph/g)).toHaveLength(4);
      expect(code).not.toMatch(/\[""\]/);
    });

    it('escapes quotes and pipes in labels', () => {
      const values = defaultValues(template);
      rows(values, 'steps')[0].text = '"至急"の申請';
      rows(values, 'steps')[1].yes = 'OK|はい';
      const code = generate(template, values);
      expect(code).toContain('#quot;至急#quot;の申請');
      expect(code).toContain('-->|"OK/はい"|');
    });

    it('puts a step whose lane was removed into the first lane', async () => {
      const values = defaultValues(template);
      rows(values, 'lanes').splice(1, 1);
      const code = generate(template, values);
      expect(code).toContain('内容を承認する?');
      await expect(typeOf(code)).resolves.toBe('swimlane');
    });
  });

  describe('architecture', () => {
    const template = form('architecture');

    it('writes groups, services with icons and connections on sides', () => {
      const code = generate(template, defaultValues(template));
      expect(code).toMatch(/group grp1\(tabler:building\)\[本社 オンプレミス\]/);
      expect(code).toMatch(/service svc\d+\(tabler:database\)\[データベース\] in grp2/);
      expect(code).toMatch(/svc\d+:R --> L:svc\d+/);
    });

    it('skips connections to a removed service or to itself', async () => {
      const values = defaultValues(template);
      const services = rows(values, 'services');
      const removed = services.splice(0, 1)[0];
      rows(values, 'connections').push({
        _id: 'self',
        from: services[0]._id,
        side: 'right',
        to: services[0]._id
      });
      const code = generate(template, values);
      expect(code).not.toContain(removed.name);
      const lines = code.split('\n').filter((line) => line.includes('-->'));
      for (const line of lines) {
        const [from, to] = /(\w+):\w --> \w:(\w+)/.exec(line)?.slice(1) ?? [];
        expect(from).not.toBe(to);
      }
      await expect(typeOf(code)).resolves.toBe('architecture');
    });
  });

  describe('gantt', () => {
    const template = form('gantt');

    it('chains tasks without a start and keeps an explicit one', () => {
      const values = defaultValues(template);
      const tasks = rows(values, 'tasks');
      tasks[0].start = '2026-05-01';
      tasks[0].days = '4';
      tasks[1].start = '';
      const code = generate(template, values);
      expect(code).toMatch(/要件ヒアリング\s*:done, t1, 2026-05-01, 4d/);
      expect(code).toMatch(/要件定義書の作成\s*:done, t2, after t1, \d+d/);
    });

    it('falls back to the project start for a bad date and to one day for bad days', async () => {
      const values = defaultValues(template);
      const tasks = rows(values, 'tasks');
      tasks[0].start = 'あした';
      tasks[0].days = '-3';
      const code = generate(template, values);
      expect(code).toMatch(/t1, 2026-04-01, 1d/);
      await expect(typeOf(code)).resolves.toBe('gantt');
    });
  });

  describe('kanban', () => {
    it('quotes the assignee safely', async () => {
      const template = form('kanban');
      const values = defaultValues(template);
      rows(values, 'cards')[0].assignee = "O'Brien {x}";
      const code = generate(template, values);
      expect(code).toContain("assigned: 'OBrien x'");
      await expect(typeOf(code)).resolves.toBe('kanban');
    });
  });

  describe('monthly closing (sequence)', () => {
    it('writes participants as aliases and messages with their arrow', () => {
      const template = form('closing');
      const code = generate(template, defaultValues(template));
      expect(code).toContain('participant p1 as 各部門');
      expect(code).toMatch(/p1->>p2: /);
      expect(code).toMatch(/-->>/);
    });
  });

  describe('org chart', () => {
    it('joins each unit to its parent and ignores a unit that reports to itself', async () => {
      const template = form('org');
      const values = defaultValues(template);
      const units = rows(values, 'units');
      units[0].parent = units[0]._id;
      const code = generate(template, values);
      expect(code).toMatch(/o1\["代表取締役社長"\]/);
      expect(code).toMatch(/o1 --> o2/);
      expect(code).not.toMatch(/o1 --> o1\b/);
      await expect(typeOf(code)).resolves.toBe('flowchart-v2');
    });
  });

  it('the generated defaults are replaceable from the Samples card', () => {
    const template = form('hiring');
    expect(isReplaceable(generate(template, defaultValues(template)), [])).toBe(false);
    expect(isTemplateCode(generate(template, defaultValues(template)))).toBe(true);
  });
});
