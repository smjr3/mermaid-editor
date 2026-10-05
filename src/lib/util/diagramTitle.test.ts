import { describe, expect, it } from 'vitest';
import { getTitle, setTitle, titleShown } from './diagramTitle';

describe('diagram title', () => {
  it('adds front matter to code without any', () => {
    expect(setTitle('flowchart TD\n  A --> B', '申請の流れ')).toBe(
      '---\ntitle: "申請の流れ"\n---\nflowchart TD\n  A --> B'
    );
  });
  it('reads quoted, single-quoted and plain titles', () => {
    expect(getTitle('---\ntitle: "a \\"b\\" c"\n---\npie')).toBe('a "b" c');
    expect(getTitle("---\ntitle: 'it''s'\n---\npie")).toBe("it's");
    expect(getTitle('---\ntitle: Plain words\n---\npie')).toBe('Plain words');
    expect(getTitle('pie title Pets')).toBe('');
  });
  it('changes the title and keeps the rest of the front matter', () => {
    const code = '---\nconfig:\n  theme: forest\ntitle: Old\n---\nflowchart LR\n  A';
    expect(setTitle(code, 'New')).toBe(
      '---\nconfig:\n  theme: forest\ntitle: "New"\n---\nflowchart LR\n  A'
    );
  });
  it('adds a title to front matter that has none', () => {
    expect(setTitle('---\nconfig:\n  look: neo\n---\nflowchart LR', 'T')).toBe(
      '---\ntitle: "T"\nconfig:\n  look: neo\n---\nflowchart LR'
    );
  });
  it('removes the title, and the front matter when nothing else is in it', () => {
    expect(setTitle('---\ntitle: Old\n---\nflowchart LR\n  A', '')).toBe('flowchart LR\n  A');
    expect(setTitle('---\ntitle: Old\nconfig:\n  look: neo\n---\nflowchart LR', '  ')).toBe(
      '---\nconfig:\n  look: neo\n---\nflowchart LR'
    );
    expect(setTitle('flowchart LR', '')).toBe('flowchart LR');
  });
  it('keeps Windows line endings and escapes what YAML would misread', () => {
    expect(setTitle('flowchart LR\r\n  A', 'a\\b "c"\nd')).toBe(
      '---\r\ntitle: "a\\\\b \\"c\\" d"\r\n---\r\nflowchart LR\r\n  A'
    );
    expect(getTitle(setTitle('flowchart LR', 'a\\b "c": #d'))).toBe('a\\b "c": #d');
  });
  it('uses the title statement of timeline and C4 diagrams, which ignore front matter', () => {
    const timeline = 'timeline\n  2026 : a';
    expect(setTitle(timeline, '沿革; #1')).toBe('timeline\n  title 沿革, ＃1\n  2026 : a');
    expect(getTitle('timeline\n  title 沿革\n  2026 : a')).toBe('沿革');
    expect(setTitle('timeline\n  title 沿革\n  2026 : a', '年表')).toBe(
      'timeline\n  title 年表\n  2026 : a'
    );
    expect(setTitle('timeline\n  title 沿革\n  2026 : a', '')).toBe(timeline);
    const c4 = '---\nconfig:\n  look: neo\n---\nC4Context\n  Person(a, "A")';
    expect(setTitle(c4, 'System')).toBe(
      '---\nconfig:\n  look: neo\n---\nC4Context\n  title System\n  Person(a, "A")'
    );
    expect(titleShown(c4)).toBe(true);
  });
  it('knows which types show a front-matter title', () => {
    expect(titleShown('flowchart LR')).toBe(true);
    expect(titleShown('---\ntitle: x\n---\nsequenceDiagram')).toBe(true);
    expect(titleShown('mindmap\n  root')).toBe(false);
    expect(titleShown('')).toBe(false);
  });
});
