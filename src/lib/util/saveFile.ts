/**
 * Local: the names of the files the editor saves (PNG, SVG, HTML, the Markdown SVG,
 * .drawio, .vsdx) and the download itself. The 書き出す dialog (ExportDialog.svelte) shows
 * the name, the diagram's title by default, next to the extension; what is typed there is
 * made safe here, and the file goes to the browser's download folder. There is no second
 * "名前を付けて保存" step any more (user decision, 2026-10-12).
 */
import { getTitle } from './diagramTitle';

export const DEFAULT_FILE_BASE = 'diagram';
const MAX_BASE_LENGTH = 100;

/**
 * A name every file system accepts: no `\ / : * ? " < > |` or control characters
 * (Windows), no leading or trailing dots and spaces, not a reserved Windows name.
 * Japanese and other text stays as it is.
 */
export const safeFileBase = (text: string): string => {
  let base = text
    // eslint-disable-next-line no-control-regex
    .replaceAll(/[\u0000-\u001F\u007F\\/:*?"<>|]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '');
  base = [...base].slice(0, MAX_BASE_LENGTH).join('').trim();
  if (/^(?:con|prn|aux|nul|com\d|lpt\d)$/i.test(base)) base = `${base}_`;
  return base;
};

/** The default file name, without extension: the diagram's title, else `diagram`. */
export const defaultFileBase = (code: string): string =>
  safeFileBase(getTitle(code)) || DEFAULT_FILE_BASE;

/** `name` with `.extension` at the end (added unless it is already there, any case). */
export const withExtension = (name: string, extension: string): string => {
  const suffix = `.${extension}`;
  return name.toLowerCase().endsWith(suffix.toLowerCase()) ? name : `${name}${suffix}`;
};

/**
 * What the user typed as a file name, with the extension, or undefined when nothing
 * usable is left. An extension typed with the name is kept.
 */
export const fileNameFromInput = (input: string, extension: string): string | undefined => {
  const typed = input.trim();
  const suffix = `.${extension}`;
  const stem = typed.toLowerCase().endsWith(suffix) ? typed.slice(0, -suffix.length) : typed;
  const base = safeFileBase(stem);
  return base ? withExtension(base, extension) : undefined;
};

/** Save a blob through a temporary link, the way upstream downloads its files. */
export const anchorDownload = (data: Blob, name: string): void => {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
