import { useMemo } from 'react';
import { INTAKE_SCHEMA, type IntakeField } from '../lib/intake-schema';
import { COLORS, FONTS, SPACE, BORDER, PATTERNS } from '../lib/design-tokens';

interface IntakeFormProps {
  data: Record<string, unknown>;
  onUpdate: (fieldId: string, value: unknown) => void;
  onFinish: () => void;
}

function FieldInput({ field, value, onChange }: { field: IntakeField; value: unknown; onChange: (v: unknown) => void }) {
  const inputStyle = { ...PATTERNS.input, marginTop: SPACE[1] };
  if (field.type === 'scale') {
    const min = field.min ?? 1;
    const max = field.max ?? 10;
    const num = value !== undefined && value !== '' ? Number(value) : min;
    return (
      <div style={{ marginTop: SPACE[2] }}>
        <input type="range" min={min} max={max} value={num} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: COLORS.accent.primary }} />
        <span style={{ fontSize: FONTS.size.xs, color: COLORS.text.dim, marginLeft: SPACE[2] }}>{num} {field.unit ?? ''}</span>
      </div>
    );
  }
  if (field.type === 'boolean') {
    return (
      <div style={{ marginTop: SPACE[2], display: 'flex', gap: SPACE[2], alignItems: 'center' }}>
        <button type="button" onClick={() => onChange(true)} style={{ ...PATTERNS.filterButton, ...(value === true ? PATTERNS.filterButtonActive : {}) }}>Yes</button>
        <button type="button" onClick={() => onChange(false)} style={{ ...PATTERNS.filterButton, ...(value === false ? PATTERNS.filterButtonActive : {}) }}>No</button>
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value || undefined)} style={inputStyle}>
        <option value="">—</option>
        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'multi_select') {
    const selected = Array.isArray(value) ? value as string[] : [];
    const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);
    return (
      <div style={{ marginTop: SPACE[2], display: 'flex', flexWrap: 'wrap', gap: SPACE[1] }}>
        {(field.options ?? []).map(opt => (
          <button type="button" key={opt} onClick={() => toggle(opt)} style={{ ...PATTERNS.filterButton, ...(selected.includes(opt) ? PATTERNS.filterButtonActive : {}) }}>{opt}</button>
        ))}
      </div>
    );
  }
  if (field.type === 'textarea') {
    return <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value || undefined)} placeholder={field.placeholder} rows={field.rows ?? 3} style={{ ...inputStyle, minHeight: 60 }} />;
  }
  return <input type={field.type === 'email' ? 'email' : 'text'} value={String(value ?? '')} onChange={e => onChange(e.target.value || undefined)} placeholder={field.placeholder} style={inputStyle} />;
}

export function IntakeForm({ data, onUpdate, onFinish }: IntakeFormProps) {
  const sections = useMemo(() => INTAKE_SCHEMA.sections, []);
  return (
    <div style={{ minHeight: '100vh', padding: SPACE[6], fontFamily: FONTS.mono, background: COLORS.bg.deep, color: COLORS.text.primary }}>
      <div style={{ ...PATTERNS.sectionLabel, marginBottom: SPACE[6], fontSize: FONTS.size.lg }}>{INTAKE_SCHEMA.title}</div>
      <p style={{ fontSize: FONTS.size.sm, color: COLORS.text.secondary, marginBottom: SPACE[6] }}>{INTAKE_SCHEMA.description}</p>
      {sections.map(section => (
        <div key={section.id} style={{ marginBottom: SPACE[8], paddingBottom: SPACE[6], borderBottom: `${BORDER.width.thin} solid ${COLORS.bg.border}` }}>
          <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, letterSpacing: FONTS.tracking.wider, color: (COLORS.axis as Record<string, string>)[section.axis] ?? COLORS.text.primary, marginBottom: SPACE[4] }}>{section.icon} {section.label}</div>
          {section.fields.map(field => (
            <div key={field.id} style={{ marginBottom: SPACE[4] }}>
              <label style={{ fontSize: FONTS.size.sm, color: COLORS.text.primary, display: 'block' }}>{field.label}{field.required && <span style={{ color: COLORS.state.red }}> *</span>}</label>
              {field.help && <div style={{ fontSize: FONTS.size.xs, color: COLORS.text.dim, marginTop: SPACE[0.5] }}>{field.help}</div>}
              <FieldInput field={field} value={data[field.id]} onChange={v => onUpdate(field.id, v)} />
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={onFinish} style={{ ...PATTERNS.filterButton, ...PATTERNS.filterButtonActive, padding: `${SPACE[3]} ${SPACE[6]}`, fontSize: FONTS.size.sm, marginTop: SPACE[4] }}>REVIEW & FINALIZE</button>
    </div>
  );
}
