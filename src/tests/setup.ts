import { vi } from 'vitest';

// TODO: Remove once https://github.com/sveltejs/kit/issues/6259 is closed.
//
// At module scope, not inside beforeAll: Vitest hoists vi.mock above every
// import either way, so the nested form only hid the real execution order from
// the reader — and Vitest warns it will become an error. The factory still runs
// lazily on first import, so `browser` is resolved at the same moment as before.
vi.mock('$app/environment', () => ({
  browser: 'window' in globalThis,
  dev: true
}));
