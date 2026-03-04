/**
 * demo-graph.ts — Starter graph for first-run visualization
 * 18 nodes across 4 axes, varied voltage, properly sized for IVM shell
 */
import type { P31Graph, GraphNode, GraphEdge } from '../types/graph';
import type { Calibration } from './intake-to-graph';

function node(
  id: string, label: string, axis: 'A' | 'B' | 'C' | 'D',
  bary: [number, number, number, number],
  urgency: number, emotional: number, cognitive: number,
  radius = 0.035,
): GraphNode {
  return {
    id, label, axis,
    bus: label.toLowerCase().replace(/\s/g, '_'),
    bary,
    state: 'active',
    desc: '',
    connections: [],
    voltage: {
      urgency, emotional, cognitive,
      composite: (urgency * 0.4 + emotional * 0.3 + cognitive * 0.3),
    },
    evidence: { verified: false, confidence: 0.5, sources: [], disputes: [] },
    metadata: { radius },
    spoon_cost: 1,
    tags: [axis.toLowerCase()],
  };
}

const nodes: GraphNode[] = [
  // Axis A — Identity / Relationships
  node('a01', 'Self', 'A', [0.7, 0.1, 0.1, 0.1], 2, 5, 3, 0.045),
  node('a02', 'Children', 'A', [0.6, 0.2, 0.1, 0.1], 8, 9, 4, 0.05),
  node('a03', 'Support Network', 'A', [0.5, 0.2, 0.2, 0.1], 3, 4, 2, 0.03),
  node('a04', 'Diagnosis', 'A', [0.55, 0.25, 0.1, 0.1], 4, 6, 5, 0.035),

  // Axis B — Health / Energy
  node('b01', 'Spoon Budget', 'B', [0.1, 0.7, 0.1, 0.1], 6, 3, 7, 0.04),
  node('b02', 'Medication', 'B', [0.1, 0.6, 0.2, 0.1], 5, 2, 4, 0.03),
  node('b03', 'Sleep', 'B', [0.15, 0.55, 0.15, 0.15], 4, 5, 6, 0.035),
  node('b04', 'Sensory Load', 'B', [0.1, 0.5, 0.2, 0.2], 7, 6, 8, 0.045),
  node('b05', 'Exercise', 'B', [0.2, 0.6, 0.1, 0.1], 2, 3, 2, 0.025),

  // Axis C — Obligations / Legal / Finance
  node('c01', 'Court', 'C', [0.1, 0.1, 0.7, 0.1], 9, 8, 9, 0.055),
  node('c02', 'Finances', 'C', [0.1, 0.15, 0.6, 0.15], 8, 7, 6, 0.04),
  node('c03', 'Housing', 'C', [0.15, 0.1, 0.55, 0.2], 6, 5, 5, 0.035),
  node('c04', 'Disability Claim', 'C', [0.1, 0.2, 0.6, 0.1], 7, 6, 7, 0.04),
  node('c05', 'Deadlines', 'C', [0.1, 0.1, 0.65, 0.15], 9, 4, 8, 0.05),

  // Axis D — Meta / Projects / Growth
  node('d01', 'P31 Labs', 'D', [0.1, 0.1, 0.1, 0.7], 5, 7, 8, 0.045),
  node('d02', 'Node One', 'D', [0.15, 0.1, 0.1, 0.65], 3, 6, 9, 0.04),
  node('d03', 'The Buffer', 'D', [0.1, 0.15, 0.1, 0.65], 4, 5, 8, 0.04),
  node('d04', 'Research', 'D', [0.2, 0.1, 0.15, 0.55], 2, 4, 7, 0.03),
];

// Wire connections
function addConn(src: string, tgt: string) {
  const s = nodes.find(n => n.id === src);
  const t = nodes.find(n => n.id === tgt);
  if (s && !s.connections.includes(tgt)) s.connections.push(tgt);
  if (t && !t.connections.includes(src)) t.connections.push(src);
}

const edgeDefs: [string, string, GraphEdge['type']][] = [
  // A axis internal
  ['a01', 'a02', 'parent_of'],
  ['a01', 'a04', 'related_to'],
  ['a02', 'a03', 'related_to'],
  // B axis internal
  ['b01', 'b02', 'related_to'],
  ['b01', 'b03', 'related_to'],
  ['b03', 'b04', 'related_to'],
  ['b04', 'b05', 'related_to'],
  // C axis internal
  ['c01', 'c02', 'related_to'],
  ['c01', 'c04', 'related_to'],
  ['c02', 'c03', 'related_to'],
  ['c04', 'c05', 'depends_on'],
  // D axis internal
  ['d01', 'd02', 'parent_of'],
  ['d01', 'd03', 'parent_of'],
  ['d03', 'd04', 'related_to'],
  // Cross-axis
  ['a02', 'c01', 'related_to'],      // Children ↔ Court
  ['a04', 'b04', 'caused_by'],       // Diagnosis ↔ Sensory Load
  ['b01', 'c05', 'blocks'],          // Spoon Budget blocks Deadlines
  ['c04', 'a04', 'supports'],        // Disability Claim supports Diagnosis
  ['d01', 'c02', 'funds'],           // P31 Labs funds Finances
  ['d03', 'b01', 'related_to'],      // The Buffer ↔ Spoon Budget
  ['a01', 'd01', 'related_to'],      // Self ↔ P31 Labs
];

const edges: GraphEdge[] = edgeDefs.map(([s, t, type]) => {
  addConn(s, t);
  return { source: s, target: t, type, weight: 0.5, label: '', evidence: '' };
});

export const DEMO_GRAPH: P31Graph = {
  version: '1.0.0',
  meta: {
    operator: 'node-zero',
    generated_at: new Date().toISOString(),
    source_count: nodes.length,
    verified_count: 0,
    unverified_count: nodes.length,
    disputed_count: 0,
    cognitive_load: 0.45,
    last_sync: new Date().toISOString(),
    entropy_score: 0.42,
  },
  nodes,
  edges,
};

export const DEMO_CALIBRATION: Calibration = {
  initialSpoons: 8,
  sensoryPrefs: ['Motion sensitivity', 'Reduce animations'],
  suggestedOS: 'DIRECT',
  breathingPattern: [4, 2, 6],
  diagnoses: ['AuDHD'],
  medications: [],
  supportLevel: 'Limited support',
};
