/**
 * Local: how the cards name an object in titles and lists. The internal id
 * (`n2`, `s3`) means nothing to someone who never sees the code, so it is shown
 * only to tell apart two objects that show the same text (「承認 (n2)」 and
 * 「承認 (n5)」), or when the object shows no text of its own.
 */
export interface Named {
  id: string;
  label: string;
}

export const displayName = (label: string, id: string, all: readonly Named[] = []): string => {
  const text = label.trim();
  if (!text || text === id) return id;
  const twin = all.some((other) => other.id !== id && other.label.trim() === text);
  return twin ? `${text} (${id})` : text;
};
