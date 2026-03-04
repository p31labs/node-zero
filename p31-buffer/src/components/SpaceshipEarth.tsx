import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { P31Graph } from '../types/graph';
import type { Calibration } from '../lib/intake-to-graph';
import { IVMRenderer } from '../lib/IVMRenderer';
import type { Graph } from '../lib/IVMRenderer';
import { useSpoons } from '../hooks/useSpoons';
import { useBreathing } from '../hooks/useBreathing';
import { useSamson } from '../hooks/useSamson';
import TelemetryBar from './TelemetryBar';
import BreathingOverlay from './BreathingOverlay';
import DeepLock from './DeepLock';
import DevMenu from './DevMenu';

interface Props {
  graph: P31Graph;
  calibration: Calibration;
  onRequestConnection?: () => void;
}

/** Convert P31 graph to IVMRenderer Graph. Use metadata.radius when present (demo), else small voltage-based radius. Cap 0.02–0.06 to avoid bowling balls. */
function p31GraphToGraph(p31: P31Graph): Graph {
  return {
    nodes: p31.nodes.map((n) => {
      const meta = n.metadata as { radius?: number } | undefined;
      const radius =
        typeof meta?.radius === 'number'
          ? Math.max(0.02, Math.min(0.06, meta.radius))
          : Math.max(0.02, Math.min(0.06, 0.025 + ((n.voltage?.urgency ?? 0) / 10) * 0.02));
      return {
        id: n.id,
        label: n.label,
        axis: n.axis,
        x: n.bary[0],
        y: n.bary[1],
        z: n.bary[2],
        radius,
        voltage: n.voltage?.urgency ?? 0,
      };
    }),
    edges: p31.edges,
  };
}

function deriveSensory(cal: Calibration): 'low' | 'medium' | 'high' {
  const raw = (Array.isArray(cal.sensoryPrefs) ? cal.sensoryPrefs.join(' ') : '').toLowerCase();
  if (/high|sensitive|reduce|motion|overwhelm/.test(raw)) return 'high';
  if (/medium|moderate|some/.test(raw)) return 'medium';
  return 'low';
}

export default function SpaceshipEarth({ graph, calibration, onRequestConnection }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<IVMRenderer | null>(null);

  // Buffer systems
  const maxSpoons = calibration.initialSpoons ?? 8;
  const { spoons, restore } = useSpoons(maxSpoons);
  const { breathing, phase: breathPhase, startBreathing } = useBreathing(
    useCallback(() => restore(0.5), [restore]),
  );
  const samson = useSamson(spoons, maxSpoons);

  const ivmGraph = useMemo(() => p31GraphToGraph(graph), [graph]);

  // UI state
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [devState, setDevState] = useState({ fps: 60, jitterbugT: 0.85 });
  const isDeepLocked = maxSpoons > 0 && (spoons / maxSpoons) < 0.25;
  const sensoryProfile = deriveSensory(calibration);
  const genSyncMode = calibration.suggestedOS ?? 'PLAIN';

  // Init renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new IVMRenderer(canvasRef.current);
    rendererRef.current = r;

    r.setSensoryProfile(sensoryProfile);
    r.setGraph(ivmGraph);
    r.start();

    return () => { r.dispose(); rendererRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update graph when it changes
  useEffect(() => {
    rendererRef.current?.setGraph(ivmGraph);
  }, [ivmGraph]);

  // Breathing → renderer
  useEffect(() => {
    rendererRef.current?.setBreathingState(breathing, breathPhase);
  }, [breathing, breathPhase]);

  // Samson tension → renderer
  useEffect(() => {
    rendererRef.current?.setTension(samson.tension);
  }, [samson.tension]);

  // Deep lock → renderer
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setDeepLock(isDeepLocked);
    if (!isDeepLocked) r.setSensoryProfile(sensoryProfile);
  }, [isDeepLocked, sensoryProfile]);

  // Backtick → DevMenu toggle
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '`') setShowDevMenu(p => !p);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Poll renderer state for DevMenu (low frequency)
  useEffect(() => {
    if (!showDevMenu) return;
    const id = setInterval(() => {
      const r = rendererRef.current;
      if (r) setDevState({ fps: r.getFps(), jitterbugT: r.getJitterbugT() });
    }, 500);
    return () => clearInterval(id);
  }, [showDevMenu]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      <TelemetryBar
        spoons={spoons}
        maxSpoons={maxSpoons}
        nodeCount={graph?.nodes?.length ?? 0}
        connectionStatus="local"
        genSyncMode={genSyncMode}
        onBreathClick={startBreathing}
        onRequestConnection={onRequestConnection}
      />

      {breathing && <BreathingOverlay phase={breathPhase} />}

      {isDeepLocked && (
        <DeepLock
          spoons={spoons}
          maxSpoons={maxSpoons}
          onBreathe={startBreathing}
          onRecover={restore}
        />
      )}

      {showDevMenu && (
        <DevMenu
          jitterbugT={devState.jitterbugT}
          spoons={spoons}
          maxSpoons={maxSpoons}
          samson={samson}
          nodeCount={graph?.nodes?.length ?? 0}
          edgeCount={graph?.edges?.length ?? 0}
          fps={devState.fps}
          sensoryProfile={sensoryProfile}
          isDeepLocked={isDeepLocked}
        />
      )}
    </div>
  );
}
