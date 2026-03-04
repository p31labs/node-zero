import { useConnections } from '../hooks/useConnections';
import { COLORS, FONTS, SPACE, BORDER, TRANSITION } from '../lib/design-tokens';

const TIER_ICONS: Record<string, string> = {
  FULL: '◉◉◉',
  ONLINE: '◉◉○',
  LOCAL: '◉○○',
  OFFLINE: '○○○',
};

interface ConnectionBadgeProps {
  onClick?: () => void;
}

export function ConnectionBadge({ onClick }: ConnectionBadgeProps) {
  const { tier, connectedCount } = useConnections();
  const color = (COLORS.tier as Record<string, string>)[tier];

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${connectedCount}/6 circuits · Press C for details`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: SPACE[1.5],
        background: 'none', border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
        borderRadius: BORDER.radius.sm, padding: `${SPACE[0.5]} ${SPACE[2]}`,
        cursor: 'pointer', fontFamily: FONTS.mono, fontSize: FONTS.size.xs,
        color, letterSpacing: FONTS.tracking.wide, transition: TRANSITION.fast,
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: FONTS.size.micro, letterSpacing: FONTS.tracking.micro }}>{TIER_ICONS[tier]}</span>
      <span>{connectedCount}/6</span>
    </button>
  );
}
