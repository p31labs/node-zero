/**
 * P31 Graph Schema — Standalone type definitions
 * Replaces @p31-buffer/graph-schema for apps/web builds
 */

export type Axis = 'A' | 'B' | 'C' | 'D';
export type NodeState = 'active' | 'pending' | 'blocked' | 'complete' | 'disputed' | 'critical';
export type EdgeType =
  | 'depends_on' | 'contradicts' | 'supports' | 'caused_by'
  | 'related_to' | 'blocks' | 'funds' | 'parent_of' | 'bond';

export interface Voltage {
  urgency: number;    // 0–10
  emotional: number;  // 0–10
  cognitive: number;  // 0–10
  composite: number;  // weighted sum
}

export interface Source {
  type: string;
  ref: string;
  date?: string;
  hash?: string;
}

export interface Dispute {
  claim: string;
  counter: string;
  resolution: string;
}

export interface Evidence {
  verified: boolean;
  confidence: number;
  sources: Source[];
  disputes: Dispute[];
  last_verified?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  axis: Axis;
  bus: string;
  bary: [number, number, number, number]; // a+b+c+d ≈ 1.0
  state: NodeState;
  desc: string;
  connections: string[];
  voltage: Voltage;
  evidence: Evidence;
  metadata?: Record<string, unknown>;
  timestamps?: {
    created?: string;
    modified?: string;
    due?: string;
    occurred?: string;
  };
  spoon_cost: number;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  label: string;
  evidence: string;
}

export interface GraphMeta {
  operator: string;
  generated_at: string;
  source_count: number;
  verified_count: number;
  unverified_count: number;
  disputed_count: number;
  cognitive_load: number;
  last_sync: string;
  entropy_score: number;
}

export interface P31Graph {
  version: string;
  meta: GraphMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
