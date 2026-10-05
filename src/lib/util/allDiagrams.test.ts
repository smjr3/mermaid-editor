import { diagramData } from '@mermaid-js/examples';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { initialValues, specFor } from './addActions';
import { colorAll, colorAllGroups, listGroups, setEdgeColor } from './colors';
import {
  addArchEdge,
  addArchGroup,
  addArchService,
  addLane,
  addNode,
  canAdd,
  isArchitecture
} from './diagramEdit';
import {
  deleteEdge,
  deleteObject,
  editableEdges,
  editableObjects,
  flowNodeDetails,
  moveNodeToLane,
  moveService,
  renameObject,
  reverseEdge,
  setEdgeHead,
  setEdgeLabel,
  setEdgeStyle,
  setNodeIcon,
  setNodeShape,
  setServiceIcon
} from './diagramModify';
import { gitlabMarkdown, toImgTag, toStandaloneHtml } from './htmlExport';
import { getDirection, setDirection } from './layout';
import { localSamples } from './localSamples';
import { starter, starterKinds } from './newDiagram';
import { architectureParts, diagramEdges, diagramObjects } from './mermaid';
import { checkedRename, findOccurrences, isValidIdentifier } from './mermaidRename';

// Every sample diagram the editor offers (mermaid's examples and this fork's
// own), through every feature that rewrites or exports the code.
const samples = [
  ...diagramData.flatMap((diagram) =>
    diagram.examples.map((example) => ({
      code: example.code,
      name: `${diagram.name}: ${example.title}`
    }))
  ),
  ...Object.entries(localSamples).flatMap(([name, list]) =>
    list.map((example) => ({ code: example.code, name: `${name}: ${example.title}` }))
  ),
  // The New diagram starters, with a title and a direction where they take one.
  ...starterKinds.map(({ id }) => ({
    code: starter(id, { direction: 'LR', title: '新しい図' }),
    name: `New diagram: ${id}`
  }))
];

const typeOf = async (code: string) => (await mermaid.parse(code)).diagramType;

describe.each(samples)('$name', ({ code }) => {
  it('parses', async () => {
    await expect(typeOf(code)).resolves.toBeTruthy();
  });

  it('keeps parsing, as the same type, after each direction the layout card offers', async () => {
    const type = await typeOf(code);
    const direction = getDirection(code);
    if (!direction) return;
    for (const next of ['LR', 'TB'] as const) {
      const changed = setDirection(code, next);
      expect(getDirection(changed)).toBe(next);
      await expect(typeOf(changed)).resolves.toBe(type);
    }
    // Setting the direction it already has changes nothing else.
    expect(setDirection(setDirection(code, 'LR'), direction)).toBe(setDirection(code, direction));
  });

  it('keeps parsing, as the same type, with every lane or subgraph coloured', async () => {
    if (listGroups(code).length === 0) return;
    const colored = colorAllGroups(code);
    expect(colored).not.toBe(code);
    await expect(typeOf(colored)).resolves.toBe(await typeOf(code));
    expect(colorAllGroups(colored, true)).toBe(code);
  });

  it('keeps parsing, as the same type and with the same objects, with every object coloured', async () => {
    const objects = await diagramObjects(code);
    if (!objects) return;
    const ids = objects.items.map(({ id }) => id);
    const colored = colorAll(code, ids, objects.syntax);
    await expect(typeOf(colored)).resolves.toBe(await typeOf(code));
    expect((await diagramObjects(colored))?.items.map(({ id }) => id)).toEqual(ids);
    const cleared = colorAll(colored, ids, objects.syntax, true);
    expect(cleared).toBe(colorAll(code, ids, objects.syntax, true));
  });

  it('keeps parsing, with the same arrows, with every arrow coloured', async () => {
    const edges = await diagramEdges(code);
    if (edges.length === 0) return;
    const colored = edges.reduce(
      (result, { index }) => setEdgeColor(result, index, '#d64545'),
      code
    );
    await expect(typeOf(colored)).resolves.toBe(await typeOf(code));
    expect((await diagramEdges(colored)).map(({ id }) => id)).toEqual(edges.map(({ id }) => id));
  });

  it('keeps parsing, as the same type, after adding a lane and a joined node', async () => {
    if (!canAdd(code)) return;
    const type = await typeOf(code);
    const { code: withLane, id: lane } = addLane(code, 'New lane');
    await expect(typeOf(withLane)).resolves.toBe(type);
    const from = (await diagramObjects(code))?.items[0]?.id;
    const before = await diagramEdges(code);
    const { code: withNode, id } = addNode(withLane, { from, label: 'New node', lane });
    await expect(typeOf(withNode)).resolves.toBe(type);
    expect((await diagramObjects(withNode))?.items.map((item) => item.id)).toContain(id);
    // Existing arrows keep their numbers.
    expect((await diagramEdges(withNode)).slice(0, before.length).map((edge) => edge.id)).toEqual(
      before.map((edge) => edge.id)
    );
  });

  it('keeps parsing as architecture after adding a group, a joined service and a connection', async () => {
    if (!isArchitecture(code)) return;
    const { services } = await architectureParts(code);
    const { code: withGroup, id: group } = addArchGroup(code, {
      icon: 'cloud',
      label: '新しいグループ'
    });
    const { code: withService, id } = addArchService(withGroup, {
      arrow: true,
      from: services[0]?.id,
      group,
      icon: 'logos:aws-lambda',
      label: 'New (service)',
      place: 'down'
    });
    const joined = services[1]
      ? addArchEdge(withService, { from: services[1].id, place: 'right', to: id })
      : withService;
    await expect(typeOf(joined)).resolves.toBe('architecture');
    expect((await architectureParts(joined)).services.map((service) => service.id)).toContain(id);
  });

  it('keeps parsing, as the same type, after each action of its Add card', async () => {
    const spec = specFor(code);
    if (!spec) return;
    const type = await typeOf(code);
    const parts = await spec.parts(code);
    for (const action of spec.actions) {
      // Every field filled: the first and last of each list, a name, a date, a number.
      const values = initialValues(action);
      for (const field of action.fields) {
        const list = parts[field.source ?? ''] ?? [];
        if (field.kind === 'item')
          values[field.key] = (field.key === 'to' ? list.at(-1) : list[0])?.id ?? '';
        if (field.kind === 'text') values[field.key] = 'Added: "x" [1]';
        if (field.kind === 'date') values[field.key] = '2025-01-02';
      }
      const result = action.apply(code, values);
      if ('error' in result) continue;
      await expect(typeOf(result.code), `${spec.kind} ${action.id}`).resolves.toBe(type);
    }
  });

  it('keeps parsing, as the same type, after renaming and after deleting each object of its Edit card', async () => {
    const objects = await editableObjects(code);
    if (!objects) return;
    const type = await typeOf(code);
    for (const object of objects.items) {
      const renamed = renameObject(code, objects.kind, object, 'Renamed: "x" [1] (y)');
      if (renamed !== undefined) {
        expect(renamed, `rename ${object.id}`).not.toBe(code);
        await expect(typeOf(renamed), `rename ${object.id}`).resolves.toBe(type);
      }
      if (object.noDelete) continue;
      for (const keepContents of object.group ? [false, true] : [false]) {
        const deleted = deleteObject(code, objects.kind, object, { keepContents });
        expect(deleted, `delete ${object.id}`).not.toBe(code);
        await expect(typeOf(deleted), `delete ${object.id} keep=${keepContents}`).resolves.toBe(
          type
        );
        // The object is gone (line-based items shift, so only ids are checked).
        if (object.line === undefined && !keepContents) {
          const left = (await editableObjects(deleted))?.items.map(({ id }) => id) ?? [];
          expect(left, `delete ${object.id}`).not.toContain(object.id);
        }
      }
    }
  }, 120_000);

  it('keeps parsing, as the same type and with the same arrows, after each node shape, icon and lane change of its Edit card', async () => {
    const objects = await editableObjects(code);
    if (objects?.kind !== 'flowchart' && objects?.kind !== 'architecture') return;
    const type = await typeOf(code);
    const arrows = async (text: string) =>
      (await diagramEdges(text)).map(({ label }) => label).sort();
    const before = await arrows(code);
    const groups = objects.items.filter((item) => item.group).map(({ id }) => id);
    for (const object of objects.items.filter((item) => !item.group && !item.noRename)) {
      const edits: [string, string | undefined][] =
        objects.kind === 'flowchart'
          ? [
              ['shape', setNodeShape(code, object.id, 'rounded')],
              ['icon', setNodeIcon(code, object.id, 'tabler:user')],
              ['no lane', moveNodeToLane(code, object.id, '')],
              ...groups.map((lane): [string, string | undefined] => [
                `lane ${lane}`,
                moveNodeToLane(code, object.id, lane)
              ])
            ]
          : [
              ['icon', setServiceIcon(code, object.id, 'logos:aws-lambda')],
              ['no group', moveService(code, object.id, '')],
              ...groups.map((group): [string, string | undefined] => [
                `group ${group}`,
                moveService(code, object.id, group)
              ])
            ];
      for (const [name, edited] of edits) {
        if (edited === undefined) continue;
        const why = `${name} ${object.id}`;
        await expect(typeOf(edited), why).resolves.toBe(type);
        if (objects.kind === 'flowchart') {
          expect(await arrows(edited), why).toEqual(before);
          if (name.startsWith('lane ')) {
            expect(flowNodeDetails(edited, object.id).lane, why).toBe(name.slice(5));
          }
        }
      }
    }
  }, 120_000);

  it('keeps parsing, as the same type and with one arrow fewer or the same arrows, after each arrow edit of its Edit card', async () => {
    const edges = await editableEdges(code);
    if (!edges || edges.items.length === 0) return;
    const type = await typeOf(code);
    const ids = (text: string) =>
      editableEdges(text).then((found) => found?.items.map(({ from, to }) => `${from}>${to}`));
    for (const edge of edges.items) {
      const edits: [string, string | undefined][] = [
        ['delete', deleteEdge(code, edges.kind, edge)],
        ['reverse', edges.can.reverse ? reverseEdge(code, edges.kind, edge) : undefined],
        [
          'label',
          edges.can.label ? setEdgeLabel(code, edges.kind, edge, 'Edited: "x" | [1]') : undefined
        ],
        ['head', edges.can.head ? setEdgeHead(code, edges.kind, edge, !edge.head) : undefined],
        ...edges.can.styles.map((style): [string, string] => [
          style,
          setEdgeStyle(code, edges.kind, edge, style)
        ])
      ];
      for (const [name, edited] of edits) {
        if (edited === undefined) continue;
        const why = `${edges.kind} ${name} ${edge.index} ${edge.from}>${edge.to}`;
        await expect(typeOf(edited), why).resolves.toBe(type);
        const before = edges.items.map(({ from, to }) => `${from}>${to}`);
        const after = await ids(edited);
        if (name === 'delete') {
          expect(after, why).toEqual(before.filter((_, i) => i !== edge.index));
        } else if (name === 'reverse') {
          expect(after, why).toEqual(
            before.map((pair, i) => (i === edge.index ? `${edge.to}>${edge.from}` : pair))
          );
        } else {
          expect(after, why).toEqual(before);
        }
      }
    }
  }, 120_000);

  it('exports to HTML, an img tag and GitLab Markdown with the source intact', () => {
    const html = toStandaloneHtml({ code, svg: '<svg></svg>', title: 't' });
    const shown = (/<pre>([\s\S]*)<\/pre>/.exec(html)?.[1] ?? '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
    expect(shown).toBe(code);
    expect(toImgTag('<svg></svg>', 'x')).toMatch(/^<img /);
    const markdown = gitlabMarkdown({
      alt: 'a',
      code,
      editUrl: 'https://x/edit#pako:a',
      fileName: 'f.svg',
      labels: { edit: 'e', source: 's' }
    });
    const fence = /\n(`{4,})text\n/.exec(markdown)?.[1] ?? '';
    expect(markdown).toContain(`${fence}text\n${code}\n${fence}\n`);
  });
});

const parse = async (code: string) => (await mermaid.parse(code)).diagramType;

describe('F2 rename across every sample', () => {
  it.each(samples)(
    '$name: no rename F2 accepts breaks the diagram',
    async ({ code }) => {
      const type = await typeOf(code);
      const words = [...new Set(code.match(/[\p{L}\p{N}_]+/gu) ?? [])].filter(isValidIdentifier);
      for (const word of words.filter(
        (candidate) => findOccurrences(code, candidate).length >= 2
      )) {
        for (const to of ['zzrenamed', 'Renamed1']) {
          const result = await checkedRename(code, word, to, parse);
          if ('code' in result) {
            await expect(typeOf(result.code), `${word} -> ${to}`).resolves.toBe(type);
          }
        }
      }
    },
    60_000
  );

  it.each([
    ['Flowchart', 'flowchart TD\n  order[Order] --> ship\n  order --> cancel', 'order'],
    ['Sequence', 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hello', 'Alice'],
    ['State', 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy', 'Idle'],
    ['Class', 'classDiagram\n  Animal <|-- Duck\n  Animal : +age', 'Animal'],
    [
      'ER',
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    string name\n  }',
      'CUSTOMER'
    ],
    [
      'Architecture',
      'architecture-beta\n  service db(database)[DB]\n  service api(server)[API]\n  db:L -- R:api',
      'db'
    ]
  ])('%s: renames a node id', async (_name, code, from) => {
    const result = await checkedRename(code, from, 'store', parse);
    expect(result).toHaveProperty('code');
  });
});
