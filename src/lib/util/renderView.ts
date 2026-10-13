import type { MermaidConfig } from 'mermaid';
import { Svg2Roughjs } from 'svg2roughjs';
import { hazardMessage, renderHazard } from './codeError';
import { render as renderDiagram } from './mermaid';
import { presetBackground } from './themePresets';

export interface PlacedDiagram {
  diagramType?: string;
  graphDiv?: SVGSVGElement;
  /** Local: rendered, but not placed because `shouldPlace` said a newer picture is shown. */
  stale?: boolean;
}

/** Local: the state a placed picture was drawn from. */
export interface DrawnFrom {
  code: string;
  mermaid: string;
  rough: boolean;
}

/** Local: a placed picture's state, and its viewBox before svg-pan-zoom took it away. */
export interface Drawn extends DrawnFrom {
  viewBox?: string;
}

// Local: the exports that capture the picture on screen (.drawio, .vsdx; exportDiagram.ts)
// check that it is still the state they started from before they read it; the SVG file and
// the preview restore the viewBox.
const drawnFrom = new WeakMap<Element, Drawn>();

/**
 * Local: records what the placed picture `svg` shows (View.svelte, once it is placed and
 * before pan/zoom is applied to it, so its own viewBox is still there).
 */
export const markDrawn = (svg: Element, { code, mermaid, rough }: DrawnFrom): void => {
  drawnFrom.set(svg, { code, mermaid, rough, viewBox: svg.getAttribute('viewBox') ?? undefined });
};

/** Local: what `svg` was drawn from, if it is a picture the view placed. */
export const getDrawnFrom = (svg: Element): Drawn | undefined => drawnFrom.get(svg);

/**
 * Renders the diagram and places the resulting SVG into the container,
 * applying the hand-drawn transform and sizing fixups. Shared by the
 * store-bound View and the standalone EmbedView.
 *
 * @returns The detected diagram type and the placed SVG element (absent when
 *   mermaid returned an empty render).
 */
export const renderAndPlaceDiagram = async ({
  code,
  config,
  container,
  rough,
  shouldPlace,
  viewId
}: {
  code: string;
  config: MermaidConfig;
  /** Must have an `id` — Svg2Roughjs addresses the container by CSS selector. */
  container: HTMLDivElement;
  rough: boolean;
  /** Local: asked once the SVG is ready; false leaves the container as it is. */
  shouldPlace?: () => boolean;
  viewId: string;
}): Promise<PlacedDiagram> => {
  const containerSelector = `#${container.id}`;
  delete container.dataset.processed;
  // Local (error recovery): code that would hang the page while drawing is refused.
  const hazard = renderHazard(code);
  if (hazard) throw new Error(hazardMessage(hazard));
  let rendered;
  try {
    rendered = await renderDiagram(config, code, viewId);
  } catch (error) {
    // Local (error recovery): mermaid leaves its scratch element (`#d<id>`, or the
    // sandbox iframe `#i<id>`) in the page when drawing fails part-way.
    document.querySelector(`#d${viewId}`)?.remove();
    document.querySelector(`#i${viewId}`)?.remove();
    throw error;
  }
  const { svg, bindFunctions, diagramType } = rendered;
  if (svg.length === 0) {
    return { diagramType };
  }
  if (shouldPlace && !shouldPlace()) {
    return { diagramType, stale: true };
  }
  container.innerHTML = svg;
  let graphDiv = document.querySelector<SVGSVGElement>(`#${viewId}`);
  if (!graphDiv) {
    throw new Error('graph-div not found');
  }
  if (rough) {
    const svg2roughjs = new Svg2Roughjs(containerSelector);
    svg2roughjs.svg = graphDiv;
    await svg2roughjs.sketch();
    graphDiv.remove();
    const sketch = document.querySelector<SVGSVGElement>(`${containerSelector} > svg`);
    if (!sketch) {
      throw new Error('sketch not found');
    }
    const height = sketch.getAttribute('height');
    const width = sketch.getAttribute('width');
    sketch.setAttribute('id', 'graph-div');
    sketch.setAttribute('height', '100%');
    sketch.setAttribute('width', '100%');
    sketch.setAttribute('viewBox', `0 0 ${width} ${height}`);
    sketch.style.maxWidth = '100%';
    // Local: the sketch drops the diagram's <style>, so a theme preset's background goes inline.
    const fill = presetBackground(config as Record<string, unknown>);
    if (fill) sketch.style.backgroundColor = fill;
    graphDiv = sketch;
  } else {
    graphDiv.setAttribute('height', '100%');
    graphDiv.style.maxWidth = '100%';
    if (bindFunctions) {
      bindFunctions(graphDiv);
    }
  }
  return { diagramType, graphDiv };
};
