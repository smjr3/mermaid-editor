import { describe, expect, it, vi } from 'vitest';

// R05: mermaid's configuration is global. A render must draw, and read back, the
// configuration it was given even while another render with another one waits.
// The fake keeps mermaid's shape: initialize() sets the global config, render()
// takes a while and draws with whatever is set, getConfig() reads it back.
const fake = vi.hoisted(() => {
  let current: { theme?: string } = {};
  const backgrounds: Record<string, string> = { dark: '#333333', forest: '#ffffff' };
  return {
    getConfig: () => ({
      ...current,
      themeVariables: { background: backgrounds[current.theme ?? ''] ?? '' }
    }),
    initialize: (config: { theme?: string }) => {
      current = config;
    },
    render: async (id: string) => {
      const before = current.theme;
      await new Promise((resolve) => setTimeout(resolve, 20));
      // A config changed mid-render would mix two themes in one picture.
      const theme = before === current.theme ? before : `${before}+${current.theme}`;
      return { diagramType: 'flowchart', svg: `<svg id="${id}" data-theme="${theme}"><g/></svg>` };
    }
  };
});

vi.mock('mermaid', () => ({
  default: {
    initialize: fake.initialize,
    mermaidAPI: { defaultConfig: {}, getConfig: fake.getConfig },
    parse: async () => ({ diagramType: 'flowchart' }),
    registerExternalDiagrams: async () => undefined,
    registerIconPacks: () => undefined,
    registerLayoutLoaders: () => undefined,
    render: fake.render
  }
}));
vi.mock('./customIconStore', () => ({ registerStoredIconPacks: async () => undefined }));

const { render } = await import('./mermaid');

describe('render (R05)', () => {
  it('keeps each concurrent render to its own theme and background', async () => {
    const [dark, forest] = await Promise.all([
      render({ theme: 'dark' }, 'flowchart TD\n  A', 'one'),
      render({ theme: 'forest' }, 'flowchart TD\n  A', 'two')
    ]);
    expect(dark.svg).toContain('data-theme="dark"');
    expect(forest.svg).toContain('data-theme="forest"');
    // The dark site's backdrop goes behind a light background only, read from the
    // config the render used (darkLines.ts).
    expect(dark.svg).not.toContain('background-color');
    expect(forest.svg).toContain('background-color');
  });

  it('runs one render after another, in the order they were asked for', async () => {
    const results = await Promise.all(
      (['dark', 'forest', 'dark'] as const).map((theme, index) =>
        render({ theme }, 'flowchart TD\n  A', `r${index}`)
      )
    );
    expect(results.map(({ svg }) => /data-theme="([^"]+)"/.exec(svg)?.[1])).toEqual([
      'dark',
      'forest',
      'dark'
    ]);
  });
});
