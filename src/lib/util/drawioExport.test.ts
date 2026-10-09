import { inflateRaw } from 'pako';
import { describe, expect, it } from 'vitest';
import {
  buildDrawio,
  type DrawioCell,
  htmlLabel,
  mermaidData,
  stencilShape,
  styleString
} from './drawioExport';
import { escapeXml } from './xmlText';

const parse = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
  return document;
};

const code = '---\ntitle: "経費 & <精算>"\n---\nflowchart LR\n\tA["申請"] -->|"承認"| B\n';

describe('escapeXml', () => {
  it('keeps line breaks as references and drops characters XML forbids', () => {
    expect(escapeXml('a<b>&"c"\n\td\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&quot;&#10;&#9;d');
  });
});

describe('style helpers', () => {
  it('writes draw.io styles, a bare name first, numbers rounded, no `;` in values', () => {
    expect(styleString({ '': 'text', fontSize: 14.3333, html: 1, image: 'a;b' })).toBe(
      'text;fontSize=14.33;html=1;image=a,b;'
    );
  });

  it('escapes labels as HTML with <br> for line breaks', () => {
    expect(htmlLabel('a < b & "c"\nd')).toBe('a &lt; b &amp; &quot;c&quot;<br>d');
  });

  it('compresses a stencil the way draw.io decompresses it', () => {
    const xml =
      '<shape w="10" h="10"><background><path><move x="0" y="0"/></path></background></shape>';
    const style = stencilShape(xml);
    expect(style).toMatch(/^stencil\([A-Za-z0-9+/=]+\)$/);
    // Graph.decompress: base64 → inflateRaw → decodeURIComponent.
    const bytes = Uint8Array.from(atob(style.slice(8, -1)), (c) => c.codePointAt(0) ?? 0);
    expect(decodeURIComponent(inflateRaw(bytes, { to: 'string' }))).toBe(xml);
  });
});

describe('buildDrawio', () => {
  const cells: DrawioCell[] = [
    {
      height: 40,
      id: '2',
      kind: 'vertex',
      parent: '1',
      style: { container: 1, fillColor: '#ffffff', shape: 'rect' },
      value: '経理',
      width: 300,
      x: 10,
      y: 10
    },
    {
      height: 20,
      id: '3',
      kind: 'vertex',
      parent: '2',
      style: { shape: 'rect' },
      value: '申請 &amp; 承認',
      width: 50,
      x: 5,
      y: 10
    },
    {
      id: '4',
      kind: 'edge',
      labelOffset: { x: 0, y: -5 },
      parent: '1',
      points: [{ x: 100, y: 30 }],
      source: '3',
      sourcePoint: { x: 65, y: 30 },
      style: { endArrow: 'block' },
      target: '2',
      targetPoint: { x: 200, y: 30 },
      value: 'ok'
    }
  ];
  const xml = buildDrawio({
    background: '#ffffff',
    cells,
    code,
    config: { flowchart: { curve: 'basis' } },
    height: 230,
    name: '経費精算',
    width: 412.5
  });
  const document = parse(xml);

  it('is an mxfile with one page and the mxGraphModel root draw.io expects', () => {
    const file = document.documentElement;
    expect(file.tagName).toBe('mxfile');
    const diagrams = file.getElementsByTagName('diagram');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].getAttribute('name')).toBe('経費精算');
    const model = diagrams[0].firstElementChild;
    expect(model?.tagName).toBe('mxGraphModel');
    expect(model?.getAttribute('pageWidth')).toBe('413');
    expect(model?.getAttribute('pageHeight')).toBe('230');
    expect(model?.getAttribute('background')).toBe('#ffffff');
    const root = model?.firstElementChild;
    expect(root?.tagName).toBe('root');
    const children = [...(root?.children ?? [])];
    expect(children.map((child) => child.tagName)).toEqual([
      'UserObject',
      'mxCell',
      'mxCell',
      'mxCell',
      'mxCell'
    ]);
    expect(children[0].getAttribute('id')).toBe('0');
    expect(children[1].getAttribute('id')).toBe('1');
    expect(children[1].getAttribute('parent')).toBe('0');
  });

  it('writes vertices with their geometry relative to the parent', () => {
    const [, , container, child] = document.getElementsByTagName('mxCell');
    expect(container.getAttribute('vertex')).toBe('1');
    expect(container.getAttribute('value')).toBe('経理');
    expect(container.getAttribute('style')).toBe('container=1;fillColor=#ffffff;shape=rect;');
    expect(child.getAttribute('parent')).toBe('2');
    expect(child.getAttribute('value')).toBe('申請 &amp; 承認');
    const geometry = child.getElementsByTagName('mxGeometry')[0];
    expect(geometry.getAttribute('x')).toBe('5');
    expect(geometry.getAttribute('width')).toBe('50');
  });

  it('writes edges with source, target, end points, waypoints and the label offset', () => {
    const edge = document.getElementsByTagName('mxCell')[4];
    expect(edge.getAttribute('edge')).toBe('1');
    expect(edge.getAttribute('source')).toBe('3');
    expect(edge.getAttribute('target')).toBe('2');
    const geometry = edge.getElementsByTagName('mxGeometry')[0];
    expect(geometry.getAttribute('relative')).toBe('1');
    const points = [...geometry.getElementsByTagName('mxPoint')].map((p) => [
      p.getAttribute('as'),
      p.getAttribute('x'),
      p.getAttribute('y')
    ]);
    expect(points).toEqual([
      ['sourcePoint', '65', '30'],
      ['targetPoint', '200', '30'],
      [null, '100', '30'],
      ['offset', '0', '-5']
    ]);
    expect(geometry.getElementsByTagName('Array')[0].getAttribute('as')).toBe('points');
  });

  it('keeps the Mermaid source and config on the root cell, with every line intact', () => {
    const object = document.getElementsByTagName('UserObject')[0];
    expect(object.getAttribute('label')).toBe('');
    const data = JSON.parse(object.getAttribute('mermaidData') ?? '') as unknown;
    expect(data).toEqual({ config: { flowchart: { curve: 'basis' } }, data: code });
    expect(object.getAttribute('mermaidData')).toBe(
      mermaidData(code, { flowchart: { curve: 'basis' } })
    );
  });

  it('stores a null config when there is none, as draw.io does', () => {
    const plain = parse(
      buildDrawio({ cells: [], code: 'flowchart LR\n  A', height: 0, name: 'x', width: 0 })
    );
    const object = plain.getElementsByTagName('UserObject')[0];
    expect(JSON.parse(object.getAttribute('mermaidData') ?? '')).toEqual({
      config: null,
      data: 'flowchart LR\n  A'
    });
    expect(plain.documentElement.innerHTML).not.toContain('background=');
  });
});
