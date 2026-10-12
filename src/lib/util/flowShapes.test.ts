import mermaid from 'mermaid';
import { describe, expect, it } from 'vitest';
import { canonicalShape, flowShapeNames } from './flowShapes';

describe('flowShapes', () => {
  it('lists every shape once, and each one parses in a flowchart', async () => {
    expect(new Set(flowShapeNames).size).toBe(flowShapeNames.length);
    expect(flowShapeNames.length).toBeGreaterThanOrEqual(53);
    for (const name of flowShapeNames) {
      await expect(
        mermaid.parse(`flowchart TD\n  A@{ shape: ${name}, label: "x" }`)
      ).resolves.toBeTruthy();
    }
  });

  it('turns mermaid’s other names into the short one', () => {
    expect(canonicalShape('decision')).toBe('diam');
    expect(canonicalShape('Database')).toBe('cyl');
    expect(canonicalShape('cyl')).toBe('cyl');
    expect(canonicalShape('nonsense')).toBeUndefined();
  });
});
