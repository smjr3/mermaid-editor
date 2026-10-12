import { describe, expect, it, vi } from 'vitest';
import {
  anchorDownload,
  defaultFileBase,
  fileNameFromInput,
  safeFileBase,
  withExtension
} from './saveFile';

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

  it('reads what was typed as the file name', () => {
    expect(fileNameFromInput(' 報告書 ', 'png')).toBe('報告書.png');
    expect(fileNameFromInput('報告書.png', 'png')).toBe('報告書.png');
    expect(fileNameFromInput('a/b', 'svg')).toBe('a b.svg');
    expect(fileNameFromInput('  ', 'png')).toBeUndefined();
    expect(fileNameFromInput('.png', 'png')).toBeUndefined();
  });
});

describe('anchorDownload', () => {
  it('downloads the blob under the name through a temporary link', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      // jsdom does not navigate.
    });
    vi.useFakeTimers();
    try {
      anchorDownload(blob, '報告書.png');
      expect(create).toHaveBeenCalledWith(blob);
      const link = click.mock.contexts[0] as HTMLAnchorElement;
      expect(link.download).toBe('報告書.png');
      expect(link.href).toBe('blob:x');
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(revoke).toHaveBeenCalledWith('blob:x');
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
