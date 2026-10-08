// Local: the IndexedDB store of imported icon packs, against an in-memory IndexedDB.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIconSet, sanitizeIconSet } from './customIcons';
import { createFakeIndexedDB, type FakeIndexedDB } from './fakeIndexedDB';

const registerIconPacks = vi.hoisted(() => vi.fn());
vi.mock('mermaid', () => ({ default: { registerIconPacks } }));

const { deleteIconPack, ICON_PACKS_CHANGED, listIconPacks, saveIconPack, storageErrorKind } =
  await import('./customIconStore');

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

// R09: a write counts once its transaction completes, not when its request succeeds.
describe('a write whose transaction aborts after the request succeeded', () => {
  const pack = sanitizeIconSet({ icons: { a: { body: '<path d="M1 1"/>' } }, prefix: 'corp' });
  const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');

  it('rejects the save, registers nothing and announces nothing', async () => {
    const announced = vi.fn();
    window.addEventListener(ICON_PACKS_CHANGED, announced);
    fake.failNextTransaction(quota());
    try {
      await expect(saveIconPack(pack)).rejects.toMatchObject({ name: 'QuotaExceededError' });
      expect(registerIconPacks).not.toHaveBeenCalled();
      expect(announced).not.toHaveBeenCalled();
      expect(await listIconPacks()).toEqual([]);
    } finally {
      window.removeEventListener(ICON_PACKS_CHANGED, announced);
    }
  });

  it('rejects the delete and keeps the pack', async () => {
    await saveIconPack(pack);
    registerIconPacks.mockClear();
    fake.failNextTransaction(quota());
    await expect(deleteIconPack('corp')).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(registerIconPacks).not.toHaveBeenCalled();
    expect((await listIconPacks()).map(({ prefix }) => prefix)).toEqual(['corp']);
  });

  it('resolves a save once the transaction completes', async () => {
    await saveIconPack(pack);
    expect(fake.rows('packs')).toHaveLength(1);
    expect(registerIconPacks).toHaveBeenCalledOnce();
  });

  it('rejects when the storage cannot be opened at all', async () => {
    fake.failNextOpen(new DOMException('Blocked', 'SecurityError'));
    await expect(saveIconPack(pack)).rejects.toMatchObject({ name: 'SecurityError' });
    expect(registerIconPacks).not.toHaveBeenCalled();
  });
});

describe('storageErrorKind', () => {
  it('tells a full storage from a blocked one and from anything else', () => {
    expect(storageErrorKind(new DOMException('x', 'QuotaExceededError'))).toBe('full');
    expect(storageErrorKind(new DOMException('x', 'SecurityError'))).toBe('blocked');
    expect(storageErrorKind(new DOMException('x', 'InvalidStateError'))).toBe('other');
    expect(storageErrorKind('nope')).toBe('other');
  });
});
