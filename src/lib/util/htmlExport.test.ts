import { fromBase64 } from 'js-base64';
import { describe, expect, it } from 'vitest';
import { defaultState } from '$/constants';
import type { State } from '$/types';
import {
  buildGitLabExport,
  buildStandaloneHtml,
  gitlabMarkdown,
  svgFile,
  takeExportSnapshot,
  toImgTag,
  toStandaloneHtml,
  toXmlSvg
} from './htmlExport';
import { deserializeState } from './serde';

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

describe('svgFile', () => {
  it('is a standalone SVG file with the given background', () => {
    const file = svgFile(svg, '#ffffff');
    expect(file.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(file).toContain('style="background-color: #ffffff"');
    expect(file).toContain('<text>図</text>');
  });

  it('adds to a style the svg already has, and refuses an unsafe colour', () => {
    const styled = '<svg xmlns="http://www.w3.org/2000/svg" style="max-width: 300px;"><g/></svg>';
    expect(svgFile(styled, 'rgb(1, 2, 3)')).toContain(
      'style="max-width: 300px; background-color: rgb(1, 2, 3)"'
    );
    expect(svgFile(svg, '"><script>')).toContain('background-color: #fff');
  });
});

// mermaid renders HTML: `&nbsp;` (block arrows), `<br>`, and kanban's `xlink:href`
// without a declared prefix. An SVG file or an <img> needs well-formed XML.
const htmlSvg =
  '<svg id="d" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a xlink:href="https://example.com/1"><text>x</text></a>' +
  '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><p>a&nbsp;b<br>c</p><img src="x.png"></div></foreignObject></svg>';
const parsesAsXml = (text: string) =>
  new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror') === null;

describe('toXmlSvg', () => {
  it('turns the HTML that mermaid renders into well-formed SVG', () => {
    expect(parsesAsXml(htmlSvg)).toBe(false);
    const xml = toXmlSvg(htmlSvg);
    expect(parsesAsXml(xml)).toBe(true);
    expect(xml).toMatch(/^<svg[^>]* xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(xml).toContain('a\u00A0b');
    expect(xml).toContain('https://example.com/1');
  });

  it('is used by the SVG file and the img tag', () => {
    expect(parsesAsXml(svgFile(htmlSvg, '#fff').replace(/^<\?xml[^>]*>\n/, ''))).toBe(true);
    const tag = toImgTag(htmlSvg, 'd');
    expect(parsesAsXml(fromBase64(/base64,([^"]+)/.exec(tag)?.[1] ?? ''))).toBe(true);
  });
});

describe('gitlabMarkdown', () => {
  const markdown = gitlabMarkdown({
    alt: 'System [overview]',
    code: 'architecture-beta\n  service db(logos:postgresql)[DB]\n```',
    editUrl: 'https://wiki.example/mermaid/edit#pako:abc',
    fileName: 'system overview.svg',
    labels: { edit: 'Edit this diagram', source: 'Mermaid source' }
  });

  it('shows the exported image, with a path GitLab can resolve', () => {
    expect(markdown).toContain('![System \\[overview\\]](system%20overview.svg)');
  });

  it('links back to the editor', () => {
    expect(markdown).toContain('[Edit this diagram](https://wiki.example/mermaid/edit#pako:abc)');
  });

  it('keeps the source in a collapsed block GitLab will not try to render', () => {
    expect(markdown).toContain('<details>\n<summary>Mermaid source</summary>');
    expect(markdown).toContain('````text\narchitecture-beta');
    expect(markdown).not.toContain('```mermaid');
    // A fence longer than any backtick run in the code, so the code cannot close it.
    expect(markdown).toMatch(/````text\n[\s\S]*```\n````/);
  });
});

// R12: the image, the source and the edit link of one export come from one moment.
describe('an export taken while the diagram is being edited', () => {
  const before = 'flowchart TD\n  Before --> Export';
  const after = 'flowchart TD\n  Edited --> During';
  const labels = { edit: 'Edit', source: 'Source' };

  // A render that is slow, during which the user types: the live state changes.
  const editingRender = (live: State) => (config: unknown, code: string) => {
    live.code = after;
    live.mermaid = '{"theme":"forest"}';
    return Promise.resolve(
      `<svg xmlns="http://www.w3.org/2000/svg"><text>${encodeURIComponent(code + JSON.stringify(config))}</text></svg>`
    );
  };

  it('builds the GitLab SVG, source and edit URL from the snapshot', async () => {
    const live: State = { ...defaultState, code: before, mermaid: '{"theme":"dark"}' };
    const snapshot = takeExportSnapshot(live, 'flowchart-v2');
    const { markdown, svg } = await buildGitLabExport(snapshot, {
      background: '#fff',
      editBase: 'https://wiki.example/edit',
      fileName: 'd.svg',
      labels,
      render: editingRender(live)
    });
    expect(live.code).toBe(after);
    expect(svg).toContain(encodeURIComponent(`${before}{"theme":"dark"}`));
    expect(markdown).toContain(before);
    expect(markdown).not.toContain('Edited');
    const editHash = /\(https:\/\/wiki\.example\/edit#([^)]+)\)/.exec(markdown)?.[1] ?? '';
    const linked = deserializeState(editHash);
    expect(linked.code).toBe(before);
    expect(linked.mermaid).toBe('{"theme":"dark"}');
    expect(markdown).toContain('![flowchart-v2 diagram](d.svg)');
  });

  it('builds the standalone page from the snapshot', async () => {
    const live: State = { ...defaultState, code: before, mermaid: '{}' };
    const html = await buildStandaloneHtml(takeExportSnapshot(live, undefined), {
      background: '#fff',
      render: editingRender(live)
    });
    expect(html).toContain('Before --&gt; Export');
    expect(html).not.toContain('Edited');
    expect(html).toContain('<title>mermaid diagram</title>');
  });

  it('renders a config that is not an object with the defaults', () => {
    for (const mermaid of ['{bad', 'null', '[1]']) {
      expect(takeExportSnapshot({ ...defaultState, mermaid }, undefined).config).toEqual({});
    }
  });
});
