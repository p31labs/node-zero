interface Props {
  spoons: number;
  maxSpoons: number;
  nodeCount: number;
  connectionStatus: 'local' | 'mesh' | 'offline';
  genSyncMode: string;
  onBreathClick: () => void;
  onRequestConnection?: () => void;
}

function SpoonMini({ spoons, max }: { spoons: number; max: number }) {
  const pct = max > 0 ? (spoons / max) * 100 : 0;
  const c = pct >= 80 ? '#00E878' : pct >= 50 ? '#F0B547' : pct >= 25 ? '#FF8C42' : '#FF4444';
  return (
    <div style={{
      width: 60, height: 6, background: 'rgba(255,255,255,0.06)',
      borderRadius: 3, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: c,
        borderRadius: 3, transition: 'width 0.5s ease, background 0.3s ease',
      }} />
    </div>
  );
}

function ConnBadge({ status, onClick }: { status: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    local: '#00E878', mesh: '#4488ff', offline: '#555',
  };
  const labels: Record<string, string> = {
    local: '1/6', mesh: 'MESH', offline: 'OFF',
  };
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors[status]}44`,
      borderRadius: 12, padding: '2px 10px', cursor: onClick ? 'pointer' : 'default',
      fontFamily: "'DM Mono', monospace", fontSize: 9, color: colors[status],
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: colors[status], display: 'inline-block',
      }} />
      {labels[status] ?? status}
    </button>
  );
}

export default function TelemetryBar({
  spoons, maxSpoons, nodeCount, connectionStatus,
  genSyncMode, onBreathClick, onRequestConnection,
}: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
      background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(0,232,120,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#888',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SpoonMini spoons={spoons} max={maxSpoons} />
        <span>{spoons.toFixed(1)} / {maxSpoons}</span>
      </div>

      <button onClick={onBreathClick} style={{
        background: 'transparent', border: '1px solid rgba(0,232,120,0.2)',
        borderRadius: 20, padding: '4px 16px', color: '#00E878',
        fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, cursor: 'pointer',
      }}>
        BREATHE
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{genSyncMode.toUpperCase()}</span>
        <span>◆ {nodeCount}</span>
        <ConnBadge status={connectionStatus} onClick={onRequestConnection} />
      </div>
    </div>
  );
}
