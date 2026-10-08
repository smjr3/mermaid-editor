/**
 * Local: "名前を付けて保存" for every file the editor saves (PNG, SVG, HTML, the
 * GitLab SVG, .drawio, .vsdx). Where the browser has the File System Access API
 * (`showSaveFilePicker`, Chromium and Edge) its own save dialog chooses the name
 * and folder; elsewhere a small dialog of ours asks for the name
 * (`askFileName`, SaveAsDialog.svelte) and the file is downloaded as before.
 *
 * The target is chosen first and written afterwards: the browser only opens its
 * picker straight after a click, and the PNG and .vsdx take a moment to draw.
 */
import { getTitle } from './diagramTitle';

/** What a file is, for the picker's type list and the fallback's extension. */
export interface SaveType {
  /** Shown in the picker's type list, e.g. 「PNG 画像」. */
  description: string;
  /** Without the dot: `png`. */
  extension: string;
  mime: string;
}

/** Where the file goes once it is made. */
export interface SaveTarget {
  /** The file name the user chose (with its extension). */
  name: string;
  write: (data: Blob) => Promise<void>;
}

/** Asks for a file name; undefined when the user cancels. */
export type AskName = (suggested: string) => Promise<string | undefined>;

interface PickerHandle {
  createWritable: () => Promise<{
    close: () => Promise<void>;
    write: (data: Blob) => Promise<void>;
  }>;
  name: string;
}
type Picker = (options: {
  suggestedName: string;
  types: { accept: Record<string, string[]>; description: string }[];
}) => Promise<PickerHandle>;

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
 * What the user typed into the fallback dialog as a file name, or undefined when
 * nothing usable is left. An extension typed with the name is kept.
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

const browserPicker = (): Picker | undefined => {
  if (typeof window === 'undefined') return undefined;
  const picker = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;
  return typeof picker === 'function' ? picker.bind(window) : undefined;
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export interface PickOptions {
  askName: AskName;
  download?: (data: Blob, name: string) => void;
  /** The File System Access picker; defaults to the browser's, if it has one. */
  picker?: Picker | null;
}

/**
 * Let the user choose where `suggested` (a name with its extension) goes.
 * Undefined when they cancel. A picker that fails for another reason (a page in
 * a cross-origin frame, no recent click) falls back to the name dialog.
 */
export const pickSaveTarget = async (
  suggested: string,
  type: SaveType,
  { askName, download = anchorDownload, picker = browserPicker() }: PickOptions
): Promise<SaveTarget | undefined> => {
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: suggested,
        types: [{ accept: { [type.mime]: [`.${type.extension}`] }, description: type.description }]
      });
      return {
        name: handle.name,
        write: async (data) => {
          const writable = await handle.createWritable();
          await writable.write(data);
          await writable.close();
        }
      };
    } catch (error) {
      if (isAbort(error)) return undefined;
      console.warn('The save dialog is not available; asking for a name instead', error);
    }
  }
  const typed = await askName(suggested);
  if (typed === undefined) return undefined;
  const name = fileNameFromInput(typed, type.extension) ?? suggested;
  return {
    name,
    write: (data) => {
      download(data, name);
      return Promise.resolve();
    }
  };
};
