import { describe, it, expect } from 'vitest';
import { createSeedGraph, addNodeToGraph } from './intake-to-graph';
import type { GraphNode } from '../types/graph';

describe('createSeedGraph', () => {
  it('returns 18 seed nodes with positions', () => {
    const graph = createSeedGraph();
    expect(graph.nodes).toHaveLength(18);
    expect(graph.edges.length).toBeGreaterThan(0);
    graph.nodes.forEach((n) => {
      expect(n.id).toBeDefined();
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(typeof n.z).toBe('number');
    });
  });

  it('includes operator and product nodes', () => {
    const graph = createSeedGraph();
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toContain('operator');
    expect(ids).toContain('buffer');
    expect(ids).toContain('spoons');
  });

  it('edges have type and weight', () => {
    const graph = createSeedGraph();
    graph.edges.forEach((e) => {
      expect(e.source).toBeDefined();
      expect(e.target).toBeDefined();
      expect(e.type).toBeDefined();
      expect(typeof e.weight).toBe('number');
    });
  });
});

describe('addNodeToGraph', () => {
  it('appends node and optionally adds edge to connectTo', () => {
    const graph = createSeedGraph();
    const newNode: GraphNode = { id: 'new-node', label: 'New', group: 'state' };
    const withNode = addNodeToGraph(graph, newNode, 'operator');
    expect(withNode.nodes).toHaveLength(graph.nodes.length + 1);
    expect(withNode.nodes.some((n) => n.id === 'new-node')).toBe(true);
    expect(withNode.edges.some((e) => e.source === 'new-node' && e.target === 'operator')).toBe(true);
  });

  it('appends node without edge when connectTo omitted', () => {
    const graph = createSeedGraph();
    const newNode: GraphNode = { id: 'orphan', label: 'Orphan', group: 'product' };
    const withNode = addNodeToGraph(graph, newNode);
    expect(withNode.nodes).toHaveLength(graph.nodes.length + 1);
    expect(withNode.edges.filter((e) => e.source === 'orphan' || e.target === 'orphan')).toHaveLength(0);
  });
});
