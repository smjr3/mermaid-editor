import { describe, expect, it, vi } from 'vitest';
import {
  defaultFileBase,
  fileNameFromInput,
  pickSaveTarget,
  safeFileBase,
  withExtension,
  type SaveType
} from './saveFile';

const png: SaveType = { description: 'PNG 画像', extension: 'png', mime: 'image/png' };

describe('file names', () => {
  it('names the file after the front-matter title', () => {
    expect(defaultFileBase('---\ntitle: "経費精算フロー"\n---\nflowchart LR\n  A --> B')).toBe(
      '経費精算フロー'
    );
  });

  it('names timeline and C4 diagrams after their title statement', () => {
    expect(defaultFileBase('timeline\n  title 採用の流れ\n  2024 : 応募')).toBe('採用の流れ');
    expect(defaultFileBase('C4Context\n  title System context\n')).toBe('System context');
  });

  it('falls back to "diagram" without a title, or with one that leaves nothing', () => {
    expect(defaultFileBase('flowchart LR\n  A --> B')).toBe('diagram');
    expect(defaultFileBase('---\ntitle: "  ...  "\n---\nflowchart LR\n  A')).toBe('diagram');
    expect(defaultFileBase('')).toBe('diagram');
  });

  it('removes characters a file system rejects and keeps Japanese text', () => {
    expect(safeFileBase('売上: 2024/Q1 <速報> "案"?')).toBe('売上 2024 Q1 速報 案');
    expect(safeFileBase('a\tb\nc')).toBe('a b c');
    expect(safeFileBase('..hidden.')).toBe('hidden');
    expect(safeFileBase('CON')).toBe('CON_');
    expect([...safeFileBase('図'.repeat(300))]).toHaveLength(100);
  });

  it('adds the extension unless it is there', () => {
    expect(withExtension('diagram', 'png')).toBe('diagram.png');
    expect(withExtension('diagram.PNG', 'png')).toBe('diagram.PNG');
    expect(withExtension('report.v2', 'svg')).toBe('report.v2.svg');
  });

  it('reads what was typed into the dialog', () => {
    expect(fileNameFromInput(' 報告書 ', 'png')).toBe('報告書.png');
    expect(fileNameFromInput('報告書.png', 'png')).toBe('報告書.png');
    expect(fileNameFromInput('a/b', 'svg')).toBe('a b.svg');
    expect(fileNameFromInput('  ', 'png')).toBeUndefined();
    expect(fileNameFromInput('.png', 'png')).toBeUndefined();
  });
});

describe('pickSaveTarget', () => {
  const blob = new Blob(['x'], { type: 'image/png' });

  it('uses the browser save dialog when there is one', async () => {
    const written: Blob[] = [];
    const close = vi.fn(() => Promise.resolve());
    const picker = vi.fn(() =>
      Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            close,
            write: (data: Blob) => {
              written.push(data);
              return Promise.resolve();
            }
          }),
        name: 'chosen.png'
      })
    );
    const askName = vi.fn();
    const target = await pickSaveTarget('diagram.png', png, { askName, picker });
    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'diagram.png',
      types: [{ accept: { 'image/png': ['.png'] }, description: 'PNG 画像' }]
    });
    expect(target?.name).toBe('chosen.png');
    await target?.write(blob);
    expect(written).toEqual([blob]);
    expect(close).toHaveBeenCalled();
    expect(askName).not.toHaveBeenCalled();
  });

  it('gives no target when the save dialog is cancelled', async () => {
    const picker = () => Promise.reject(new DOMException('The user aborted', 'AbortError'));
    const askName = vi.fn();
    expect(await pickSaveTarget('diagram.png', png, { askName, picker })).toBeUndefined();
    expect(askName).not.toHaveBeenCalled();
  });

  it('asks for the name and downloads when the browser has no save dialog', async () => {
    const download = vi.fn();
    const askName = vi.fn(() => Promise.resolve('売上'));
    const target = await pickSaveTarget('diagram.png', png, { askName, download, picker: null });
    expect(askName).toHaveBeenCalledWith('diagram.png');
    expect(target?.name).toBe('売上.png');
    await target?.write(blob);
    expect(download).toHaveBeenCalledWith(blob, '売上.png');
  });

  it('falls back to the name dialog when the save dialog fails for another reason', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const picker = () => Promise.reject(new DOMException('Cross origin', 'SecurityError'));
    const download = vi.fn();
    const target = await pickSaveTarget('diagram.png', png, {
      askName: (suggested) => Promise.resolve(suggested),
      download,
      picker
    });
    await target?.write(blob);
    expect(download).toHaveBeenCalledWith(blob, 'diagram.png');
  });

  it('gives no target when the name dialog is cancelled, and keeps the default for an empty name', async () => {
    const download = vi.fn();
    expect(
      await pickSaveTarget('diagram.png', png, {
        askName: () => Promise.resolve(undefined),
        download,
        picker: null
      })
    ).toBeUndefined();
    const target = await pickSaveTarget('diagram.png', png, {
      askName: () => Promise.resolve('///'),
      download,
      picker: null
    });
    expect(target?.name).toBe('diagram.png');
  });

  it('uses window.showSaveFilePicker by default, and the dialog when it is missing', async () => {
    const askName = vi.fn(() => Promise.resolve('x'));
    const download = vi.fn();
    expect('showSaveFilePicker' in window).toBe(false);
    expect((await pickSaveTarget('a.png', png, { askName, download }))?.name).toBe('x.png');
    const picker = vi.fn(() =>
      Promise.resolve({ createWritable: vi.fn(), name: 'from-picker.png' })
    );
    Object.assign(window, { showSaveFilePicker: picker });
    try {
      expect((await pickSaveTarget('a.png', png, { askName, download }))?.name).toBe(
        'from-picker.png'
      );
    } finally {
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  });
});
