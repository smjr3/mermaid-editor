import { messages } from '$/i18n/messages';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { specFor } from './addActions';
import { canAdd, isArchitecture } from './diagramEdit';
import { editableObjects, editKind } from './diagramModify';
import { getTitle } from './diagramTitle';
import { getDirection } from './layout';
import { isReplaceable, starter, starterKinds } from './newDiagram';

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

const expectedType: Record<string, string> = {
  architecture: 'architecture',
  block: 'block',
  c4: 'c4',
  class: 'classDiagram',
  er: 'er',
  flowchart: 'flowchart-v2',
  gantt: 'gantt',
  git: 'gitGraph',
  journey: 'journey',
  kanban: 'kanban',
  mindmap: 'mindmap',
  packet: 'packet',
  pie: 'pie',
  quadrant: 'quadrantChart',
  sankey: 'sankey',
  sequence: 'sequence',
  state: 'stateDiagram',
  swimlane: 'swimlane',
  timeline: 'timeline',
  xychart: 'xychart',
  zenuml: 'zenuml'
};

describe('new diagram starters', () => {
  it('offers every type the owner asked for', () => {
    expect(starterKinds.map(({ id }) => id).sort()).toEqual(Object.keys(expectedType).sort());
  });

  it('has a name and a description for every type in every language', () => {
    for (const { id } of starterKinds) {
      for (const catalogue of Object.values(messages)) {
        expect(catalogue).toHaveProperty([`new.kind.${id}`]);
        expect(catalogue).toHaveProperty([`new.kind.${id}.hint`]);
      }
    }
  });

  describe.each(starterKinds)('$id', (kind) => {
    const code = starter(kind.id);

    it('parses as its type', async () => {
      await expect(typeOf(code)).resolves.toBe(expectedType[kind.id]);
    });

    it('gives the Add card something to do', () => {
      const offered =
        (specFor(code)?.actions.length ?? 0) > 0 || canAdd(code) || isArchitecture(code);
      expect(offered).toBe(true);
    });

    it('gives the Edit card something to change, where it handles the type', async () => {
      if (!editKind(code)) return;
      expect((await editableObjects(code))?.items.length).toBeGreaterThan(0);
    });

    it('names its placeholders in Japanese', () => {
      // mermaid's sankey lexer reads ASCII only.
      if (kind.id === 'sankey') return;
      expect(code).toMatch(/[぀-ヿ一-鿿]/);
    });

    it('takes a title where mermaid shows one, and still parses', async () => {
      const titled = starter(kind.id, { title: '月次の流れ "案"' });
      await expect(typeOf(titled)).resolves.toBe(expectedType[kind.id]);
      if (kind.title) expect(getTitle(titled)).toBe('月次の流れ "案"');
      else expect(titled).toBe(code);
    });

    it('takes a direction where the type has one', async () => {
      for (const direction of ['LR', 'TB'] as const) {
        const turned = starter(kind.id, { direction });
        await expect(typeOf(turned)).resolves.toBe(expectedType[kind.id]);
        expect(getDirection(turned)).toBe(kind.direction ? direction : undefined);
      }
    });
  });
});

describe('isReplaceable', () => {
  const samples = ['flowchart TD\n  A --> B', 'pie\n  "a" : 1'];
  it('is true for empty code, a sample or a starter, whatever the line endings', () => {
    expect(isReplaceable('', samples)).toBe(true);
    expect(isReplaceable('  \n', samples)).toBe(true);
    expect(isReplaceable('flowchart TD\r\n  A --> B\r\n', samples)).toBe(true);
    expect(isReplaceable(starter('gantt'), samples)).toBe(true);
    expect(isReplaceable(starter('flowchart', { direction: 'LR', title: 'x' }), samples)).toBe(
      true
    );
  });
  it('is false for code the user wrote or changed', () => {
    expect(isReplaceable('flowchart TD\n  A --> C', samples)).toBe(false);
    expect(isReplaceable(`${starter('sequence')}\n  p1->>p2: もう一つ`, samples)).toBe(false);
  });
});
