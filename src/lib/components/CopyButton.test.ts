// Local (R10): the copy button shows the tick only once the copy has succeeded.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyButton from './CopyButton.svelte';

const notify = vi.hoisted(() => vi.fn());
vi.mock('$/util/notify', () => ({ notify }));

let target: HTMLElement;
let component: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  // jsdom has no Web Animations; the icon's transition only needs it to finish.
  Element.prototype.animate ??= function () {
    const animation = {
      cancel: () => undefined,
      currentTime: 0,
      onfinish: null as (() => void) | null
    };
    setTimeout(() => animation.onfinish?.(), 0);
    return animation as unknown as Animation;
  };
  target = document.createElement('div');
  document.body.append(target);
  notify.mockClear();
});

afterEach(() => {
  if (component) unmount(component);
  component = undefined;
  target.remove();
});

const deferred = () => {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};

const state = () => target.querySelector('button')?.dataset.copyState;

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

describe('CopyButton', () => {
  it('shows the tick only after the copy has finished', async () => {
    const copy = deferred();
    component = mount(CopyButton, { props: { onclick: () => copy.promise }, target });
    target.querySelector('button')?.click();
    await settle();
    expect(state()).toBe('busy');
    copy.resolve();
    await settle();
    expect(state()).toBe('done');
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows an error state and a notice when the copy fails', async () => {
    const copy = deferred();
    component = mount(CopyButton, { props: { onclick: () => copy.promise }, target });
    target.querySelector('button')?.click();
    await settle();
    copy.reject(new Error('Denied'));
    await settle();
    expect(state()).toBe('failed');
    expect(notify).toHaveBeenCalledOnce();
  });
});
