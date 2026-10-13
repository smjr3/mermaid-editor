import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest's jsdom environment exposes its JSDOM instance, used to move the page's origin.
declare const jsdom: { reconfigure: (options: { url: string }) => void };

const offline = vi.hoisted(() => ({ isOffline: false }));
vi.mock('./env', async (original) => {
  const actual = await original<typeof import('./env')>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) =>
        key === 'isOffline' ? offline.isOffline : target[key as keyof typeof target]
    })
  };
});

const {
  buildIconSet,
  parseIconPackEnv,
  remoteIconPacks,
  vendorIconPacks,
  sanitizeIconSet,
  svgToIcon,
  toIconName,
  toPrefix
} = await import('./customIcons');

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

  // R04: MERMAID_OFFLINE covers the hosted packs too.
  it('refuses a pack on another site when offline, before any request', async () => {
    offline.isOffline = true;
    try {
      const fetchMock = vi.fn(async () => Response.json({ icons: {}, prefix: 'x' }));
      vi.stubGlobal('fetch', fetchMock);
      const [pack] = remoteIconPacks('aws=https://icons.example.com/aws.json');
      await expect(pack.loader()).rejects.toThrow(/MERMAID_OFFLINE/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      offline.isOffline = false;
    }
  });

  it('still loads a pack this site hosts when offline', async () => {
    offline.isOffline = true;
    try {
      const fetchMock = vi.fn(async () =>
        Response.json({ icons: { sql: { body: '<path d="M0 0"/>' } }, prefix: 'x' })
      );
      vi.stubGlobal('fetch', fetchMock);
      const [pack] = remoteIconPacks('azure=./icon-packs/azure.json');
      await expect(pack.loader()).resolves.toMatchObject({ prefix: 'azure' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      offline.isOffline = false;
    }
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

// Local (N03): a pack URL on this site that redirects elsewhere must not reach the
// other origin when offline — the redirect is refused before it is followed.
describe('remoteIconPacks (MERMAID_OFFLINE) and redirects', () => {
  const servers: Server[] = [];
  let site = '';
  let outside = '';
  let outsideHits = 0;
  const originalUrl = location.href;
  const pack = JSON.stringify({ icons: { sql: { body: '<path d="M0 0"/>' } }, prefix: 'x' });

  const listen = (handler: Parameters<typeof createServer>[1]) =>
    new Promise<string>((resolve) => {
      const server = createServer(handler);
      servers.push(server);
      server.listen(0, '127.0.0.1', () => {
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      });
    });

  beforeAll(async () => {
    outside = await listen((_request, response) => {
      outsideHits += 1;
      response.setHeader('content-type', 'application/json');
      response.end(pack);
    });
    site = await listen((request, response) => {
      const status = /^\/(\d{3})\//.exec(request.url ?? '')?.[1];
      if (status) {
        response.writeHead(Number(status), { location: `${outside}/aws.json` });
        response.end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(pack);
    });
    jsdom.reconfigure({ url: `${site}/edit` });
    offline.isOffline = true;
  });

  afterAll(async () => {
    offline.isOffline = false;
    jsdom.reconfigure({ url: originalUrl });
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });

  beforeEach(() => {
    outsideHits = 0;
  });

  it('loads a pack this site serves directly', async () => {
    const [loader] = remoteIconPacks('azure=./icon-packs/azure.json');
    await expect(loader.loader()).resolves.toMatchObject({ prefix: 'azure' });
  });

  it.each([301, 302, 303, 307, 308])(
    'refuses a %i redirect to another origin without requesting it',
    async (status) => {
      const [loader] = remoteIconPacks(`aws=./${status}/aws.json`);
      await expect(loader.loader()).rejects.toThrow(/redirect/);
      expect(outsideHits).toBe(0);
    }
  );
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

// R04: an icon must not make the browser fetch anything when it is drawn: external
// images, `use` references and `url(…)` paints are taken out; local ones stay.
describe('external references in icons', () => {
  const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">${body}</svg>`;
  const png = 'data:image/png;base64,iVBORw0KGgo=';

  it('drops images that are not data: URLs and keeps embedded ones', () => {
    const { body } = svgToIcon(
      svg(
        `<image href="https://tracker.example.com/a.png" width="4" height="4"/>` +
          `<image xlink:href="//tracker.example.com/b.png"/>` +
          `<image href="${png}" width="4" height="4"/>`
      )
    );
    expect(body).not.toContain('tracker.example.com');
    expect(body).toContain(png);
  });

  it('drops url() paints that point outside the icon and keeps local ones', () => {
    const { body } = svgToIcon(
      svg(
        `<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>` +
          `<rect width="4" height="4" style="fill:url(https://tracker.example.com/p.svg#x);stroke:#123456"/>` +
          `<rect width="4" height="4" fill="url('https://tracker.example.com/q.svg#y')" stroke="#654321"/>` +
          `<rect width="4" height="4" filter="url(http://tracker.example.com/f.svg#f)"/>` +
          `<rect width="4" height="4" fill="url(#g)"/>`
      )
    );
    expect(body).not.toContain('tracker.example.com');
    expect(body).toContain('stroke:#123456');
    expect(body).toContain('stroke="#654321"');
    expect(body).toContain('fill="url(#g)"');
  });

  it('drops use references to other files', () => {
    const { body } = svgToIcon(
      svg(
        `<defs><path id="p" d="M0 0h4"/></defs>` +
          `<use href="https://tracker.example.com/s.svg#p"/>` +
          `<use xlink:href="sprites.svg#p"/>` +
          `<use href="#p"/>`
      )
    );
    expect(body).not.toContain('tracker.example.com');
    expect(body).not.toContain('sprites.svg');
    expect(body).toContain('id="p"');
  });

  it('keeps links, which only go anywhere on a click', () => {
    const { body } = svgToIcon(
      svg('<a href="https://example.com/"><rect width="4" height="4"/></a>')
    );
    expect(body).toContain('href="https://example.com/"');
  });

  it('applies to packs as well as SVG files', () => {
    const pack = sanitizeIconSet({
      icons: {
        logo: {
          body: '<image href="https://tracker.example.com/a.png"/><rect style="fill:url(https://tracker.example.com/p#x)" width="1" height="1"/>'
        }
      },
      prefix: 'corp'
    });
    expect(pack.icons.logo.body).not.toContain('tracker.example.com');
    expect(pack.icons.logo.body).toContain('<rect');
  });
});

// Local (N04): CSS lets a function name be written with escapes, in any case and with
// comments, so `u\72l(` is `url(`. The style and presentation attributes are read as
// CSS: only local `#id` references and known value functions survive.
describe('external references written with CSS escapes', () => {
  const svg = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
  const outside = /outside\.example/i;

  it.each([
    String.raw`fill:u\72l(https://outside.example/probe.svg#paint)`,
    String.raw`fill:u\000072l(https://outside.example/probe.svg#paint)`,
    String.raw`fill:u\72 l(https://outside.example/probe.svg#paint)`,
    String.raw`fill:\75\72\6c(https://outside.example/probe.svg#paint)`,
    String.raw`fill:\u\r\l(https://outside.example/probe.svg#paint)`,
    'fill:URL(https://outside.example/probe.svg#paint)',
    'fill:Url( &quot;https://outside.example/probe.svg#paint&quot; )',
    'fill:url(/**/https://outside.example/probe.svg#paint)',
    'fill:u/**/rl(https://outside.example/probe.svg#paint)',
    String.raw`filter:u\72l('https://outside.example/f.svg#f')`,
    String.raw`mask:u\72l(https://outside.example/m.svg#m)`,
    String.raw`clip-path:u\72l(https://outside.example/c.svg#c)`,
    String.raw`stroke:u\72l(https://outside.example/s.svg#s)`,
    String.raw`marker-end:u\72l(https://outside.example/k.svg#k)`,
    String.raw`cursor:u\72l(https://outside.example/c.cur),auto`,
    'mask-image:image-set(&quot;https://outside.example/i.png&quot; 1x)',
    String.raw`--paint:u\72l(https://outside.example/v.svg#v);fill:var(--paint)`,
    String.raw`f\69ll:u\72l(https://outside.example/probe.svg#paint)`
  ])('drops %s from a style attribute, keeping the rest', (declaration) => {
    const { body } = svgToIcon(
      svg(`<path d="M0 0h1" style="${declaration};stroke-width:2;opacity:.5"/>`)
    );
    expect(body).not.toMatch(outside);
    expect(body).toContain('stroke-width:2');
    expect(body).toContain('opacity:.5');
    expect(body).toContain('d="M0 0h1"');
  });

  it.each([
    ['fill', String.raw`u\72l(https://outside.example/probe.svg#paint)`],
    ['stroke', String.raw`\55 RL(https://outside.example/probe.svg#paint)`],
    ['filter', String.raw`u\72l( 'https://outside.example/f.svg#f' )`],
    ['mask', String.raw`u\72l(https://outside.example/m.svg#m)`],
    ['clip-path', String.raw`u\72l(https://outside.example/c.svg#c)`],
    ['marker-start', String.raw`u\72l(https://outside.example/k.svg#k)`]
  ])('drops a %s attribute that is an escaped external url()', (attribute, value) => {
    const { body } = svgToIcon(svg(`<path d="M0 0h1" ${attribute}="${value}" stroke-width="2"/>`));
    expect(body).not.toMatch(outside);
    expect(body).toContain('stroke-width="2"');
  });

  it('keeps local references, colours and transforms', () => {
    const { body } = svgToIcon(
      svg(
        `<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>` +
          `<clipPath id="c"><rect width="4" height="4"/></clipPath><mask id="m"/><filter id="f"/>` +
          `<marker id="k"/></defs>` +
          `<rect width="4" height="4" fill="url(#g)" clip-path="url('#c')" transform="matrix(1 0 0 1 2 3) rotate(45)"/>` +
          `<path d="M0 0h4" style="fill:URL( #g );stroke:rgb(10 20 30 / 50%);mask:u\\72l(#m);filter:url(&quot;#f&quot;) drop-shadow(1px 1px 2px #000);marker-end:url(#k);transform:translate(1px,2px) scale(1.5)"/>` +
          `<circle r="2" fill="hsl(120deg 50% 50%)" stroke="currentColor" style="fill-opacity:calc(1 - .5);stroke:var(--accent, #123)"/>`
      )
    );
    expect(body).toContain('fill="url(#g)"');
    expect(body).toContain(`clip-path="url('#c')"`);
    expect(body).toContain('transform="matrix(1 0 0 1 2 3) rotate(45)"');
    expect(body).toContain('fill:URL( #g )');
    expect(body).toContain('stroke:rgb(10 20 30 / 50%)');
    expect(body).toContain(String.raw`mask:u\72l(#m)`);
    expect(body).toContain('drop-shadow(1px 1px 2px #000)');
    expect(body).toContain('marker-end:url(#k)');
    expect(body).toContain('transform:translate(1px,2px) scale(1.5)');
    expect(body).toContain('fill="hsl(120deg 50% 50%)"');
    expect(body).toContain('stroke="currentColor"');
    expect(body).toContain('fill-opacity:calc(1 - .5)');
    expect(body).toContain('stroke:var(--accent, #123)');
  });

  it('applies to stored packs as well as SVG files', () => {
    const pack = sanitizeIconSet({
      icons: {
        probe: {
          body: String.raw`<path d="M0 0h1" style="fill:u\72l(https://outside.example/probe.svg#paint)" fill="u\72l(https://outside.example/p.svg#p)"/>`
        }
      },
      prefix: 'corp'
    });
    expect(pack.icons.probe.body).not.toMatch(outside);
    expect(pack.icons.probe.body).toContain('d="M0 0h1"');
  });
});
