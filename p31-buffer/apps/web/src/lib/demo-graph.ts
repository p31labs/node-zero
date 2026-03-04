/**
 * Demo graph for showcasing Spaceship Earth.
 * 18 nodes across 4 axes with varied voltages; bypasses the onboarding pipeline.
 *
 * Usage in App.tsx:
 *   import { DEMO_GRAPH, DEMO_CALIBRATION } from './lib/demo-graph';
 *   <SpaceshipEarth graph={DEMO_GRAPH} calibration={DEMO_CALIBRATION} ... />
 */

import type { P31Graph } from '@p31-buffer/graph-schema';

interface DemoCalibration {
  initialSpoons: number;
  suggestedOS: string;
  initialEntropy: number;
  sensoryPrefs: string[];
  displayName: string;
  pronouns: string | null;
}

// Internal shape: bary is [a,b,c] with d = 1-a-b-c
interface DemoNode {
  id: string;
  label: string;
  axis: 'A' | 'B' | 'C' | 'D';
  bary3: [number, number, number];
  radius: number;
  voltage: { urgency: number; emotional: number; cognitive: number };
  tags: string[];
}

function toBary4([a, b, c]: [number, number, number]): [number, number, number, number] {
  const d = Math.max(0, 1 - a - b - c);
  return [a, b, c, d];
}

// Radii 0.02–0.06 so nodes sit on the jitterbug without obscuring it (IVMRenderer caps at 0.06).
const nodes: DemoNode[] = [
  // AXIS A (green) — Support People
  { id: 'a1', label: 'Mom (Tyler)', axis: 'A', bary3: [0.8, 0.1, 0.05], radius: 0.035, voltage: { urgency: 2, emotional: 3, cognitive: 1 }, tags: ['family', 'safe'] },
  { id: 'a2', label: 'Bash', axis: 'A', bary3: [0.7, 0.15, 0.1], radius: 0.05, voltage: { urgency: 1, emotional: 8, cognitive: 2 }, tags: ['family', 'child'] },
  { id: 'a3', label: 'Willow', axis: 'A', bary3: [0.75, 0.05, 0.15], radius: 0.05, voltage: { urgency: 1, emotional: 9, cognitive: 2 }, tags: ['family', 'child'] },
  { id: 'a4', label: 'Claude (Centaur)', axis: 'A', bary3: [0.65, 0.2, 0.1], radius: 0.02, voltage: { urgency: 0, emotional: 1, cognitive: 0 }, tags: ['tool', 'support'] },
  { id: 'a5', label: 'Dr. Martinez', axis: 'A', bary3: [0.6, 0.25, 0.05], radius: 0.025, voltage: { urgency: 3, emotional: 2, cognitive: 4 }, tags: ['medical'] },
  // AXIS B (blue) — Activities / Routines
  { id: 'b1', label: 'Morning Meds', axis: 'B', bary3: [0.1, 0.75, 0.1], radius: 0.03, voltage: { urgency: 7, emotional: 3, cognitive: 2 }, tags: ['routine', 'medical'] },
  { id: 'b2', label: 'P31 Dev Sprint', axis: 'B', bary3: [0.15, 0.7, 0.05], radius: 0.035, voltage: { urgency: 5, emotional: 4, cognitive: 8 }, tags: ['work', 'flow'] },
  { id: 'b3', label: 'Breathing Practice', axis: 'B', bary3: [0.05, 0.8, 0.1], radius: 0.025, voltage: { urgency: 0, emotional: 1, cognitive: 0 }, tags: ['regulation'] },
  { id: 'b4', label: 'Legal Filing', axis: 'B', bary3: [0.1, 0.65, 0.2], radius: 0.04, voltage: { urgency: 9, emotional: 7, cognitive: 8 }, tags: ['legal', 'deadline'] },
  { id: 'b5', label: 'Exercise Walk', axis: 'B', bary3: [0.05, 0.6, 0.25], radius: 0.02, voltage: { urgency: 1, emotional: 0, cognitive: 0 }, tags: ['regulation'] },
  // AXIS C (gold) — Environments / Places
  { id: 'c1', label: 'Home Office', axis: 'C', bary3: [0.1, 0.1, 0.7], radius: 0.035, voltage: { urgency: 2, emotional: 3, cognitive: 3 }, tags: ['space', 'work'] },
  { id: 'c2', label: 'Courthouse', axis: 'C', bary3: [0.05, 0.15, 0.75], radius: 0.04, voltage: { urgency: 8, emotional: 9, cognitive: 7 }, tags: ['space', 'trigger'] },
  { id: 'c3', label: "Kids' School", axis: 'C', bary3: [0.15, 0.05, 0.65], radius: 0.03, voltage: { urgency: 4, emotional: 6, cognitive: 3 }, tags: ['space', 'family'] },
  { id: 'c4', label: 'Brunswick SSA', axis: 'C', bary3: [0.1, 0.2, 0.6], radius: 0.025, voltage: { urgency: 6, emotional: 5, cognitive: 6 }, tags: ['space', 'medical'] },
  // AXIS D (orange) — Values / Goals
  { id: 'd1', label: 'Protect the Kids', axis: 'D', bary3: [0.3, 0.3, 0.3], radius: 0.06, voltage: { urgency: 3, emotional: 10, cognitive: 2 }, tags: ['value', 'core'] },
  { id: 'd2', label: 'Ship P31 v1', axis: 'D', bary3: [0.25, 0.35, 0.25], radius: 0.04, voltage: { urgency: 6, emotional: 5, cognitive: 7 }, tags: ['value', 'mission'] },
  { id: 'd3', label: 'Financial Stability', axis: 'D', bary3: [0.35, 0.25, 0.3], radius: 0.03, voltage: { urgency: 7, emotional: 6, cognitive: 5 }, tags: ['value'] },
  { id: 'd4', label: 'Stay Regulated', axis: 'D', bary3: [0.28, 0.28, 0.35], radius: 0.035, voltage: { urgency: 2, emotional: 4, cognitive: 1 }, tags: ['value', 'health'] },
];

const edges: Array<{ source: string; target: string; weight: number }> = [
  { source: 'a1', target: 'a2', weight: 0.9 },
  { source: 'a1', target: 'a3', weight: 0.9 },
  { source: 'a2', target: 'a3', weight: 0.95 },
  { source: 'a2', target: 'c3', weight: 0.7 },
  { source: 'a3', target: 'c3', weight: 0.7 },
  { source: 'b4', target: 'c2', weight: 0.85 },
  { source: 'b4', target: 'd1', weight: 0.8 },
  { source: 'c2', target: 'd1', weight: 0.75 },
  { source: 'b4', target: 'd3', weight: 0.6 },
  { source: 'b2', target: 'c1', weight: 0.8 },
  { source: 'b2', target: 'a4', weight: 0.9 },
  { source: 'b2', target: 'd2', weight: 0.85 },
  { source: 'b1', target: 'a5', weight: 0.7 },
  { source: 'b3', target: 'd4', weight: 0.9 },
  { source: 'b5', target: 'd4', weight: 0.8 },
  { source: 'b1', target: 'd4', weight: 0.6 },
  { source: 'd1', target: 'a2', weight: 0.95 },
  { source: 'd1', target: 'a3', weight: 0.95 },
  { source: 'd2', target: 'a4', weight: 0.8 },
  { source: 'c4', target: 'a5', weight: 0.65 },
  { source: 'c4', target: 'd3', weight: 0.5 },
  { source: 'd4', target: 'a4', weight: 0.6 },
];

export const DEMO_GRAPH: P31Graph = {
  nodes: nodes.map((n) => ({
    id: n.id,
    label: n.label,
    axis: n.axis,
    state: 'active',
    bary: toBary4(n.bary3),
    voltage: n.voltage,
    metadata: { source: 'demo', tags: n.tags, radius: n.radius },
    connections: [],
  })),
  edges,
};

export const DEMO_CALIBRATION: DemoCalibration = {
  initialSpoons: 8,
  suggestedOS: 'TECHNICAL',
  initialEntropy: 0.35,
  sensoryPrefs: ['moderate'],
  displayName: 'Demo Operator',
  pronouns: null,
};
