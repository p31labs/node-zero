/**
 * Stub types for @p31-buffer/graph-schema when the package is not yet built.
 * Replace with the real package when packages/graph-schema exists.
 */
declare module '@p31-buffer/graph-schema' {
  export type Axis = 'A' | 'B' | 'C' | 'D';

  export interface GraphNode {
    id: string;
    label: string;
    axis: Axis;
    state: string;
    bary: [number, number, number, number];
    voltage: { urgency: number; emotional: number; cognitive: number };
    metadata?: Record<string, unknown>;
    connections?: string[];
  }

  export interface P31Graph {
    nodes: GraphNode[];
    edges: Array<{ source: string; target: string; weight: number }>;
  }
}
