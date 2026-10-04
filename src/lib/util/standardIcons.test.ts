import { describe, expect, it } from 'vitest';
import { searchIcons } from './iconSearch';
import { iconReference, isStandardIcon, standardIconPack } from './standardIcons';

describe('standard icons', () => {
  it("holds mermaid's five built-in architecture icons", () => {
    expect(Object.keys(standardIconPack.icons).sort()).toEqual([
      'cloud',
      'database',
      'disk',
      'internet',
      'server'
    ]);
  });

  it('are found by the search and written without a prefix', () => {
    const [match] = searchIcons([standardIconPack], 'database');
    expect(match.id).toBe('mermaid:database');
    expect(isStandardIcon(match.id)).toBe(true);
    expect(iconReference(match.id)).toBe('database');
  });

  it('leaves other icons as prefix:name', () => {
    expect(isStandardIcon('logos:aws-lambda')).toBe(false);
    expect(iconReference('logos:aws-lambda')).toBe('logos:aws-lambda');
  });
});
