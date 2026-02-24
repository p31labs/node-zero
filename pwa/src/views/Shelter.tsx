import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { WalletCard, GenesisDomeCard } from "./ShelterLive";

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
  const { session, loading } = useSession();

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <div className="label" style={{ letterSpacing: 4, marginBottom: 24 }}>
        SHELTER DASHBOARD
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="label">NODE STATUS</span>
          <span className="mono" style={{ fontSize: 10, color: "#31ffa3", letterSpacing: 1 }}>
            {loading ? "…" : session ? "● ALIVE" : "● ONLINE"}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 13, color: "#888" }}>
          Identity: {session ? "wired via Quantum Hello World (real stack)" : "complete QHW to see wallet & dome"}
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

      <Link
        to="/mesh"
        className="card"
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        <div className="label" style={{ marginBottom: 8 }}>LIVING MESH</div>
        <div className="mono" style={{ fontSize: 12, color: "#31ffa380" }}>
          /mesh
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
          {session ? "View your nodes and coherence in-app" : "Complete QHW to see your mesh"}
        </div>
      </Link>

      <GenesisDomeCard />
      <WalletCard />

      <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#333", fontStyle: "italic" }}>
        P31 Labs · Georgia 501(c)(3) · MIT License
      </div>
    </div>
  );
}
