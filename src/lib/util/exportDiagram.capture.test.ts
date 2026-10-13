// The exports that capture the diagram on screen (exportDiagram.ts), with the view, the
// state and the file download replaced by stand-ins:
// - N01 (review 2026-10-13): a .drawio or .vsdx is made from one state — the picture and the
//   Mermaid source in the same file never disagree, even when the code or the config changes
//   while the export waits for the view; a cancelled export saves nothing.
// - N02: the SVG file is the whole diagram, without svg-pan-zoom's viewport transform.
import { strFromU8, unzipSync } from 'fflate';
import { fromBase64 } from 'js-base64';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '$/constants';
import type { State } from '$/types';

const NS = 'http://www.w3.org/2000/svg';

const live = vi.hoisted(() => ({
  gate: undefined as Promise<void> | undefined,
  input: {} as Record<string, unknown>,
  saved: [] as { blob: Blob; name: string }[]
}));

vi.mock('./state.svelte', () => ({
  inputState: live.input,
  updateCodeStore: (patch: Record<string, unknown>) => Object.assign(live.input, patch),
  validatedState: {
    get current() {
      return live.input;
    }
  }
}));
vi.mock('./autoSync', () => ({ waitForRender: () => live.gate ?? Promise.resolve() }));
vi.mock('./saveFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./saveFile')>()),
  anchorDownload: (blob: Blob, name: string) => live.saved.push({ blob, name })
}));
// draw.io cells need a laid-out SVG (getBBox, getScreenCTM), which jsdom has not: one cell
// per text of the diagram stands in for them.
vi.mock('./svgToDrawio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./svgToDrawio')>()),
  svgToDrawio: (svg: SVGSVGElement) => ({
    cells: [...svg.querySelectorAll('text')].map((text, index) => ({
      height: 10,
      id: `t${index}`,
      kind: 'vertex' as const,
      parent: '1',
      style: { text: 1 },
      value: text.textContent ?? '',
      width: 10,
      x: 0,
      y: 0
    })),
    height: 50,
    width: 100
  })
}));
// The canvas: the "PNG" is the SVG text that was drawn on it, so the test can read it back.
vi.mock('./imageExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageExport')>()),
  canvasToBlob: (canvas: HTMLCanvasElement & { drawn?: string }) =>
    Promise.resolve(new Blob([canvas.drawn ?? ''], { type: 'image/png' })),
  loadImage: (src: string) => Promise.resolve({ src } as HTMLImageElement)
}));

const { saveDrawio, saveSvg, saveVsdx, ExportStaleError } = await import('./exportDiagram');
const renderView = await import('./renderView');

const stateA: State = {
  ...defaultState,
  code: 'flowchart LR\n  Alpha --> Beta',
  mermaid: '{\n  "theme": "forest"\n}',
  panZoom: true,
  rough: false
};
const stateB: State = {
  ...stateA,
  code: 'flowchart LR\n  Gamma --> Delta',
  mermaid: '{\n  "theme": "neutral"\n}'
};

/** What View.svelte does when it places a picture: the SVG, recorded with its state. */
const place = (state: State, label: string) => {
  document.body.innerHTML = `<div id="container"><svg xmlns="${NS}" id="graph-div" viewBox="0 0 100 50" width="100%"><g><text>${label}</text></g></svg></div>`;
  const svg = document.querySelector('#container svg');
  if (svg) {
    renderView.markDrawn(svg, { code: state.code, mermaid: state.mermaid, rough: state.rough });
  }
};

const setInput = (state: State) => {
  Object.assign(live.input, structuredClone(state));
};

/** Holds the export at "wait for the view" until `release` is called. */
const hold = () => {
  let release: () => void = () => undefined;
  live.gate = new Promise((resolve) => {
    release = () => resolve();
  });
  return () => {
    live.gate = undefined;
    release();
  };
};

/** The user edits (code and config) while the export waits; the view draws the edit. */
const editDuringWait = async (release: () => void) => {
  await vi.advanceTimersByTimeAsync(1000);
  setInput(stateB);
  place(stateB, 'Gamma-state');
  release();
};

const readDrawio = async (blob: Blob) => {
  const xml = new DOMParser().parseFromString(await blob.text(), 'application/xml');
  const data = JSON.parse(
    xml.querySelector('[mermaidData]')?.getAttribute('mermaidData') ?? '{}'
  ) as { config?: unknown; data?: string };
  const values = [...xml.querySelectorAll('mxCell[vertex="1"]')].map(
    (cell) => cell.getAttribute('value') ?? ''
  );
  return { code: data.data, config: data.config, values };
};

const readVsdx = async (blob: Blob) => {
  const parts = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const picture = strFromU8(parts['visio/media/image1.png']);
  const svg = fromBase64(picture.replace(/^data:image\/svg\+xml;base64,/, ''));
  const page = strFromU8(parts['visio/pages/page1.xml']);
  const shapeData = new DOMParser()
    .parseFromString(page, 'application/xml')
    .querySelector('Row[N="MermaidSource"] Cell[N="Value"]')
    ?.getAttribute('V');
  return { picture: svg, shapeData };
};

beforeEach(() => {
  vi.useFakeTimers();
  live.saved.length = 0;
  live.gate = undefined;
  setInput(stateA);
  place(stateA, 'Alpha-state');
  // jsdom has no canvas: a 2D context that remembers what was drawn on it.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement & { drawn?: string }
  ) {
    return {
      drawImage: (image: HTMLImageElement) => {
        this.drawn = image.src;
      },
      fillRect: vi.fn(),
      fillStyle: ''
    } as unknown as CanvasRenderingContext2D;
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('.drawio from one state (N01)', () => {
  it('holds the code, the config and the cells of the state it started from', async () => {
    const done = saveDrawio('d.drawio', { background: 'transparent' }, structuredClone(stateA));
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    expect(live.saved).toHaveLength(1);
    const file = await readDrawio(live.saved[0].blob);
    expect(file.code).toBe(stateA.code);
    expect(file.config).toEqual({ theme: 'forest' });
    expect(file.values).toContain('Alpha-state');
    // Pan/zoom is back on afterwards.
    expect(live.input.panZoom).toBe(true);
  });

  it('never mixes the state before and after an edit made while it waits', async () => {
    const release = hold();
    const done = saveDrawio('d.drawio', { background: 'transparent' }, structuredClone(stateA));
    const settled = done.then(
      () => 'saved',
      (error: unknown) => error
    );
    await editDuringWait(release);
    const outcome = await settled;
    if (outcome === 'saved') {
      const file = await readDrawio(live.saved[0].blob);
      // Which state each part of the file shows: all three must name the same one.
      const parts = {
        cells: file.values.includes('Alpha-state') ? 'A' : 'B',
        code: file.code === stateA.code ? 'A' : 'B',
        config: JSON.stringify(file.config) === '{"theme":"forest"}' ? 'A' : 'B'
      };
      expect(parts).toEqual({ cells: parts.code, code: parts.code, config: parts.code });
    } else {
      // Stopped with a notice instead, and nothing was saved.
      expect(outcome).toBeInstanceOf(ExportStaleError);
      expect(live.saved).toHaveLength(0);
    }
    // The current input is not put back to the state the export started from.
    expect(live.input.code).toBe(stateB.code);
    expect(live.input.mermaid).toBe(stateB.mermaid);
    expect(live.input.panZoom).toBe(true);
  });

  it.each([
    ['the code', { code: stateB.code }],
    ['the config', { mermaid: stateB.mermaid }],
    ['the hand-drawn setting', { rough: true }]
  ])('stops, saving nothing, when the view shows another %s', async (_, change) => {
    place({ ...stateA, ...change }, 'Alpha-state');
    const done = saveDrawio(
      'd.drawio',
      { background: 'transparent' },
      structuredClone(stateA)
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await done).toBeInstanceOf(ExportStaleError);
    expect(live.saved).toHaveLength(0);
    expect(live.input.panZoom).toBe(true);
  });

  it('saves nothing once cancelled while it waits', async () => {
    const controller = new AbortController();
    const done = saveDrawio(
      'd.drawio',
      { background: 'transparent' },
      structuredClone(stateA),
      controller.signal
    ).catch((error: unknown) => error);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await done).toMatchObject({ name: 'AbortError' });
    expect(live.saved).toHaveLength(0);
    expect(live.input.panZoom).toBe(true);
  });
});

describe('.vsdx from one state (N01)', () => {
  it('holds the picture and the Shape Data of the state it started from', async () => {
    const done = saveVsdx('d.vsdx', { background: 'transparent' }, structuredClone(stateA));
    await vi.advanceTimersByTimeAsync(1000);
    await done;
    const file = await readVsdx(live.saved[0].blob);
    expect(file.picture).toContain('Alpha-state');
    expect(file.shapeData).toBe(stateA.code);
  });

  it('never pairs the picture of one state with the source of another', async () => {
    const release = hold();
    const settled = saveVsdx('d.vsdx', { background: 'transparent' }, structuredClone(stateA)).then(
      () => 'saved',
      (error: unknown) => error
    );
    await editDuringWait(release);
    const outcome = await settled;
    if (outcome === 'saved') {
      const file = await readVsdx(live.saved[0].blob);
      const parts = {
        picture: file.picture.includes('Alpha-state') ? 'A' : 'B',
        shapeData: file.shapeData === stateA.code ? 'A' : 'B'
      };
      expect(parts).toEqual({ picture: parts.shapeData, shapeData: parts.shapeData });
    } else {
      expect(outcome).toBeInstanceOf(ExportStaleError);
      expect(live.saved).toHaveLength(0);
    }
    expect(live.input.code).toBe(stateB.code);
  });

  it('saves nothing once cancelled while it waits', async () => {
    const controller = new AbortController();
    const release = hold();
    const done = saveVsdx(
      'd.vsdx',
      { background: 'transparent' },
      structuredClone(stateA),
      controller.signal
    ).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    release();
    expect(await done).toMatchObject({ name: 'AbortError' });
    expect(live.saved).toHaveLength(0);
  });
});

describe('the SVG file is the whole diagram (N02)', () => {
  // The view with pan/zoom on: svg-pan-zoom took the viewBox away and moves the drawing
  // with a transform on its viewport group.
  const zoomed = (transform: string, rough = false) => {
    document.body.innerHTML = `<div id="container"><svg xmlns="${NS}" id="graph-div" width="100%" height="100%" style="max-width: 100%;"><g class="svg-pan-zoom_viewport" transform="${transform}" style="transform: ${transform};">${rough ? '<g class="rough"><path d="M0 0L10 10"/></g>' : ''}<g><rect x="10" y="20" width="200" height="100"/><text>Alpha-state</text></g></g></svg></div>`;
    // jsdom does not lay out SVG: the drawing's box in its own coordinates.
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: () => ({ height: 100, width: 200, x: 10, y: 20 })
    });
  };
  const saved = async () => {
    const text = await live.saved.at(-1)?.blob.text();
    return new DOMParser().parseFromString(text ?? '', 'image/svg+xml');
  };

  afterEach(() => {
    delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
  });

  it.each([false, true])(
    'drops the viewport transform and restores the viewBox and size (rough %s)',
    async (rough) => {
      setInput({ ...stateA, rough });
      zoomed('matrix(2,0,0,2,-300,-100)', rough);
      await saveSvg('d.svg', { background: 'transparent' });
      const file = await saved();
      const svg = file.documentElement;
      const viewport = svg.querySelector('.svg-pan-zoom_viewport');
      expect(viewport?.getAttribute('transform')).toBeNull();
      expect(viewport?.getAttribute('style')).toBeNull();
      expect(svg.getAttribute('viewBox')).toBe('2 12 216 116');
      expect(svg.getAttribute('width')).toBe('216');
      expect(svg.getAttribute('height')).toBe('116');
      expect(svg.querySelector('text')?.textContent).toBe('Alpha-state');
      // The view keeps its pan/zoom.
      const view = document.querySelector('#container svg');
      expect(view?.getAttribute('viewBox')).toBeNull();
      expect(view?.querySelector('.svg-pan-zoom_viewport')?.getAttribute('transform')).toBe(
        'matrix(2,0,0,2,-300,-100)'
      );
      expect(live.input.panZoom).toBe(true);
    }
  );

  it('is the same file whatever the zoom and the pan', async () => {
    zoomed('matrix(2,0,0,2,-300,-100)');
    await saveSvg('a.svg', { background: 'white' });
    zoomed('matrix(0.5,0,0,0.5,40,7)');
    await saveSvg('b.svg', { background: 'white' });
    const [a, b] = await Promise.all(live.saved.map(({ blob }) => blob.text()));
    expect(a).toBe(b);
  });

  it('restores the viewBox the picture had when the view placed it', async () => {
    zoomed('matrix(3,0,0,3,-500,-200)');
    const svg = document.querySelector('#container svg') as SVGSVGElement;
    // As View.svelte does: recorded before svg-pan-zoom took the viewBox away.
    svg.setAttribute('viewBox', '-8 -8 300 150');
    renderView.markDrawn(svg, { code: stateA.code, mermaid: stateA.mermaid, rough: false });
    svg.removeAttribute('viewBox');
    await saveSvg('d.svg', { background: 'transparent' });
    const file = (await saved()).documentElement;
    expect(file.getAttribute('viewBox')).toBe('-8 -8 300 150');
    expect(file.getAttribute('width')).toBe('300');
    expect(file.getAttribute('height')).toBe('150');
    expect(file.querySelector('.svg-pan-zoom_viewport')?.getAttribute('transform')).toBeNull();
    expect(svg.getAttribute('viewBox')).toBeNull();
  });

  it('keeps the viewBox of a view without pan/zoom', async () => {
    await saveSvg('d.svg', { background: 'transparent' });
    const svg = (await saved()).documentElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 50');
    expect(svg.getAttribute('width')).toBe('100');
    expect(svg.getAttribute('height')).toBe('50');
  });
});
