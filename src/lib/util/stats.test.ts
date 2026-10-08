import { beforeEach, describe, expect, it, vi } from 'vitest';

// Local (R04): analytics configured on an offline build.
vi.mock('./env', () => ({
  env: { analyticsUrl: 'https://analytics.example.com', domain: 'example.org', isOffline: true }
}));
const plausibleLoaded = vi.hoisted(() => ({ count: 0 }));
vi.mock('plausible-tracker', () => ({
  default: () => {
    plausibleLoaded.count++;
    return { trackEvent: () => undefined };
  }
}));

const stats = await import('./stats');
const { getAnalyticsSafeUrl, initAnalytics } = stats;

describe('analytics on an offline build (R04)', () => {
  it('is not started, even with an analytics URL', async () => {
    await initAnalytics();
    expect(plausibleLoaded.count).toBe(0);
    expect(stats.plausible).toBeUndefined();
  });
});

describe('getAnalyticsUrl', () => {
  beforeEach(() => {
    // Reset location to a clean state before each test
    window.history.replaceState(null, '', '/');
  });

  it('should return origin and pathname for a simple URL', () => {
    window.history.replaceState(null, '', '/edit');
    const url = getAnalyticsSafeUrl();
    expect(url).toBe(`${window.location.origin}/edit`);
  });

  it('should include search/query params (UTM parameters)', () => {
    window.history.replaceState(null, '', '/edit?utm_source=github&utm_medium=docs');
    const url = getAnalyticsSafeUrl();
    expect(url).toBe(`${window.location.origin}/edit?utm_source=github&utm_medium=docs`);
  });

  it('should never include the hash', () => {
    window.history.replaceState(null, '', '/edit#pako:someDiagramData');
    // replaceState doesn't set hash, so set it via location
    window.location.hash = '#pako:someDiagramData';
    const url = getAnalyticsSafeUrl();
    expect(url).not.toContain('#');
    expect(url).not.toContain('pako:');
    expect(url).toBe(`${window.location.origin}/edit`);
  });

  it('should include search params but exclude hash when both are present', () => {
    window.history.replaceState(null, '', '/edit?utm_campaign=launch');
    window.location.hash = '#pako:diagramDataHere';
    const url = getAnalyticsSafeUrl();
    expect(url).not.toContain('#');
    expect(url).not.toContain('pako:');
    expect(url).toContain('utm_campaign=launch');
    expect(url).toBe(`${window.location.origin}/edit?utm_campaign=launch`);
  });

  it('should return just origin for root path with no params', () => {
    window.history.replaceState(null, '', '/');
    const url = getAnalyticsSafeUrl();
    expect(url).toBe(`${window.location.origin}/`);
  });
});
