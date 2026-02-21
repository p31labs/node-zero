import { useState } from "react";
import { QuantumHelloWorld } from "./QuantumHelloWorld";

type View = "intro" | "flow";

export function P31() {
  const [view, setView] = useState<View>("intro");

  if (view === "flow") {
    return <QuantumHelloWorld />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 48px)",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <Tetra size={160} glow />
      <div className="mono" style={{ fontSize: 12, color: "#31ffa360", letterSpacing: 6, marginTop: 16 }}>
        PHOSPHORUS-31
      </div>
      <div
        style={{
          fontSize: 16,
          color: "#666",
          fontStyle: "italic",
          marginTop: 24,
          maxWidth: 420,
          lineHeight: 1.7,
        }}
      >
        The minimum stable system has four vertices and six edges. Every vertex sees every other vertex.
      </div>
      <div
        style={{
          marginTop: 32,
          padding: "16px 24px",
          background: "#0d1117",
          border: "1px solid #31ffa320",
          borderRadius: 8,
          animation: "slideup 0.5s ease",
        }}
      >
        <div className="mono" style={{ fontSize: 11, color: "#31ffa340", letterSpacing: 2, marginBottom: 8 }}>
          READY TO BEGIN
        </div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          Full onboarding — identity, conversation, covenant, molecule formation — uses the real @p31 stack.
        </div>
        <button
          onClick={() => setView("flow")}
          style={{
            padding: "10px 24px",
            background: "#31ffa320",
            border: "1px solid #31ffa340",
            borderRadius: 8,
            color: "#31ffa3",
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: 2,
          }}
        >
          BEGIN
        </button>
      </div>
    </div>
  );
}

function Tetra({ size = 160, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      style={glow ? { filter: "drop-shadow(0 0 20px #31ffa360)" } : undefined}
    >
      <line className="edge" x1={80} y1={20} x2={20} y2={120} />
      <line className="edge" x1={80} y1={20} x2={140} y2={120} />
      <line className="edge" x1={20} y1={120} x2={140} y2={120} />
      <line className="edge" x1={80} y1={20} x2={80} y2={90} strokeDasharray="4,4" />
      <line className="edge" x1={20} y1={120} x2={80} y2={90} strokeDasharray="4,4" />
      <line className="edge" x1={140} y1={120} x2={80} y2={90} strokeDasharray="4,4" />
      <circle className="vtx" cx={80} cy={20} r={3} />
      <circle className="vtx" cx={20} cy={120} r={3} />
      <circle className="vtx" cx={140} cy={120} r={3} />
      <circle className="vtx" cx={80} cy={90} r={3} />
    </svg>
  );
}
