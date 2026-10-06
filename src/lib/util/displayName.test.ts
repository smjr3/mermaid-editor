import { describe, expect, it } from 'vitest';
import { displayName } from './displayName';

describe('displayName', () => {
  const all = [
    { id: 'n1', label: '開始' },
    { id: 'n2', label: '承認' },
    { id: 'n5', label: ' 承認 ' },
    { id: 'X', label: 'X' }
  ];

  it('shows the text alone when no other object shows it', () => {
    expect(displayName('開始', 'n1', all)).toBe('開始');
  });

  it('adds the id only to tell two objects with the same text apart', () => {
    expect(displayName('承認', 'n2', all)).toBe('承認 (n2)');
    expect(displayName(' 承認 ', 'n5', all)).toBe('承認 (n5)');
  });

  it('shows the id when there is no text of its own', () => {
    expect(displayName('', 'n9', all)).toBe('n9');
    expect(displayName('X', 'X', all)).toBe('X');
  });
});
