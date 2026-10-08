import { describe, expect, it } from 'vitest';
import { answerFileName, askFileName, saveAsPrompt } from './saveAsPrompt.svelte';

describe('saveAsPrompt', () => {
  it('opens a request with the suggested name and resolves with the answer', async () => {
    const answer = askFileName('diagram.png');
    expect(saveAsPrompt.request?.suggested).toBe('diagram.png');
    answerFileName('報告書.png');
    expect(await answer).toBe('報告書.png');
    expect(saveAsPrompt.request).toBeUndefined();
  });

  it('cancels an open request when another one starts', async () => {
    const first = askFileName('a.svg');
    const second = askFileName('b.svg');
    expect(await first).toBeUndefined();
    answerFileName(undefined);
    expect(await second).toBeUndefined();
  });
});
