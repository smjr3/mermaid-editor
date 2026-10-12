import { describe, expect, it } from 'vitest';
import { businessTemplatesName } from './localSamples';
import { findSample, sampleCatalog } from './sampleCatalog';

describe('sampleCatalog', () => {
  it('lists upstream, ZenUML and local groups', () => {
    const catalog = sampleCatalog();
    expect(catalog.Flowchart?.length).toBeGreaterThan(0);
    expect(catalog.ZenUML?.[0]?.code).toMatch(/^zenuml/);
    expect(catalog[businessTemplatesName]?.length).toBeGreaterThan(0);
    expect(catalog.Swimlane?.length).toBeGreaterThan(0);
  });

  it('finds a group default or a sample by title', () => {
    expect(findSample('ZenUML')?.title).toBe('Order Service');
    expect(findSample('ZenUML', 'Order Service')?.isDefault).toBe(true);
    expect(findSample('ZenUML', 'missing')).toBeUndefined();
    expect(findSample('missing')).toBeUndefined();
  });
});
