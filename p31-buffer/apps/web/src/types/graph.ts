/**
 * IVM graph types — used by renderer and intake pipeline.
 * All keys p31: prefixed in storage; no message text stored.
 */
export interface GraphEdge {
  source: string;
  target: string;
  type?: string;
  weight?: number;
}

export interface GraphNode {
  id: string;
  label?: string;
  group?: string;
  /** Axis: A=Identity, B=Health, C=Legal, D=Technical */
  axis?: string;
  /** Bus/subsystem category */
  bus?: string;
  /** Barycentric coordinates [a, b, c, d] in tetrahedral space */
  bary?: [number, number, number, number];
  /** Node state */
  state?: 'active' | 'pending' | 'blocked' | 'complete';
  /** Description text */
  desc?: string;
  /** Connection target indices (numeric IDs) */
  connections?: number[];
  x?: number;
  y?: number;
  z?: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
