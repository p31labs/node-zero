import type { BreathPhase } from '../hooks/useBreathing';

interface BreathOverlayProps {
  phase: BreathPhase;
  progress: number;
  cycle: number;
  totalCycles: number;
  onStop: () => void;
}

const PHASE_LABELS: Record<BreathPhase, string> = {
  idle: '',
  in: 'BREATHE IN',
  hold: 'HOLD',
  out: 'BREATHE OUT',
};

const PHASE_COLORS: Record<BreathPhase, string> = {
  idle: '#33FF33',
  in: '#00D4FF',
  hold: '#a78bfa',
  out: '#33FF33',
};

export function BreathOverlay({
  phase,
  progress,
  cycle,
  totalCycles,
  onStop,
}: BreathOverlayProps) {
  const baseSize = 60;
  const maxSize = 160;
  let size = baseSize;

  if (phase === 'in') size = baseSize + (maxSize - baseSize) * progress;
  else if (phase === 'hold') size = maxSize;
  else if (phase === 'out') size = maxSize - (maxSize - baseSize) * progress;

  const color = PHASE_COLORS[phase];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5,5,5,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={() => {}}
      role="dialog"
      aria-label="Breathing exercise"
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}40, ${color}10)`,
          border: `2px solid ${color}60`,
          boxShadow: `0 0 ${size / 2}px ${color}30`,
          transition: 'width 0.3s ease, height 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, color, letterSpacing: 2, fontWeight: 700 }}>
          {PHASE_LABELS[phase]}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {Array.from({ length: totalCycles }, (_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                i < cycle ? color : i === cycle ? `${color}80` : 'rgba(255,255,255,0.1)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: 1,
        }}
      >
        CYCLE {cycle + 1} OF {totalCycles}
      </div>

      <button
        type="button"
        onClick={onStop}
        aria-label="Stop breathing exercise"
        style={{
          marginTop: 32,
          padding: '8px 24px',
          borderRadius: 4,
          fontSize: 10,
          letterSpacing: 2,
          fontWeight: 600,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          minWidth: 44,
          minHeight: 44,
        }}
      >
        STOP
      </button>
    </div>
  );
}
