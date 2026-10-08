import { TID } from '$/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultToolsSize,
  openSection,
  rememberToolsSize,
  showTab,
  tabOf,
  toggleSection,
  toolsAccordion,
  toolsSizeFor,
  toolsTabs,
  toolsWidths,
  widthModeOf
} from './toolsPane.svelte';

describe('tools tabs', () => {
  beforeEach(() => {
    toolsAccordion.open = TID.sampleDiagramsCard;
    toolsAccordion.tab = 'make';
    toolsAccordion.last = {};
  });

  it('puts every section in one tab', () => {
    expect(tabOf(TID.sampleDiagramsCard)).toBe('make');
    expect(tabOf(TID.aiCard)).toBe('make');
    expect(tabOf(TID.addCard)).toBe('fix');
    expect(tabOf(TID.editCard)).toBe('fix');
    expect(tabOf(TID.colorsCard)).toBe('fix');
    expect(tabOf(TID.layoutCard)).toBe('fix');
    expect(tabOf(TID.iconPacksCard)).toBe('fix');
    expect(tabOf(TID.actionsCard)).toBe('out');
    expect(tabOf(TID.shareCard)).toBe('out');
    expect(tabOf('nothing')).toBeUndefined();
  });

  it('orders 直す as add, layout, edit, colours, icons', () => {
    expect(toolsTabs.find(({ id }) => id === 'fix')?.sections).toEqual([
      TID.addCard,
      TID.layoutCard,
      TID.editCard,
      TID.colorsCard,
      TID.iconPacksCard
    ]);
  });

  it('opening a section shows its tab and closes the open one', () => {
    openSection(TID.colorsCard);
    expect(toolsAccordion).toMatchObject({ open: TID.colorsCard, tab: 'fix' });
    toggleSection(TID.actionsCard);
    expect(toolsAccordion).toMatchObject({ open: TID.actionsCard, tab: 'out' });
  });

  it('a click on the open header closes it and stays on its tab', () => {
    openSection(TID.addCard);
    toggleSection(TID.addCard);
    expect(toolsAccordion).toMatchObject({ open: undefined, tab: 'fix' });
  });

  it('showing a tab reopens its last section, else its first', () => {
    showTab('fix');
    expect(toolsAccordion).toMatchObject({ open: TID.addCard, tab: 'fix' });
    openSection(TID.layoutCard);
    showTab('out');
    expect(toolsAccordion.open).toBe(TID.actionsCard);
    showTab('fix');
    expect(toolsAccordion.open).toBe(TID.layoutCard);
  });
});

describe('tools pane width', () => {
  beforeEach(() => {
    toolsWidths.value = {};
  });

  it('gives 直す a width of its own, wider by default', () => {
    expect(widthModeOf('fix')).toBe('fix');
    expect(widthModeOf('make')).toBe('normal');
    expect(widthModeOf('out')).toBe('normal');
    expect(defaultToolsSize('fix', 1280)).toBeGreaterThan(defaultToolsSize('normal', 1280));
    expect(toolsSizeFor('fix', 1440)).toBe(40);
    expect(toolsSizeFor('normal', 1440)).toBe(32);
    expect(toolsSizeFor('normal', 1024)).toBe(25);
  });

  it('remembers a width per mode and ignores a collapsed pane or nonsense', () => {
    rememberToolsSize('fix', 47.26);
    rememberToolsSize('normal', 0);
    expect(toolsSizeFor('fix', 1280)).toBe(47.3);
    expect(toolsSizeFor('normal', 1280)).toBe(32);
    toolsWidths.value = { normal: 95 };
    expect(toolsSizeFor('normal', 1280)).toBe(32);
  });
});
