import { describe, expect, it } from 'vitest';
import { adjustedMessage, displayName, nameChanges } from './displayName';

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

describe('nameChanges', () => {
  it('removes nested or overlapping tags completely', () => {
    const changes = nameChanges('<scr<script>ipt>x', 'x');
    expect(changes).toEqual([{ from: '<script>', to: '' }]);
    expect(changes.some(({ to }) => to.includes('<'))).toBe(false);
  });
  it('lists each change of a sign once', () => {
    expect(nameChanges('a;b;c', 'a,b,c')).toEqual([{ from: ';', to: ',' }]);
    expect(nameChanges('yes|no', 'yes/no')).toEqual([{ from: '|', to: '/' }]);
    expect(nameChanges('<b>bold</b> text', 'bold text')).toEqual([
      { from: '<b>', to: '' },
      { from: '</b>', to: '' }
    ]);
    expect(nameChanges('Fix #12', 'Fix 12')).toEqual([{ from: '#', to: '' }]);
    expect(nameChanges('DB [main]', 'DB (main)')).toEqual([
      { from: '[', to: '(' },
      { from: ']', to: ')' }
    ]);
    expect(nameChanges('section A', '「section A」')).toEqual([
      { from: '', to: '「' },
      { from: '', to: '」' }
    ]);
    expect(nameChanges('%% memo', '％％ memo')).toEqual([{ from: '%%', to: '％％' }]);
    expect(nameChanges('Order Service', 'Order_Service')).toEqual([{ from: '␣', to: '_' }]);
  });

  it('finds nothing when the name shows as typed', () => {
    expect(nameChanges('承認', '承認')).toEqual([]);
    // Entity codes, spaces and the stars the lists drop are not changes.
    expect(nameChanges('say "hi"', 'say #quot;hi#quot;')).toEqual([]);
    expect(nameChanges('No #1', 'No #35;1')).toEqual([]);
    expect(nameChanges('  a   b ', 'a b')).toEqual([]);
    expect(nameChanges('**a**', 'a')).toEqual([]);
  });
});

describe('adjustedMessage', () => {
  it('says what was replaced, briefly', () => {
    expect(adjustedMessage('a;b', 'a,b')).toBe('使えない文字を置き換えました: ; → ,');
    expect(adjustedMessage('<i>x</i>|y', 'x/y')).toBe(
      '使えない文字を置き換えました: <i> → （削除）、</i> → （削除）、| → /'
    );
    expect(adjustedMessage('title X', '「title X」')).toBe(
      '使えない文字を置き換えました: 「 を追加、」 を追加'
    );
    expect(adjustedMessage('a;b|c#d[e', 'a,b/cd(e')).toMatch(/、…$/);
  });

  it('is empty when nothing changed, or only letters differ (a fallback, an id)', () => {
    expect(adjustedMessage('承認', '承認')).toBe('');
    expect(adjustedMessage('Task', 'New topic')).toBe('');
  });
});
