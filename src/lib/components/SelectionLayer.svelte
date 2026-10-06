<script lang="ts">
  import DiagramContextMenu from '$/components/DiagramContextMenu.svelte';
  import SelectionToolbar from '$/components/SelectionToolbar.svelte';
  import { TID } from '$/constants';
  import { t } from '$/i18n';
  import { pickTarget, type PickElement } from '$/util/diagramPick';
  import {
    cancelConnect,
    clearSelection,
    requestRename,
    sameSelection,
    select,
    selection,
    type Selected
  } from '$/util/selection.svelte';
  import { isTypingTarget, keyCommand } from '$/util/selectionKeys';
  import { selectionModel as model } from '$/util/selectionModel.svelte';
  import { settledState } from '$/util/settledState.svelte';
  import { untrack } from 'svelte';

  // Local: "click the diagram, then change it". Sits over the diagram in the view
  // pane: a click on a drawn object or arrow selects it (diagramPick.ts), an outline
  // marks it, the mini toolbar floats above it, a right click opens a menu, a double
  // click renames, and the keys of selectionKeys.ts act on it. Drawn as an overlay
  // so the SVG itself (which PNG and SVG export read) is never touched.
  let { host }: { host: HTMLElement | undefined } = $props();

  // The lists for the last valid code.
  $effect(() => {
    const { code, error } = settledState.current;
    if (error) return;
    void model.sync(code);
  });

  const svgOf = () => host?.querySelector<SVGSVGElement>('#view svg') ?? undefined;

  const describe = (element: Element): PickElement => {
    const id = element.id;
    const cls = element.getAttribute('class') ?? '';
    // A gantt bar's name is in `<id>-text`; a sequence message's text sits before its
    // line, an actor's name after its box.
    const named = id ? document.getElementById(`${id}-text`) : null;
    const before = /\bmessageLine/.test(cls) ? element.previousElementSibling : null;
    const after =
      /^rect$/i.test(element.tagName) && /\bactor\b/.test(cls) ? element.nextElementSibling : null;
    return {
      childId: element.querySelector('[id]')?.id,
      cls,
      dataId: element.getAttribute('data-id'),
      id,
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

  /** The object or arrow under an event's target. */
  const pickAt = (target: EventTarget | null): Selected | undefined => {
    const svg = svgOf();
    if (!svg || !(target instanceof Element) || !svg.contains(target)) return undefined;
    const ctx = context(svg);
    if (!ctx) return undefined;
    const path: PickElement[] = [];
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
      ...svg.querySelectorAll('[id], [data-id], .edgeLabel, .messageText, rect.actor, text.actor')
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
    // A node just added keeps the toolbar (and its open rename field) where it was until
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
      const picked = pickAt(event.target);
      if (picked?.type === 'node' && selection.connectFrom) {
        void model.connectTo(picked.id);
        return;
      }
      if (picked) select(picked);
      else if (svg) clearSelection();
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (inOwnUi(event.target)) return;
      const picked = pickAt(event.target);
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
      const picked = pickAt(event.target);
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
        selection.connectFrom &&
        !isTypingTarget(event.target as Element)
      ) {
        cancelConnect();
        event.preventDefault();
        return;
      }
      const command = keyCommand(event, selection.current, isTypingTarget(event.target as Element));
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

{#if selection.connectFrom}
  <div
    class="absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-sm shadow"
    role="status"
    data-selection-ui>
    {t('sel.connecting')}
  </div>
{/if}

{#if box && selection.current && host && !menu}
  <SelectionToolbar {box} hostWidth={host.clientWidth} hostHeight={host.clientHeight} />
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
