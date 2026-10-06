import { describe, expect, it, vi } from 'vitest';

// mermaid draws into a scratch element (`#d<id>`) and, when the layout throws
// part-way (an invalid gantt date, a circular sankey link), leaves it behind.
vi.mock('./mermaid', () => ({
  render: (_config: unknown, _code: string, id: string) => {
    const scratch = document.createElement('div');
    scratch.id = `d${id}`;
    scratch.innerHTML = '<svg></svg>';
    document.body.append(scratch);
    return Promise.reject(new Error('Invalid date:2026-99-99'));
  }
}));

const { renderAndPlaceDiagram } = await import('./renderView');

describe('renderAndPlaceDiagram', () => {
  it('removes mermaid’s scratch element and keeps the last picture when drawing fails', async () => {
    const container = document.createElement('div');
    container.id = 'container';
    container.innerHTML = '<svg id="graph-1"><text>last picture</text></svg>';
    document.body.append(container);
    await expect(
      renderAndPlaceDiagram({
        code: 'gantt\n  T :a1, 2026-99-99, 3d',
        config: {},
        container,
        rough: false,
        viewId: 'graph-2'
      })
    ).rejects.toThrow('Invalid date');
    expect(document.querySelector('#dgraph-2')).toBeNull();
    expect(container.textContent).toBe('last picture');
  });

  it('refuses a state inside itself, which would hang the page', async () => {
    const container = document.createElement('div');
    container.id = 'container2';
    document.body.append(container);
    await expect(
      renderAndPlaceDiagram({
        code: 'stateDiagram-v2\n  state A {\n    A --> B\n  }',
        config: {},
        container,
        rough: false,
        viewId: 'graph-3'
      })
    ).rejects.toThrow('inside itself');
    expect(document.querySelector('#dgraph-3')).toBeNull();
  });
});
