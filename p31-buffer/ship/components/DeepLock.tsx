interface Props {
  spoons: number;
  maxSpoons: number;
  onBreathe: () => void;
  onRecover: (amount: number) => void;
}

export default function DeepLock({ spoons, maxSpoons, onBreathe, onRecover }: Props) {
  const btn = (label: string, onClick: () => void, accent = false) => (
    <button onClick={onClick} style={{
      background: accent ? 'rgba(0,232,120,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${accent ? 'rgba(0,232,120,0.2)' : 'rgba(255,255,255,0.1)'}`,
      color: accent ? '#00E878' : 'rgba(255,255,255,0.4)',
      borderRadius: 8, padding: '12px 24px', fontSize: 10,
      fontFamily: "'DM Mono', monospace", letterSpacing: 2, cursor: 'pointer',
    }}>
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(5,5,16,0.92)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 24, zIndex: 200,
      animation: 'dlFadeIn 0.6s ease',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        border: '2px solid rgba(255,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>
        🛡️
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 12,
        letterSpacing: 4, color: '#FF4444', textTransform: 'uppercase',
      }}>
        Deep Processing Lock
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: 'rgba(255,255,255,0.4)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6,
      }}>
        Energy below 25%. New inputs blocked to protect your capacity.
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, color: '#FF4444' }}>
        {spoons.toFixed(1)} / {maxSpoons}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {btn('BREATHE (4-2-6)', onBreathe, true)}
        {btn('NAP (+2)', () => onRecover(2))}
        {btn('HEAVY WORK (+1)', () => onRecover(1))}
      </div>
      <style>{`@keyframes dlFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
