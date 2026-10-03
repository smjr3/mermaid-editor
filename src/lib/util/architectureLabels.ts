/**
 * Local: architecture diagrams put a service's label under its icon, but
 * mermaid starts and ends edges at the icon's edge, so an edge leaving or
 * entering from below runs straight through the label (mermaid.live does the
 * same). Services are drawn above edges, so outlining the label text in the
 * diagram's background colour hides the part of the edge beneath it. The style
 * goes inside the SVG, so exported SVG/PNG files keep it. In the editor the
 * outline takes the page background (`--background`), which the view shows
 * through the diagram; an exported file falls back to the theme's background.
 */

// A plain CSS colour: hex, a name, or rgb()/hsl() — nothing that could close the style element.
const colourPattern = /^(#[\da-f]{3,8}|[a-z]+|(rgb|hsl)a?\([\d\s.,%]+\))$/i;

export const addLabelHalo = (svg: string, id: string, background: string): string => {
  if (!svg.includes('aria-roledescription="architecture"')) {
    return svg;
  }
  const value = background.trim();
  const colour =
    colourPattern.test(value) && value.toLowerCase() !== 'transparent' ? value : '#ffffff';
  const style = `<style>#${id} .architecture-service text,#${id} .architecture-edges text{paint-order:stroke;stroke:var(--background,${colour});stroke-width:6px;stroke-linejoin:round;}</style>`;
  return svg.replace(/<svg\b[^>]*>/, (open) => open + style);
};
