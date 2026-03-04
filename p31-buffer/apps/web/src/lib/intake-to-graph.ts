import type { Graph, GraphNode, GraphEdge } from '../types/graph';

/**
 * Seed positions: 12 jitterbug vertices at t≈0.85 (SCALE 0.7).
 * Nodes without coords get assigned by index to spread across vertices.
 */
const SEED_POSITIONS: [number, number, number][] = [
  [0.7, 0.7, 0],
  [0.7, -0.7, 0],
  [-0.7, 0.7, 0],
  [-0.7, -0.7, 0],
  [0.7, 0, 0.7],
  [0.7, 0, -0.7],
  [-0.7, 0, 0.7],
  [-0.7, 0, -0.7],
  [0, 0.7, 0.7],
  [0, 0.7, -0.7],
  [0, -0.7, 0.7],
  [0, -0.7, -0.7],
];

const SEED_NODES: GraphNode[] = [
  { id: 'operator', label: 'You', group: 'identity' },
  { id: 'buffer', label: 'The Buffer', group: 'product' },
  { id: 'scope', label: 'The Scope', group: 'product' },
  { id: 'fold', label: 'The Fold', group: 'product' },
  { id: 'node-one', label: 'Node One', group: 'product' },
  { id: 'centaur', label: 'The Centaur', group: 'product' },
  { id: 'sprout', label: 'Sprout', group: 'product' },
  { id: 'spoons', label: 'Energy', group: 'state' },
  { id: 'voltage', label: 'Voltage', group: 'state' },
  { id: 'samson', label: 'SAMSON', group: 'state' },
  { id: 'breathing', label: 'Breathing', group: 'state' },
  { id: 'love', label: 'L.O.V.E.', group: 'economy' },
  { id: 'wallet', label: 'Wallet', group: 'economy' },
  { id: 'bash', label: 'S.J.', group: 'family' },
  { id: 'willow', label: 'W.J.', group: 'family' },
  { id: 'mesh', label: 'The Mesh', group: 'network' },
  { id: 'posner', label: 'Posner Molecule', group: 'science' },
  { id: 'larmor', label: '863 Hz', group: 'science' },
];

const SEED_EDGES: GraphEdge[] = [
  { source: 'operator', target: 'buffer', type: 'uses' },
  { source: 'operator', target: 'scope', type: 'monitors' },
  { source: 'operator', target: 'fold', type: 'writes' },
  { source: 'operator', target: 'centaur', type: 'collaborates' },
  { source: 'operator', target: 'spoons', type: 'has' },
  { source: 'operator', target: 'breathing', type: 'practices' },
  { source: 'spoons', target: 'samson', type: 'feeds' },
  { source: 'samson', target: 'voltage', type: 'governs' },
  { source: 'breathing', target: 'spoons', type: 'recovers' },
  { source: 'voltage', target: 'buffer', type: 'gates' },
  { source: 'love', target: 'wallet', type: 'stores' },
  { source: 'operator', target: 'love', type: 'earns' },
  { source: 'operator', target: 'bash', type: 'parent' },
  { source: 'operator', target: 'willow', type: 'parent' },
  { source: 'bash', target: 'sprout', type: 'uses' },
  { source: 'willow', target: 'sprout', type: 'uses' },
  { source: 'mesh', target: 'node-one', type: 'hardware' },
  { source: 'mesh', target: 'posner', type: 'models' },
  { source: 'posner', target: 'larmor', type: 'resonates' },
  { source: 'node-one', target: 'operator', type: 'assists' },
];

function withPositions(nodes: GraphNode[]): GraphNode[] {
  return nodes.map((n, i) => {
    const [vx, vy, vz] = SEED_POSITIONS[i % 12];
    const offset = Math.floor(i / 12) * 0.08;
    return {
      ...n,
      x: n.x ?? vx + offset * (i % 3 === 0 ? 1 : 0),
      y: n.y ?? vy + offset * (i % 3 === 1 ? 1 : 0),
      z: n.z ?? vz,
    };
  });
}

export function createSeedGraph(): Graph {
  return {
    nodes: withPositions([...SEED_NODES]),
    edges: SEED_EDGES.map((e) => ({ ...e, type: e.type ?? 'related_to', weight: e.weight ?? 1 })),
  };
}

export function addNodeToGraph(graph: Graph, node: GraphNode, connectTo?: string): Graph {
  const nodes = [...graph.nodes, node];
  const edges = connectTo
    ? [...graph.edges, { source: node.id, target: connectTo, type: 'related_to' }]
    : [...graph.edges];
  return { nodes, edges };
}
