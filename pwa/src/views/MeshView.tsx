/**
 * MeshView — 9-node Living Mesh driven by useSession().
 * 3×3 grid: active nodes (with data) full opacity + border; inactive dim 40%.
 * Shows Maxwell (E ≥ 3V − 6) and coherence when structure is rigid.
 */

import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";

const NODE_IDS = [
  "31p",
  "L.O.V.E.",
  "BUFFER",
  "SCOPE",
  "BONDING",
  "BREATHE",
  "MEDS",
  "PING",
  "SPROUT",
] as const;

type NodeId = (typeof NODE_IDS)[number];

function getRigidity(session: NonNullable<ReturnType<typeof useSession>["session"]>) {
  const structures = (session.gameSnapshot as unknown as { structures?: Array<{ rigidity?: Record<string, unknown> }> })?.structures ?? [];
  const structure = structures[0];
  const rigidity = (structure?.rigidity ?? {}) as Record<string, unknown>;
  return {
    isRigid: (rigidity.isRigid as boolean) ?? (rigidity.RIGID as boolean) ?? false,
    vertices: (rigidity.vertices as number) ?? (rigidity.V as number) ?? 0,
    edges: (rigidity.edges as number) ?? (rigidity.E as number) ?? 0,
    coherence: (rigidity.coherence as number) ?? 0,
  };
}

function getWallet(session: NonNullable<ReturnType<typeof useSession>["session"]>) {
  const wallet = (session.ledgerSnapshot as unknown as { wallet?: Record<string, unknown> })?.wallet ?? {};
  return {
    love: (wallet.totalEarned as number) ?? (wallet.total as number) ?? 0,
    sovereignty: (wallet.sovereigntyPool as number) ?? (wallet.sovereignty as number) ?? 0,
    performance: (wallet.performancePool as number) ?? (wallet.performance as number) ?? 0,
  };
}

function isNodeActive(id: NodeId, session: NonNullable<ReturnType<typeof useSession>["session"]>): boolean {
  const wallet = getWallet(session);
  const { isRigid, vertices, edges } = getRigidity(session);
  switch (id) {
    case "31p":
      return Boolean(session.nodeId);
    case "L.O.V.E.":
      return wallet.love > 0;
    case "BUFFER":
      return wallet.sovereignty > 0 || wallet.performance > 0;
    case "SCOPE":
      return Boolean(session.domeName);
    case "BONDING":
      return isRigid;
    case "BREATHE":
    case "MEDS":
    case "PING":
    case "SPROUT":
      return vertices > 0 || edges > 0;
    default:
      return false;
  }
}

function nodeValue(id: NodeId, session: NonNullable<ReturnType<typeof useSession>["session"]>): string {
  const wallet = getWallet(session);
  const { edges, coherence } = getRigidity(session);
  switch (id) {
    case "31p":
      return session.nodeId ? session.nodeId.slice(0, 8) + "…" : "—";
    case "L.O.V.E.":
      return String(wallet.love);
    case "BUFFER":
      return `${wallet.sovereignty}/${wallet.performance}`;
    case "SCOPE":
      return session.domeName || "—";
    case "BONDING":
      return `${edges}E`;
    case "BREATHE":
    case "MEDS":
    case "PING":
    case "SPROUT":
      return coherence > 0 ? String(coherence) : "—";
    default:
      return "—";
  }
}

export function MeshView() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="mesh-wrap" style={{ padding: 24, textAlign: "center", color: "#666" }}>
        <span className="mono">…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mesh-wrap" style={{ padding: 24, maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
        <div className="label" style={{ marginBottom: 16 }}>LIVING MESH</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
          Complete Quantum Hello World to see your nodes and coherence.
        </div>
        <Link
          to="/"
          className="link"
          style={{ display: "inline-block", padding: "10px 20px", border: "1px solid #31ffa340", borderRadius: 8 }}
        >
          Complete QHW
        </Link>
      </div>
    );
  }

  const rigidity = getRigidity(session);
  const activeCount = NODE_IDS.filter((id) => isNodeActive(id, session)).length;

  return (
    <div className="mesh-wrap" style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <div className="label" style={{ letterSpacing: 4, marginBottom: 20 }}>
        LIVING MESH
      </div>

      <div
        className="mesh-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {NODE_IDS.map((id) => {
          const active = isNodeActive(id, session);
          const value = nodeValue(id, session);
          return (
            <div
              key={id}
              className={`mesh-node ${active ? "mesh-node-active" : ""}`}
              style={{
                padding: 14,
                background: "#0d1117",
                border: `1px solid ${active ? "#31ffa340" : "#222"}`,
                borderRadius: 8,
                opacity: active ? 1 : 0.4,
                transition: "opacity 0.2s, border-color 0.2s",
              }}
            >
              <div className="mono" style={{ fontSize: 10, color: "#31ffa360", letterSpacing: 1, marginBottom: 4 }}>
                {id}
              </div>
              <div className="mono" style={{ fontSize: 12, color: active ? "#ccc" : "#555" }}>
                {value}
              </div>
            </div>
          );
        })}
      </div>

      {rigidity.isRigid && (
        <div
          className="mesh-maxwell"
          style={{
            padding: 12,
            background: "#0d1117",
            border: "1px solid #31ffa320",
            borderRadius: 8,
            fontSize: 12,
            color: "#31ffa380",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          E ≥ 3V − 6 · coherence {rigidity.coherence}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: "#444" }}>
        {activeCount} of 9 nodes active
      </div>
    </div>
  );
}
