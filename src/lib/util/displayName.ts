import { t } from '$/i18n';

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

/** Local (QA 2026-10-13): one change Mermaid's syntax forced on a typed name. */
export interface NameChange {
  from: string;
  to: string;
}

// Compared as the diagram shows them: entity codes (`#quot;`, `#35;`) decoded, the
// markdown stars and code marks the object lists drop left out, spaces collapsed.
const namedCodes: Record<string, string> = { amp: '&', gt: '>', lt: '<', nbsp: ' ', quot: '"' };
const shownText = (text: string) =>
  text
    .replaceAll(/#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll(/#([a-z]+);/gi, (match, name: string) => namedCodes[name] ?? match)
    .replaceAll(/[*`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

/**
 * What changed between the name as typed and as the diagram now shows it (`;` → `,`, a
 * tag removed, 「」 added), each change once, from a character diff of the two.
 */
export const nameChanges = (typed: string, shown: string): NameChange[] => {
  // A tag that went is one change, whatever letters of it the diff could pair up.
  const after = shownText(shown);
  const tags: NameChange[] = [];
  const rest = shownText(typed).replaceAll(/<\/?[a-z][^<>]*>/gi, (tag) => {
    if (after.includes(tag)) return tag;
    if (!tags.some(({ from }) => from === tag)) tags.push({ from: tag, to: '' });
    return '';
  });
  return [...tags, ...signChanges(shownText(rest), after)];
};

const signChanges = (typed: string, shown: string): NameChange[] => {
  const a = [...typed];
  const b = [...shown];
  if (typed === shown) return [];
  if (a.length > 400 || b.length > 400) return [{ from: a.join(''), to: b.join('') }];
  // The longest common subsequence, then the runs outside it.
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const changes: NameChange[] = [];
  let from = '';
  let to = '';
  const flush = () => {
    const seen = changes.some((change) => change.from === from && change.to === to);
    if ((from.trim() || to.trim()) && !seen) changes.push({ from, to });
    from = '';
    to = '';
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
      to += b[j++];
    } else {
      from += a[i++];
    }
  }
  flush();
  // A space is named, so that a change of one (`Order Service` → `Order_Service`) reads.
  return changes.map((change) => ({
    from: change.from.trim() || (change.from ? '␣' : ''),
    to: change.to.trim() || (change.to ? '␣' : '')
  }));
};

/**
 * The short notice for a name Mermaid's syntax changed, or '' when it is shown as typed.
 * Only the changes of signs count (`;`, `|`, `#`, a tag, a space, 「」 added): letters
 * that differ are another name (a fallback, an id), not an adjustment.
 */
export const adjustedMessage = (typed: string, shown: string): string => {
  const changes = nameChanges(typed, shown).filter(
    ({ from, to }) => /[^\p{L}\p{N}]/u.test(from) || (!from && /^[「」"'()（）]+$/.test(to))
  );
  if (changes.length === 0) return '';
  const listed = changes
    .slice(0, 3)
    .map(({ from, to }) =>
      from ? `${from} → ${to || t('edit.adjustedRemoved')}` : t('edit.adjustedAdded', { to })
    );
  if (changes.length > 3) listed.push('…');
  return t('edit.adjusted', { changes: listed.join(t('edit.adjustedJoin')) });
};
