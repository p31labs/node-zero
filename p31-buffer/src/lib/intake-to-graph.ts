/**
 * intake-to-graph.ts — Converts onboarding intake data into a P31Graph + Calibration
 */
import type { P31Graph, GraphNode, GraphEdge, Axis } from '../types/graph';

export interface Calibration {
  initialSpoons: number;
  sensoryPrefs: string[];
  suggestedOS: string;
  breathingPattern: [number, number, number]; // inhale, hold, exhale seconds
  diagnoses: string[];
  medications: string[];
  supportLevel: string;
}

/** Extract calibration settings from raw intake answers */
export function extractCalibration(data: Record<string, unknown>): Calibration {
  const spoonRaw = Number(data['energy_level'] ?? data['initial_spoons'] ?? 8);
  const initialSpoons = Math.max(1, Math.min(12, spoonRaw));

  const sensoryPrefs = Array.isArray(data['sensory_prefs'])
    ? (data['sensory_prefs'] as string[])
    : typeof data['sensory_prefs'] === 'string'
      ? [data['sensory_prefs'] as string]
      : [];

  const diagnoses = Array.isArray(data['diagnoses'])
    ? (data['diagnoses'] as string[])
    : [];

  const medications = Array.isArray(data['medications'])
    ? (data['medications'] as string[])
    : typeof data['medications'] === 'string'
      ? [data['medications'] as string]
      : [];

  return {
    initialSpoons,
    sensoryPrefs,
    suggestedOS: String(data['preferred_mode'] ?? 'PLAIN'),
    breathingPattern: [4, 2, 6],
    diagnoses,
    medications,
    supportLevel: String(data['support_level'] ?? 'moderate'),
  };
}

/** Derive axis from field category */
function fieldToAxis(fieldId: string): Axis {
  if (/name|role|relation|family|child|parent|care/.test(fieldId)) return 'A';
  if (/health|med|diag|sensory|sleep|energy|spoon/.test(fieldId)) return 'B';
  if (/legal|court|case|money|finance|housing/.test(fieldId)) return 'C';
  return 'D';
}

/** Convert intake data to initial graph nodes */
export function intakeToGraph(data: Record<string, unknown>, cal: Calibration): P31Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nodeIndex = 0;

  // Generate nodes from non-empty intake fields
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === '' || value === null) continue;
    const axis = fieldToAxis(key);
    const id = `intake-${String(nodeIndex++).padStart(3, '0')}`;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Barycentric: dominant on the field's axis
    const bary: [number, number, number, number] = [0.1, 0.1, 0.1, 0.1];
    const axisIdx = { A: 0, B: 1, C: 2, D: 3 }[axis];
    bary[axisIdx] = 0.7;

    nodes.push({
      id,
      label,
      axis,
      bus: key,
      bary,
      state: 'active',
      desc: Array.isArray(value) ? value.join(', ') : String(value),
      connections: [],
      voltage: { urgency: 3, emotional: 3, cognitive: 3, composite: 3 },
      evidence: { verified: false, confidence: 0.5, sources: [], disputes: [] },
      spoon_cost: 1,
      tags: [axis.toLowerCase(), 'intake'],
    });
  }

  // Connect nodes within the same axis
  const byAxis: Record<string, string[]> = {};
  for (const n of nodes) {
    (byAxis[n.axis] ??= []).push(n.id);
  }
  for (const ids of Object.values(byAxis)) {
    for (let i = 0; i < ids.length - 1; i++) {
      edges.push({
        source: ids[i],
        target: ids[i + 1],
        type: 'related_to',
        weight: 0.5,
        label: '',
        evidence: '',
      });
      const srcNode = nodes.find(n => n.id === ids[i]);
      const tgtNode = nodes.find(n => n.id === ids[i + 1]);
      if (srcNode) srcNode.connections.push(ids[i + 1]);
      if (tgtNode) tgtNode.connections.push(ids[i]);
    }
  }

  return {
    version: '1.0.0',
    meta: {
      operator: 'node-zero',
      generated_at: new Date().toISOString(),
      source_count: nodes.length,
      verified_count: 0,
      unverified_count: nodes.length,
      disputed_count: 0,
      cognitive_load: Math.min(1, nodes.length / 50),
      last_sync: new Date().toISOString(),
      entropy_score: 0.5,
    },
    nodes,
    edges,
  };
}
