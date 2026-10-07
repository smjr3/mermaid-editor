/**
 * Local: what the selection (selection.svelte.ts) is, and the edits on it, shared
 * by the mini toolbar, the "選択中" panel, the right-click menu and the keyboard.
 *
 * The lists are the Edit card's (`editableObjects`, `editableEdges`) and the
 * Colours card's (`diagramObjects`), for the last valid code; every edit is one of
 * those cards' functions. Code edits are applied only if mermaid still parses the
 * result as the same type (`checkEdit`, as the Edit card does); colours go straight
 * in, as the Colours card does.
 */
import { t } from '$/i18n';
import type { MessageKey } from '$/i18n/messages';
import {
  getEdgeColor,
  getObjectColor,
  getTextColor,
  getTextStyle,
  resetTextStyle,
  setEdgeColor,
  setObjectColor,
  setTextColor,
  setTextStyle,
  type Swatch,
  type TextStyle
} from './colors';
import {
  deleteMember,
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
  flowNodeDetails,
  moveNodeToLane,
  moveService,
  renameObject,
  reverseEdge,
  serviceDetails,
  setEdgeHead,
  setEdgeLabel,
  setEdgeStyle,
  setNodeIcon,
  setNodeShape,
  setServiceIcon,
  type EdgeStyle,
  type EditEdges,
  type EditObject,
  type EditObjects
} from './diagramModify';
import { diagramObjects } from './mermaid';
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
  sameSelection,
  select,
  selection,
  type Selected
} from './selection.svelte';
import { applyToolEdit, editsBlocked } from './codeHealth.svelte';
import { inputState, updateCode } from './state.svelte';

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
  fields = $derived(
    this.kind && this.object ? objectFields(inputState.code, this.kind, this.object) : undefined
  );
  label = $derived(
    this.object ? this.object.label.trim() || this.object.id : (this.edge?.label ?? '')
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
    const current = selection.current;
    if (current?.type === 'node' && !objects?.items.some(({ id }) => id === current.id)) {
      clearSelection();
    } else if (current?.type === 'edge' && current.index >= (edges?.items.length ?? 0)) {
      clearSelection();
    }
  }

  private say(key: MessageKey, params?: Record<string, string>) {
    this.message = t(key, params);
  }

  /** A refusal: in the panel, and over the diagram for a few seconds. */
  private warn(key: MessageKey, params?: Record<string, string>) {
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
      await this.apply(
        renameObject(inputState.code, kind, object, text),
        t('edit.renamed', { name: text })
      );
    } else if (edge) {
      await this.apply(setEdgeLabel(inputState.code, kind, edge, text), t('edit.updated'));
    }
  };

  remove = async (keepContents = false) => {
    const { kind, object, edge } = this;
    if (!kind) return;
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
    await this.apply(
      setObjectFields(inputState.code, kind, object, values),
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
  setEdgeHead = async (head: boolean) => {
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

  addAfter = async () => {
    const { kind, object } = this;
    if (!kind || !object) return;
    await this.added(addAfter(inputState.code, kind, object, t('sel.newNode')));
  };
  /** A branch: another node from where the selected one comes from. */
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
  /** "ノードを追加" on the empty canvas. */
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
