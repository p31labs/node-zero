const stack = [
  ["@p31/node-zero", "0.2.0-α.0", "220 tests", "#6366f1"],
  ["@p31/love-ledger", "0.1.0-α.0", "115 tests", "#f59e0b"],
  ["@p31/game-engine", "0.1.0-α.0", "104 tests", "#31ffa3"],
] as const;

const links = [
  ["npm: @p31/node-zero", "https://www.npmjs.com/package/@p31/node-zero"],
  ["npm: @p31/love-ledger", "https://www.npmjs.com/package/@p31/love-ledger"],
  ["npm: @p31/game-engine", "https://www.npmjs.com/package/@p31/game-engine"],
  ["GitHub: p31labs", "https://github.com/p31labs"],
] as const;

export function Shelter() {
  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <div className="label" style={{ letterSpacing: 4, marginBottom: 24 }}>
        SHELTER DASHBOARD
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="label">NODE STATUS</span>
          <span className="mono" style={{ fontSize: 10, color: "#31ffa3", letterSpacing: 1 }}>
            ● ONLINE
          </span>
        </div>
        <div className="mono" style={{ fontSize: 13, color: "#888" }}>
          Identity: wired via Quantum Hello World (real stack)
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>P31 STACK — 439 TESTS</div>
        {stack.map((s) => (
          <div
            key={s[0]}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #111",
              fontSize: 12,
            }}
            className="mono"
          >
            <span style={{ color: s[3] }}>{s[0]}</span>
            <span style={{ color: "#555" }}>{s[1]} · {s[2]}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>LINKS</div>
        {links.map((l) => (
          <a key={l[0]} className="link" href={l[1]} target="_blank" rel="noopener">
            {l[0]}
          </a>
        ))}
      </div>

      <div className="card" style={{ borderColor: "#22c55e20" }}>
        <div className="mono" style={{ fontSize: 10, color: "#22c55e", letterSpacing: 2, marginBottom: 8 }}>
          ✓ STRUCTURE[0] — GENESIS DOME
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }} className="mono">
          <span style={{ fontSize: 12, color: "#888" }}>V: 4 · E: 6</span>
          <span style={{ fontSize: 12, color: "#31ffa3" }}>Coherence: 1.000</span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
          Maxwell: E ≥ 3V − 6 → 6 ≥ 6 ✓ RIGID
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span className="label">L.O.V.E. WALLET</span>
          <span className="mono" style={{ fontSize: 24, color: "#31ffa3", fontWeight: 600 }}>
            90.0
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #6366f1" }}>
            <div className="mono" style={{ fontSize: 10, color: "#6366f1", marginBottom: 4 }}>SOVEREIGNTY</div>
            <div className="mono" style={{ fontSize: 16, color: "#e2e8f0" }}>45.0</div>
            <div className="mono" style={{ fontSize: 9, color: "#555", marginTop: 4 }}>IMMUTABLE</div>
          </div>
          <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
            <div className="mono" style={{ fontSize: 10, color: "#f59e0b", marginBottom: 4 }}>PERFORMANCE</div>
            <div className="mono" style={{ fontSize: 16, color: "#e2e8f0" }}>45.0</div>
            <div className="mono" style={{ fontSize: 9, color: "#555", marginTop: 4 }}>CS MODULATED</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#333", fontStyle: "italic" }}>
        P31 Labs · Georgia 501(c)(3) · MIT License
      </div>
    </div>
  );
}
