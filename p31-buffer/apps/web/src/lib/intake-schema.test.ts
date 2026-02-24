import { describe, it, expect } from 'vitest';
import { INTAKE_SCHEMA } from './intake-schema';

describe('INTAKE_SCHEMA', () => {
  it('has 4 sections (one per axis)', () => {
    expect(INTAKE_SCHEMA.sections).toHaveLength(4);
  });

  it('sections map to axes A, B, C, D', () => {
    const axes = INTAKE_SCHEMA.sections.map(s => s.axis);
    expect(axes).toEqual(['A', 'B', 'C', 'D']);
  });

  it('every field has a unique id', () => {
    const allIds = INTAKE_SCHEMA.sections.flatMap(s => s.fields.map(f => f.id));
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it('every field has a valid type', () => {
    const validTypes = ['text', 'email', 'select', 'multi_select', 'scale', 'boolean', 'textarea', 'date'];
    const allFields = INTAKE_SCHEMA.sections.flatMap(s => s.fields);
    for (const field of allFields) {
      expect(validTypes).toContain(field.type);
    }
  });

  it('select and multi_select fields have options', () => {
    const allFields = INTAKE_SCHEMA.sections.flatMap(s => s.fields);
    const selectFields = allFields.filter(f => f.type === 'select' || f.type === 'multi_select');
    for (const field of selectFields) {
      expect(field.options).toBeDefined();
      expect(field.options!.length).toBeGreaterThan(0);
    }
  });

  it('scale fields have min and max', () => {
    const allFields = INTAKE_SCHEMA.sections.flatMap(s => s.fields);
    const scaleFields = allFields.filter(f => f.type === 'scale');
    for (const field of scaleFields) {
      expect(field.min).toBeDefined();
      expect(field.max).toBeDefined();
      expect(field.max!).toBeGreaterThan(field.min!);
    }
  });

  it('all voltageWeight values are between 0 and 1', () => {
    const allFields = INTAKE_SCHEMA.sections.flatMap(s => s.fields);
    for (const field of allFields) {
      expect(field.voltageWeight).toBeGreaterThanOrEqual(0);
      expect(field.voltageWeight).toBeLessThanOrEqual(1);
    }
  });

  it('has at least one required field per section', () => {
    for (const section of INTAKE_SCHEMA.sections) {
      const requiredCount = section.fields.filter(f => f.required).length;
      expect(requiredCount).toBeGreaterThan(0);
    }
  });
});
