import { useRef, useState, useCallback, useEffect } from "react";
import type { Element } from "../../lib/bonding/elements";
import type { GameState, PlacedAtom } from "../../lib/bonding/game-store";
import type { PingReaction } from "../../lib/bonding/game-store";
import { ELEMENTS } from "../../lib/bonding/elements";
import { canBond } from "../../lib/bonding/chemistry";

const BOND_DIST = 60;

function bondSitePositions(
  atom: PlacedAtom,
  allAtoms: PlacedAtom[],
  valence: number
): { x: number; y: number }[] {
  const bonded = allAtoms.filter((a) => atom.bonds.includes(a.id));
  const used = bonded.map((b) => Math.atan2(b.y - atom.y, b.x - atom.x));
  const remaining = valence - bonded.length;
  if (remaining <= 0) return [];
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < remaining; i++) {
    let angle: number;
    if (used.length === 0) {
      angle = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(valence, 1);
    } else {
      const sorted = [...used].sort((a, b) => a - b);
      let maxGap = 0,
        gapStart = 0;
      for (let j = 0; j < sorted.length; j++) {
        const next = sorted[(j + 1) % sorted.length];
        let gap = (next - sorted[j] + 2 * Math.PI) % (2 * Math.PI);
        if (gap < 0) gap += 2 * Math.PI;
        if (gap > maxGap) {
          maxGap = gap;
          gapStart = sorted[j];
        }
      }
      angle = gapStart + maxGap / 2 + (i * maxGap) / (remaining + 1);
    }
    sites.push({
      x: atom.x + Math.cos(angle) * BOND_DIST,
      y: atom.y + Math.sin(angle) * BOND_DIST,
    });
  }
  return sites;
}

function getValence(symbol: string): number {
  const el = ELEMENTS.find((e) => e.symbol === symbol);
  return el?.valence ?? 0;
}

interface Props {
  game: GameState;
  selectedElement: Element | null;
  onPlaceAtom: (x: number, y: number, bondToAtomId?: number) => void;
  onPingAtom: (atomId: number, reaction: PingReaction) => void;
  isMyTurn: boolean;
}

export function MoleculeCanvas({ game, selectedElement, onPlaceAtom, onPingAtom, isMyTurn }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pingMenu, setPingMenu] = useState<{ atomId: number; x: number; y: number } | null>(null);
  const [pingFlash, setPingFlash] = useState<number | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const prevAtomIds = useRef<Set<number>>(new Set());
  const [justPlaced, setJustPlaced] = useState<Set<number>>(new Set());
  const prevBondKeys = useRef<Set<string>>(new Set());
  const [newBondKeys, setNewBondKeys] = useState<Set<string>>(new Set());

  const atoms = game.atoms;
  const pos = useCallback((a: PlacedAtom) => ({ x: a.x, y: a.y }), []);

  useEffect(() => {
    const ids = new Set(atoms.map((a) => a.id));
    const added = atoms.filter((a) => !prevAtomIds.current.has(a.id)).map((a) => a.id);
    prevAtomIds.current = ids;
    if (added.length) {
      setJustPlaced((prev) => new Set([...prev, ...added]));
      const t = setTimeout(() => {
        setJustPlaced((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.delete(id));
          return next;
        });
      }, 700);
      return () => clearTimeout(t);
    }
  }, [atoms]);

  useEffect(() => {
    const keys = new Set<string>();
    atoms.forEach((a) => (a.bonds || []).forEach((bid) => keys.add(`${Math.min(a.id, bid)}-${Math.max(a.id, bid)}`)));
    const added = [...keys].filter((k) => !prevBondKeys.current.has(k));
    prevBondKeys.current = keys;
    if (added.length) {
      setNewBondKeys((prev) => new Set([...prev, ...added]));
      const t = setTimeout(() => {
        setNewBondKeys((prev) => {
          const next = new Set(prev);
          added.forEach((k) => next.delete(k));
          return next;
        });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [atoms]);

  const centerX = atoms.length ? atoms.reduce((s, a) => s + a.x, 0) / atoms.length : 400;
  const centerY = atoms.length ? atoms.reduce((s, a) => s + a.y, 0) / atoms.length : 300;
  const padding = 120;
  const minX = atoms.length ? Math.min(...atoms.map((a) => a.x)) - padding : centerX - 80;
  const minY = atoms.length ? Math.min(...atoms.map((a) => a.y)) - padding : centerY - 80;
  const maxX = atoms.length ? Math.max(...atoms.map((a) => a.x)) + padding : centerX + 80;
  const maxY = atoms.length ? Math.max(...atoms.map((a) => a.y)) + padding : centerY + 80;
  const vbW = Math.max(400, maxX - minX + 80);
  const vbH = Math.max(320, maxY - minY + 80);
  const vbX = minX - 40;
  const vbY = minY - 40;

  const handlePing = useCallback(
    (atomId: number, reaction: PingReaction) => {
      onPingAtom(atomId, reaction);
      setPingMenu(null);
      setPingFlash(atomId);
      setTimeout(() => setPingFlash(null), 600);
    },
    [onPingAtom]
  );

  const bondSites: { x: number; y: number; parentId: number }[] = [];
  if (selectedElement && isMyTurn) {
    if (atoms.length === 0) {
      bondSites.push({ x: centerX, y: centerY, parentId: 0 });
    } else {
      for (const atom of atoms) {
        const valence = getValence(atom.element);
        const sites = bondSitePositions(atom, atoms, valence);
        if (canBond(atom.element, atom.bonds.length) && sites.length > 0) {
          sites.forEach((s) => bondSites.push({ ...s, parentId: atom.id }));
        }
      }
    }
  }

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (pingMenu) setPingMenu(null);
    if (e.button === 0) dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
    }
  };
  const onSvgPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 280,
        background: "#050510",
        overflow: "hidden",
        touchAction: "none",
      }}
      onPointerLeave={onSvgPointerUp}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="280"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", cursor: dragRef.current ? "grabbing" : "grab" }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={onSvgPointerUp}
      >
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0a0a14" />
            <stop offset="100%" stopColor="#050510" />
          </radialGradient>
          <filter id="glow-p0" x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor="#39FF14" result="COLOR" />
            <feComposite in="COLOR" in2="SourceAlpha" operator="in" result="MASK" />
            <feMorphology in="MASK" operator="dilate" radius="3" result="DILATED" />
            <feGaussianBlur in="DILATED" stdDeviation="4" result="HALO" />
            <feMerge>
              <feMergeNode in="HALO" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-p1" x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor="#06B6D4" result="COLOR" />
            <feComposite in="COLOR" in2="SourceAlpha" operator="in" result="MASK" />
            <feMorphology in="MASK" operator="dilate" radius="3" result="DILATED" />
            <feGaussianBlur in="DILATED" stdDeviation="4" result="HALO" />
            <feMerge>
              <feMergeNode in="HALO" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#bgGrad)" />

        {atoms.map((a) =>
          (a.bonds || []).map((bid) => {
            const bonded = atoms.find((x) => x.id === bid);
            if (!bonded) return null;
            const p1 = pos(a);
            const p2 = pos(bonded);
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const bondKey = `${Math.min(a.id, bid)}-${Math.max(a.id, bid)}`;
            const isNew = newBondKeys.has(bondKey);
            return (
              <line
                key={`${a.id}-${bid}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={2}
                strokeDasharray={len}
                strokeDashoffset={isNew ? len : 0}
                style={
                  isNew
                    ? {
                        animation: "bondDraw 0.3s ease-out forwards",
                      }
                    : undefined
                }
              />
            );
          })
        )}

        {atoms.map((a) => {
          const el = ELEMENTS.find((e) => e.symbol === a.element);
          const color = el?.color ?? "#888";
          const r = el?.radius ?? 20;
          const isFlashing = pingFlash === a.id;
          const entering = justPlaced.has(a.id);
          const p = pos(a);
          return (
            <g key={a.id} transform={`translate(${p.x},${p.y})`}>
              <g
                className={`atom-idle ${entering ? "atom-entering" : ""} ${isFlashing ? "ping-flash" : ""}`}
                role="img"
                aria-label={`${a.element} atom`}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={r}
                  fill={color}
                  fillOpacity={0.3}
                  stroke={color}
                  strokeWidth={2}
                  filter={`url(#glow-p${a.placedBy})`}
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={r * 0.8}
                  fontWeight="bold"
                  fontFamily="DM Mono, monospace"
                >
                  {a.element}
                </text>
              </g>
            </g>
          );
        })}

        {bondSites.map((site, i) => {
          const parentEl = site.parentId === 0 ? null : atoms.find((a) => a.id === site.parentId);
          const label = parentEl ? `Bond site on ${parentEl.element}` : "Bond site for first atom";
          return (
            <g
              key={i}
              role="button"
              aria-label={label}
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => onPlaceAtom(site.x, site.y, site.parentId === 0 ? undefined : site.parentId)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onPlaceAtom(site.x, site.y, site.parentId === 0 ? undefined : site.parentId);
                }
              }}
            >
              <circle cx={site.x} cy={site.y} r={22} fill="transparent" />
              <g transform={`translate(${site.x},${site.y})`} className="bond-site" style={{ pointerEvents: "none" }}>
                <circle r={5} fill="none" stroke="#31ffa3" strokeWidth={1.5} strokeDasharray="4 3" />
              </g>
            </g>
          );
        })}

        {atoms.map((a) => {
          const p = pos(a);
          return (
            <circle
              key={`hit-${a.id}`}
              cx={p.x}
              cy={p.y}
              r={Math.max(28, (ELEMENTS.find((e) => e.symbol === a.element)?.radius ?? 20) + 10)}
              fill="transparent"
              style={{ cursor: !selectedElement && isMyTurn ? "pointer" : "default" }}
              onClick={() => {
                if (selectedElement && isMyTurn) return;
                if (!selectedElement && isMyTurn) setPingMenu({ atomId: a.id, x: p.x, y: p.y });
              }}
            />
          );
        })}

        {pingMenu && (
          <g>
            <rect
              x={pingMenu.x - 50}
              y={pingMenu.y - 28}
              width={100}
              height={44}
              rx={8}
              fill="#0c0c18"
              stroke="#31ffa340"
              strokeWidth={1}
            />
            {(["💚", "🤔", "😂", "🔺"] as PingReaction[]).map((r, i) => (
              <text
                key={r}
                x={pingMenu.x - 36 + i * 24}
                y={pingMenu.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={18}
                style={{ cursor: "pointer" }}
                onClick={() => handlePing(pingMenu.atomId, r)}
              >
                {r}
              </text>
            ))}
          </g>
        )}
      </svg>
      <style>{`
        @keyframes bondDraw { to { stroke-dashoffset: 0; } }
        @keyframes atomEnter {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .atom-entering {
          animation: atomEnter 600ms linear(0, 0.4 8%, 0.8 16%, 1.15 28%, 1.05 38%, 0.95 50%, 1.02 65%, 0.99 80%, 1) forwards;
        }
        @keyframes bondSitePulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.6; }
        }
        .bond-site { animation: bondSitePulse 1.5s ease-in-out infinite; }
        @keyframes atomDrift {
          0% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(0.5px, -0.3px, 0); }
          50% { transform: translate3d(-0.2px, 0.5px, 0); }
          75% { transform: translate3d(-0.5px, -0.4px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        .atom-idle { animation: atomDrift 2s ease-in-out infinite alternate; will-change: transform; }
        @keyframes pingFlash {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.3); filter: brightness(1.5); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .ping-flash { animation: pingFlash 600ms ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .atom-idle, .bond-site { animation: none !important; }
          .atom-entering { animation-duration: 0ms !important; }
          .ping-flash { transform: none !important; }
        }
      `}</style>
    </div>
  );
}
