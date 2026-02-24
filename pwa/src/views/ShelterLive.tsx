/**
 * ShelterLive — reads real LOVE wallet + Genesis Dome structure
 * from SessionContext. Uses existing PWA styles (.card, .label, .mono).
 */

import { useSession } from "../context/SessionContext";

export function WalletCard() {
  const { session } = useSession();

  if (!session) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: "#666" }}>
          Complete Quantum Hello World to see your wallet.
        </p>
      </div>
    );
  }

  const wallet = session.ledgerSnapshot.wallet;
  const earned = wallet?.totalEarned ?? 0;
  const sovereignty = wallet?.sovereigntyPool ?? 0;
  const performance = wallet?.performancePool ?? 0;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span className="label">L.O.V.E. WALLET</span>
        <span className="mono" style={{ fontSize: 10, color: "#31ffa360", letterSpacing: 1 }}>
          {session.fingerprint.slice(0, 8)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 24, color: "#31ffa3", fontWeight: 600 }}>
          {earned.toFixed(1)}
        </span>
        <span style={{ fontSize: 12, color: "#555" }}>LOVE earned</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #6366f1" }}>
          <div className="mono" style={{ fontSize: 10, color: "#6366f1", marginBottom: 4 }}>SOVEREIGNTY</div>
          <div className="mono" style={{ fontSize: 16, color: "#e2e8f0" }}>{sovereignty.toFixed(1)}</div>
          <div className="mono" style={{ fontSize: 9, color: "#555", marginTop: 4 }}>IMMUTABLE</div>
        </div>
        <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
          <div className="mono" style={{ fontSize: 10, color: "#f59e0b", marginBottom: 4 }}>PERFORMANCE</div>
          <div className="mono" style={{ fontSize: 16, color: "#e2e8f0" }}>{performance.toFixed(1)}</div>
          <div className="mono" style={{ fontSize: 9, color: "#555", marginTop: 4 }}>CS MODULATED</div>
        </div>
      </div>
    </div>
  );
}

export function GenesisDomeCard() {
  const { session } = useSession();

  if (!session) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: "#666" }}>
          Complete Quantum Hello World to see your Genesis Dome.
        </p>
      </div>
    );
  }

  const structures = session.gameSnapshot?.structures ?? [];
  const dome = structures[0];

  if (!dome) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: "#666" }}>No structure in snapshot.</p>
      </div>
    );
  }

  const rigidity = dome.rigidity;
  const isRigid = rigidity?.isRigid ?? false;
  const vertices = rigidity?.vertices ?? 0;
  const edges = rigidity?.edges ?? 0;
  const coherence = rigidity?.coherence ?? 0;

  return (
    <div className="card" style={{ borderColor: "#22c55e20" }}>
      <div className="mono" style={{ fontSize: 10, color: "#22c55e", letterSpacing: 2, marginBottom: 8 }}>
        ✓ STRUCTURE[0] — {(dome.name ?? session.domeName).toUpperCase()}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }} className="mono">
        <span style={{ fontSize: 12, color: "#888" }}>V: {vertices} · E: {edges}</span>
        <span style={{ fontSize: 12, color: "#31ffa3" }}>Coherence: {coherence.toFixed(3)}</span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
        Maxwell: E ≥ 3V − 6 → {edges} ≥ {rigidity?.maxwellThreshold ?? 6} ✓ {isRigid ? "RIGID" : "FLEX"}
      </div>
    </div>
  );
}
