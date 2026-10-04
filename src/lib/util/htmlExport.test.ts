import { fromBase64 } from 'js-base64';
import { describe, expect, it } from 'vitest';
import { toImgTag, toStandaloneHtml } from './htmlExport';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>図</text></svg>';

describe('toStandaloneHtml', () => {
  const html = toStandaloneHtml({
    code: 'flowchart TD\n  A --> B</pre><script>',
    svg,
    title: 'Diagram <1>'
  });

  it('is a complete page with the diagram inline', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Diagram &lt;1&gt;</title>');
    expect(html).toContain(svg);
  });

  it('keeps the mermaid source, escaped, so the diagram can be edited again', () => {
    expect(html).toContain('flowchart TD\n  A --&gt; B&lt;/pre&gt;&lt;script&gt;');
    expect(html).not.toContain('</pre><script>');
  });

  it('uses the given background, and refuses one that could break the style', () => {
    expect(toStandaloneHtml({ background: '#0a0f1c', code: '', svg, title: '' })).toContain(
      'background: #0a0f1c;'
    );
    expect(
      toStandaloneHtml({ background: 'red;}</style><script>', code: '', svg, title: '' })
    ).toContain('background: #fff;');
  });

  it('sizes only the diagram itself, not the icons nested inside it', () => {
    expect(html).toContain('.diagram > svg {');
    expect(html).not.toMatch(/\.diagram svg\b/);
  });

  it('loads nothing from the network', () => {
    expect(html).not.toMatch(/(src|href)="https?:/);
  });
});

describe('toImgTag', () => {
  it('is one self-contained img tag', () => {
    const tag = toImgTag(svg, 'A "quoted" diagram');
    expect(tag).toMatch(
      /^<img alt="A &quot;quoted&quot; diagram" src="data:image\/svg\+xml;base64,[\w+/=]+">$/
    );
    const encoded = /base64,([^"]+)/.exec(tag)?.[1] ?? '';
    expect(fromBase64(encoded)).toBe(svg);
  });
});
