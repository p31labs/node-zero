/**
 * graph-data.ts — P31 Operations Graph: 79 nodes
 * 4 Axes: A=Identity/Self, B=Health/Biology, C=Legal/Structure, D=Technical/Build
 * Each node has barycentric coords (a,b,c,d) in tetrahedral space.
 *
 * Quadray→Cartesian: [a-b-c+d, a-b+c-d, a+b-c-d] / √2  (Kirby Urner / Tom Ace)
 * Barycentric→3D: weighted tetrahedral vertex blend, projected to shell.
 */
import type { Graph, GraphNode, GraphEdge } from '../types/graph';

const SQRT2 = Math.sqrt(2);

/** Quadray→Cartesian (Kirby Urner / Tom Ace) */
function quadrayToCartesian(a: number, b: number, c: number, d: number): [number, number, number] {
  return [
    (a - b - c + d) / SQRT2,
    (a - b + c - d) / SQRT2,
    (a + b - c - d) / SQRT2,
  ];
}

/** Tetrahedral reference vertices in Cartesian space */
const TETRA_VERTS = [
  quadrayToCartesian(1, 0, 0, 0),
  quadrayToCartesian(0, 1, 0, 0),
  quadrayToCartesian(0, 0, 1, 0),
  quadrayToCartesian(0, 0, 0, 1),
];

/** Barycentric→Cartesian: project (a,b,c,d) through tetrahedron onto shell */
export function barycentricToCartesian(
  a: number, b: number, c: number, d: number,
  radius = 2.5,
): [number, number, number] {
  const sum = a + b + c + d || 1;
  const na = a / sum, nb = b / sum, nc = c / sum, nd = d / sum;
  let x = na * TETRA_VERTS[0][0] + nb * TETRA_VERTS[1][0] + nc * TETRA_VERTS[2][0] + nd * TETRA_VERTS[3][0];
  let y = na * TETRA_VERTS[0][1] + nb * TETRA_VERTS[1][1] + nc * TETRA_VERTS[2][1] + nd * TETRA_VERTS[3][1];
  let z = na * TETRA_VERTS[0][2] + nb * TETRA_VERTS[1][2] + nc * TETRA_VERTS[2][2] + nd * TETRA_VERTS[3][2];
  const len = Math.sqrt(x * x + y * y + z * z) || 0.001;
  const dominance = Math.max(na, nb, nc, nd);
  const shellFactor = 0.35 + 0.65 * dominance;
  const r = radius * shellFactor;
  return [x / len * r, y / len * r, z / len * r];
}

function makeNode(
  id: number, label: string, axis: string, bus: string,
  bary: [number, number, number, number],
  state: 'active' | 'pending' | 'blocked' | 'complete' = 'active',
  desc = '',
  connections: number[] = [],
): GraphNode {
  const [x, y, z] = barycentricToCartesian(...bary);
  return {
    id: String(id),
    label, axis, bus, bary, state, desc, connections,
    x, y, z,
  };
}

// ── 79-NODE GRAPH ──────────────────────────────────────────────────────────
const NODES: GraphNode[] = [
  // ── AXIS A: IDENTITY / SELF (20 nodes) ────────────────────────────────
  makeNode(0, 'Will Johnson', 'A', 'core', [0.85, 0.05, 0.05, 0.05], 'active', 'Operator · Node Zero · The Soul', [1,2,3,4,20,40]),
  makeNode(1, 'Sebastian (Bash)', 'A', 'family', [0.7, 0.15, 0.1, 0.05], 'active', 'Son · Born 3/10/2016 · First Star', [0,2,3]),
  makeNode(2, 'Willow Marie', 'A', 'family', [0.7, 0.15, 0.1, 0.05], 'active', 'Daughter · Born 8/8/2019 · Second Star', [0,1,3]),
  makeNode(3, 'Christyn', 'A', 'family', [0.5, 0.1, 0.35, 0.05], 'blocked', 'Co-parent · Adversarial litigation', [0,1,2,40,41]),
  makeNode(4, 'The Centaur', 'A', 'core', [0.4, 0.05, 0.05, 0.5], 'active', 'Human-AI symbiosis · Homo Syntheticus', [0,60,61]),
  makeNode(5, 'P31 Labs (Org)', 'A', 'core', [0.35, 0.05, 0.15, 0.45], 'active', '501(c)(3) · Georgia nonprofit · phosphorus31.org', [0,60,61,62]),
  makeNode(6, 'Spoon Bank', 'A', 'cognitive', [0.45, 0.4, 0.05, 0.1], 'active', '12 metabolic units/day · Energy accounting', [0,20,21]),
  makeNode(7, 'AuDHD Identity', 'A', 'cognitive', [0.55, 0.3, 0.05, 0.1], 'active', 'Diagnosed 2025 · Autism + ADHD', [0,6,20,21]),
  makeNode(8, 'DoD Service (Past)', 'A', 'core', [0.5, 0.1, 0.1, 0.3], 'complete', '16yr GS-12 · Kings Bay · Submarine electrician', [0,50]),
  makeNode(9, 'Messenger Kids Logs', 'A', 'family', [0.5, 0.05, 0.4, 0.05], 'active', 'Children initiated all contact · Contradicts McGhan Feb 6', [1,2,3,40]),
  makeNode(10, 'GEICO Policy', 'A', 'family', [0.35, 0.05, 0.55, 0.05], 'active', 'Joint policy · $298.27 · Reinstated 02/12/26', [0,3,50]),
  makeNode(11, 'Ontological Security', 'A', 'core', [0.6, 0.1, 0.1, 0.2], 'active', 'Hardware root of trust · One Device One Self', [0,4,70]),
  makeNode(12, 'Delta Topology', 'A', 'mesh', [0.3, 0.1, 0.1, 0.5], 'active', 'Peer-to-peer · Self-braced · No center', [0,4,11,60]),
  makeNode(13, 'Wye Collapse', 'A', 'mesh', [0.35, 0.15, 0.4, 0.1], 'blocked', 'Floating Neutral · Central institutions failing', [3,40,41]),
  makeNode(14, 'Care Score', 'A', 'family', [0.5, 0.1, 0.15, 0.25], 'active', 'Frequency × Reciprocity × Consistency', [1,2,9]),
  makeNode(15, 'Vault (Medical)', 'A', 'core', [0.3, 0.4, 0.1, 0.2], 'active', 'Envelope encrypted · AES-256-GCM · Tier-gated', [0,20,70]),
  makeNode(16, 'Vault (Legal)', 'A', 'core', [0.3, 0.1, 0.4, 0.2], 'active', 'Court filings · Evidence · Timeline', [0,40,70]),
  makeNode(17, 'Vault (Professional)', 'A', 'core', [0.3, 0.05, 0.1, 0.55], 'active', 'Credentials · GS-12 · Engineering certs', [0,8,70]),
  makeNode(18, 'Bond Protocol', 'A', 'mesh', [0.4, 0.15, 0.15, 0.3], 'active', 'Chemical handshake · K4 tetrahedron config', [1,2,14]),
  makeNode(19, 'Ancestor Node', 'A', 'core', [0.6, 0.15, 0.1, 0.15], 'pending', 'Abdication Protocol · Headless public utility', [0,5,12]),

  // ── AXIS B: HEALTH / BIOLOGY (15 nodes) ───────────────────────────────
  makeNode(20, 'Hypoparathyroidism', 'B', 'medical', [0.1, 0.7, 0.1, 0.1], 'active', 'Since 2003 · Permanent · Calcium regulation', [0,21,22,23]),
  makeNode(21, 'Serum Calcium', 'B', 'medical', [0.05, 0.8, 0.05, 0.1], 'active', 'Target >8.5 mg/dL · Phase noise below 8.0', [20,22]),
  makeNode(22, 'Posner Molecules', 'B', 'quantum', [0.1, 0.55, 0.05, 0.3], 'active', 'Ca₉(PO₄)₆ · Neural qubits · Fisher hypothesis', [20,21,23,65]),
  makeNode(23, 'Larmor Frequency', 'B', 'quantum', [0.05, 0.5, 0.05, 0.4], 'active', '863 Hz · ³¹P in 50μT · Resonant bridge', [22,65,71]),
  makeNode(24, 'SSA Psych Exam', 'B', 'medical', [0.15, 0.55, 0.25, 0.05], 'pending', 'Feb 20 telehealth · Consultative', [0,20,7,42]),
  makeNode(25, 'SSA Medical Exam', 'B', 'medical', [0.15, 0.55, 0.25, 0.05], 'pending', 'Feb 26 Brunswick GA · In-person', [0,20,42]),
  makeNode(26, 'FERS Disability', 'B', 'medical', [0.1, 0.4, 0.15, 0.35], 'pending', '60% high-3 Y1 · 40% Y2+ · $85,362 high-3', [20,50,51]),
  makeNode(27, 'SSDI Application', 'B', 'medical', [0.1, 0.45, 0.2, 0.25], 'pending', 'Mandatory FERS integration · +$1000/mo Y2+', [24,25,26]),
  makeNode(28, 'Lithium (Decoherence)', 'B', 'quantum', [0.05, 0.6, 0.05, 0.3], 'active', '⁷Li vs ⁶Li · Chemical damping · Spin modulator', [22,23]),
  makeNode(29, 'Meltdown Risk', 'B', 'cognitive', [0.2, 0.6, 0.15, 0.05], 'active', '12 spoons = instant bankruptcy · Monitor threshold', [6,7,20]),
  makeNode(30, 'Cognitive Load Dial', 'B', 'cognitive', [0.15, 0.45, 0.05, 0.35], 'active', '0-100% · Maps to Jitterbug θ · PFC prosthetic', [6,7,29,65]),
  makeNode(31, 'Masking Cost', 'B', 'cognitive', [0.2, 0.55, 0.2, 0.05], 'active', '3 spoons per event · Suppressing ND traits', [6,7]),
  makeNode(32, 'Medicaid Coverage', 'B', 'medical', [0.15, 0.5, 0.3, 0.05], 'active', 'Health insurance · Both children covered', [1,2,20]),
  makeNode(33, 'SNAP Benefits', 'B', 'medical', [0.2, 0.5, 0.25, 0.05], 'active', 'Food security · Active', [0,32]),
  makeNode(34, 'Encopresis (Willow)', 'B', 'medical', [0.25, 0.55, 0.15, 0.05], 'active', 'Medical condition · Daughter', [2,20,32]),

  // ── AXIS C: LEGAL / STRUCTURE (20 nodes) ──────────────────────────────
  makeNode(40, 'Johnson v Johnson', 'C', 'court', [0.1, 0.05, 0.8, 0.05], 'active', 'Civil Action 2025CV936 · Camden County', [0,3,41,42]),
  makeNode(41, 'Oct 23 Zombie Order', 'C', 'court', [0.05, 0.05, 0.85, 0.05], 'blocked', 'Void ab initio · East signed post-termination', [40,43,44]),
  makeNode(42, 'March 12 Continuation', 'C', 'court', [0.1, 0.1, 0.75, 0.05], 'pending', 'Chief Judge Scarlett · Superior Court', [40,41]),
  makeNode(43, 'Joseph East (Terminated)', 'C', 'filing', [0.05, 0.05, 0.85, 0.05], 'complete', 'Authority terminated for cause · Oct 20', [41,44]),
  makeNode(44, 'Adams Challenge', 'C', 'court', [0.05, 0.05, 0.85, 0.05], 'active', 'Judge Green · No Order of Designation · O.C.G.A. § 15-1-9.1', [41,45]),
  makeNode(45, 'Judge Green Recusal', 'C', 'court', [0.05, 0.05, 0.85, 0.05], 'pending', 'Pending · Feb 5 order unsigned', [44,42]),
  makeNode(46, 'Supplemental Brief', 'C', 'filing', [0.1, 0.05, 0.8, 0.05], 'complete', 'Filed Feb 9 · Supporting evidence', [40,42]),
  makeNode(47, 'GAL Motion', 'C', 'filing', [0.1, 0.1, 0.75, 0.05], 'complete', 'Filed Feb 9 · Guardian ad litem', [40,1,2]),
  makeNode(48, 'Recusal Motion', 'C', 'filing', [0.1, 0.05, 0.8, 0.05], 'complete', 'Filed Feb 9 · Judge Green', [45]),
  makeNode(49, 'McGhan (Opposing)', 'C', 'court', [0.05, 0.05, 0.85, 0.05], 'blocked', 'Filed despite knowing East terminated', [41,43]),
  makeNode(50, 'TSP Liquidation', 'C', 'finance', [0.1, 0.05, 0.55, 0.3], 'blocked', '$70,793.85 gross · $14,158.37 withheld', [40,51,52]),
  makeNode(51, '10% Penalty Challenge', 'C', 'finance', [0.1, 0.05, 0.6, 0.25], 'active', '26 U.S.C. § 72(t)(2)(C) · RBCO exemption', [50,52]),
  makeNode(52, 'Mortgage Protection', 'C', 'finance', [0.15, 0.05, 0.55, 0.25], 'active', '$182,449 at 3.2% · Asset preservation', [50]),
  makeNode(53, 'Fisher-Escolà Theory', 'C', 'court', [0.1, 0.3, 0.45, 0.15], 'active', 'Strict liability · Biological decoherence · Novel theory', [20,40,22]),
  makeNode(54, 'OQE Protocol', 'C', 'court', [0.1, 0.05, 0.55, 0.3], 'active', 'Objective Quality Evidence · Submarine engineering method', [8,40]),
  makeNode(55, 'HCB Fiscal Sponsor', 'C', 'filing', [0.15, 0.05, 0.45, 0.35], 'pending', 'Applied · P31 Labs fiscal sponsorship', [5,40]),
  makeNode(56, 'Feb 9 Filing Batch', 'C', 'filing', [0.1, 0.05, 0.8, 0.05], 'complete', 'Supplemental briefs + GAL + Recusal', [46,47,48]),
  makeNode(57, 'East Consent Timeline', 'C', 'court', [0.05, 0.05, 0.85, 0.05], 'active', 'Signed consent AFTER withdrawal', [41,43,50]),
  makeNode(58, 'Iron Dome Defense', 'C', 'court', [0.1, 0.1, 0.65, 0.15], 'active', 'Multi-layer legal shield · Forensic data science', [40,54]),
  makeNode(59, 'GS-12 Income Loss', 'C', 'finance', [0.15, 0.1, 0.55, 0.2], 'blocked', '$74,627/yr → $0 · Sept 2025 cessation', [8,26,50]),

  // ── AXIS D: TECHNICAL / BUILD (24 nodes) ──────────────────────────────
  makeNode(60, 'Phenix Navigator', 'D', 'hardware', [0.1, 0.1, 0.05, 0.75], 'active', 'Class II medical device · ESP32-S3 · LoRa', [0,4,61,62,70]),
  makeNode(61, 'Node One', 'D', 'hardware', [0.05, 0.05, 0.05, 0.85], 'active', 'Primary hardware module · Thick Click', [60,62]),
  makeNode(62, 'The Buffer', 'D', 'software', [0.1, 0.1, 0.05, 0.75], 'active', 'Software layer · Cognitive shield application', [60,61,63]),
  makeNode(63, 'Whale Channel', 'D', 'software', [0.1, 0.05, 0.05, 0.8], 'pending', 'Communication protocol · Mesh network', [62,64]),
  makeNode(64, 'Thick Click', 'D', 'hardware', [0.05, 0.15, 0.05, 0.75], 'active', 'Mechanical switch · Reduces cognitive load', [60,61]),
  makeNode(65, 'Cognitive Shield', 'D', 'software', [0.1, 0.25, 0.05, 0.6], 'active', 'SIC-POVM QKD · Quantum-secure comms', [22,23,62]),
  makeNode(66, 'Samson V2 Controller', 'D', 'software', [0.05, 0.2, 0.05, 0.7], 'active', 'PID loop · Mark 1 Attractor H≈0.35', [30,62,65]),
  makeNode(67, 'Ping', 'D', 'software', [0.15, 0.1, 0.05, 0.7], 'pending', 'State broadcast · Ephemeral metabolic pulse', [60,63]),
  makeNode(68, 'ESP32-S3 Firmware', 'D', 'hardware', [0.05, 0.05, 0.05, 0.85], 'active', 'C/C++ · ESP-IDF · Real-time processing', [60,61]),
  makeNode(69, 'LoRa Meshtastic', 'D', 'infrastructure', [0.1, 0.05, 0.05, 0.8], 'active', 'Off-grid sovereignty · Delta mesh', [60,63,12]),
  makeNode(70, 'NXP SE050', 'D', 'hardware', [0.1, 0.05, 0.05, 0.8], 'active', 'EAL 6+ secure element · ECDSA P-256', [11,60,15]),
  makeNode(71, 'Trimtab Encoder', 'D', 'hardware', [0.05, 0.2, 0.05, 0.7], 'active', 'Rotary encoder · Larmor frequency tuning', [23,60,64]),
  makeNode(72, 'State Packet (32-bit)', 'D', 'infrastructure', [0.05, 0.1, 0.05, 0.8], 'active', 'Version|Type|Urgency|Valence|Load|Voltage', [67,68]),
  makeNode(73, 'Geodesic Brain UI', 'D', 'software', [0.1, 0.15, 0.05, 0.7], 'active', 'Three.js r128 · InstancedMesh · <100 draw calls', [62,65,66]),
  makeNode(74, 'Google Apps Script', 'D', 'software', [0.1, 0.15, 0.1, 0.65], 'active', 'Spoon_Bank · updateSpoonBank() · Router.gs', [6,29]),
  makeNode(75, 'phosphorus31.org', 'D', 'infrastructure', [0.15, 0.05, 0.1, 0.7], 'active', 'Live site · P31 Labs presence', [5,60]),
  makeNode(76, 'SIC-POVM Protocol', 'D', 'quantum', [0.05, 0.15, 0.05, 0.75], 'active', 'Tetrahedral measurement · 4 states on Bloch sphere', [65,22]),
  makeNode(77, 'Jitterbug Engine', 'D', 'software', [0.05, 0.1, 0.05, 0.8], 'active', 's(θ)=2cos(θ−π/3) · Parametric transformation', [66,73]),
  makeNode(78, 'Mark 1 Attractor', 'D', 'quantum', [0.1, 0.2, 0.05, 0.65], 'active', 'ε^(H≈0.35) · Sweet spot of complexity', [66,77]),
];

/** Build edges from node connections arrays */
function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const conns = node.connections ?? [];
    for (const targetIdx of conns) {
      const targetNode = nodes.find((n) => n.id === String(targetIdx));
      if (!targetNode) continue;
      const key = [node.id, targetNode.id].sort().join('_');
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ source: node.id, target: targetNode.id, type: 'related_to' });
      }
    }
  }
  return edges;
}

/** Jitter co-located nodes so they don't overlap */
function applyJitter(nodes: GraphNode[]): GraphNode[] {
  const eps = 0.15;
  const positions = nodes.map((n) => [n.x ?? 0, n.y ?? 0, n.z ?? 0]);

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i][0] - positions[j][0];
      const dy = positions[i][1] - positions[j][1];
      const dz = positions[i][2] - positions[j][2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < eps) {
        const angle = (i * 137.508 * Math.PI) / 180; // golden angle
        const r = eps * 0.6;
        positions[j][0] += r * Math.cos(angle);
        positions[j][1] += r * Math.sin(angle);
        positions[j][2] += r * Math.sin(angle * 0.7);
      }
    }
  }

  return nodes.map((n, i) => ({
    ...n,
    x: positions[i][0],
    y: positions[i][1],
    z: positions[i][2],
  }));
}

/** Create the full 79-node P31 graph */
export function createFullGraph(): Graph {
  const jitteredNodes = applyJitter(NODES);
  return {
    nodes: jitteredNodes,
    edges: buildEdges(jitteredNodes),
  };
}

export const AXIS_COLORS: Record<string, string> = {
  A: '#ff6b6b',
  B: '#4ecdc4',
  C: '#ffe66d',
  D: '#a29bfe',
};

export const AXIS_NAMES: Record<string, string> = {
  A: 'Identity',
  B: 'Health',
  C: 'Legal',
  D: 'Technical',
};

export const STATE_COLORS: Record<string, string> = {
  active: '#2dffa0',
  pending: '#ffd93d',
  blocked: '#ff5252',
  complete: '#6a7a8a',
};

export const GRAPH_NODES = NODES;
