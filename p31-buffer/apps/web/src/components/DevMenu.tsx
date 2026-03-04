import type { SamsonState } from '../hooks/useSamson';

interface Props {
  jitterbugT: number;
  spoons: number;
  maxSpoons: number;
  samson: SamsonState;
  nodeCount: number;
  edgeCount: number;
  fps: number;
  sensoryProfile: string;
  isDeepLocked: boolean;
}

export default function DevMenu({
  jitterbugT, spoons, maxSpoons, samson, nodeCount, edgeCount,
  fps, sensoryProfile, isDeepLocked,
}: Props) {
  const pct = maxSpoons > 0 ? (spoons / maxSpoons) * 100 : 100;
  const hb = pct >= 80 ? 'GREEN' : pct >= 50 ? 'YELLOW' : pct >= 25 ? 'ORANGE' : 'RED';
  const hbColor = { GREEN: '#00E878', YELLOW: '#F0B547', ORANGE: '#FF8C42', RED: '#FF4444' }[hb];

  const r = (label: string, value: string | number, color = '#888') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );

  const sec = (children: React.ReactNode) => (
    <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  );

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, width: 260,
      background: 'rgba(5,5,16,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,232,120,0.15)', borderRadius: 8, padding: 16,
      fontFamily: "'DM Mono', monospace", fontSize: 10, lineHeight: 1.8, zIndex: 300,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: '#00E878', marginBottom: 12, textTransform: 'uppercase' }}>
        IVM Debug
      </div>

      {sec(<>
        {r('Jitterbug t', jitterbugT.toFixed(3), '#00E878')}
        {r('Nodes', nodeCount)}
        {r('Edges', edgeCount)}
        {r('FPS', fps, fps >= 55 ? '#00E878' : fps >= 30 ? '#F0B547' : '#FF4444')}
      </>)}

      {sec(<>
        {r('Spoons', `${spoons.toFixed(1)} / ${maxSpoons}`)}
        {r('Heartbeat', hb, hbColor)}
        {r('Deep Lock', isDeepLocked ? 'ACTIVE' : 'off', isDeepLocked ? '#FF4444' : '#888')}
      </>)}

      {sec(<>
        {r('H', samson.H.toFixed(3), samson.H > 0.25 && samson.H < 0.45 ? '#00E878' : '#F0B547')}
        {r('Error', samson.error.toFixed(3))}
        {r('P', samson.pTerm, samson.pTerm === 'stable' ? '#00E878' : '#F0B547')}
        {r('I (drift)', samson.drift,
          samson.drift === 'nominal' ? '#00E878' : samson.drift === 'looping' ? '#F0B547' : '#FF4444')}
        {r('D (burn)', samson.burnout,
          samson.burnout === 'ok' ? '#00E878' : samson.burnout === 'warning' ? '#F0B547' : '#FF4444')}
        {r('Valve', samson.valve.toFixed(2))}
        {r('AI Temp', samson.aiTemp.toFixed(2), '#a78bfa')}
        {r('Z-Score', samson.zScore.toFixed(2))}
      </>)}

      {r('Sensory', sensoryProfile)}
    </div>
  );
}
