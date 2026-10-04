import { diagramData } from '@mermaid-js/examples';
import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { gitlabMarkdown, toImgTag, toStandaloneHtml } from './htmlExport';
import { getDirection, setDirection } from './layout';
import { localSamples } from './localSamples';
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
  )
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
