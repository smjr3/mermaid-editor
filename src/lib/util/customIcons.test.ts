import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildIconSet,
  parseIconPackEnv,
  remoteIconPacks,
  vendorIconPacks,
  sanitizeIconSet,
  svgToIcon,
  toIconName,
  toPrefix
} from './customIcons';

describe('toIconName', () => {
  it('turns file names into Iconify icon names', () => {
    expect(toIconName('Web Server.svg')).toBe('web-server');
    expect(toIconName('Load_Balancer (v2).SVG')).toBe('load-balancer-v2');
    // Azure's architecture icons are named like this.
    expect(toIconName('10130-icon-service-Azure-SQL.svg')).toBe('azure-sql');
  });
});

describe('toPrefix', () => {
  it('normalises a prefix and refuses empty ones', () => {
    expect(toPrefix(' My Icons ')).toBe('my-icons');
    expect(toPrefix('!!!')).toBeUndefined();
  });
});

describe('svgToIcon', () => {
  it('keeps the drawing and the viewBox size', () => {
    const icon = svgToIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><path d="M0 0h18v18H0z" fill="#0078d4"/></svg>'
    );
    expect(icon.width).toBe(18);
    expect(icon.height).toBe(18);
    expect(icon.body).toContain('<path');
    expect(icon.body).toContain('#0078d4');
  });

  it('strips scripts, event handlers and foreign content', () => {
    const icon = svgToIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10" onload="alert(2)"/><foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><circle r="1"/></a></svg>'
    );
    expect(icon.body).not.toMatch(/script|onload|foreignObject|javascript:/i);
    expect(icon.body).toContain('<rect');
  });

  it('rejects text that is not an SVG', () => {
    expect(() => svgToIcon('<html><body>hi</body></html>')).toThrow();
  });
});

describe('buildIconSet', () => {
  it('collects SVG files under one prefix', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>';
    const set = buildIconSet('corp', [
      { name: 'Firewall.svg', text: svg },
      { name: 'Router.svg', text: svg }
    ]);
    expect(set.prefix).toBe('corp');
    expect(Object.keys(set.icons)).toEqual(['firewall', 'router']);
  });
});

describe('sanitizeIconSet', () => {
  it('accepts an Iconify JSON pack and sanitises every body', () => {
    const set = sanitizeIconSet({
      height: 24,
      icons: {
        bad: { body: '<path d="M0 0"/><script>x</script>' },
        ok: { body: '<path d="M1 1"/>' }
      },
      prefix: 'Vendor Pack',
      width: 24
    });
    expect(set.prefix).toBe('vendor-pack');
    expect(set.icons.bad.body).not.toContain('script');
    expect(set.icons.ok.body).toContain('<path');
  });

  it('rejects anything that is not an icon pack', () => {
    expect(() => sanitizeIconSet({ prefix: 'x' })).toThrow();
    expect(() => sanitizeIconSet('nope')).toThrow();
  });
});

// R08: what Iconify draws an icon with is kept, validated, through save and reload.
describe('sanitizeIconSet keeps the drawing data', () => {
  const pack = {
    aliases: {
      flipped: { hFlip: true, parent: 'arrow' },
      'flipped-again': { parent: 'flipped', vFlip: true },
      turned: { parent: 'arrow', rotate: 1 }
    },
    height: 20,
    icons: {
      arrow: {
        body: '<path d="M1 1"/>',
        hFlip: true,
        height: 16,
        left: -4,
        rotate: 2,
        top: 8,
        vFlip: false,
        width: 32
      }
    },
    left: 2,
    prefix: 'vendor',
    top: -3,
    width: 20
  };

  it('keeps per-icon position, size and transforms, and the set defaults', () => {
    const set = sanitizeIconSet(pack);
    expect(set.icons.arrow).toEqual({ ...pack.icons.arrow, body: '<path d="M1 1"></path>' });
    expect(set).toMatchObject({ height: 20, left: 2, top: -3, width: 20 });
  });

  it('keeps aliases, including one that points at another alias', () => {
    expect(sanitizeIconSet(pack).aliases).toEqual(pack.aliases);
  });

  it('is unchanged by a second pass, as when a stored pack is read back', () => {
    const once = sanitizeIconSet(pack);
    expect(sanitizeIconSet(structuredClone(once))).toEqual(once);
  });

  it('drops values that are not valid', () => {
    const set = sanitizeIconSet({
      icons: {
        a: {
          body: '<path/>',
          hFlip: 'yes',
          left: Number.NaN,
          rotate: 1.5,
          top: '3',
          vFlip: 1,
          width: -2
        }
      },
      left: Number.POSITIVE_INFINITY,
      prefix: 'p'
    });
    expect(Object.keys(set.icons.a)).toEqual(['body']);
    expect(set).not.toHaveProperty('left');
  });

  it('drops aliases that lead nowhere, loop, or use prototype keys', () => {
    const aliases = JSON.parse(
      '{"ok":{"parent":"a"},"missing":{"parent":"nope"},"loop-a":{"parent":"loop-b"},' +
        '"loop-b":{"parent":"loop-a"},"no-parent":{},"constructor":{"parent":"a"},' +
        '"__proto__":{"parent":"a"},"to-proto":{"parent":"constructor"},"a":{"parent":"ok"}}'
    ) as Record<string, unknown>;
    const set = sanitizeIconSet({ aliases, icons: { a: { body: '<path/>' } }, prefix: 'p' });
    expect(set.aliases).toEqual({ ok: { parent: 'a' } });
    expect(Object.getPrototypeOf(set.aliases)).toBe(Object.prototype);
  });

  it('drops icons named after prototype keys', () => {
    const set = sanitizeIconSet({
      icons: { constructor: { body: '<path/>' }, ok: { body: '<path/>' } },
      prefix: 'p'
    });
    expect(Object.keys(set.icons)).toEqual(['ok']);
  });

  it('keeps an SVG viewBox origin, negative ones too, through a save and reload', () => {
    for (const [viewBox, left, top] of [
      ['10 20 24 24', 10, 20],
      ['-10 -20 24 24', -10, -20]
    ] as const) {
      const built = buildIconSet('corp', [
        {
          name: 'Shape.svg',
          text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="M1 1"/></svg>`
        }
      ]);
      expect(built.icons.shape).toMatchObject({ height: 24, left, top, width: 24 });
      const reloaded = sanitizeIconSet(structuredClone(sanitizeIconSet(built)));
      expect(reloaded.icons.shape).toEqual(built.icons.shape);
    }
  });
});

describe('parseIconPackEnv', () => {
  it('reads prefix=url pairs and skips malformed entries', () => {
    expect(
      parseIconPackEnv(' azure=./icon-packs/azure.json, gcp = https://example.com/gcp.json ,broken')
    ).toEqual([
      { name: 'azure', url: './icon-packs/azure.json' },
      { name: 'gcp', url: 'https://example.com/gcp.json' }
    ]);
    expect(parseIconPackEnv(undefined)).toEqual([]);
  });
});

describe('remoteIconPacks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a hosted pack on first use, names it by its key and sanitises it', async () => {
    const fetchMock = vi.fn<(url: URL) => Promise<Response>>(async () =>
      Response.json({
        icons: { sql: { body: '<path d="M0 0"/><script>x</script>' } },
        prefix: 'whatever'
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const [pack] = remoteIconPacks('azure=./icon-packs/azure.json');
    expect(pack.name).toBe('azure');
    expect(fetchMock).not.toHaveBeenCalled();

    const json = await pack.loader();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/icon-packs\/azure\.json$/);
    expect(json.prefix).toBe('azure');
    expect(json.icons.sql.body).not.toContain('script');
  });

  it('fails the load on an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 }))
    );
    const [pack] = remoteIconPacks('azure=./missing.json');
    await expect(pack.loader()).rejects.toThrow(/404/);
  });
});

describe('vendorIconPacks', () => {
  it('loads the packs fetched at build time, sanitised, named after their files', async () => {
    const packs = vendorIconPacks(
      {
        '../vendor-icons/gcp.json': () =>
          Promise.resolve({
            default: { icons: { vpc: { body: '<path d="M0 0"/><script>x</script>' } }, prefix: 'x' }
          }),
        '../vendor-icons/tabler.json': () =>
          Promise.resolve({ default: { icons: {}, prefix: 'tabler' } })
      },
      ['tabler']
    );
    expect(packs.map(({ name }) => name)).toEqual(['gcp']);
    const pack = await packs[0].loader();
    expect(pack.prefix).toBe('gcp');
    expect(pack.icons.vpc.body).toBe('<path d="M0 0"></path>');
  });
});
