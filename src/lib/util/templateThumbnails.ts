/**
 * Local: the small previews in the "Create from a template" dialog
 * (TemplateForms.svelte). Each template's default diagram is rendered once per
 * theme and kept for the page's lifetime; renders run one after another so
 * opening the dialog does not stall the editor's own render.
 */
import type { MermaidConfig } from 'mermaid';
import { render } from './mermaid';

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** The SVG of a diagram as a thumbnail, or '' if it does not render. */
export const thumbnail = (key: string, code: string, theme?: string): Promise<string> => {
  const cacheKey = `${theme ?? ''}\n${code}`;
  let svg = cache.get(cacheKey);
  if (!svg) {
    const config = (
      theme ? { startOnLoad: false, theme } : { startOnLoad: false }
    ) as MermaidConfig;
    const run = queue.then(async () => (await render(config, code, `template-thumb-${key}`)).svg);
    queue = run.catch(() => undefined);
    svg = run.catch(() => '');
    cache.set(cacheKey, svg);
  }
  return svg;
};
