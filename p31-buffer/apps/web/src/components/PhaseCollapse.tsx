import { COLORS, FONTS, SPACE, BORDER, PATTERNS } from '../lib/design-tokens';
import { INTAKE_SCHEMA } from '../lib/intake-schema';

interface PhaseCollapseProps {
  intakeData: Record<string, unknown>;
  walletAddress: string | null;
  onSignAndFinalize: () => void;
  onSkipSignAndFinalize: () => void;
}

export function PhaseCollapse({ intakeData, walletAddress, onSignAndFinalize, onSkipSignAndFinalize }: PhaseCollapseProps) {
  const entries = INTAKE_SCHEMA.sections.flatMap(s =>
    s.fields.filter(f => intakeData[f.id] !== undefined && intakeData[f.id] !== '').map(f => ({
      section: s.label,
      label: f.label,
      value: Array.isArray(intakeData[f.id]) ? (intakeData[f.id] as unknown[]).join(', ') : String(intakeData[f.id]),
    }))
  );

  return (
    <div style={{ minHeight: '100vh', padding: SPACE[8], fontFamily: FONTS.mono, background: COLORS.bg.base, color: COLORS.text.primary }}>
      <div style={{ ...PATTERNS.sectionLabel, marginBottom: SPACE[6], fontSize: FONTS.size.lg }}>REVIEW & FINALIZE</div>
      <p style={{ fontSize: FONTS.size.sm, color: COLORS.text.secondary, marginBottom: SPACE[6] }}>Confirm your answers. Sign with your wallet to attach crypto identity, or save locally only.</p>
      <div style={{ ...PATTERNS.card, marginBottom: SPACE[8], maxHeight: 360, overflowY: 'auto' }}>
        {entries.map((e, i) => (
          <div key={i} style={{ padding: `${SPACE[2]} 0`, borderBottom: `${BORDER.width.thin} solid ${COLORS.bg.border}`, fontSize: FONTS.size.sm }}>
            <div style={{ color: COLORS.text.dim, fontSize: FONTS.size.xs }}>{e.section}</div>
            <div style={{ fontWeight: FONTS.weight.medium }}>{e.label}</div>
            <div style={{ color: COLORS.text.secondary }}>{e.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: SPACE[4], flexWrap: 'wrap' }}>
        {walletAddress && (
          <button type="button" onClick={onSignAndFinalize} style={{ ...PATTERNS.filterButton, ...PATTERNS.filterButtonActive, padding: `${SPACE[3]} ${SPACE[6]}`, fontSize: FONTS.size.sm }}>SIGN & SAVE</button>
        )}
        <button type="button" onClick={onSkipSignAndFinalize} style={{ ...PATTERNS.filterButton, padding: `${SPACE[3]} ${SPACE[6]}`, fontSize: FONTS.size.sm }}>{walletAddress ? 'SAVE WITHOUT SIGNING' : 'SAVE & ENTER SHIP'}</button>
      </div>
    </div>
  );
}
