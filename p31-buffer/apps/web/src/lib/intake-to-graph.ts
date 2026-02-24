import type { GraphNode, Axis, P31Graph } from '@p31-buffer/graph-schema';
import { INTAKE_SCHEMA, type IntakeField, type IntakeSection } from './intake-schema';

export function fieldToNode(
  field: IntakeField,
  section: IntakeSection,
  value: unknown,
  index: number,
): GraphNode | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;

  const voltage = computeFieldVoltage(field, value);
  const bary = axisWeightedBary(section.axis, index, section.fields.length);

  return {
    id: `intake:${field.id}`,
    label: field.label,
    axis: section.axis,
    state: 'active',
    bary,
    voltage: {
      urgency: voltage,
      emotional: field.voltageWeight > 0.3 ? voltage * 0.8 : 0,
      cognitive: field.type === 'textarea' ? 0.3 : 0.1,
    },
    metadata: {
      source: 'intake',
      fieldId: field.id,
      fieldType: field.type,
      answeredAt: Date.now(),
    },
    connections: [],
  } as GraphNode;
}

export function intakeToGraph(data: Record<string, unknown>): P31Graph {
  const nodes: GraphNode[] = [];
  const edges: { source: string; target: string; weight: number }[] = [];

  for (const section of INTAKE_SCHEMA.sections) {
    const sectionNodes: GraphNode[] = [];

    for (let i = 0; i < section.fields.length; i++) {
      const field = section.fields[i];
      const value = data[field.id];
      const node = fieldToNode(field, section, value, i);
      if (node) {
        nodes.push(node);
        sectionNodes.push(node);
      }
    }

    for (let i = 1; i < sectionNodes.length; i++) {
      edges.push({
        source: sectionNodes[i - 1].id,
        target: sectionNodes[i].id,
        weight: 0.5,
      });
    }
  }

  const crossLinks: [string, string][] = [
    ['intake:neurotype', 'intake:energy_baseline'],
    ['intake:energy_baseline', 'intake:stressors'],
    ['intake:stressors', 'intake:support_level'],
    ['intake:tech_comfort', 'intake:sensory_prefs'],
    ['intake:neurotype', 'intake:sensory_prefs'],
    ['intake:sleep_quality', 'intake:energy_baseline'],
    ['intake:safe_space', 'intake:support_level'],
  ];

  for (const [src, tgt] of crossLinks) {
    if (nodes.some(n => n.id === src) && nodes.some(n => n.id === tgt)) {
      edges.push({ source: src, target: tgt, weight: 0.3 });
    }
  }

  return { nodes, edges } as P31Graph;
}

function computeFieldVoltage(field: IntakeField, value: unknown): number {
  const weight = field.voltageWeight;
  if (weight === 0) return 0;
  let raw = 0;

  switch (field.type) {
    case 'scale': {
      const min = field.min ?? 1;
      const max = field.max ?? 10;
      const normalized = (Number(value) - min) / (max - min);
      raw = field.invertVoltage ? 1 - normalized : normalized;
      break;
    }
    case 'boolean':
      raw = field.invertVoltage ? (value ? 0 : 1) : (value ? 1 : 0);
      break;
    case 'multi_select': {
      const count = Array.isArray(value) ? value.length : 0;
      const maxOptions = field.options?.length ?? 1;
      raw = count / maxOptions;
      if (Array.isArray(value) && value.includes('None currently')) raw = 0;
      if (Array.isArray(value) && value.includes('Neurotypical')) raw = 0;
      break;
    }
    case 'select': {
      const idx = field.options?.indexOf(value as string) ?? 0;
      const max = Math.max((field.options?.length ?? 1) - 1, 0);
      raw = max > 0 ? idx / max : 0;
      if (field.invertVoltage) raw = 1 - raw;
      break;
    }
    case 'textarea':
      raw = Math.min(String(value).length / 500, 1);
      break;
    default:
      raw = 0.1;
  }
  return Math.min(raw * weight * 10, 10);
}

function axisWeightedBary(axis: Axis, fieldIndex: number, fieldCount: number): [number, number, number, number] {
  const primary = 0.6 + (fieldIndex / Math.max(fieldCount - 1, 1)) * 0.15;
  const secondary = (1 - primary) / 3;
  const jitter = () => secondary + (Math.random() - 0.5) * 0.05;
  switch (axis) {
    case 'A': return [primary, jitter(), jitter(), jitter()];
    case 'B': return [jitter(), primary, jitter(), jitter()];
    case 'C': return [jitter(), jitter(), primary, jitter()];
    case 'D': return [jitter(), jitter(), jitter(), primary];
    default: return [0.25, 0.25, 0.25, 0.25];
  }
}

export interface Calibration {
  initialSpoons: number;
  suggestedOS: string;
  initialEntropy: number;
  sensoryPrefs: string[];
  displayName: string;
  pronouns: string | null;
}

export function extractCalibration(data: Record<string, unknown>): Calibration {
  return {
    initialSpoons: data.energy_baseline != null ? Number(data.energy_baseline) : 8,
    suggestedOS: inferGenSync(data.comm_preference as string | undefined, data.tech_comfort as number | undefined),
    initialEntropy: estimateEntropy(data),
    sensoryPrefs: (data.sensory_prefs as string[]) || [],
    displayName: (data.name as string) || 'Operator',
    pronouns: (data.pronouns as string) ?? null,
  };
}

function inferGenSync(commPref?: string, techComfort?: number): string {
  if (techComfort != null && techComfort >= 8) return 'TECHNICAL';
  if (commPref === 'Text/chat (async)') return 'TECHNICAL';
  if (commPref === 'Voice call' || commPref === 'Video call') return 'EMPATHIC';
  if (commPref === 'Email (formal async)') return 'EXECUTIVE';
  return 'PLAIN';
}

function estimateEntropy(data: Record<string, unknown>): number {
  let entropy = 0.2;
  const stressors = data.stressors;
  if (Array.isArray(stressors)) {
    if (stressors.includes('None currently')) return 0.15;
    entropy += stressors.length * 0.08;
  }
  if (typeof data.support_level === 'number' && data.support_level < 5) {
    entropy += (5 - data.support_level) * 0.05;
  }
  if (typeof data.sleep_quality === 'number' && data.sleep_quality < 5) {
    entropy += (5 - data.sleep_quality) * 0.04;
  }
  return Math.min(entropy, 1);
}
