import { describe, it, expect } from 'vitest';
import { fieldToNode, intakeToGraph, extractCalibration } from './intake-to-graph';
import { type IntakeField, type IntakeSection } from './intake-schema';

describe('fieldToNode', () => {
  const mockSection: IntakeSection = {
    id: 'mock_section',
    axis: 'A',
    label: 'Mock Section',
    icon: '◆',
    fields: [],
  };

  const mockField: IntakeField = {
    id: 'mock_field',
    type: 'text',
    label: 'Mock Field',
    required: true,
    voltageWeight: 0.5,
  };

  it('returns null for empty string value', () => {
    expect(fieldToNode(mockField, mockSection, '', 0)).toBeNull();
  });

  it('returns null for undefined value', () => {
    expect(fieldToNode(mockField, mockSection, undefined, 0)).toBeNull();
  });

  it('returns null for empty array value', () => {
    expect(fieldToNode(mockField, mockSection, [], 0)).toBeNull();
  });

  it('creates a node with correct axis from section', () => {
    const sectionA: IntakeSection = { ...mockSection, axis: 'A' };
    const sectionB: IntakeSection = { ...mockSection, axis: 'B' };
    const nodeA = fieldToNode({ ...mockField, id: 'fieldA' }, sectionA, 'value', 0);
    const nodeB = fieldToNode({ ...mockField, id: 'fieldB' }, sectionB, 'value', 0);
    expect(nodeA?.axis).toBe('A');
    expect(nodeB?.axis).toBe('B');
  });

  it('creates a node with id prefixed by intake:', () => {
    const node = fieldToNode({ ...mockField, id: 'name' }, mockSection, 'value', 0);
    expect(node?.id).toBe('intake:name');
  });

  it('computes voltage from scale field (non-inverted)', () => {
    const scaleField: IntakeField = { ...mockField, type: 'scale', min: 1, max: 10, voltageWeight: 0.5, invertVoltage: false };
    const nodeHigh = fieldToNode(scaleField, mockSection, 10, 0);
    const nodeLow = fieldToNode(scaleField, mockSection, 1, 0);
    expect(nodeHigh!.voltage.urgency).toBeGreaterThan(nodeLow!.voltage.urgency);
  });

  it('computes inverted voltage from scale field', () => {
    const scaleField: IntakeField = { ...mockField, type: 'scale', min: 1, max: 12, voltageWeight: 0.5, invertVoltage: true };
    const nodeHigh = fieldToNode(scaleField, mockSection, 1, 0);
    const nodeLow = fieldToNode(scaleField, mockSection, 12, 0);
    expect(nodeHigh!.voltage.urgency).toBeGreaterThan(nodeLow!.voltage.urgency);
  });

  it('computes voltage from multi_select by count', () => {
    const multiSelectField: IntakeField = { ...mockField, type: 'multi_select', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], voltageWeight: 0.8 };
    const node = fieldToNode(multiSelectField, mockSection, ['Financial', 'Legal', 'Medical'], 0);
    expect(node!.voltage.urgency).toBeCloseTo(3 / 10 * 0.8 * 10);
  });

  it('computes voltage from boolean field', () => {
    const booleanField: IntakeField = { ...mockField, type: 'boolean', invertVoltage: true };
    const nodeLow = fieldToNode(booleanField, mockSection, true, 0);
    const nodeHigh = fieldToNode(booleanField, mockSection, false, 0);
    expect(nodeHigh!.voltage.urgency).toBeGreaterThan(nodeLow!.voltage.urgency);
  });

  it('assigns barycentric coordinates weighted toward field axis', () => {
    const nodeA = fieldToNode(mockField, { ...mockSection, axis: 'A' }, 'value', 0);
    const nodeC = fieldToNode(mockField, { ...mockSection, axis: 'C' }, 'value', 0);
    expect(nodeA!.bary[0]).toBeGreaterThan(nodeA!.bary[1]);
    expect(nodeC!.bary[2]).toBeGreaterThan(nodeC!.bary[0]);
    expect(nodeA!.bary.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });
});

describe('intakeToGraph', () => {
  it('returns empty graph for empty data', () => {
    const graph = intakeToGraph({});
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('creates nodes only for answered fields', () => {
    const data = { name: 'Will', energy_baseline: 8 };
    const graph = intakeToGraph(data);
    expect(graph.nodes.length).toBe(2);
    expect(graph.nodes.map(n => n.id)).toContain('intake:name');
    expect(graph.nodes.map(n => n.id)).toContain('intake:energy_baseline');
  });

  it('creates intra-section edges between consecutive answered fields', () => {
    const data = { energy_baseline: 8, sleep_quality: 7, medications: true };
    const graph = intakeToGraph(data);
    const healthEdges = graph.edges.filter(e =>
      e.source.startsWith('intake:energy') || e.source.startsWith('intake:sleep')
    );
    expect(healthEdges.length).toBeGreaterThan(0);
  });

  it('creates cross-axis edges when both endpoints exist', () => {
    const data = { neurotype: ['ADHD'], energy_baseline: 6 };
    const graph = intakeToGraph(data);
    const crossEdge = graph.edges.find(e =>
      e.source === 'intake:neurotype' && e.target === 'intake:energy_baseline'
    );
    expect(crossEdge).toBeDefined();
  });

  it('does NOT create cross-axis edges when one endpoint is missing', () => {
    const data = { neurotype: ['ADHD'] }; // no energy_baseline
    const graph = intakeToGraph(data);
    const crossEdge = graph.edges.find(e =>
      e.source === 'intake:neurotype' && e.target === 'intake:energy_baseline'
    );
    expect(crossEdge).toBeUndefined();
  });
});

describe('extractCalibration', () => {
  it('defaults to 8 spoons when energy_baseline not provided', () => {
    const cal = extractCalibration({});
    expect(cal.initialSpoons).toBe(8);
  });

  it('uses energy_baseline as initial spoons', () => {
    const cal = extractCalibration({ energy_baseline: 5 });
    expect(cal.initialSpoons).toBe(5);
  });

  it('infers TECHNICAL genSync for high tech_comfort', () => {
    const cal = extractCalibration({ tech_comfort: 9 });
    expect(cal.suggestedOS).toBe('TECHNICAL');
  });

  it('infers EMPATHIC genSync for voice/video preference', () => {
    const cal = extractCalibration({ comm_preference: 'Voice call' });
    expect(cal.suggestedOS).toBe('EMPATHIC');
  });

  it('infers EXECUTIVE genSync for email preference', () => {
    const cal = extractCalibration({ comm_preference: 'Email (formal async)' });
    expect(cal.suggestedOS).toBe('EXECUTIVE');
  });

  it('infers PLAIN genSync as default', () => {
    const cal = extractCalibration({});
    expect(cal.suggestedOS).toBe('PLAIN');
  });

  it('computes higher entropy for more stressors', () => {
    const low = extractCalibration({ stressors: ['Financial'] });
    const high = extractCalibration({ stressors: ['Financial', 'Legal', 'Medical', 'Housing', 'Childcare'] });
    expect(high.initialEntropy).toBeGreaterThan(low.initialEntropy);
  });

  it('computes near-zero entropy for "None currently"', () => {
    const cal = extractCalibration({ stressors: ['None currently'] });
    expect(cal.initialEntropy).toBeLessThanOrEqual(0.2);
  });

  it('extracts display name or defaults to Operator', () => {
    expect(extractCalibration({ name: 'Will' }).displayName).toBe('Will');
    expect(extractCalibration({}).displayName).toBe('Operator');
  });
});
