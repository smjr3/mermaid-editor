import type { MessageKey } from '$/i18n/messages';

/**
 * Local: the names the Templates card shows for its categories. The group names are
 * mermaid's catalogue keys (`@mermaid-js/examples`, plus ZenUML and this fork's
 * local groups), in English; these give the common ones a Japanese name. English
 * keeps the catalogue's own name.
 */
export const sampleNameKeys: Record<string, MessageKey> = {
  Architecture: 'preset.name.architecture',
  Block: 'preset.name.block',
  Class: 'preset.name.class',
  'Cynefin Framework': 'preset.name.cynefin',
  'Entity Relationship': 'preset.name.er',
  'Event Modeling': 'preset.name.eventModeling',
  Flowchart: 'preset.name.flowchart',
  Gantt: 'preset.name.gantt',
  Git: 'preset.name.git',
  Ishikawa: 'preset.name.ishikawa',
  Kanban: 'preset.name.kanban',
  Mindmap: 'preset.name.mindmap',
  Packet: 'preset.name.packet',
  Pie: 'preset.name.pie',
  Quadrant: 'preset.name.quadrant',
  Radar: 'preset.name.radar',
  'Railroad (ABNF)': 'preset.name.railroadAbnf',
  'Railroad (EBNF)': 'preset.name.railroadEbnf',
  'Railroad (IR)': 'preset.name.railroadIr',
  'Railroad (PEG)': 'preset.name.railroadPeg',
  Requirement: 'preset.name.requirement',
  Sankey: 'preset.name.sankey',
  Sequence: 'preset.name.sequence',
  State: 'preset.name.state',
  Swimlane: 'preset.name.swimlane',
  'System Architecture': 'preset.name.systemArchitecture',
  Timeline: 'preset.name.timeline',
  TreeView: 'preset.name.treeView',
  Treemap: 'preset.name.treemap',
  'Use Case': 'preset.name.useCase',
  'User Journey': 'preset.name.journey',
  Venn: 'preset.name.venn',
  'Wardley Maps': 'preset.name.wardley',
  XY: 'preset.name.xy'
};
