import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { describeCodeError, errorLineOf, hazardMessage, renderHazard } from './codeError';

/** The message mermaid gives for the code, as the app shows it. */
const messageOf = async (code: string): Promise<string> => {
  try {
    await mermaid.parse(code);
  } catch (error) {
    return String(error);
  }
  throw new Error(`parsed: ${code}`);
};

describe('errorLineOf', () => {
  it.each([
    ['an arrow with no target at the end', 'flowchart TD\n  A[Start] --> B[Next]\n  B -->', 3],
    ['an unbalanced bracket', 'flowchart TD\n  A[Start --> B[Next]\n  B --> C', 2],
    ['an unknown word', 'flowchart TD\n  A --> B\n  foo bar baz qux\n  B --> C', 3],
    [
      'a broken sequence message',
      'sequenceDiagram\n  Alice->>Bob: hi\n  Bob->>: \n  Bob->>Alice: ok',
      3
    ],
    [
      'a mistake under front matter',
      '---\ntitle: T\n---\nflowchart TD\n  A --> B\n  foo bar baz\n  C --> D',
      6
    ],
    [
      'a mistake after a comment',
      'flowchart TD\n  %% a note\n  A --> B\n  foo bar baz\n  C --> D',
      4
    ],
    ['a repeated line', 'flowchart TD\n  A --> B\n  A --> B\n  foo bar\n  A --> B\n  foo bar', 4],
    ['a langium diagram', 'pie\n  "a" : 1\n  "b" : x\n  "c" : 3', 3],
    ['an architecture label', 'architecture-beta\n  service a(server)[A]\n  service b(server)[]', 3]
  ])('finds the line of %s', async (_name, code, line) => {
    expect(errorLineOf(await messageOf(code), code)).toBe(line);
  });

  it('points at the header when there is no diagram type', async () => {
    const code = '\n\nA --> B\nB --> C';
    expect(errorLineOf(await messageOf(code), code)).toBe(3);
  });

  it('gives up on a message without a place', () => {
    expect(errorLineOf('Error: something else', 'flowchart TD\n  A')).toBeUndefined();
  });
});

describe('renderHazard', () => {
  // mermaid parses these, then overflows the stack while laying them out and leaves
  // the tab unresponsive — and, the code being saved, again on every reload.
  it.each([
    ['stateDiagram-v2\n  [*] --> A\n  state A {\n    [*] --> A\n  }', 'A', 4],
    ['stateDiagram-v2\n  state A {\n    A --> B\n  }', 'A', 3],
    [
      'stateDiagram-v2\n  state Outer {\n    state Inner {\n      x --> Outer\n    }\n  }',
      'Outer',
      4
    ],
    ['stateDiagram\n  state "Long name" as A {\n    B --> A\n  }', 'A', 3]
  ])('finds a composite state that contains itself in %j', (code, name, line) => {
    expect(renderHazard(code, 'stateDiagram')).toEqual({ line, name });
  });

  it.each([
    'stateDiagram-v2\n  state A {\n    B --> C\n  }\n  A --> D',
    'stateDiagram-v2\n  state A {\n    B --> C : mentions A\n  }',
    'stateDiagram-v2\n  state AB {\n    A --> ABC\n  }',
    'stateDiagram-v2\n  state A {\n    %% A here is a comment\n    B\n  }'
  ])('leaves %j alone', (code) => {
    expect(renderHazard(code, 'stateDiagram')).toBeUndefined();
  });

  it('tells a state diagram by its header when not given the type', () => {
    expect(
      renderHazard('---\ntitle: T\n---\nstateDiagram-v2\n  state A {\n    A --> B\n  }')
    ).toEqual({ line: 6, name: 'A' });
    expect(renderHazard('flowchart TD\n  subgraph A\n    A\n  end')).toBeUndefined();
  });

  it('only looks at state diagrams', () => {
    expect(
      renderHazard('flowchart TD\n  subgraph A\n    A\n  end', 'flowchart-v2')
    ).toBeUndefined();
  });

  it('is described with the state and its line', () => {
    const code = 'stateDiagram-v2\n  state A {\n    A --> B\n  }';
    const message = hazardMessage(renderHazard(code, 'stateDiagram') ?? { line: 0, name: '' });
    expect(describeCodeError(message, code)).toEqual({
      key: 'recover.selfNested',
      line: 3,
      name: 'A'
    });
  });
});

describe('describeCodeError', () => {
  it('says the code is empty', () => {
    expect(describeCodeError('', '  \n')).toEqual({ key: 'recover.empty' });
  });

  it('says which line stops part-way', async () => {
    const code = 'flowchart TD\n  A --> B\n  B -->';
    expect(describeCodeError(await messageOf(code), code)).toEqual({
      key: 'recover.unfinished',
      line: 3
    });
  });

  it('says which line has a mistake', async () => {
    const code = 'flowchart TD\n  A --> B\n  foo bar baz\n  B --> C';
    expect(describeCodeError(await messageOf(code), code)).toEqual({
      key: 'recover.atLine',
      line: 3
    });
  });

  it('says the diagram type is missing', async () => {
    const code = 'A --> B';
    expect(describeCodeError(await messageOf(code), code)).toEqual({
      key: 'recover.noType',
      line: 1
    });
  });

  it('falls back to a general message', () => {
    expect(describeCodeError('Error: odd', 'flowchart TD\n  A')).toEqual({
      key: 'recover.unknown'
    });
  });
});
