import type { MessageKey } from '$/i18n/messages';
import { headerLine } from './diagramEdit';
import { editKind, type EditKind, type EditObject } from './diagramModify';
import type { Selected } from './selection.svelte';

/**
 * Local: the inspector's first row, the target switcher — 「図全体 │ 図形 │ 矢印 │ グループ」
 * for a flowchart, 「図全体 │ 参加者 │ メッセージ」 for a sequence diagram, and so on. The
 * tabs come from the kinds `diagramModify.ts` edits: a type gets an object tab for what
 * `editableObjects` lists, a group tab where some of those objects hold others (lanes,
 * subgraphs, sections, boundaries, architecture groups) and an arrow tab where
 * `editableEdges` knows the type's arrow syntax. A tab is there whenever the type has
 * that kind, not only when the diagram has such items (so an empty flowchart still shows
 * 矢印); the one exception is a gantt's 区分, which is only there with a section. The
 * words are the add bar's (InsertBar.svelte): 図形・矢印・レーン, 参加者・メッセージ, ….
 */
export type InspectorTabId = 'all' | 'object' | 'element' | 'group' | 'edge';

export interface InspectorTab {
  id: InspectorTabId;
  label: MessageKey;
}

interface KindTabs {
  object: MessageKey;
  /** A second kind of object with its own tab (a requirement diagram's 要素). */
  element?: MessageKey;
  group?: MessageKey;
  /** The group tab only with a group in the diagram (a gantt without sections). */
  groupWhenPresent?: boolean;
  edge?: MessageKey;
}

const swimlane = /^\s*swimlane-beta\b/;

const byKind: Record<EditKind, KindTabs> = {
  architecture: {
    edge: 'insp.tab.connection',
    group: 'insp.tab.group',
    object: 'insp.tab.service'
  },
  block: { edge: 'insp.tab.edge', object: 'insp.tab.block' },
  c4: { edge: 'insp.tab.relation', group: 'insp.tab.boundary', object: 'insp.tab.element' },
  class: { edge: 'insp.tab.relation', object: 'insp.tab.class' },
  er: { edge: 'insp.tab.relation', object: 'insp.tab.entity' },
  flowchart: { edge: 'insp.tab.edge', group: 'insp.tab.group', object: 'insp.tab.node' },
  gantt: { group: 'insp.tab.section', groupWhenPresent: true, object: 'insp.tab.task' },
  git: { object: 'insp.tab.item' },
  journey: { object: 'insp.tab.item' },
  kanban: { object: 'insp.tab.card' },
  mindmap: { object: 'insp.tab.topic' },
  packet: { object: 'insp.tab.item' },
  pie: { object: 'insp.tab.item' },
  quadrant: { object: 'insp.tab.item' },
  requirement: {
    edge: 'insp.tab.relation',
    element: 'insp.tab.element',
    object: 'insp.tab.requirement'
  },
  sankey: { object: 'insp.tab.item' },
  sequence: { edge: 'insp.tab.message', object: 'insp.tab.participant' },
  state: { edge: 'insp.tab.transition', object: 'insp.tab.state' },
  timeline: { object: 'insp.tab.item' },
  xychart: { object: 'insp.tab.item' },
  zenuml: { object: 'insp.tab.item' }
};

const tabsOf = (code: string): KindTabs | undefined => {
  const kind = editKind(code);
  if (!kind) return undefined;
  const tabs = byKind[kind];
  // A swimlane's subgraphs are its lanes.
  return kind === 'flowchart' && swimlane.test(headerLine(code))
    ? { ...tabs, group: 'insp.tab.lane' }
    : tabs;
};

/** The tabs for this code, 図全体 first; only 図全体 for a type the panel cannot edit. */
export const inspectorTabs = (code: string, objects: EditObject[] = []): InspectorTab[] => {
  const tabs: InspectorTab[] = [{ id: 'all', label: 'ws.inspectorRoot' }];
  const kind = tabsOf(code);
  if (!kind) return tabs;
  tabs.push({ id: 'object', label: kind.object });
  if (kind.element) tabs.push({ id: 'element', label: kind.element });
  if (kind.group && (!kind.groupWhenPresent || objects.some((object) => object.group)))
    tabs.push({ id: 'group', label: kind.group });
  if (kind.edge) tabs.push({ id: 'edge', label: kind.edge });
  return tabs;
};

/** A requirement diagram's `element name { … }` declarations: the 要素 tab's items. */
const elementIds = (code: string): Set<string> => {
  const found = new Set<string>();
  for (const match of code.matchAll(/^\s*element\s+("[^"]*"|\S+)\s*\{/gm))
    found.add(match[1].replaceAll(/^"|"$/g, ''));
  return found;
};

/** The tab an object belongs to: a group's tab where the type has one, else the object tab. */
export const tabOfObject = (code: string, object: EditObject): InspectorTabId => {
  const kind = tabsOf(code);
  if (!kind) return 'object';
  if (kind.element && elementIds(code).has(object.id)) return 'element';
  return object.group && kind.group ? 'group' : 'object';
};

/** The tab of what is selected: 図全体 with nothing selected. */
export const tabOfSelection = (
  code: string,
  selected: Selected | undefined,
  objects: EditObject[] = []
): InspectorTabId => {
  if (!selected) return 'all';
  if (selected.type === 'edge') return 'edge';
  const object = objects.find(({ id }) => id === selected.id);
  return object ? tabOfObject(code, object) : 'object';
};

/** The objects a tab lists (the arrows are the edge list's, not an object). */
export const objectsOfTab = (
  code: string,
  tab: InspectorTabId,
  objects: EditObject[]
): EditObject[] =>
  tab === 'all' || tab === 'edge'
    ? []
    : objects.filter((object) => tabOfObject(code, object) === tab);
