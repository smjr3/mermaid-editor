import { toBase64 } from 'js-base64';
import { describe, expect, it } from 'vitest';
import { buildDrawio, mermaidData } from './drawioExport';
import { escapeXml, svgSize } from './xmlText';

const parse = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
  return document;
};

const code = '---\ntitle: "経費 & <精算>"\n---\nflowchart LR\n\tA["申請"] -->|"承認"| B\n';
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="-8 -8 412.5 230" style="max-width: 412.5px;"><g/></svg>';
const svgBase64 = toBase64(svg);
const size = svgSize(svg) ?? { height: 0, width: 0 };

describe('svgSize', () => {
  it('reads the viewBox, else width and height', () => {
    expect(size).toEqual({ height: 230, width: 412.5 });
    expect(svgSize('<svg width="120px" height="40"></svg>')).toEqual({ height: 40, width: 120 });
    expect(svgSize('<svg viewBox="0,0,30,20"/>')).toEqual({ height: 20, width: 30 });
    expect(svgSize('<svg width="100%"></svg>')).toBeUndefined();
    expect(svgSize('<svg width="100%" height="100%"></svg>')).toBeUndefined();
    expect(svgSize('<div/>')).toBeUndefined();
  });
});

describe('escapeXml', () => {
  it('keeps line breaks as references and drops characters XML forbids', () => {
    expect(escapeXml('a<b>&"c"\n\td\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&quot;&#10;&#9;d');
  });
});

describe('buildDrawio', () => {
  const xml = buildDrawio({
    code,
    config: { flowchart: { curve: 'basis' } },
    height: size.height,
    name: '経費精算',
    svgBase64,
    width: size.width
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
    const root = model?.firstElementChild;
    expect(root?.tagName).toBe('root');
    const children = [...(root?.children ?? [])];
    expect(children.map((child) => child.tagName)).toEqual(['mxCell', 'mxCell', 'UserObject']);
    expect(children[0].getAttribute('id')).toBe('0');
    expect(children[1].getAttribute('parent')).toBe('0');
    expect(model?.getAttribute('pageWidth')).toBe('413');
    expect(model?.getAttribute('pageHeight')).toBe('230');
  });

  it('has one image cell the size of the SVG viewBox, holding the SVG', () => {
    const object = document.getElementsByTagName('UserObject')[0];
    const cell = object.getElementsByTagName('mxCell')[0];
    expect(cell.getAttribute('vertex')).toBe('1');
    expect(cell.getAttribute('parent')).toBe('1');
    const style = cell.getAttribute('style') ?? '';
    expect(style).toMatch(/^shape=image;/);
    expect(style).toContain('noLabel=1;');
    expect(style).toContain('editIcon=1;');
    // draw.io style values cannot hold `;`, so the data URI has no `;base64`.
    expect(style).toContain(`;image=data:image/svg+xml,${svgBase64};`);
    const geometry = cell.getElementsByTagName('mxGeometry')[0];
    expect(geometry.getAttribute('as')).toBe('geometry');
    expect(Number(geometry.getAttribute('width'))).toBe(412.5);
    expect(Number(geometry.getAttribute('height'))).toBe(230);
  });

  it('keeps the Mermaid source and config on mermaidData, with every line intact', () => {
    const object = document.getElementsByTagName('UserObject')[0];
    expect(object.getAttribute('id')).toBe('2');
    expect(object.getAttribute('label')).toBe('');
    const data = JSON.parse(object.getAttribute('mermaidData') ?? '') as unknown;
    expect(data).toEqual({ config: { flowchart: { curve: 'basis' } }, data: code });
    expect(object.getAttribute('mermaidData')).toBe(
      mermaidData(code, { flowchart: { curve: 'basis' } })
    );
  });

  it('stores a null config when there is none, as draw.io does', () => {
    const plain = parse(
      buildDrawio({ code: 'flowchart LR\n  A', height: 0, name: 'x', svgBase64, width: 0 })
    );
    const object = plain.getElementsByTagName('UserObject')[0];
    expect(JSON.parse(object.getAttribute('mermaidData') ?? '')).toEqual({
      config: null,
      data: 'flowchart LR\n  A'
    });
    // A zero size (no viewBox) still gives draw.io a cell it can select.
    expect(plain.getElementsByTagName('mxGeometry')[0].getAttribute('width')).toBe('1');
  });
});
