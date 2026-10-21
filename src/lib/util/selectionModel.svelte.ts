/**
 * Local: what the selection (selection.svelte.ts) is, and the edits on it, shared
 * by the mini toolbar, the "選択中" panel, the right-click menu and the keyboard.
 *
 * The lists are the Edit card's (`editableObjects`, `editableEdges`) and the
 * Colours card's (`diagramObjects`), for the last valid code; every edit is one of
 * those cards' functions. Code edits are applied only if mermaid still parses the
 * result as the same type (`checkEdit`, as the Edit card does); colours go straight
 * in, as the Colours card does.
 *
 * The selection may hold several items (selection.svelte.ts): `targets`,
 * `selectedObjects` and `selectedEdges` list them; the singular `object` / `edge` are
 * the primary one, which the single-selection rows keep using. `applyToAll` runs a
 * code rewrite over every item and writes once (one undo step); `commonValue` tells
 * a row whether the items agree (or shows 「まちまち」). `removeAll` deletes them all
 * in one step. The command registry (selectionCommands.ts) is built on these.
 */
import { t } from '$/i18n';
import type { MessageKey } from '$/i18n/messages';
import {
  type ColorSyntax,
  getEdgeColor,
  getObjectColor,
  getObjectStroke,
  getTextColor,
  getTextStyle,
  resetTextStyle,
  setEdgeColor,
  setObjectColor,
  setObjectStroke,
  setTextColor,
  setTextStyle,
  type Swatch,
  type TextStyle
} from './colors';
import {
  deleteMember,
  moveGanttTask,
  objectFields,
  objectMembers,
  setMember,
  setObjectFields,
  type DetailValues,
  type Member
} from './diagramDetails';
import type { NodeShape } from './diagramEdit';
import {
  checkEdit,
  deleteEdge,
  deleteObject,
  editableEdges,
  editableObjects,
  edgeFields,
  flowNodeDetails,
  moveNodeToLane,
  moveService,
  renameObject,
  reverseEdge,
  serviceDetails,
  setEdgeFields,
  setEdgeHead,
  setEdgeLabel,
  setEdgeStyle,
  setNodeIcon,
  setNodeIconOptions,
  setNodeShape,
  setNodeShapeName,
  setServiceIcon,
  type EdgeHead,
  type EdgeStyle,
  type EditEdge,
  type EditEdges,
  type EditObject,
  type EditObjects
} from './diagramModify';
import { addSpecs, initialValues } from './addActions';
import { objectOptionKeys, objectOptions, setObjectOption } from './diagramOptions';
import { diagramIds } from './diagramIds';
import { adjustedMessage } from './displayName';
import { diagramObjects, parse } from './mermaid';
import { checkedRename, findOccurrences, isValidIdentifier } from './mermaidRename';
import {
  addAfter,
  addedObject,
  addStandalone,
  branchSource,
  canAddAfter,
  canConnect,
  colorSyntaxFor,
  connect,
  neighbour,
  reverseDuplicates,
  type Added
} from './selectionActions';
import {
  clearSelection,
  endRename,
  requestRename,
  requestReveal,
  sameSelection,
  select,
  selection,
  selectMany,
  type Selected
} from './selection.svelte';
import { applyToolEdit, editsBlocked } from './codeHealth.svelte';
import { inputState, updateCode } from './state.svelte';

/** Why an id rename was refused, as F2 in the code says it. */
const idRejections = {
  breaks: 'editor.renameBreaks',
  invalid: 'editor.renameInvalid',
  taken: 'editor.renameTaken'
} as const satisfies Record<string, MessageKey>;

/** One selected item with what it names in the current lists. */
export interface SelectionTarget {
  selected: Selected;
  object?: EditObject;
  edge?: EditEdge;
}

/** `commonValue`: the selected items do not agree. */
export const MIXED: unique symbol = Symbol('mixed');
export type Mixed = typeof MIXED;
export const isMixed = (value: unknown): value is Mixed => value === MIXED;

/** Equal, or swatches / plain objects with the same entries. */
const sameValue = (a: unknown, b: unknown): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    JSON.stringify(a) === JSON.stringify(b));

class SelectionModel {
  /** The code the lists below were read from. */
  code = $state('');
  objects = $state<EditObjects | undefined>();
  edges = $state<EditEdges | undefined>();
  colourable = $state<string[]>([]);
  message = $state('');
  /**
   * Why the last edit was refused, shown over the diagram for a few seconds: the
   * panel's `message` is out of sight while the user works in the mini toolbar.
   */
  warning = $state('');
  private warningTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The inline rename's text and what it renames, kept here rather than in the
   * toolbar so that clicking elsewhere (another node, the canvas, the tools) can
   * still apply it to the object it was typed for.
   */
  draft = $state<{ target: Selected | 'adding'; name: string } | undefined>();
  /** The name a node being added will show, while its rename is already open. */
  draftLabel = $state<string | undefined>();
  /** Resolves (true when it worked) once a node being added is in the code and selected. */
  pendingAdd: Promise<boolean> | undefined;
  /** The node the last addition made, which a rename opened while adding it renames. */
  private lastAdded: string | undefined;

  kind = $derived(this.objects?.kind);
  object = $derived.by((): EditObject | undefined => {
    const current = selection.current;
    return current?.type === 'node'
      ? this.objects?.items.find(({ id }) => id === current.id)
      : undefined;
  });
  edge = $derived.by(() => {
    const current = selection.current;
    return current?.type === 'edge' ? this.edges?.items[current.index] : undefined;
  });
  /** Every selected item, in the order chosen, with what it names (items the lists lack are left out). */
  targets = $derived.by((): SelectionTarget[] =>
    selection.items
      .map((selected): SelectionTarget => ({ selected, ...this.resolve(selected) }))
      .filter(({ object, edge }) => object !== undefined || edge !== undefined)
  );
  /** The selected objects, in the order chosen. */
  selectedObjects = $derived(this.targets.flatMap(({ object }) => (object ? [object] : [])));
  /** The selected arrows, in the order chosen. */
  selectedEdges = $derived(this.targets.flatMap(({ edge }) => (edge ? [edge] : [])));
  /** More than one item is selected: the rows act on all of them. */
  multiple = $derived(selection.items.length > 1);
  /** How the selected object's colour is written, or undefined where it has none. */
  syntax = $derived(colorSyntaxFor(this.kind, this.object, this.colourable));
  /** A flowchart node's shape, lane and icon. */
  node = $derived(
    this.kind === 'flowchart' && this.object && !this.object.group
      ? flowNodeDetails(inputState.code, this.object.id)
      : undefined
  );
  /** An architecture service's icon and group. */
  service = $derived(
    this.kind === 'architecture' && this.object && !this.object.group
      ? serviceDetails(inputState.code, this.object.id)
      : undefined
  );
  /** Where the object can move: the lanes, subgraphs or groups other than itself. */
  groups = $derived(
    (this.objects?.items ?? []).filter((item) => item.group && item.id !== this.object?.id)
  );
  canAddAfter = $derived(canAddAfter(this.kind, this.object));
  canConnect = $derived(canConnect(this.kind, this.object));
  members = $derived(
    this.kind && this.object ? objectMembers(inputState.code, this.kind, this.object.id) : undefined
  );
  // Local: the object's properties, then its options mermaid offers for the type (diagramOptions.ts).
  fields = $derived.by(() => {
    if (!this.kind || !this.object) return undefined;
    const own = objectFields(inputState.code, this.kind, this.object);
    const options = objectOptions(inputState.code, this.kind, this.object);
    return own || options.length > 0 ? [...(own ?? []), ...options] : undefined;
  });
  label = $derived(
    this.object ? this.object.label.trim() || this.object.id : (this.edge?.label ?? '')
  );
  /** Local: the selected arrow's other properties (head shape, length, kind, …). */
  edgeFields = $derived(
    this.kind && this.edge ? edgeFields(inputState.code, this.kind, this.edge) : []
  );

  /** Reads the lists for valid code; drops a selection the code no longer has. */
  async sync(code: string): Promise<void> {
    const [objects, edges, colours] = await Promise.all([
      editableObjects(code),
      editableEdges(code),
      diagramObjects(code)
    ]);
    // A newer code arrived meanwhile: its own sync applies.
    if (code !== inputState.code && this.code === inputState.code) return;
    this.code = code;
    this.objects = objects;
    this.edges = edges;
    this.colourable = colours?.items.map(({ id }) => id) ?? [];
    // Items the code no longer has go; the ones left keep their order and primary.
    const kept = selection.items.filter((item) =>
      item.type === 'node'
        ? objects?.items.some(({ id }) => id === item.id)
        : item.index < (edges?.items.length ?? 0)
    );
    if (kept.length !== selection.items.length) {
      if (kept.length === 0) clearSelection();
      else selectMany(kept);
    }
  }

  /** How an object's colour is written (colors.ts), or undefined where it has none. */
  syntaxOf = (object: EditObject | undefined): ColorSyntax | undefined =>
    colorSyntaxFor(this.kind, object, this.colourable);

  /**
   * The value every selected item agrees on, `MIXED` when they differ, undefined when
   * `getter` has nothing for any of them (items it returns undefined for are skipped).
   */
  commonValue = <T>(getter: (target: SelectionTarget) => T | undefined): T | Mixed | undefined => {
    let found: T | undefined;
    let any = false;
    for (const target of this.targets) {
      const value = getter(target);
      if (value === undefined) continue;
      if (any && !sameValue(found, value)) return MIXED;
      found = value;
      any = true;
    }
    return found;
  };

  /**
   * Runs `fn` over every selected item in turn (each call sees the code the one before
   * returned; undefined leaves the code as it was), checks the result once with mermaid
   * and writes it once — one undo step. Refused while the code is broken, as every edit
   * is (codeHealth.svelte.ts). Resolves to whether the code changed.
   */
  applyToAll = async (
    fn: (code: string, target: SelectionTarget) => string | undefined,
    done: string = t('edit.updated'),
    targets: SelectionTarget[] = this.targets
  ): Promise<boolean> => {
    if (editsBlocked()) {
      this.warn('recover.blocked');
      return false;
    }
    let code = inputState.code;
    const before = code;
    for (const target of targets) {
      const next = fn(code, target);
      if (next !== undefined) code = next;
    }
    if (code === before) return false;
    return this.apply(code, done);
  };

  private say(key: MessageKey, params?: Record<string, string>) {
    this.message = t(key, params);
  }

  /** A refusal: in the panel, and over the diagram for a few seconds. */
  warn(key: MessageKey, params?: Record<string, string>) {
    this.say(key, params);
    this.warning = this.message;
    clearTimeout(this.warningTimer);
    this.warningTimer = setTimeout(() => (this.warning = ''), 4000);
  }

  /** Applies an edit if mermaid still accepts the result as the same type of diagram. */
  private async apply(next: string | undefined, done: string): Promise<boolean> {
    // Local: the lists are the last valid code's; the broken code cannot be checked.
    if (editsBlocked()) {
      this.warn('recover.blocked');
      return false;
    }
    const code = inputState.code;
    if (next === undefined || next === code || !(await checkEdit(code, next))) {
      this.warn('edit.breaks');
      return false;
    }
    // The code changed while mermaid checked the edit (a second click, a keystroke):
    // the edit was made from the old code, so writing it would drop that change.
    if (inputState.code !== code) return false;
    updateCode(next, { updateDiagram: true });
    this.message = done;
    this.warning = '';
    return true;
  }

  /** A colour or text style: written straight in, as the Colours card does. */
  private style(next: string) {
    // Local: checked, and refused while the code has an error (codeHealth.svelte.ts).
    void applyToolEdit(next).then((result) => {
      if (result === 'blocked') this.warn('recover.blocked');
      else if (result === 'refused') this.warn('edit.breaks');
      else if (result === 'stale') this.warn('edit.stale');
    });
  }

  /** What a selection names in the current lists. */
  private resolve(target: Selected | undefined) {
    return {
      edge: target?.type === 'edge' ? this.edges?.items[target.index] : undefined,
      object:
        target?.type === 'node' ? this.objects?.items.find(({ id }) => id === target.id) : undefined
    };
  }

  /** The text an object or arrow shows, as the rename field starts with it. */
  private labelOf(target: Selected | undefined): string {
    const { object, edge } = this.resolve(target);
    return object ? object.label.trim() || object.id : (edge?.label ?? '');
  }

  /** Opens the inline rename's draft on the selection, or on the node being added. */
  startDraft = () => {
    if (this.draftLabel !== undefined) {
      this.draft = { name: this.draftLabel, target: 'adding' };
      return;
    }
    const target = selection.current;
    this.draft = target && { name: this.labelOf(target), target };
  };

  /** Closes the inline rename without applying it. */
  cancelDraft = () => {
    this.draft = undefined;
    endRename();
  };

  /**
   * Applies the inline rename to the object it was opened on, if its text changed;
   * from Enter, the ✓ button, or a click elsewhere. Applied once, however many of
   * those arrive.
   */
  commitDraft = async () => {
    const draft = this.draft;
    this.draft = undefined;
    if (!draft) {
      endRename();
      return;
    }
    if (draft.target === 'adding' || sameSelection(selection.current, draft.target)) endRename();
    let target = draft.target;
    if (target === 'adding') {
      // Typed while the node was still being added: rename it once it is there.
      if (this.pendingAdd && !(await this.pendingAdd)) return;
      if (!this.lastAdded) return;
      target = { id: this.lastAdded, type: 'node' };
    }
    if (draft.name.trim() === this.labelOf(target)) return;
    await this.rename(draft.name, target);
  };

  rename = async (name: string, target: Selected | undefined = selection.current) => {
    const { kind } = this;
    const { object, edge } = this.resolve(target);
    const text = name.trim();
    if (!kind) return;
    if (object) {
      if (object.noRename) return;
      if (!text) {
        this.warn('sel.emptyName');
        return;
      }
      const next = renameObject(inputState.code, kind, object, text);
      if (next !== undefined && (await this.apply(next, t('edit.renamed', { name: text })))) {
        const objects = (await editableObjects(next))?.items ?? [];
        const renamed =
          objects.find(({ id }) => id === object.id) ??
          objects.find(({ line }) => line !== undefined && line === object.line);
        if (renamed) this.adjusted(text, renamed.label);
      }
    } else if (edge) {
      const next = setEdgeLabel(inputState.code, kind, edge, text);
      if (next !== undefined && (await this.apply(next, t('edit.updated')))) {
        const label = (await editableEdges(next))?.items[edge.index]?.label;
        if (label !== undefined) this.adjusted(text, label);
      }
    }
  };

  /**
   * Local (QA 2026-10-13): says so, once and without stopping anything, when the name
   * just applied shows otherwise than typed because Mermaid's syntax could not hold it
   * (`;` → `,`, `|` → `/`, a tag removed, 「」 around a keyword, …).
   */
  private adjusted(typed: string, shown: string) {
    const notice = adjustedMessage(typed, shown);
    if (!notice) return;
    this.message = `${this.message} ${notice}`.trim();
    this.warning = notice;
    clearTimeout(this.warningTimer);
    this.warningTimer = setTimeout(() => (this.warning = ''), 4000);
  }

  remove = async (keepContents = false) => {
    const { kind, object, edge } = this;
    if (!kind) return;
    if (this.multiple) {
      await this.removeAll(keepContents);
      return;
    }
    if (object && !object.noDelete) {
      const done = await this.apply(
        deleteObject(inputState.code, kind, object, { keepContents }),
        t('edit.deleted', { name: object.label.trim() })
      );
      if (done) clearSelection();
    } else if (edge) {
      if (await this.apply(deleteEdge(inputState.code, kind, edge), t('edit.updated'))) {
        clearSelection();
      }
    }
  };

  /**
   * Deletes every selected item in one step: the arrows first, from the highest index
   * (or line) down so the lower ones keep their place, then the objects (a deleted
   * object takes its arrows with it, which is why the arrows go first).
   */
  removeAll = async (keepContents = false) => {
    const { kind } = this;
    if (!kind) return;
    const edges = [...this.selectedEdges].sort(
      (a, b) => (b.line ?? b.index) - (a.line ?? a.index) || b.index - a.index
    );
    // Line-based objects (a mindmap topic, a kanban card) are named by their line, which
    // a deletion above them shifts: the lowest line goes last.
    const objects = this.selectedObjects
      .filter(({ noDelete }) => !noDelete)
      .sort((a, b) => (b.line ?? -1) - (a.line ?? -1));
    const count = edges.length + objects.length;
    if (count === 0) return;
    const done = await this.applyToAll(
      (code, { edge, object }) =>
        edge
          ? deleteEdge(code, kind, edge)
          : object
            ? deleteObject(code, kind, object, { keepContents })
            : undefined,
      t('sel.deletedMany', { count: String(count) }),
      [
        ...edges.map((edge): SelectionTarget => ({
          edge,
          selected: { index: edge.index, type: 'edge' }
        })),
        ...objects.map((object): SelectionTarget => ({
          object,
          selected: { id: object.id, type: 'node' }
        }))
      ]
    );
    if (done) clearSelection();
  };

  // ---- Colours and text (colors.ts) ----

  get color(): Swatch | undefined {
    return this.object && this.syntax
      ? getObjectColor(inputState.code, this.object.id, this.syntax)
      : undefined;
  }
  setColor = (swatch: Swatch | undefined) => {
    if (this.object && this.syntax) {
      this.style(setObjectColor(inputState.code, this.object.id, swatch, this.syntax));
    }
  };
  /** The border colour set on its own (the inspector's 「枠」). */
  get stroke(): string | undefined {
    return this.object && this.syntax
      ? getObjectStroke(inputState.code, this.object.id, this.syntax)
      : undefined;
  }
  setStroke = (color: string | undefined) => {
    if (this.object && this.syntax) {
      this.style(setObjectStroke(inputState.code, this.object.id, color, this.syntax));
    }
  };
  get textStyle(): TextStyle | undefined {
    return this.object && this.syntax && this.syntax !== 'c4'
      ? getTextStyle(inputState.code, this.object.id, this.syntax)
      : undefined;
  }
  setTextStyle = (text: Partial<TextStyle>) => {
    if (this.object && this.syntax) {
      this.style(setTextStyle(inputState.code, this.object.id, text, this.syntax));
    }
  };
  get textColor(): string | undefined {
    return this.object && this.syntax
      ? getTextColor(inputState.code, this.object.id, this.syntax)
      : undefined;
  }
  setTextColor = (color: string | undefined) => {
    if (this.object && this.syntax) {
      this.style(setTextColor(inputState.code, this.object.id, color, this.syntax));
    }
  };
  resetText = () => {
    if (this.object && this.syntax) {
      this.style(resetTextStyle(inputState.code, this.object.id, this.syntax));
    }
  };
  /** Flowchart arrows have a colour each (`linkStyle`). */
  get canColorEdge(): boolean {
    return this.kind === 'flowchart' && !!this.edge;
  }
  get edgeColor(): string | undefined {
    return this.canColorEdge && this.edge
      ? getEdgeColor(inputState.code, this.edge.index)
      : undefined;
  }
  setEdgeColor = (color: string | undefined) => {
    if (this.canColorEdge && this.edge) {
      this.style(setEdgeColor(inputState.code, this.edge.index, color));
    }
  };

  // ---- Objects (diagramModify.ts, diagramDetails.ts) ----

  setShape = async (shape: NodeShape) => {
    const { object } = this;
    if (!object) return;
    await this.apply(
      setNodeShape(inputState.code, object.id, shape),
      t('edit.changed', { name: this.label })
    );
  };
  /** Any of mermaid's shapes by its name (flowShapes.ts); the five common ones keep brackets. */
  setShapeName = async (shape: string) => {
    const { object } = this;
    if (!object) return;
    await this.apply(
      setNodeShapeName(inputState.code, object.id, shape),
      t('edit.changed', { name: this.label })
    );
  };
  setIcon = async (icon: string) => {
    const { object } = this;
    if (!object) return;
    const next = this.service
      ? setServiceIcon(inputState.code, object.id, icon)
      : setNodeIcon(inputState.code, object.id, icon);
    await this.apply(next, t('edit.changed', { name: this.label }));
  };
  moveTo = async (group: string) => {
    const { object } = this;
    if (!object) return;
    const next = this.service
      ? moveService(inputState.code, object.id, group)
      : moveNodeToLane(inputState.code, object.id, group);
    await this.apply(next, t('edit.moved', { name: this.label }));
  };
  setFields = async (values: DetailValues) => {
    const { kind, object } = this;
    if (!kind || !object) return;
    const [key, value] = Object.entries(values)[0] ?? [];
    // Local (QA 2026-10-13): a gantt task's 区分 moves its line; the selection follows it.
    if (kind === 'gantt' && key === 'section' && object.line !== undefined) {
      const moved = moveGanttTask(inputState.code, object.line, value);
      if (moved && (await this.apply(moved.code, t('edit.changed', { name: this.label })))) {
        await this.sync(moved.code);
        select({ id: `L${moved.line}`, type: 'node' });
      }
      return;
    }
    const next =
      key !== undefined && objectOptionKeys.has(key)
        ? setObjectOption(inputState.code, kind, object, key, value)
        : setObjectFields(inputState.code, kind, object, values);
    await this.apply(next, t('edit.changed', { name: this.label }));
  };
  /** Local: an icon node's background and label position. */
  setIconOptions = async (options: { form?: string; pos?: string }) => {
    const { object } = this;
    if (!object || !this.node?.icon) return;
    await this.apply(
      setNodeIconOptions(inputState.code, object.id, options),
      t('edit.changed', { name: this.label })
    );
  };
  setMember = async (member: Member, values: DetailValues | undefined) => {
    const { kind, object } = this;
    if (!kind || !object) return;
    const next = values
      ? setMember(inputState.code, kind, object.id, member, values)
      : deleteMember(inputState.code, kind, object.id, member);
    await this.apply(
      next,
      t(values ? 'edit.changed' : 'edit.deleted', { name: member.label.trim() })
    );
  };

  /** A new class member or entity attribute (the Add card's own action), last in the object. */
  addMember = async () => {
    const { kind, object } = this;
    if (!object || (kind !== 'class' && kind !== 'er')) return;
    const action = addSpecs
      .find((spec) => spec.kind === kind)
      ?.actions.find(({ id }) => id === (kind === 'class' ? 'member' : 'attribute'));
    if (!action) return;
    const result = action.apply(inputState.code, {
      ...initialValues(action),
      [kind === 'class' ? 'class' : 'entity']: object.id
    });
    if ('error' in result) {
      this.warn(result.error);
      return;
    }
    await this.apply(result.code, t('sel.added', { name: result.name }));
  };

  /** Whether the object's id is a name in the code that a rename can change everywhere. */
  get canRenameId(): boolean {
    const { object } = this;
    return (
      !!object &&
      object.line === undefined &&
      isValidIdentifier(object.id) &&
      findOccurrences(inputState.code, object.id).length > 0
    );
  }

  /** Changes the object's id everywhere it is used, as F2 in the code does (mermaidRename.ts). */
  renameId = async (to: string) => {
    const { object } = this;
    const next = to.trim();
    if (!object || !next || next === object.id) return;
    if (editsBlocked()) {
      this.warn('recover.blocked');
      return;
    }
    const code = inputState.code;
    const result = await checkedRename(
      code,
      object.id,
      next,
      async (text) => (await parse(text)).diagramType,
      diagramIds
    );
    if ('reason' in result) {
      this.warn(idRejections[result.reason], { name: next });
      return;
    }
    // The code changed while mermaid checked the rename: it was made from the old code.
    if (inputState.code !== code) return;
    updateCode(result.code, { updateDiagram: true });
    this.message = t('edit.renamed', { name: next });
    this.warning = '';
    select({ id: next, type: 'node' });
  };

  // ---- Arrows ----

  reverse = async () => {
    const { kind, edge } = this;
    if (!kind || !edge) return;
    if (kind !== 'sequence' && reverseDuplicates(this.edges?.items ?? [], edge)) {
      this.warn('sel.reverseDuplicate');
      return;
    }
    await this.apply(reverseEdge(inputState.code, kind, edge), t('edit.updated'));
  };
  setEdgeStyle = async (style: EdgeStyle) => {
    const { kind, edge } = this;
    if (kind && edge) {
      await this.apply(setEdgeStyle(inputState.code, kind, edge, style), t('edit.updated'));
    }
  };
  setEdgeFields = async (values: DetailValues) => {
    const { kind, edge } = this;
    if (kind && edge)
      await this.apply(setEdgeFields(inputState.code, kind, edge, values), t('edit.updated'));
  };
  setEdgeHead = async (head: EdgeHead) => {
    const { kind, edge } = this;
    if (kind && edge)
      await this.apply(setEdgeHead(inputState.code, kind, edge, head), t('edit.updated'));
  };

  // ---- New objects and arrows (selectionActions.ts) ----

  /** Applies an addition, then selects the new object and opens its rename. */
  private async added(result: Added | undefined) {
    const kind = this.kind;
    const before = this.objects?.items ?? [];
    if (!result || !kind) {
      this.say('edit.breaks');
      return;
    }
    // The rename opens at once, on the name the new node gets: checking the code,
    // reading the new lists and redrawing take from a fraction of a second to a few
    // seconds, and keys typed meanwhile (and a final Enter, which would add yet another
    // node) must land in the field. `pendingAdd` tells the field's commit to wait.
    if (editsBlocked()) {
      this.say('recover.blocked');
      return;
    }
    const openedEarly = !selection.renaming && selection.current !== undefined;
    if (openedEarly) {
      this.draftLabel = result.name;
      requestRename();
    }
    let done: (added: boolean) => void = () => undefined;
    this.pendingAdd = new Promise((resolve) => (done = resolve));
    let ok = false;
    try {
      if (!(await this.apply(result.code, t('sel.added', { name: result.name })))) return;
      let id = result.id;
      if (!id) {
        const after = (await editableObjects(result.code))?.items ?? [];
        id = addedObject(before, after, result.name)?.id;
      }
      if (id) {
        await this.sync(result.code);
        this.lastAdded = id;
        select({ id, type: 'node' }, { keepRename: true });
        // It may be drawn outside the part of the diagram on screen.
        requestReveal();
        // Nothing was selected to open it on (a node added on the empty canvas).
        if (!openedEarly) requestRename();
        ok = true;
      }
    } finally {
      // A rename the add could not carry over is closed.
      if (!ok && this.draftLabel !== undefined) endRename();
      this.draftLabel = undefined;
      this.pendingAdd = undefined;
      done(ok);
    }
  }

  /** Applies an addition made elsewhere (the add bar, a lane's ＋追加), as `added` does. */
  insert = (result: Added | undefined) => this.added(result);

  addAfter = async () => {
    const { kind, object } = this;
    if (!kind || !object) return;
    await this.added(addAfter(inputState.code, kind, object, t('sel.newNode')));
  };
  /** A branch: another node from where the selected one comes from, or one more way out of a decision. */
  addBranch = async () => {
    const { kind, object } = this;
    if (!kind || !object) return;
    const source = branchSource(
      inputState.code,
      kind,
      this.objects?.items ?? [],
      this.edges?.items ?? [],
      object
    );
    await this.added(addAfter(inputState.code, kind, source, t('sel.newNode')));
  };
  /** "図形を追加" on the empty canvas. */
  addNode = async () => {
    await this.added(
      addStandalone(inputState.code, this.kind, this.objects?.items ?? [], t('sel.newNode'))
    );
  };
  connectTo = async (to: string) => {
    const { kind } = this;
    const from = selection.connectFrom;
    selection.connectFrom = undefined;
    if (!kind || !from || from === to) return;
    const name = (id: string) =>
      this.objects?.items.find((item) => item.id === id)?.label.trim() || id;
    // A second identical arrow draws nothing new (sequence messages may repeat).
    if (kind !== 'sequence' && this.edges?.items.some((e) => e.from === from && e.to === to)) {
      this.warn('sel.alreadyConnected', { from: name(from), to: name(to) });
      select({ id: to, type: 'node' });
      return;
    }
    const done = await this.apply(
      connect(inputState.code, kind, from, to),
      t('sel.connected', { from: name(from), to: name(to) })
    );
    if (done) select({ id: to, type: 'node' });
  };

  /** Moves the selection along the arrows. */
  step = (direction: 'next' | 'previous') => {
    const { object } = this;
    if (!object) return;
    const id = neighbour(this.edges?.items ?? [], object.id, direction);
    if (id && this.objects?.items.some((item) => item.id === id)) select({ id, type: 'node' });
  };
}

export const selectionModel = new SelectionModel();
