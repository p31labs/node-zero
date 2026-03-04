import { COLORS, FONTS, SPACE, PATTERNS, LAYOUT } from '../lib/design-tokens';

interface WalletConnectProps {
  onConnect: () => void;
  onSkip: () => void;
}

export function WalletConnect({ onConnect, onSkip }: WalletConnectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: SPACE[8], fontFamily: FONTS.mono, background: COLORS.bg.deep, color: COLORS.text.primary }}>
      <div style={{ fontSize: FONTS.size['2xl'], fontWeight: FONTS.weight.light, letterSpacing: FONTS.tracking.widest, marginBottom: SPACE[4] }}>WELCOME TO THE BUFFER</div>
      <p style={{ fontSize: FONTS.size.sm, color: COLORS.text.secondary, marginBottom: SPACE[8], textAlign: 'center', maxWidth: LAYOUT.copyMaxWidth }}>Connect a wallet for crypto identity and L.O.V.E. ledger, or continue in local mode.</p>
      <div style={{ display: 'flex', gap: SPACE[4], flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" onClick={onConnect} style={{ ...PATTERNS.filterButton, ...PATTERNS.filterButtonActive, padding: `${SPACE[3]} ${SPACE[6]}`, fontSize: FONTS.size.sm }}>CONNECT WALLET</button>
        <button type="button" onClick={onSkip} style={{ ...PATTERNS.filterButton, padding: `${SPACE[3]} ${SPACE[6]}`, fontSize: FONTS.size.sm }}>SKIP → LOCAL MODE</button>
      </div>
    </div>
  );
}
