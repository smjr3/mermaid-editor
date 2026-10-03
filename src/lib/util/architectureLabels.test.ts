import { describe, expect, it } from 'vitest';
import { addLabelHalo } from './architectureLabels';

const svg = (body: string, type = 'architecture') =>
  `<svg id="d1" xmlns="http://www.w3.org/2000/svg" aria-roledescription="${type}"><style>#d1{}</style>${body}</svg>`;

describe('addLabelHalo', () => {
  it('outlines architecture labels in the background colour, so edges under them do not show through', () => {
    const out = addLabelHalo(
      svg('<g class="architecture-service"><g><text>Web</text></g></g>'),
      'd1',
      '#ffffff'
    );
    expect(out).toContain(
      '<style>#d1 .architecture-service text,#d1 .architecture-edges text{paint-order:stroke;stroke:var(--background,#ffffff);stroke-width:6px;stroke-linejoin:round;}</style>'
    );
    expect(out.indexOf('paint-order')).toBeLessThan(out.indexOf('<g class'));
  });

  it('leaves other diagrams untouched', () => {
    const flowchart = svg('<g class="node"><text>A</text></g>', 'flowchart-v2');
    expect(addLabelHalo(flowchart, 'd1', '#fff')).toBe(flowchart);
  });

  it('refuses a colour that could break out of the style element', () => {
    const input = svg('<g class="architecture-service"><text>x</text></g>');
    expect(addLabelHalo(input, 'd1', 'red;}</style><script>')).toContain(
      'stroke:var(--background,#ffffff);'
    );
  });
});
