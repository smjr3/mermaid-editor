import { describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import {
  checkedRename,
  findOccurrences,
  identifierAt,
  isValidIdentifier,
  renameIn
} from './mermaidRename';

const flowchart = `flowchart TD
  A[Start A] --> B{Is A ok?}
  B -->|A path| C
  A --> C
  %% A in a comment
  click A "https://example.com/A"`;

describe('identifierAt', () => {
  it('finds the identifier under a 1-based column', () => {
    expect(identifierAt('  A[Start] --> Bee', 3)).toEqual({ name: 'A', start: 3, end: 4 });
    expect(identifierAt('  A[Start] --> Bee', 17)).toEqual({ name: 'Bee', start: 16, end: 19 });
  });

  it('returns undefined between identifiers', () => {
    expect(identifierAt('  A --> B', 5)).toBeUndefined();
  });

  it('accepts non-ASCII names', () => {
    expect(identifierAt('  受付 --> 発送', 3)?.name).toBe('受付');
  });
});

describe('findOccurrences', () => {
  it('finds node ids but not label text, edge labels, comments or strings', () => {
    const lines = findOccurrences(flowchart, 'A').map(({ line, start }) => [line, start]);
    expect(lines).toEqual([
      [2, 3],
      [4, 3],
      [6, 9]
    ]);
  });

  it('matches whole identifiers only', () => {
    expect(findOccurrences('graph TD\n  AB --> A\n  A_1 --> A', 'A')).toHaveLength(2);
  });

  it('skips message and description text after a spaced colon', () => {
    const seq = 'sequenceDiagram\n  Alice->>Bob: Hi Bob\n  Bob-->>Alice: Hi Alice';
    expect(findOccurrences(seq, 'Bob').map(({ line }) => line)).toEqual([2, 3]);
  });

  it('keeps architecture edge sides, which use an unspaced colon', () => {
    const arch =
      'architecture-beta\n  service db(database)[DB]\n  service api(server)[API]\n  db:R -- L:api';
    expect(findOccurrences(arch, 'db').map(({ line }) => line)).toEqual([2, 4]);
    expect(findOccurrences(arch, 'api').map(({ line }) => line)).toEqual([3, 4]);
  });

  it('ignores front matter', () => {
    expect(findOccurrences('---\ntitle: A\n---\ngraph TD\n  A --> B', 'A')).toHaveLength(1);
  });
});

describe('renameIn', () => {
  it('renames every occurrence and nothing else', () => {
    expect(renameIn(flowchart, 'A', 'Start')).toBe(`flowchart TD
  Start[Start A] --> B{Is A ok?}
  B -->|A path| C
  Start --> C
  %% A in a comment
  click Start "https://example.com/A"`);
  });
});

describe('isValidIdentifier', () => {
  it('accepts plain names and rejects keywords and punctuation', () => {
    expect(isValidIdentifier('order_2')).toBe(true);
    expect(isValidIdentifier('受付')).toBe(true);
    expect(isValidIdentifier('end')).toBe(false);
    expect(isValidIdentifier('subgraph')).toBe(false);
    expect(isValidIdentifier('a b')).toBe(false);
    expect(isValidIdentifier('')).toBe(false);
  });
});

describe('Windows line endings', () => {
  it('renames across CRLF lines and keeps the line endings', () => {
    const code = 'flowchart TD\r\n  order[Order] --> ship\r\n  order --> cancel';
    expect(renameIn(code, 'order', 'purchase')).toBe(
      'flowchart TD\r\n  purchase[Order] --> ship\r\n  purchase --> cancel'
    );
    expect(findOccurrences(code, 'order').map(({ line, start }) => [line, start])).toEqual([
      [2, 3],
      [3, 3]
    ]);
  });
});

describe('isValidIdentifier', () => {
  it('rejects plain numbers, which are values rather than names', () => {
    expect(isValidIdentifier('16')).toBe(false);
    expect(isValidIdentifier('node16')).toBe(true);
  });
});

describe('checkedRename', () => {
  const parse = async (code: string) => (await mermaid.parse(code)).diagramType;
  const code =
    'architecture-beta\n  service db(database)[DB]\n  service api(server)[API]\n  db:L -- R:api';

  it('returns the renamed code when it still parses as the same diagram', async () => {
    await expect(checkedRename(code, 'db', 'store', parse)).resolves.toEqual({
      code: code.replaceAll('db:', 'store:').replace('service db(', 'service store(')
    });
  });

  it('refuses a rename that breaks the diagram', async () => {
    // Architecture ids may not start with a capital R, L, T or B.
    await expect(checkedRename(code, 'db', 'Renamed', parse)).resolves.toEqual({
      reason: 'breaks'
    });
    await expect(checkedRename(code, 'R', 'X', parse)).resolves.toEqual({ reason: 'breaks' });
  });

  it('refuses an invalid new name', async () => {
    await expect(checkedRename(code, 'db', 'end', parse)).resolves.toEqual({ reason: 'invalid' });
  });
});
