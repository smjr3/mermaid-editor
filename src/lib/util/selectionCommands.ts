/**
 * Local: the command registry for the selection — the operations the add bar over
 * the diagram, the right-click menu and the inspector's rows all offer, defined once
 * so the three show the same operations with the same words.
 *
 * A command has a `key`, the i18n key of its `label`, and is an `action` (a button:
 * ＋次, 削除, 向きを反転 …) or a `choice` (a value to pick: a colour, a shape, a line
 * style …). `appliesTo(model)` says whether it fits what is selected (the diagram
 * type, objects or arrows or lanes, one item or several); `current(model)` gives the
 * value the selected items agree on, or `MIXED` for 「まちまち」; `run(model, value)`
 * performs it. Every run goes through the selection model's edits
 * (selectionModel.svelte.ts) and so through the existing code rewriters and
 * `checkEdit`; several items are changed in one undo step (`applyToAll`).
 *
 * `selectSame` builds a new selection from the model's lists (same shape, same colour,
 * same lane, every arrow, everything downstream of a node) and hands it to
 * `selectMany`. `moveLeft` / `moveRight` (順番の入れ替え) are reserved and not yet
 * applicable; see the TODO at their definition.
 */
import type { MessageKey } from '$/i18n/messages';
import {
  getEdgeColor,
  getObjectColor,
  getObjectStroke,
  getTextColor,
  getTextStyle,
  lineColors,
  setEdgeColor,
  setObjectColor,
  setObjectStroke,
  setTextColor,
  setTextStyle,
  swatches,
  textSizeChoices,
  type Swatch,
  type TextSize
} from './colors';
import type { NodeShape } from './diagramEdit';
import {
  edgeFields,
  flowNodeDetails,
  moveNodeToLane,
  moveService,
  reverseEdge,
  serviceDetails,
  setEdgeFields,
  setEdgeHead,
  setEdgeStyle,
  setNodeShapeName,
  type EdgeHead,
  type EdgeStyle,
  type EditEdge,
  type EditObject
} from './diagramModify';
import { displayName } from './displayName';
import { flowShapeNames, type FlowShapeName } from './flowShapes';
import { reverseDuplicates } from './selectionActions';
import { requestRename, selectMany, startConnect, type Selected } from './selection.svelte';
import { MIXED, selectionModel, type Mixed, type SelectionTarget } from './selectionModel.svelte';
import { inputState } from './state.svelte';

export type Model = typeof selectionModel;

export type CommandKey =
  | 'addNext'
  | 'addBranch'
  | 'connectFrom'
  | 'rename'
  | 'fillColor'
  | 'strokeColor'
  | 'textColor'
  | 'shape'
  | 'textSize'
  | 'bold'
  | 'lineStyle'
  | 'arrowHead'
  | 'edgeLength'
  | 'reverse'
  | 'moveToLane'
  | 'moveLeft'
  | 'moveRight'
  | 'delete'
  | 'selectSame';

export interface CommandChoice {
  value: string;
  /** The i18n key of its name; `text` instead when the name is the user's (a lane). */
  label?: MessageKey;
  text?: string;
  /** Colours: what the swatch shows. */
  swatch?: Partial<Swatch>;
}

export interface SelectionCommand {
  key: CommandKey;
  label: MessageKey;
  kind: 'action' | 'choice';
  /** The key that also does it, shown beside the label in a menu. */
  shortcut?: string;
  /** The values to pick from (`choice`), for what is selected now. */
  choices?: (model: Model) => CommandChoice[];
  /** Whether the command fits what is selected. */
  appliesTo: (model: Model) => boolean;
  /**
   * The value the selected items agree on (`choice`: one of `choices`; `bold`: 'true'
   * or 'false'), `MIXED` when they differ, undefined when none has one.
   */
  current?: (model: Model) => string | Mixed | undefined;
  /** Performs it: with the chosen value for a `choice`. */
  run: (model: Model, value?: string) => Promise<void> | void;
}

const code = () => inputState.code;

/** The selected objects that have a colour syntax (colors.ts), with it. */
const colourable = (model: Model) =>
  model.selectedObjects.flatMap((object) => {
    const syntax = model.syntaxOf(object);
    return syntax ? [{ object, syntax }] : [];
  });

const objectTargets = (model: Model) => model.targets.filter(({ object }) => object);
const edgeTargets = (model: Model) => model.targets.filter(({ edge }) => edge);

/** Flowchart nodes drawn as a shape (not a lane, not an icon or image). */
const shapedNodes = (model: Model) =>
  model.kind === 'flowchart'
    ? model.selectedObjects.flatMap((object) => {
        if (object.group) return [];
        const details = flowNodeDetails(code(), object.id);
        return details.icon || details.shape === undefined ? [] : [{ details, object }];
      })
    : [];

const single = (model: Model) => model.targets.length === 1;

/** The swatch name for a fill colour, 'custom' for one outside the palette, 'none' for none. */
const swatchValue = (swatch: Swatch | undefined): string =>
  swatch
    ? (swatches.find(({ fill, stroke }) => fill === swatch.fill && stroke === swatch.stroke)
        ?.name ?? 'custom')
    : 'none';

const fillChoices: CommandChoice[] = [
  { label: 'colors.lineDefault', value: 'none' },
  ...swatches.map(({ fill, name, stroke }): CommandChoice => ({
    label: `colors.swatch.${name}`,
    swatch: { fill, stroke },
    value: name
  }))
];

const lineChoices: CommandChoice[] = [
  { label: 'colors.lineDefault', value: 'none' },
  ...lineColors.map((stroke): CommandChoice => ({
    swatch: { stroke },
    text: stroke,
    value: stroke
  }))
];

/** A line colour's value: the hex, 'none' when none. */
const lineValue = (color: string | undefined) => color ?? 'none';
const lineColor = (value: string | undefined) =>
  value === undefined || value === 'none' ? undefined : value;

// The 形 row: the Add card's five under their names, then every other mermaid shape.
const commonShapes: [FlowShapeName, NodeShape][] = [
  ['rect', 'rect'],
  ['rounded', 'rounded'],
  ['diam', 'diamond'],
  ['circle', 'circle'],
  ['stadium', 'stadium']
];
const shapeChoices: CommandChoice[] = [
  ...commonShapes.map(([name, shape]): CommandChoice => ({
    label: `add.shape.${shape}`,
    value: name
  })),
  ...flowShapeNames
    .filter((name) => !commonShapes.some(([common]) => common === name))
    .map((name): CommandChoice => ({ label: `shape.${name}` as MessageKey, value: name }))
];

const edgeStyles: EdgeStyle[] = ['solid', 'dotted', 'thick', 'invisible'];

/** The arrows that are not `~~~` (an invisible link has no head). */
const headedEdges = (model: Model) =>
  model.selectedEdges.filter(({ style }) => style !== 'invisible');

/** The 長さ field of an arrow (flowcharts), as `edgeFields` lists it. */
const lengthField = (model: Model, edge: EditEdge) =>
  model.kind ? edgeFields(code(), model.kind, edge).find(({ key }) => key === 'length') : undefined;

/** Which lane or group an object is in ('' for none), for 「同じレーン」 and 移動先. */
const laneOf = (model: Model, object: EditObject): string | undefined => {
  if (object.group) return undefined;
  if (model.kind === 'flowchart') return flowNodeDetails(code(), object.id).lane;
  if (model.kind === 'architecture') return serviceDetails(code(), object.id)?.group ?? '';
  return undefined;
};

/** Everything that can be selected: every object and every arrow of the lists. */
export const allSelectable = (model: Model): Selected[] => [
  ...(model.objects?.items ?? []).map((object): Selected => ({ id: object.id, type: 'node' })),
  ...(model.edges?.items ?? []).map((edge): Selected => ({ index: edge.index, type: 'edge' }))
];

/** The node and arrows reached from `id` by following the arrows forward, `id` included. */
export const downstream = (edges: EditEdge[], id: string): Selected[] => {
  const nodes = new Set<string>([id]);
  const picked: Selected[] = [{ id, type: 'node' }];
  const queue = [id];
  while (queue.length > 0) {
    const from = queue.shift();
    for (const edge of edges) {
      if (edge.from !== from) continue;
      picked.push({ index: edge.index, type: 'edge' });
      if (!nodes.has(edge.to)) {
        nodes.add(edge.to);
        picked.push({ id: edge.to, type: 'node' });
        queue.push(edge.to);
      }
    }
  }
  return picked;
};

type SameKey = 'shape' | 'color' | 'lane' | 'edges' | 'downstream';

/** What 「同じものを選ぶ」 can pick for the primary selection. */
const sameChoices = (model: Model): CommandChoice[] => {
  const { object, edge } = model;
  const choices: CommandChoice[] = [];
  const hasEdges = (model.edges?.items.length ?? 0) > 0;
  if (object && shapedNodes(model).some((item) => item.object.id === object.id)) {
    choices.push({ label: 'sel.cmd.sameShape', value: 'shape' });
  }
  if (object && model.syntaxOf(object))
    choices.push({ label: 'sel.cmd.sameColor', value: 'color' });
  if (object && (laneOf(model, object) !== undefined || (object.group && object.members?.length))) {
    choices.push({ label: 'sel.cmd.sameLane', value: 'lane' });
  }
  if ((object || edge) && hasEdges) choices.push({ label: 'sel.cmd.allEdges', value: 'edges' });
  if (object && !object.group && hasEdges) {
    choices.push({ label: 'sel.cmd.downstream', value: 'downstream' });
  }
  return choices;
};

/** The items 「同じものを選ぶ」 picks; empty when the choice does not fit. */
export const sameAs = (model: Model, which: SameKey): Selected[] => {
  const { object } = model;
  const objects = model.objects?.items ?? [];
  const edges = model.edges?.items ?? [];
  const nodes = (ids: string[]) => ids.map((id): Selected => ({ id, type: 'node' }));
  switch (which) {
    case 'shape': {
      if (!object || object.group) return [];
      const shape = flowNodeDetails(code(), object.id).shapeName;
      if (!shape || model.kind !== 'flowchart') return [];
      return nodes(
        objects
          .filter((item) => !item.group && flowNodeDetails(code(), item.id).shapeName === shape)
          .map(({ id }) => id)
      );
    }
    case 'color': {
      const syntax = model.syntaxOf(object);
      if (!object || !syntax) return [];
      const wanted = JSON.stringify(getObjectColor(code(), object.id, syntax) ?? null);
      return nodes(
        objects
          .filter((item) => {
            const own = model.syntaxOf(item);
            return !!own && JSON.stringify(getObjectColor(code(), item.id, own) ?? null) === wanted;
          })
          .map(({ id }) => id)
      );
    }
    case 'lane': {
      if (!object) return [];
      if (object.group) return nodes([object.id, ...(object.members ?? [])]);
      const lane = laneOf(model, object);
      if (lane === undefined) return [];
      return nodes(objects.filter((item) => laneOf(model, item) === lane).map(({ id }) => id));
    }
    case 'edges':
      return edges.map((edge): Selected => ({ index: edge.index, type: 'edge' }));
    case 'downstream':
      return object && !object.group ? downstream(edges, object.id) : [];
    default:
      return [];
  }
};

export const selectionCommands: SelectionCommand[] = [
  {
    appliesTo: (model) => single(model) && model.canAddAfter,
    key: 'addNext',
    kind: 'action',
    label: 'insp.addNext',
    run: (model) => model.addAfter(),
    shortcut: 'Enter'
  },
  {
    appliesTo: (model) => single(model) && model.canAddAfter && !model.object?.group,
    key: 'addBranch',
    kind: 'action',
    label: 'insp.addBranch',
    run: (model) => model.addBranch(),
    shortcut: 'Tab'
  },
  {
    appliesTo: (model) => single(model) && model.canConnect,
    key: 'connectFrom',
    kind: 'action',
    label: 'sel.connect',
    run: () => startConnect()
  },
  {
    appliesTo: (model) =>
      single(model) &&
      (model.object ? !model.object.noRename : !!model.edge && !!model.edges?.can.label),
    key: 'rename',
    kind: 'action',
    label: 'canvas.menuRename',
    run: () => requestRename(),
    shortcut: 'F2'
  },
  {
    appliesTo: (model) => colourable(model).length > 0,
    choices: () => fillChoices,
    current: (model) =>
      model.commonValue(({ object }) => {
        const syntax = model.syntaxOf(object);
        return object && syntax
          ? swatchValue(getObjectColor(code(), object.id, syntax))
          : undefined;
      }),
    key: 'fillColor',
    kind: 'choice',
    label: 'insp.colorFill',
    run: async (model, value) => {
      const swatch = swatches.find(({ name }) => name === value);
      await model.applyToAll(
        (text, { object }) => {
          const syntax = model.syntaxOf(object);
          return object && syntax ? setObjectColor(text, object.id, swatch, syntax) : undefined;
        },
        undefined,
        objectTargets(model)
      );
    }
  },
  {
    // The border of an object; a flowchart arrow's line colour (`linkStyle`).
    appliesTo: (model) =>
      colourable(model).length > 0 ||
      (model.kind === 'flowchart' && model.selectedEdges.length > 0),
    choices: () => lineChoices,
    current: (model) =>
      model.commonValue(({ object, edge }) => {
        const syntax = model.syntaxOf(object);
        if (object && syntax) return lineValue(getObjectStroke(code(), object.id, syntax));
        if (edge && model.kind === 'flowchart') return lineValue(getEdgeColor(code(), edge.index));
        return undefined;
      }),
    key: 'strokeColor',
    kind: 'choice',
    label: 'insp.colorStroke',
    run: async (model, value) => {
      const color = lineColor(value);
      await model.applyToAll((text, { object, edge }) => {
        const syntax = model.syntaxOf(object);
        if (object && syntax) return setObjectStroke(text, object.id, color, syntax);
        if (edge && model.kind === 'flowchart') return setEdgeColor(text, edge.index, color);
        return undefined;
      });
    }
  },
  {
    appliesTo: (model) => colourable(model).length > 0,
    choices: () => lineChoices,
    current: (model) =>
      model.commonValue(({ object }) => {
        const syntax = model.syntaxOf(object);
        return object && syntax ? lineValue(getTextColor(code(), object.id, syntax)) : undefined;
      }),
    key: 'textColor',
    kind: 'choice',
    label: 'insp.colorText',
    run: async (model, value) => {
      const color = lineColor(value);
      await model.applyToAll(
        (text, { object }) => {
          const syntax = model.syntaxOf(object);
          return object && syntax ? setTextColor(text, object.id, color, syntax) : undefined;
        },
        undefined,
        objectTargets(model)
      );
    }
  },
  {
    appliesTo: (model) => shapedNodes(model).length > 0,
    choices: () => shapeChoices,
    current: (model) =>
      model.commonValue(({ object }) =>
        object && shapedNodes(model).some((item) => item.object.id === object.id)
          ? (flowNodeDetails(code(), object.id).shapeName ?? 'other')
          : undefined
      ),
    key: 'shape',
    kind: 'choice',
    label: 'sel.shape',
    run: async (model, value) => {
      if (!value || !(flowShapeNames as readonly string[]).includes(value)) return;
      const shaped = new Set(shapedNodes(model).map(({ object }) => object.id));
      await model.applyToAll(
        (text, { object }) =>
          object && shaped.has(object.id) ? setNodeShapeName(text, object.id, value) : undefined,
        undefined,
        objectTargets(model)
      );
    }
  },
  {
    appliesTo: (model) => colourable(model).some(({ syntax }) => syntax !== 'c4'),
    choices: () =>
      textSizeChoices.map((size): CommandChoice => ({
        label: `colors.textSize.${size}`,
        value: size
      })),
    current: (model) =>
      model.commonValue(({ object }) => {
        const syntax = model.syntaxOf(object);
        return object && syntax && syntax !== 'c4'
          ? getTextStyle(code(), object.id, syntax).size
          : undefined;
      }),
    key: 'textSize',
    kind: 'choice',
    label: 'sel.size',
    run: async (model, value) => {
      if (!value || !(textSizeChoices as string[]).includes(value)) return;
      await model.applyToAll(
        (text, { object }) => {
          const syntax = model.syntaxOf(object);
          return object && syntax && syntax !== 'c4'
            ? setTextStyle(text, object.id, { size: value as TextSize }, syntax)
            : undefined;
        },
        undefined,
        objectTargets(model)
      );
    }
  },
  {
    // A toggle: pressed when every selected object is bold; pressing makes them all
    // bold unless they all are, which makes them all plain.
    appliesTo: (model) => colourable(model).some(({ syntax }) => syntax !== 'c4'),
    current: (model) =>
      model.commonValue(({ object }) => {
        const syntax = model.syntaxOf(object);
        return object && syntax && syntax !== 'c4'
          ? String(getTextStyle(code(), object.id, syntax).bold)
          : undefined;
      }),
    key: 'bold',
    kind: 'action',
    label: 'sel.bold',
    run: async (model) => {
      const bold = model.commonValue(({ object }) => {
        const syntax = model.syntaxOf(object);
        return object && syntax && syntax !== 'c4'
          ? getTextStyle(code(), object.id, syntax).bold
          : undefined;
      });
      const next = bold !== true;
      await model.applyToAll(
        (text, { object }) => {
          const syntax = model.syntaxOf(object);
          return object && syntax && syntax !== 'c4'
            ? setTextStyle(text, object.id, { bold: next }, syntax)
            : undefined;
        },
        undefined,
        objectTargets(model)
      );
    }
  },
  {
    appliesTo: (model) =>
      model.selectedEdges.length > 0 && (model.edges?.can.styles.length ?? 0) > 0,
    choices: (model) =>
      edgeStyles
        .filter((style) => model.edges?.can.styles.includes(style))
        .map((style): CommandChoice => ({ label: `edit.edgeStyle.${style}`, value: style })),
    current: (model) => model.commonValue(({ edge }) => edge?.style),
    key: 'lineStyle',
    kind: 'choice',
    label: 'insp.edgeStyle',
    run: async (model, value) => {
      const { kind } = model;
      if (!kind || !value || !(edgeStyles as string[]).includes(value)) return;
      await model.applyToAll(
        (text, { edge }) => (edge ? setEdgeStyle(text, kind, edge, value as EdgeStyle) : undefined),
        undefined,
        edgeTargets(model)
      );
    }
  },
  {
    appliesTo: (model) =>
      !!model.edges?.can.head &&
      model.selectedEdges.length > 0 &&
      headedEdges(model).length === model.selectedEdges.length,
    choices: (model) => [
      { label: 'edit.edgeHeadEnd', value: 'end' },
      // Only where the type can draw a head at each end (not block, for one).
      ...(model.edges?.can.both
        ? [{ label: 'edit.edgeHeadBoth', value: 'both' } satisfies CommandChoice]
        : []),
      { label: 'edit.edgeHeadOff', value: 'none' }
    ],
    current: (model) => model.commonValue(({ edge }) => edge?.head),
    key: 'arrowHead',
    kind: 'choice',
    label: 'sel.head',
    run: async (model, value) => {
      const { kind } = model;
      if (!kind || (value !== 'end' && value !== 'both' && value !== 'none')) return;
      await model.applyToAll(
        (text, { edge }) => (edge ? setEdgeHead(text, kind, edge, value as EdgeHead) : undefined),
        undefined,
        edgeTargets(model)
      );
    }
  },
  {
    appliesTo: (model) =>
      model.kind === 'flowchart' &&
      model.selectedEdges.length > 0 &&
      model.selectedEdges.every((edge) => lengthField(model, edge)),
    choices: (model) => {
      const field = model.selectedEdges[0] && lengthField(model, model.selectedEdges[0]);
      return (field?.options ?? []).map((value: string): CommandChoice => ({
        label: `${field?.label}.${value}` as MessageKey,
        value
      }));
    },
    current: (model) => model.commonValue(({ edge }) => edge && lengthField(model, edge)?.value),
    key: 'edgeLength',
    kind: 'choice',
    label: 'edge.length',
    run: async (model, value) => {
      const { kind } = model;
      if (!kind || !value) return;
      await model.applyToAll(
        (text, { edge }) => (edge ? setEdgeFields(text, kind, edge, { length: value }) : undefined),
        undefined,
        edgeTargets(model)
      );
    }
  },
  {
    appliesTo: (model) => model.selectedEdges.length > 0 && !!model.edges?.can.reverse,
    key: 'reverse',
    kind: 'action',
    label: 'insp.edgeReverse',
    run: async (model) => {
      if (single(model)) {
        await model.reverse();
        return;
      }
      const { kind } = model;
      if (!kind) return;
      const all = model.edges?.items ?? [];
      // An arrow whose opposite is already there stays as it is (as the single case refuses).
      const turnable = edgeTargets(model).filter(
        ({ edge }) => edge && (kind === 'sequence' || !reverseDuplicates(all, edge))
      );
      if (turnable.length === 0) {
        model.warn('sel.reverseDuplicate');
        return;
      }
      await model.applyToAll(
        (text, { edge }) => (edge ? reverseEdge(text, kind, edge) : undefined),
        undefined,
        turnable
      );
    }
  },
  {
    appliesTo: (model) =>
      (model.kind === 'flowchart' || model.kind === 'architecture') &&
      model.selectedObjects.length > 0 &&
      model.selectedObjects.every((object) => laneOf(model, object) !== undefined) &&
      (model.objects?.items ?? []).some((item) => item.group),
    choices: (model) => {
      const items = model.objects?.items ?? [];
      const none: MessageKey = model.kind === 'architecture' ? 'edit.noGroup' : 'edit.noLane';
      return [
        { label: none, value: '' },
        ...items
          .filter((item) => item.group)
          .map((group): CommandChoice => ({
            text: displayName(group.label, group.id, items),
            value: group.id
          }))
      ];
    },
    current: (model) =>
      model.commonValue(({ object }) => (object ? laneOf(model, object) : undefined)),
    key: 'moveToLane',
    kind: 'choice',
    label: 'sel.moveTo',
    run: async (model, value) => {
      if (value === undefined) return;
      const service = model.kind === 'architecture';
      await model.applyToAll(
        (text, { object }) =>
          object && !object.group
            ? service
              ? moveService(text, object.id, value)
              : moveNodeToLane(text, object.id, value)
            : undefined,
        undefined,
        objectTargets(model)
      );
    }
  },
  // TODO(reorder): 順番の入れ替え — moving a node left or right within its rank by reordering
  // the lines of the code (meaning unchanged). The rewrite lives in `src/lib/util/reorder.ts`
  // (another agent writes it); the integrator wires `appliesTo` and `run` to it. Until then
  // the two keys are reserved and never offered.
  {
    appliesTo: () => false,
    key: 'moveLeft',
    kind: 'action',
    label: 'sel.cmd.moveLeft',
    run: () => undefined
  },
  {
    appliesTo: () => false,
    key: 'moveRight',
    kind: 'action',
    label: 'sel.cmd.moveRight',
    run: () => undefined
  },
  {
    appliesTo: (model) =>
      model.selectedEdges.length > 0 || model.selectedObjects.some(({ noDelete }) => !noDelete),
    key: 'delete',
    kind: 'action',
    label: 'sel.delete',
    run: (model) => model.remove(),
    shortcut: 'Del'
  },
  {
    appliesTo: (model) => sameChoices(model).length > 0,
    choices: sameChoices,
    key: 'selectSame',
    kind: 'choice',
    label: 'sel.cmd.selectSame',
    run: (model, value) => {
      const picked = sameAs(model, value as SameKey);
      if (picked.length > 0) selectMany(picked);
    }
  }
];

export const commandByKey = (key: CommandKey): SelectionCommand =>
  selectionCommands.find((command) => command.key === key) as SelectionCommand;

/** The commands that fit what is selected now, in registry order. */
export const availableCommands = (model: Model): SelectionCommand[] =>
  selectionCommands.filter((command) => command.appliesTo(model));

export { MIXED };
export type { SelectionTarget };
