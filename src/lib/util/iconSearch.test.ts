import { describe, expect, it } from 'vitest';
import { iconSvg, searchIcons } from './iconSearch';
import { insertIntoEditor, registerEditorInserter } from './iconSearch';

const tabler = {
  aliases: { 'db-alias': { parent: 'database' } },
  height: 24,
  icons: {
    database: { body: '<path d="M1 1"/>' },
    'database-off': { body: '<path d="M2 2"/>' },
    server: { body: '<path d="M3 3"/>' },
    'server-2': { body: '<path d="M4 4"/>' }
  },
  prefix: 'tabler',
  width: 24
};
const logos = {
  icons: { 'aws-lambda': { body: '<g/>', height: 256, width: 200 }, 'aws-s3': { body: '<g/>' } },
  prefix: 'logos'
};

describe('searchIcons', () => {
  it('finds icons whose names contain every word, exact and prefix matches first', () => {
    const results = searchIcons([tabler, logos], 'server');
    expect(results.map(({ id }) => id)).toEqual(['tabler:server', 'tabler:server-2']);
  });

  it('matches several words in any order and across packs', () => {
    expect(searchIcons([tabler, logos], 'lambda aws').map(({ id }) => id)).toEqual([
      'logos:aws-lambda'
    ]);
  });

  it('includes aliases, drawn with their parent', () => {
    const [alias] = searchIcons([tabler], 'db-alias');
    expect(alias).toMatchObject({ id: 'tabler:db-alias', icon: { body: '<path d="M1 1"/>' } });
  });

  it('limits the results and ignores an empty query', () => {
    expect(searchIcons([tabler], 'a', 2)).toHaveLength(2);
    expect(searchIcons([tabler], '  ')).toEqual([]);
  });

  it('takes the size from the icon, else the pack, else 16', () => {
    const [lambda] = searchIcons([logos], 'lambda');
    expect(lambda.icon).toMatchObject({ height: 256, width: 200 });
    const [s3] = searchIcons([logos], 's3');
    expect(s3.icon).toMatchObject({ height: 16, width: 16 });
    const [db] = searchIcons([tabler], 'database-off');
    expect(db.icon).toMatchObject({ height: 24, width: 24 });
  });
});

describe('iconSvg', () => {
  it('wraps the body in an svg with its viewBox', () => {
    expect(iconSvg({ body: '<g/>', height: 24, width: 32 })).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="100%" height="100%"><g/></svg>'
    );
  });
});

describe('insertIntoEditor', () => {
  it('uses the registered inserter, and reports when there is none or it declines', () => {
    expect(insertIntoEditor('logos:aws-s3')).toBe(false);
    const inserted: string[] = [];
    const unregister = registerEditorInserter((text) => {
      inserted.push(text);
      return true;
    });
    expect(insertIntoEditor('logos:aws-s3')).toBe(true);
    expect(inserted).toEqual(['logos:aws-s3']);
    unregister();
    expect(insertIntoEditor('logos:aws-s3')).toBe(false);
  });
});
