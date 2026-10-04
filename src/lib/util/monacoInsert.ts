import type * as monaco from 'monaco-editor';

/**
 * Local: inserts text at the Monaco cursor, replacing any selection — but only
 * while the editor shows the diagram code, not the config (iconSearch.ts).
 */
export const insertAtCursor = (
  editor: monaco.editor.IStandaloneCodeEditor,
  codeModel: monaco.editor.ITextModel,
  text: string
): boolean => {
  const selection = editor.getSelection();
  if (editor.getModel() !== codeModel || !selection) return false;
  editor.executeEdits('icon-picker', [{ forceMoveMarkers: true, range: selection, text }]);
  editor.focus();
  return true;
};
