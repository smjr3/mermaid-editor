import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The deployment-side converter (scripts/svg-to-iconify.js), used to publish a
// vendor's SVG icons as a pack next to the site; see docs-dev/ICONS.md.
import { convertSvgDirectory } from '../../../scripts/svg-to-iconify.js';
import { sanitizeIconSet } from './customIcons';

describe('scripts/svg-to-iconify.js', () => {
  it('turns a folder tree of SVG files into an Iconify pack the app accepts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svg-to-iconify-'));
    mkdirSync(join(dir, 'networking'));
    writeFileSync(
      join(dir, 'networking', '10061-icon-service-Virtual-Networks.svg'),
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M0 0h18v18H0z" fill="#50e6ff"/></svg>'
    );
    writeFileSync(
      join(dir, 'Firewall.svg'),
      '<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>'
    );
    writeFileSync(join(dir, 'notes.txt'), 'ignored');

    const pack = convertSvgDirectory(dir, 'azure');
    expect(pack.prefix).toBe('azure');
    expect(Object.keys(pack.icons).sort()).toEqual(['firewall', 'virtual-networks']);
    expect(pack.icons['virtual-networks']).toMatchObject({ height: 18, width: 18 });
    expect(pack.icons['virtual-networks'].body).toContain('#50e6ff');
    expect(Object.keys(sanitizeIconSet(pack).icons)).toHaveLength(2);
  });
});
