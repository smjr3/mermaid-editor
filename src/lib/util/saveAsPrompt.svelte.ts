/**
 * Local: the request behind the fallback "名前を付けて保存" dialog
 * (SaveAsDialog.svelte), for browsers without `showSaveFilePicker` (saveFile.ts).
 * One request at a time; a second one cancels the first.
 */
import type { AskName } from './saveFile';

interface Request {
  resolve: (name: string | undefined) => void;
  suggested: string;
}

export const saveAsPrompt = $state<{ request: Request | undefined }>({ request: undefined });

/** Open the dialog with `suggested` filled in; resolves to what was typed, or undefined. */
export const askFileName: AskName = (suggested) =>
  new Promise((resolve) => {
    saveAsPrompt.request?.resolve(undefined);
    saveAsPrompt.request = { resolve, suggested };
  });

/** Close the dialog with a name (the Save button) or without one (cancel, Escape). */
export const answerFileName = (name: string | undefined): void => {
  const { request } = saveAsPrompt;
  saveAsPrompt.request = undefined;
  request?.resolve(name);
};
