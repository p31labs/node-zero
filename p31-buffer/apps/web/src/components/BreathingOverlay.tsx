import type { BreathPhase } from '../hooks/useBreathing';

export default function BreathingOverlay({ phase }: { phase: BreathPhase }) {
  const labels: Record<BreathPhase, string> = { idle: '', in: 'BREATHE IN', hold: 'HOLD', out: 'BREATHE OUT' };
  const dur: Record<BreathPhase, number> = { idle: 0, in: 4, hold: 2, out: 6 };
  const anim = phase === 'in'
    ? `breathIn ${dur.in}s ease-in-out`
    : phase === 'out'
    ? `breathOut ${dur.out}s ease-in-out`
    : 'none';

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 50,
    }}>
      <div style={{
        width: 200, height: 200, borderRadius: '50%',
        border: '2px solid rgba(0,232,120,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', animation: anim,
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          letterSpacing: 4, color: '#00E878', textTransform: 'uppercase',
        }}>
          {labels[phase]}
        </span>
      </div>
      <style>{`
        @keyframes breathIn { from { transform: scale(0.6); opacity: 0.3; } to { transform: scale(1); opacity: 0.8; } }
        @keyframes breathOut { from { transform: scale(1); opacity: 0.8; } to { transform: scale(0.6); opacity: 0.3; } }
      `}</style>
    </div>
  );
}
