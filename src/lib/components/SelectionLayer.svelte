<script lang="ts">
  import { connectMode, stopConnect } from '$/components/canvas/connectMode.svelte';
  import DiagramContextMenu from '$/components/DiagramContextMenu.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { containing, pickTarget, type PickElement } from '$/util/diagramPick';
  import {
    clearSelection,
    requestRename,
    sameSelection,
    select,
    selection,
    startConnect,
    type Selected
  } from '$/util/selection.svelte';
  import { canConnect } from '$/util/selectionActions';
  import { historyCommand, isTypingTarget, keyCommand } from '$/util/selectionKeys';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import type { PanZoomState } from '$/util/panZoom';
  import { settledState } from '$/util/settledState.svelte';
  import { untrack } from 'svelte';
  import { codeHistory } from '$/util/undoStack.svelte';

  // Local: "click the diagram, then change it". Sits over the diagram in the view
  // pane: a click on a drawn object or arrow selects it (diagramPick.ts), an outline
  // marks it (the inspector beside the diagram shows what it is and changes it), a right
  // click opens a menu, a double click renames, and the keys of selectionKeys.ts act on
  // it. While an arrow is being drawn (the add bar's 矢印, "ここから矢印を引く") a banner says
  // which shape to click next. Drawn as an overlay so the SVG itself (which PNG and SVG
  // export read) is never touched. Clicks on anything marked `data-selection-ui` (the
  // menu, the banner, the add bar's popovers, the inspector's fields) are not clicks on
  // the diagram: they neither select nor clear, and do not apply an open rename.
  // A node just added (selectionModel's `added`) is brought into view once drawn, through
  // the view's `panZoomState`.
  let { host, panZoomState }: { host: HTMLElement | undefined; panZoomState?: PanZoomState } =
    $props();

  // The lists for the last valid code.
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    void model.sync(code);
  });

  const svgOf = () => host?.querySelector<SVGSVGElement>('#view svg') ?? undefined;

  // The svg's id, which prefixes the ids of the drawn objects.
  const svgId = (element: Element) =>
    (element instanceof SVGElement ? element.ownerSVGElement?.id : undefined) ?? '';

  const describe = (element: Element): PickElement => {
    const id = element.id;
    const cls = element.getAttribute('class') ?? '';
    // A gantt bar's name is in `<id>-text`; a sequence message's text sits before its
    // line, an actor's name after its box.
    const named = id ? document.getElementById(`${id}-text`) : null;
    const message = /\bmessageLine/.test(cls);
    const before = message ? element.previousElementSibling : null;
    const after =
      /^rect$/i.test(element.tagName) && /\bactor\b/.test(cls) ? element.nextElementSibling : null;
    // A C4 relationship: a bare <line> followed by its <text>.
    const tag = element.tagName.toLowerCase();
    const next = element.nextElementSibling;
    const previous = element.previousElementSibling;
    const c4Text =
      model.kind !== 'c4' || cls || element.closest(`[id^="${svgId(element)}-"]`)
        ? undefined
        : tag === 'line' && next?.tagName.toLowerCase() === 'text'
          ? (next.textContent ?? '')
          : tag === 'text' && previous?.tagName.toLowerCase() === 'line'
            ? (element.textContent ?? '')
            : undefined;
    // Message lines in drawing order, when there are as many as the arrows listed.
    const lines = message
      ? [...(element.closest('svg')?.querySelectorAll('[class*="messageLine"]') ?? [])]
      : [];
    return {
      childId: element.querySelector('[id]')?.id,
      cls,
      dataId: element.getAttribute('data-id'),
      edgeText: message ? (before?.textContent ?? '') : c4Text,
      id,
      order:
        lines.length === (model.edges?.items.length ?? -1) ? lines.indexOf(element) : undefined,
      text: (named ?? before ?? after ?? element).textContent ?? ''
    };
  };

  const context = (svg: SVGSVGElement) =>
    model.kind
      ? {
          code: model.code,
          edges: model.edges?.items ?? [],
          kind: model.kind,
          objects: model.objects?.items ?? [],
          svgId: svg.id
        }
      : undefined;

  /**
   * What is near a click that hit nothing selectable: an arrow within a few pixels (lines
   * are thin), else the smallest lane or group around it (an architecture group's box
   * has no fill, so the click lands on the canvas).
   */
  const pickNear = (svg: SVGSVGElement, x: number, y: number): Selected | undefined => {
    const ctx = context(svg);
    if (!ctx) return undefined;
    for (const shape of svg.querySelectorAll<SVGGeometryElement>('path, line, polyline')) {
      const picked = pickTarget([describe(shape)], ctx);
      const matrix = shape.getScreenCTM();
      if (picked?.type !== 'edge' || !matrix) continue;
      const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      const width = shape.style.strokeWidth;
      shape.style.strokeWidth = `${12 / Math.max(Math.abs(matrix.a), 0.01)}px`;
      const hit = shape.isPointInStroke(point);
      shape.style.strokeWidth = width;
      if (hit) return picked;
    }
    const groups = [...svg.querySelectorAll('g.cluster, rect[id*="-group-"]')];
    for (const index of containing(
      groups.map((group) => group.getBoundingClientRect()),
      x,
      y
    )) {
      const picked = pickTarget([describe(groups[index])], ctx);
      if (picked) return picked;
    }
    return undefined;
  };

  /** The object or arrow under an event's target, or near the click. */
  const pickAt = (target: EventTarget | null, at?: MouseEvent): Selected | undefined => {
    const svg = svgOf();
    if (!svg || !(target instanceof Element) || !svg.contains(target)) return undefined;
    const ctx = context(svg);
    if (!ctx) return undefined;
    const direct = pickPath(target, ctx);
    return direct ?? (at ? pickNear(svg, at.clientX, at.clientY) : undefined);
  };

  const pickPath = (
    target: Element,
    ctx: NonNullable<ReturnType<typeof context>>
  ): Selected | undefined => {
    const path: PickElement[] = [];
    const svg = svgOf();
    for (
      let element: Element | null = target;
      element && element !== svg;
      element = element.parentElement
    ) {
      path.push(describe(element));
    }
    return pickTarget(path, ctx);
  };

  /** The drawn element of the selection (re-found after every render). */
  const findElement = (selected: Selected): Element | undefined => {
    const svg = svgOf();
    const ctx = svg && context(svg);
    if (!svg || !ctx) return undefined;
    // Elements with an id, and the labels and actor boxes that are recognised by their text.
    const candidates = [
      ...svg.querySelectorAll(
        '[id], [data-id], .edgeLabel, .messageText, rect.actor, text.actor, line, [class*="messageLine"]'
      )
    ];
    const preferred =
      selected.type === 'edge'
        ? (element: Element) => /^(?:path|line)$/i.test(element.tagName)
        : (element: Element) => /^g$/i.test(element.tagName);
    const matches = (element: Element) =>
      sameSelection(pickTarget([describe(element)], ctx), selected);
    return candidates.find((e) => preferred(e) && matches(e)) ?? candidates.find(matches);
  };

  // Where the selection is drawn, relative to the host; followed every frame while
  // something is selected, so panning, zooming and re-rendering keep the outline on it.
  let box = $state<{ x: number; y: number; width: number; height: number } | undefined>();
  let placed: Selected | undefined;
  $effect(() => {
    const selected = selection.current;
    // Read so a new render or list re-finds the element.
    void model.objects;
    void model.edges;
    if (!selected || !host) {
      box = undefined;
      return;
    }
    // Another selection starts unplaced; the same one after a render keeps its place.
    // A node just added (its rename already open) keeps the outline where it was until
    // the new node is drawn.
    if (!sameSelection(placed, selected) && !untrack(() => selection.renaming)) box = undefined;
    placed = selected;
    let element: Element | undefined;
    let frame = 0;
    const follow = () => {
      if (!element?.isConnected) element = findElement(selected);
      const hostRect = host?.getBoundingClientRect();
      const rect = element?.getBoundingClientRect();
      // Gone for a moment (the diagram is re-rendering): it stays where it was; a
      // selection the code no longer has is cleared by the model.
      if (rect && hostRect && (rect.width > 0 || rect.height > 0)) {
        const next = {
          height: rect.height,
          width: rect.width,
          x: rect.left - hostRect.left,
          y: rect.top - hostRect.top
        };
        if (
          !box ||
          Math.abs(box.x - next.x) > 0.5 ||
          Math.abs(box.y - next.y) > 0.5 ||
          Math.abs(box.width - next.width) > 0.5 ||
          Math.abs(box.height - next.height) > 0.5
        ) {
          box = next;
        }
      }
      frame = requestAnimationFrame(follow);
    };
    // Not called here: what it reads must not become this effect's dependencies.
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  });

  // A node just added may be drawn outside the part of the diagram on screen (zoomed in,
  // panned away): once it is drawn and the redraw has settled (its box unchanged for a
  // few frames, after the view restored its pan and zoom), the view pans — at the same
  // zoom unless the node is bigger than the canvas — so it is fully visible. Nothing
  // moves when it already is; nothing happens for a type whose drawing has no ids to
  // find it by, nor once the selection has moved on.
  $effect(() => {
    const session = selection.revealSession;
    const view = panZoomState;
    if (!session || !host || !view) return;
    const target = untrack(() => selection.current);
    if (!target) return;
    const until = performance.now() + 8000;
    let element: Element | undefined;
    let last: DOMRect | undefined;
    let steady = 0;
    let frame = 0;
    const tick = () => {
      if (!sameSelection(selection.current, target) || performance.now() > until) return;
      if (!element?.isConnected) {
        element = findElement(target);
        last = undefined;
      }
      const rect = element?.getBoundingClientRect();
      const canvas = host?.querySelector('#view')?.getBoundingClientRect();
      if (rect && canvas && (rect.width > 0 || rect.height > 0)) {
        const same =
          last &&
          Math.abs(last.left - rect.left) < 0.5 &&
          Math.abs(last.top - rect.top) < 0.5 &&
          Math.abs(last.width - rect.width) < 0.5 &&
          Math.abs(last.height - rect.height) < 0.5;
        steady = same ? steady + 1 : 0;
        last = rect;
        if (steady >= 2) {
          view.reveal(rect, canvas);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // The right-click menu: on an object or arrow, or on the empty canvas.
  let menu = $state<{ x: number; y: number; target: 'selection' | 'canvas' } | undefined>();

  const inOwnUi = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-selection-ui]');

  // Clicks: a drag that panned the diagram is not a click.
  let downAt: { x: number; y: number } | undefined;
  $effect(() => {
    const element = host;
    if (!element) return;
    const onDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
      // The diagram's pan/zoom keeps focus where it is, so the rename field would
      // not notice the click: apply what was typed before the click selects anything.
      if (selection.renaming && !inOwnUi(event.target)) void model.commitDraft();
    };
    const onClick = (event: MouseEvent) => {
      if (inOwnUi(event.target)) return;
      menu = undefined;
      if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const svg = svgOf();
      if (
        !(event.target instanceof Element) ||
        !element.querySelector('#view')?.contains(event.target)
      ) {
        return;
      }
      const picked = pickAt(event.target, event);
      if (picked?.type === 'node' && selection.connectFrom) {
        void model.connectTo(picked.id);
        return;
      }
      // The add bar's 矢印 with nothing selected: this shape is where the arrow starts.
      if (connectMode.pickingStart && picked?.type === 'node') {
        const object = model.objects?.items.find(({ id }) => id === picked.id);
        if (!canConnect(model.kind, object)) return;
        connectMode.pickingStart = false;
        select(picked);
        startConnect();
        return;
      }
      if (picked) select(picked);
      else if (svg) clearSelection();
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (inOwnUi(event.target)) return;
      const picked = pickAt(event.target, event);
      if (!picked) return;
      // Not svg-pan-zoom's zoom: a double click on an object renames it.
      event.stopPropagation();
      event.preventDefault();
      select(picked);
      requestRename();
    };
    const onContextMenu = (event: MouseEvent) => {
      if (inOwnUi(event.target)) return;
      if (
        !(event.target instanceof Element) ||
        !element.querySelector('#view')?.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      const picked = pickAt(event.target, event);
      if (picked) select(picked);
      else clearSelection();
      const rect = element.getBoundingClientRect();
      menu = {
        target: picked ? 'selection' : 'canvas',
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    };
    element.addEventListener('pointerdown', onDown, true);
    element.addEventListener('click', onClick);
    element.addEventListener('dblclick', onDoubleClick, true);
    element.addEventListener('contextmenu', onContextMenu);
    return () => {
      element.removeEventListener('pointerdown', onDown, true);
      element.removeEventListener('click', onClick);
      element.removeEventListener('dblclick', onDoubleClick, true);
      element.removeEventListener('contextmenu', onContextMenu);
    };
  });

  // The keys (selectionKeys.ts), when the keyboard is not busy elsewhere.
  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && menu) {
        menu = undefined;
        return;
      }
      if (
        event.key === 'Escape' &&
        (selection.connectFrom || connectMode.pickingStart) &&
        !isTypingTarget(event.target as Element)
      ) {
        stopConnect();
        event.preventDefault();
        return;
      }
      const typing = isTypingTarget(event.target as Element);
      // Ctrl+Z / Ctrl+Y outside the fields: the diagram's undo, selection or not.
      const history = historyCommand(event, typing);
      if (history) {
        event.preventDefault();
        codeHistory[history]();
        return;
      }
      const command = keyCommand(event, selection.current, typing);
      if (!command) return;
      event.preventDefault();
      switch (command) {
        case 'addAfter':
          void model.addAfter();
          break;
        case 'addBranch':
          void model.addBranch();
          break;
        case 'clear':
          clearSelection();
          break;
        case 'delete':
          void model.remove();
          break;
        case 'next':
        case 'previous':
          model.step(command);
          break;
        case 'rename':
          requestRename();
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if box && selection.current}
  <div
    class="pointer-events-none absolute z-10 rounded-sm outline-2 outline-offset-2 outline-accent outline-dashed"
    style:left={`${box.x}px`}
    style:top={`${box.y}px`}
    style:width={`${box.width}px`}
    style:height={`${box.height}px`}
    data-testid={TID.selectionOutline}
    data-selected={selection.current.type === 'node'
      ? selection.current.id
      : `edge-${selection.current.index}`}>
  </div>
{/if}

{#if selection.connectFrom || connectMode.pickingStart}
  <div
    class="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-md border bg-card py-1 pr-1 pl-3 text-sm shadow"
    role="status"
    data-selection-ui
    data-testid={TID.canvasConnectBanner}
    data-step={selection.connectFrom ? 'target' : 'start'}>
    <span>{t(selection.connectFrom ? 'canvas.connectTarget' : 'canvas.connectStart')}</span>
    <button
      type="button"
      class="rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
      data-testid={TID.canvasConnectCancel}
      onclick={stopConnect}>{t('sel.cancel')}</button>
  </div>
{/if}

{#if model.warning}
  <div
    class="absolute bottom-2 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-sm shadow"
    role="status"
    data-selection-ui
    data-testid={TID.selectionWarning}>
    {model.warning}
  </div>
{/if}

{#if menu}
  <DiagramContextMenu
    x={menu.x}
    y={menu.y}
    target={menu.target}
    hostWidth={host?.clientWidth ?? 0}
    hostHeight={host?.clientHeight ?? 0}
    onclose={() => (menu = undefined)} />
{/if}
