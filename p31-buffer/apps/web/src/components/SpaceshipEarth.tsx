import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { IVMRenderer } from '../lib/IVMRenderer';
import { createFullGraph, AXIS_COLORS, AXIS_NAMES, STATE_COLORS } from '../lib/graph-data';
import { useSpoons } from '../hooks/useSpoons';
import { useSamson } from '../hooks/useSamson';
import { useBreathing } from '../hooks/useBreathing';
import { HUD } from './HUD';
import { BreathOverlay } from './BreathOverlay';
import { DeepLockGate } from './DeepLockGate';
import type { SensoryProfile } from '../hooks/useOnboarding';
import type { Graph } from '../types/graph';

interface SpaceshipEarthProps {
  sensoryProfile: SensoryProfile;
  initialSpoons: number;
  graph?: Graph;
}

const panelBg = 'rgba(6,8,16,0.88)';
const panelBorder = 'rgba(45,255,160,0.1)';
const dim = '#4a5a6a';
const mid = '#7a8a9a';
const bright = '#c8d8e8';
const accent = '#2dffa0';
const font = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export function SpaceshipEarth({ sensoryProfile, initialSpoons, graph }: SpaceshipEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<IVMRenderer | null>(null);

  const spoonHook = useSpoons();
  const samson = useSamson();
  const breathing = useBreathing(3);

  const [showSamson, setShowSamson] = useState(false);
  const [fps, setFps] = useState(60);
  const [jitterbugT, setJitterbugT] = useState(0.85);

  // Panels state
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filterAxis, setFilterAxis] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showShell, setShowShell] = useState(true);
  const [showVE, setShowVE] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [cogLoad, setCogLoad] = useState(75);

  const prevActive = useRef(breathing.active);

  // Full graph
  const fullGraph = useMemo(() => graph ?? createFullGraph(), [graph]);

  // Filtered indices
  const filteredIndices = useMemo(() => {
    return fullGraph.nodes.map((n) => {
      if (filterAxis !== 'ALL' && n.axis !== filterAxis) return false;
      if (filterState !== 'ALL' && n.state !== filterState) return false;
      if (searchTerm && !(n.label ?? '').toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(n.desc ?? '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [fullGraph, filterAxis, filterState, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const visible = filteredIndices.filter(Boolean).length;
    const byAxis: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const byState: Record<string, number> = { active: 0, pending: 0, blocked: 0, complete: 0 };
    fullGraph.nodes.forEach((n, i) => {
      if (filteredIndices[i]) {
        byAxis[n.axis ?? 'A'] = (byAxis[n.axis ?? 'A'] || 0) + 1;
        byState[n.state ?? 'active'] = (byState[n.state ?? 'active'] || 0) + 1;
      }
    });
    return { visible, byAxis, byState };
  }, [fullGraph, filteredIndices]);

  const selectedData = useMemo(() => {
    if (!selectedNode) return null;
    return fullGraph.nodes.find((n) => n.id === selectedNode) ?? null;
  }, [fullGraph, selectedNode]);

  const hoveredData = useMemo(() => {
    if (!hoveredNode) return null;
    return fullGraph.nodes.find((n) => n.id === hoveredNode) ?? null;
  }, [fullGraph, hoveredNode]);

  useEffect(() => {
    spoonHook.calibrate(initialSpoons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new IVMRenderer(canvasRef.current);
    renderer.setSensoryProfile({
      motionScale: sensoryProfile.motionScale,
      glowIntensity: sensoryProfile.glowIntensity,
    });
    renderer.setGraph(fullGraph);
    renderer.onNodeHover = (id) => setHoveredNode(id);
    renderer.onNodeClick = (id) => setSelectedNode(id);
    renderer.start();
    rendererRef.current = renderer;

    const poll = setInterval(() => {
      setFps(renderer.getFps());
      setJitterbugT(renderer.getJitterbugT());
    }, 500);

    return () => {
      clearInterval(poll);
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensoryProfile.motionScale, sensoryProfile.glowIntensity]);

  // Sync display toggles to renderer
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.showShell = showShell;
    rendererRef.current.showVE = showVE;
    rendererRef.current.showEdges = showEdges;
    rendererRef.current.cogLoad = cogLoad;
  }, [showShell, showVE, showEdges, cogLoad]);

  // Sync filtered indices
  useEffect(() => {
    rendererRef.current?.setFilteredIndices(filteredIndices);
  }, [filteredIndices]);

  // Sync selected node
  useEffect(() => {
    rendererRef.current?.setSelectedNode(selectedNode);
  }, [selectedNode]);

  // Breathing state
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setBreathingState(
      breathing.phase === 'idle' ? 'idle' : (breathing.phase as 'in' | 'hold' | 'out'),
    );
  }, [breathing.phase]);

  useEffect(() => {
    if (prevActive.current && !breathing.active) {
      spoonHook.recover(0.5);
    }
    prevActive.current = breathing.active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breathing.active]);

  useEffect(() => {
    const entropy = 1 - spoonHook.heartbeatPct;
    samson.update(entropy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spoonHook.spoons]);

  useEffect(() => {
    rendererRef.current?.setTension(samson.valve);
  }, [samson.valve]);

  useEffect(() => {
    rendererRef.current?.setDeepLock(spoonHook.deepLock);
  }, [spoonHook.deepLock]);

  const handleBreathClick = useCallback(() => {
    if (breathing.active) breathing.stop();
    else breathing.start();
  }, [breathing]);

  const spoonState = {
    spoons: spoonHook.spoons, max: spoonHook.max, heartbeat: spoonHook.heartbeat,
    heartbeatPct: spoonHook.heartbeatPct, deepLock: spoonHook.deepLock,
  };
  const samsonState = {
    H: samson.H, error: samson.error, valve: samson.valve, pTerm: samson.pTerm,
    drift: samson.drift, burnout: samson.burnout, aiTemp: samson.aiTemp, zScore: samson.zScore,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#060810', overflow: 'hidden',
      display: 'flex', fontFamily: font, color: bright,
    }}>
      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0, background: panelBg,
        borderRight: `1px solid ${panelBorder}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto', fontSize: 10,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: accent, marginBottom: 4 }}>
            SPACESHIP EARTH
          </div>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2 }}>
            P31 LABS · NODE ZERO · GEODESIC QUANTUM BRAIN
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <input
            type="text" placeholder="Search nodes..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', fontSize: 10, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2, color: bright, fontFamily: font, outline: 'none',
            }}
          />
        </div>

        {/* Axis Filter */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>AXIS FILTER</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {['ALL', 'A', 'B', 'C', 'D'].map((ax) => (
              <button key={ax} onClick={() => setFilterAxis(ax)} style={{
                padding: '4px 8px', fontSize: 9, fontFamily: font, fontWeight: 600,
                background: filterAxis === ax
                  ? (ax === 'ALL' ? `${accent}18` : `${AXIS_COLORS[ax]}22`)
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterAxis === ax
                  ? (ax === 'ALL' ? `${accent}55` : `${AXIS_COLORS[ax]}55`)
                  : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 2, cursor: 'pointer', letterSpacing: 1,
                color: filterAxis === ax ? (ax === 'ALL' ? accent : AXIS_COLORS[ax]) : dim,
              }}>
                {ax === 'ALL' ? 'ALL' : `${ax}: ${AXIS_NAMES[ax]}`}
              </button>
            ))}
          </div>
        </div>

        {/* State Filter */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>STATE FILTER</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {['ALL', 'active', 'pending', 'blocked', 'complete'].map((st) => (
              <button key={st} onClick={() => setFilterState(st)} style={{
                padding: '4px 8px', fontSize: 9, fontFamily: font, fontWeight: 600,
                background: filterState === st ? `${STATE_COLORS[st] ?? accent}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterState === st ? `${STATE_COLORS[st] ?? accent}55` : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 2, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
                color: filterState === st ? (STATE_COLORS[st] ?? accent) : dim,
              }}>
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Display Toggles */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>DISPLAY</div>
          {[
            { label: 'Geodesic Shell', val: showShell, set: setShowShell },
            { label: 'VE Wireframe', val: showVE, set: setShowVE },
            { label: 'Data Edges', val: showEdges, set: setShowEdges },
          ].map(({ label, val, set }) => (
            <label key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', padding: '3px 0', color: val ? mid : dim,
            }}>
              <div
                onClick={() => set(!val)}
                style={{
                  width: 12, height: 12, borderRadius: 2,
                  border: `1px solid ${val ? `${accent}55` : '#222'}`,
                  background: val ? `${accent}15` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: accent,
                }}
              >
                {val ? '\u2713' : ''}
              </div>
              {label}
            </label>
          ))}
        </div>

        {/* Jitterbug Control */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>
            JITTERBUG · {breathing.active ? 'BREATHING' : 'IDLE'}
          </div>
          <button onClick={handleBreathClick} style={{
            width: '100%', padding: '6px', fontSize: 9, fontFamily: font, fontWeight: 700,
            background: breathing.active ? `${accent}12` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${breathing.active ? `${accent}40` : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 2, cursor: 'pointer', letterSpacing: 2,
            color: breathing.active ? accent : mid,
          }}>
            {breathing.active ? '\u25A0 STOP' : '\u25B6 BREATHE'}
          </button>
        </div>

        {/* Cognitive Load */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 4 }}>
            COGNITIVE LOAD · {cogLoad}%
          </div>
          <div style={{
            fontSize: 8, marginBottom: 6,
            color: cogLoad > 70 ? accent : cogLoad > 30 ? '#ffd93d' : '#ff5252',
          }}>
            {cogLoad > 85 ? 'EXPANSIVE VOID' : cogLoad > 50 ? 'GLOWING ORBS' : cogLoad > 10 ? 'SHRINKING VOID' : 'MOLECULE ONLY'}
          </div>
          <input
            type="range" min={0} max={100} step={1} value={cogLoad}
            onChange={(e) => setCogLoad(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: accent }}
          />
        </div>

        {/* Telemetry */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${panelBorder}` }}>
          <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>TELEMETRY</div>
          <div style={{ fontSize: 9, color: mid, lineHeight: 1.8 }}>
            <div>Visible: <span style={{ color: accent }}>{stats.visible}</span> / {fullGraph.nodes.length}</div>
            {Object.entries(stats.byAxis).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: AXIS_COLORS[k] }}>{AXIS_NAMES[k]}</span>
                <span>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 4, borderTop: `1px solid ${panelBorder}`, paddingTop: 4 }}>
              {Object.entries(stats.byState).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: STATE_COLORS[k] }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Architecture */}
        <div style={{ padding: '10px 14px', fontSize: 8, color: dim, lineHeight: 1.6 }}>
          <div style={{ letterSpacing: 2, marginBottom: 6 }}>ARCHITECTURE</div>
          <div>IVM cuboctahedron base</div>
          <div>2V icosahedral geodesic shell</div>
          <div>Quadray (a,b,c,d) → Cartesian</div>
          <div>InstancedMesh · ~4 draw calls</div>
          <div style={{ marginTop: 4, color: `${accent}66` }}>
            s(θ) = 2·cos(θ − π/3)
          </div>
        </div>
      </div>

      {/* ── CENTER: Canvas ──────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
          aria-label="Spaceship Earth visualization"
        />

        {/* HUD overlay */}
        <HUD
          spoonState={spoonState} samsonState={samsonState}
          fps={fps} jitterbugT={jitterbugT}
          onBreathClick={handleBreathClick}
          onSamsonClick={() => setShowSamson(!showSamson)}
          showSamson={showSamson}
        />

        {/* Hover tooltip */}
        {hoveredData && hoveredNode !== selectedNode && (
          <div style={{
            position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
            background: panelBg, border: `1px solid ${panelBorder}`,
            padding: '6px 12px', borderRadius: 3, fontSize: 10,
            pointerEvents: 'none', maxWidth: 300, zIndex: 20,
          }}>
            <span style={{ color: AXIS_COLORS[hoveredData.axis ?? 'A'], fontWeight: 700 }}>
              [{hoveredData.axis}]
            </span>{' '}
            <span style={{ color: bright }}>{hoveredData.label}</span>
            <span style={{ color: dim, marginLeft: 8 }}>{hoveredData.bus}</span>
          </div>
        )}

        {/* Bottom info */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          fontSize: 8, color: dim, letterSpacing: 2, pointerEvents: 'none',
        }}>
          DRAG TO ORBIT · SCROLL TO ZOOM · CLICK TO SELECT
        </div>

        {breathing.active && (
          <BreathOverlay
            phase={breathing.phase} progress={breathing.progress}
            cycle={breathing.cycle} totalCycles={breathing.totalCycles}
            onStop={breathing.stop}
          />
        )}
        {spoonHook.deepLock && !breathing.active && (
          <DeepLockGate spoons={spoonHook.spoons} onBreathe={breathing.start} />
        )}
      </div>

      {/* ── RIGHT PANEL: Node Detail ──────────────────────────────── */}
      <div style={{
        width: 280, flexShrink: 0, background: panelBg,
        borderLeft: `1px solid ${panelBorder}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto', fontSize: 10,
      }}>
        {selectedData ? (
          <>
            <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${panelBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: STATE_COLORS[selectedData.state ?? 'active'],
                  boxShadow: `0 0 6px ${STATE_COLORS[selectedData.state ?? 'active']}88`,
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: bright }}>
                  {selectedData.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 9 }}>
                <span style={{
                  padding: '2px 6px', borderRadius: 2,
                  background: `${AXIS_COLORS[selectedData.axis ?? 'A']}22`,
                  color: AXIS_COLORS[selectedData.axis ?? 'A'],
                  border: `1px solid ${AXIS_COLORS[selectedData.axis ?? 'A']}44`,
                }}>
                  {AXIS_NAMES[selectedData.axis ?? 'A']}
                </span>
                <span style={{
                  padding: '2px 6px', borderRadius: 2,
                  background: 'rgba(255,255,255,0.04)', color: mid,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {selectedData.bus}
                </span>
                <span style={{
                  padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase',
                  background: `${STATE_COLORS[selectedData.state ?? 'active']}15`,
                  color: STATE_COLORS[selectedData.state ?? 'active'],
                  border: `1px solid ${STATE_COLORS[selectedData.state ?? 'active']}44`,
                }}>
                  {selectedData.state}
                </span>
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}` }}>
              <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 6 }}>DESCRIPTION</div>
              <div style={{ color: mid, lineHeight: 1.6 }}>{selectedData.desc}</div>
            </div>

            {selectedData.bary && (
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}` }}>
                <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 6 }}>BARYCENTRIC COORDINATES</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {['A', 'B', 'C', 'D'].map((ax, i) => (
                    <div key={ax} style={{
                      padding: '4px 8px', borderRadius: 2,
                      background: `${AXIS_COLORS[ax]}08`,
                      border: `1px solid ${AXIS_COLORS[ax]}22`,
                    }}>
                      <div style={{ fontSize: 8, color: AXIS_COLORS[ax] }}>{ax} · {AXIS_NAMES[ax]}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: bright }}>
                        {selectedData.bary![i].toFixed(2)}
                      </div>
                      <div style={{ height: 2, borderRadius: 1, marginTop: 3, background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{
                          height: '100%', borderRadius: 1,
                          width: `${selectedData.bary![i] * 100}%`,
                          background: AXIS_COLORS[ax],
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${panelBorder}` }}>
              <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 6 }}>CARTESIAN POSITION</div>
              <div style={{ fontFamily: font, fontSize: 9, color: mid }}>
                ({(selectedData.x ?? 0).toFixed(3)}, {(selectedData.y ?? 0).toFixed(3)}, {(selectedData.z ?? 0).toFixed(3)})
              </div>
            </div>

            {(selectedData.connections?.length ?? 0) > 0 && (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 6 }}>
                  CONNECTIONS ({selectedData.connections!.filter((j) => j < fullGraph.nodes.length).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedData.connections!
                    .filter((j) => j < fullGraph.nodes.length)
                    .map((j) => {
                      const cn = fullGraph.nodes[j];
                      if (!cn) return null;
                      return (
                        <button key={j} onClick={() => setSelectedNode(cn.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 8px', borderRadius: 2,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer', fontSize: 9, fontFamily: font,
                          color: mid, textAlign: 'left',
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: AXIS_COLORS[cn.axis ?? 'A'], flexShrink: 0,
                          }} />
                          <span style={{ color: bright }}>{cn.label}</span>
                          <span style={{ color: dim, marginLeft: 'auto', fontSize: 8 }}>
                            {cn.axis}·{(cn.state ?? 'active').slice(0, 3)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '16px 14px', color: dim }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: mid, marginBottom: 12 }}>
              NODE DETAIL
            </div>
            <div style={{ lineHeight: 1.8 }}>
              Click any node in the 3D space to inspect its coordinates, connections, and metadata.
            </div>
            <div style={{ marginTop: 20, padding: 12, background: `${accent}06`, border: `1px solid ${accent}15`, borderRadius: 3 }}>
              <div style={{ fontSize: 8, color: accent, letterSpacing: 2, marginBottom: 8 }}>GEOMETRY</div>
              <div style={{ lineHeight: 1.8, color: mid }}>
                <div>IVM cuboctahedron: 12 vertices</div>
                <div>Permutations of (2,1,1,0) quadray</div>
                <div>Geodesic shell: 2V icosahedron</div>
                <div>Data mapped via (a,b,c,d) barycentric</div>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
              <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>AXES</div>
              {['A', 'B', 'C', 'D'].map((ax) => (
                <div key={ax} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 1, background: AXIS_COLORS[ax] }} />
                  <span style={{ color: AXIS_COLORS[ax], fontWeight: 600 }}>{ax}</span>
                  <span style={{ color: mid }}>{AXIS_NAMES[ax]}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
              <div style={{ fontSize: 8, color: dim, letterSpacing: 2, marginBottom: 8 }}>STATES</div>
              {Object.entries(STATE_COLORS).map(([st, col]) => (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                  <span style={{ color: col, textTransform: 'uppercase' }}>{st}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
