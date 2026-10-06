/**
 * Local: when the view renders. Every edit used to queue a render of its own, one
 * after another, so a burst of typing on a diagram that takes a few hundred
 * milliseconds to draw kept the view busy for seconds after the typing stopped
 * (and a render that counted as slow deferred the next one by a further second).
 *
 * Here a request replaces whatever is still waiting: renders never overlap, one
 * waits for a short pause in typing (longer after a slow render, never more than
 * `maxDelay`), and only the newest request is drawn. The view asks `isLatest` and
 * `isNewer` before placing a finished render, so a render that a newer request
 * superseded while it ran is dropped, and an older picture can never overwrite a
 * newer one.
 */
export interface RenderSchedulerOptions<T> {
  /** Draws `value`; `token` identifies the request (see `isNewer`). */
  render: (value: T, token: number) => Promise<void>;
  /** Pause after the last typed change before rendering (ms); default 100. */
  minDelay?: number;
  /** Upper bound of the pause, however slow the last render was (ms); default 300. */
  maxDelay?: number;
  now?: () => number;
}

export interface RenderScheduler<T> {
  /** Asks for `value` to be drawn; `immediate` skips the typing pause. */
  schedule: (value: T, options?: { immediate?: boolean }) => void;
  /** Whether a finished render may be placed: no newer one is on screen. Marks it shown. */
  isNewer: (token: number) => boolean;
  /** Whether `token` is still the latest request. */
  isLatest: (token: number) => boolean;
  /** Resolves once nothing is waiting or rendering. */
  idle: () => Promise<void>;
  /** The pause the next typed change waits (ms). */
  readonly delay: number;
  dispose: () => void;
}

export const createRenderScheduler = <T>({
  render,
  minDelay = 100,
  maxDelay = 300,
  now = () => performance.now()
}: RenderSchedulerOptions<T>): RenderScheduler<T> => {
  let latestToken = 0;
  let shownToken = 0;
  let waiting: { value: T; token: number } | undefined;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastDuration = 0;
  let idleWaiters: (() => void)[] = [];

  const delay = () => Math.min(maxDelay, Math.max(minDelay, minDelay + lastDuration / 2));
  const busy = () => running || waiting !== undefined || timer !== undefined;
  const settleIdle = () => {
    if (busy()) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const resolve of waiters) resolve();
  };

  const kick = () => {
    if (running || timer !== undefined || !waiting) {
      settleIdle();
      return;
    }
    const job = waiting;
    waiting = undefined;
    running = true;
    const start = now();
    void render(job.value, job.token)
      .catch(() => undefined)
      .finally(() => {
        lastDuration = now() - start;
        running = false;
        kick();
      });
  };

  const schedule = (value: T, { immediate = false } = {}) => {
    latestToken += 1;
    waiting = { token: latestToken, value };
    clearTimeout(timer);
    timer = undefined;
    const wait = immediate ? 0 : delay();
    if (wait <= 0) {
      kick();
    } else {
      timer = setTimeout(() => {
        timer = undefined;
        kick();
      }, wait);
    }
  };

  return {
    get delay() {
      return delay();
    },
    dispose: () => {
      clearTimeout(timer);
      timer = undefined;
      waiting = undefined;
      settleIdle();
    },
    idle: () =>
      busy() ? new Promise<void>((resolve) => idleWaiters.push(resolve)) : Promise.resolve(),
    isLatest: (token) => token === latestToken,
    isNewer: (token) => {
      if (token < shownToken) return false;
      shownToken = token;
      return true;
    },
    schedule
  };
};

/**
 * Local: numbers asynchronous jobs so only the newest one's result is used
 * (state.svelte.ts publishes a validation only if no edit came after it).
 */
export const createLatestGuard = () => {
  let latest = 0;
  return {
    next: (): number => (latest += 1),
    isLatest: (ticket: number): boolean => ticket === latest
  };
};

export const settleDelay = 250;

export interface Settled {
  code: string;
  error: unknown;
}

// Every validation makes a new Error, so errors compare by their message.
const same = (a: unknown, b: unknown) => (a ? String(a) : '') === (b ? String(b) : '');

/**
 * Local: decides when a validated state reaches the tool cards (settledState.svelte.ts):
 * a typed change after `delay` without a newer one; a button's edit, the first state and
 * a change of the error alone at once; the same code and error not at all.
 */
export const createSettler = (publish: (next: Settled) => void, delay = settleDelay) => {
  let last: Settled | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (next: Settled & { updateDiagram?: boolean }): void => {
    const value = { code: next.code, error: next.error };
    if (last && last.code === value.code && same(last.error, value.error)) return;
    const immediate = !last || next.updateDiagram === true || last.code === value.code;
    last = value;
    clearTimeout(timer);
    timer = undefined;
    if (immediate) {
      publish(value);
    } else {
      timer = setTimeout(() => {
        timer = undefined;
        publish(value);
      }, delay);
    }
  };
};
