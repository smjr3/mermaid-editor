import { TID } from '$/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSection, showTab, tabOf, toggleSection, toolsAccordion } from './toolsPane.svelte';

describe('tools tabs', () => {
  beforeEach(() => {
    toolsAccordion.open = TID.sampleDiagramsCard;
    toolsAccordion.tab = 'make';
    toolsAccordion.last = {};
  });

  it('puts every section in one tab', () => {
    expect(tabOf(TID.sampleDiagramsCard)).toBe('make');
    expect(tabOf(TID.addCard)).toBe('make');
    expect(tabOf(TID.editCard)).toBe('fix');
    expect(tabOf(TID.colorsCard)).toBe('fix');
    expect(tabOf(TID.layoutCard)).toBe('fix');
    expect(tabOf(TID.iconPacksCard)).toBe('fix');
    expect(tabOf(TID.actionsCard)).toBe('out');
    expect(tabOf(TID.aiCard)).toBe('out');
    expect(tabOf('nothing')).toBeUndefined();
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
    expect(toolsAccordion).toMatchObject({ open: undefined, tab: 'make' });
  });

  it('showing a tab reopens its last section, else its first', () => {
    showTab('fix');
    expect(toolsAccordion).toMatchObject({ open: TID.editCard, tab: 'fix' });
    openSection(TID.layoutCard);
    showTab('out');
    expect(toolsAccordion.open).toBe(TID.actionsCard);
    showTab('fix');
    expect(toolsAccordion.open).toBe(TID.layoutCard);
  });
});
