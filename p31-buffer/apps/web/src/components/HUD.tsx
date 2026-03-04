import type { SpoonState } from '../hooks/useSpoons';
import type { SamsonState } from '../hooks/useSamson';
import { HEARTBEAT_LABELS, HEARTBEAT_COLORS } from '../hooks/useSpoons';

interface HUDProps {
  spoonState: SpoonState;
  samsonState: SamsonState;
  fps: number;
  jitterbugT: number;
  onBreathClick: () => void;
  onSamsonClick: () => void;
  showSamson: boolean;
}

export function HUD({
  spoonState,
  samsonState,
  fps,
  jitterbugT,
  onBreathClick,
  onSamsonClick,
  showSamson,
}: HUDProps) {
  const hb = HEARTBEAT_COLORS[spoonState.heartbeat];
  const label = HEARTBEAT_LABELS[spoonState.heartbeat];
  const MARK1 = Math.PI / 9;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(180deg, rgba(5,5,5,0.9) 0%, rgba(5,5,5,0) 100%)',
        pointerEvents: 'none',
        fontFamily: "'Courier New', Courier, monospace",
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {Array.from({ length: spoonState.max }, (_, i) => (
            <div
              key={i}
              aria-label={`Spoon ${i + 1} of ${spoonState.max}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i < spoonState.spoons ? hb.text : 'rgba(255,255,255,0.08)',
                transition: 'all 0.3s',
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: hb.text, fontWeight: 600, marginLeft: 4 }}>
            {spoonState.spoons}
          </span>
        </div>

        <button
          type="button"
          onClick={onSamsonClick}
          aria-label={`SAMSON entropy: ${samsonState.H.toFixed(3)}`}
          style={{
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 9,
            letterSpacing: 1,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            background: `${Math.abs(samsonState.error) > 0.1 ? '#FFB000' : '#33FF33'}18`,
            color: Math.abs(samsonState.error) > 0.1 ? '#FFB000' : '#33FF33',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          H:{samsonState.H.toFixed(2)}
        </button>

        <div
          style={{
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 8,
            letterSpacing: 1.5,
            fontWeight: 700,
            background: `${hb.text}18`,
            color: hb.text,
          }}
        >
          {label}
        </div>

        <button
          type="button"
          onClick={onBreathClick}
          aria-label="Start breathing exercise"
          style={{
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 9,
            letterSpacing: 1,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: '1px solid rgba(0,212,255,0.2)',
            background: 'rgba(0,212,255,0.08)',
            color: '#00D4FF',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          BREATHE
        </button>

        <div
          style={{
            marginLeft: 'auto',
            fontSize: 8,
            color: 'rgba(255,255,255,0.2)',
            display: 'flex',
            gap: 8,
          }}
        >
          <span>{fps} FPS</span>
          <span>T:{jitterbugT.toFixed(2)}</span>
        </div>
      </div>

      {showSamson && (
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.06)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 8,
              letterSpacing: 2,
              color: 'rgba(255,255,255,0.25)',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            SAMSON V2 — PID STATE
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10 }}>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>H: </span>
              <span
                style={{
                  color: Math.abs(samsonState.error) < 0.05 ? '#33FF33' : '#FFB000',
                  fontWeight: 600,
                }}
              >
                {samsonState.H.toFixed(3)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 4 }}>
                target {MARK1.toFixed(3)}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>P: </span>
              <span style={{ color: samsonState.pTerm === 'stable' ? '#33FF33' : '#FFB000' }}>
                {samsonState.pTerm}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>I: </span>
              <span
                style={{
                  color:
                    samsonState.drift === 'nominal'
                      ? '#33FF33'
                      : samsonState.drift === 'looping'
                        ? '#FFB000'
                        : '#FF6B6B',
                }}
              >
                {samsonState.drift}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>D: </span>
              <span
                style={{
                  color:
                    samsonState.burnout === 'ok'
                      ? '#33FF33'
                      : samsonState.burnout === 'warning'
                        ? '#FFB000'
                        : '#FF6B6B',
                }}
              >
                {samsonState.burnout}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>AI temp: </span>
              <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                {samsonState.aiTemp.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>Z: </span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{samsonState.zScore.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>Valve: </span>
              <span style={{ color: '#00D4FF' }}>{samsonState.valve.toFixed(3)}</span>
            </div>
          </div>

          {samsonState.drift === 'looping' && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                color: '#facc15',
                padding: '4px 8px',
                borderRadius: 3,
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.12)',
              }}
            >
              Loop detected. Consider shifting task or taking a break.
            </div>
          )}
          {samsonState.drift === 'escalating' && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                color: '#f87171',
                padding: '4px 8px',
                borderRadius: 3,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.12)',
              }}
            >
              Escalation detected. SAMSON is lowering AI temperature.
            </div>
          )}
          {samsonState.burnout === 'critical' && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                color: '#f87171',
                padding: '4px 8px',
                borderRadius: 3,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.12)',
              }}
            >
              Burnout velocity critical. Defer non-essential tasks. Breathe.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
