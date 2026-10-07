// Local: the IndexedDB store of imported icon packs, against an in-memory IndexedDB.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIconSet, sanitizeIconSet } from './customIcons';
import { createFakeIndexedDB, type FakeIndexedDB } from './fakeIndexedDB';

const registerIconPacks = vi.hoisted(() => vi.fn());
vi.mock('mermaid', () => ({ default: { registerIconPacks } }));

const { listIconPacks, saveIconPack } = await import('./customIconStore');

let fake: FakeIndexedDB;

beforeEach(() => {
  fake = createFakeIndexedDB();
  vi.stubGlobal('indexedDB', fake.factory);
  registerIconPacks.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a saved pack read back', () => {
  // R08: listIconPacks used to keep only body, width and height.
  it('keeps positions, transforms and aliases', async () => {
    const pack = sanitizeIconSet({
      aliases: { mirrored: { hFlip: true, parent: 'arrow' } },
      icons: {
        arrow: { body: '<path d="M1 1"/>', left: -2, rotate: 1, top: 3, vFlip: true, width: 30 }
      },
      prefix: 'vendor'
    });
    await saveIconPack(pack);
    const [stored] = await listIconPacks();
    expect(stored.icons.arrow).toMatchObject({
      left: -2,
      rotate: 1,
      top: 3,
      vFlip: true,
      width: 30
    });
    expect(stored.aliases).toEqual({ mirrored: { hFlip: true, parent: 'arrow' } });
    expect(stored).toEqual(pack);
  });

  it('keeps the viewBox origin of an imported SVG', async () => {
    const pack = buildIconSet('corp', [
      {
        name: 'Shape.svg',
        text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 24 24"><path d="M1 1"/></svg>'
      }
    ]);
    await saveIconPack(pack);
    const [stored] = await listIconPacks();
    expect(stored.icons.shape).toEqual(pack.icons.shape);
    expect(stored.icons.shape).toMatchObject({ height: 24, left: 10, top: 20, width: 24 });
  });
});
