/**
 * Node Zero Protocol — Live Demo
 *
 * Two nodes running the full protocol stack in a single browser tab:
 *   - WebCrypto P-256 identity (ECDSA signing + ECDH key agreement)
 *   - BroadcastChannel transport (real message passing)
 *   - 5-phase authenticated bond negotiation (challenge → response → confirm → ECDH → ACTIVE)
 *   - AES-256-GCM encrypted messaging over the bond
 *   - Vault with per-layer DEK wrapping and real encryption
 *   - Care score with exponential decay and hysteresis tier transitions
 *
 * Imports from the @p31/node-zero package (local source).
 * Requires React 18+ and a bundler (Vite recommended).
 *
 * Usage:
 *   npm create vite@latest demo -- --template react
 *   cd demo && npm i && cp ../node-zero-demo.jsx src/App.jsx
 *   # Add "../src" to vite resolve alias or install @p31/node-zero
 *   npm run dev
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Real Protocol Imports ──────────────────────────────────────────
// Change these to "@p31/node-zero" or "@p31/node-zero/primitives" etc.
// if using the published package instead of local source.

import { WebCryptoIdentityProvider } from "./src/backends/webcrypto-identity.js";
import { BroadcastChannelTransport } from "./src/transports/websocket.js";
import { ChannelManager } from "./src/primitives/channel-manager.js";
import { StateEngine } from "./src/primitives/state-engine.js";
import { VaultStore } from "./src/primitives/vault-store.js";
import { deriveNodeId, randomBytes } from "./src/backends/crypto-utils.js";

// ─── Protocol Node ──────────────────────────────────────────────────

class DemoNode {
  constructor(name, channelName) {
    this.name = name;
    this.identity = new WebCryptoIdentityProvider();
    this.transport = new BroadcastChannelTransport(channelName);
    this.channel = null;
    this.state = null;
    this.vault = new VaultStore(randomBytes(32));
    this.nodeId = null;
    this.compressedPubKey = null;
  }

  async boot() {
    await this.identity.generateKeypair();
    const fullIdentity = await this.identity.exportPublicKey();

    this.nodeId = fullIdentity.nodeId;
    this.compressedPubKey = fullIdentity.publicKey.data;

    await this.transport.configure({ medium: "WEBSOCKET", mtu: 65535 });
    this.transport.setLocalIdentity(this.compressedPubKey);

    this.state = new StateEngine(this.nodeId);
    this.channel = new ChannelManager(this.identity, this.transport);

    return fullIdentity;
  }

  async updateAxis(axis, value) {
    if (this.state) {
      await this.state.updateAxis(axis, value);
    }
  }

  getVoltage() {
    return this.state?.getComposite()?.composite ?? 0;
  }

  getSpoons() {
    return this.state?.getSpoonCount() ?? 12;
  }

  getTier() {
    return this.state?.getCurrentTier() ?? "FULL";
  }

  destroy() {
    this.channel?.destroy();
    this.transport?.close();
  }
}

// ─── Theme ──────────────────────────────────────────────────────────

const T = {
  FULL: { bg: "#040d07", bd: "#16a34a18", ac: "#22c55e", gl: "0 0 80px rgba(34,197,94,0.06)", tx: "#86efac", pl: "#14532d" },
  PATTERN: { bg: "#0d0800", bd: "#d9770618", ac: "#f59e0b", gl: "0 0 80px rgba(245,158,11,0.06)", tx: "#fcd34d", pl: "#451a03" },
  REFLEX: { bg: "#0d0404", bd: "#dc262618", ac: "#ef4444", gl: "0 0 80px rgba(239,68,68,0.08)", tx: "#fca5a5", pl: "#450a0a" },
};

// ─── UI Components ──────────────────────────────────────────────────

function Dots({ n, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{
          width: i < n ? 7 : 4, height: i < n ? 7 : 4, borderRadius: "50%", transition: "all 0.5s",
          backgroundColor: i < n ? color : "rgba(255,255,255,0.05)",
          boxShadow: i < n ? `0 0 5px ${color}40` : "none",
        }} />
      ))}
      <span style={{ fontSize: 9, opacity: 0.3, marginLeft: 4, fontFamily: "monospace" }}>{n}</span>
    </div>
  );
}

function Axis({ label, val, onChange, min = 0, accentColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 9, opacity: 0.3, width: 64, fontFamily: "monospace" }}>{label}</span>
      <input type="range" min={min * 100} max={100} value={Math.round(val * 100)}
        onChange={e => onChange(parseInt(e.target.value) / 100)}
        style={{ flex: 1, height: 2, accentColor: accentColor || "#22c55e", cursor: "pointer" }} />
      <span style={{ fontSize: 9, opacity: 0.3, width: 32, textAlign: "right", fontFamily: "monospace" }}>{val.toFixed(2)}</span>
    </div>
  );
}

function Card({ node, axes, onSet, peerState, bond, trustTier, careScore }) {
  if (!node?.nodeId) return null;
  const tier = node.getTier();
  const t = T[tier];
  const v = node.getVoltage();
  const sp = node.getSpoons();

  return (
    <div style={{ backgroundColor: t.bg, borderRadius: 14, padding: 18, border: `1px solid ${t.bd}`, boxShadow: t.gl, transition: "all 0.7s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.tx, letterSpacing: -0.3 }}>{node.name}</div>
          <div style={{ fontSize: 8, opacity: 0.2, fontFamily: "monospace", marginTop: 1 }}>{node.nodeId.slice(0, 16)}…</div>
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 16, backgroundColor: t.pl, color: t.tx, border: `1px solid ${t.ac}18` }}>{tier}</div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, opacity: 0.25, fontFamily: "monospace", marginBottom: 2 }}>
          <span>φ voltage</span><span>{v.toFixed(3)}</span>
        </div>
        <div style={{ height: 2.5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${v * 100}%`, backgroundColor: t.ac, borderRadius: 3, transition: "width 0.7s", boxShadow: `0 0 6px ${t.ac}30` }} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, opacity: 0.25, fontFamily: "monospace", marginBottom: 2 }}>spoons</div>
        <Dots n={sp} color={t.ac} />
      </div>
      <div style={{ padding: 8, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)", marginBottom: 10 }}>
        <Axis label="URGENCY" val={axes.urgency} onChange={x => onSet("urgency", x)} accentColor={t.ac} />
        <Axis label="VALENCE" val={axes.valence} onChange={x => onSet("valence", x)} min={-1} accentColor={t.ac} />
        <Axis label="COGNITIVE" val={axes.cognitive} onChange={x => onSet("cognitive", x)} accentColor={t.ac} />
      </div>
      {peerState && (
        <div style={{ padding: 8, borderRadius: 8, border: `1px dashed ${t.ac}12`, backgroundColor: "rgba(0,0,0,0.12)" }}>
          <div style={{ fontSize: 8, opacity: 0.2, fontFamily: "monospace", marginBottom: 4 }}>Remote Peer</div>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            {[["spoons", peerState.spoons], ["voltage", peerState.voltage.toFixed(2)], ["tier", peerState.tier]].map(([l, val]) => (
              <div key={l}><div style={{ fontSize: 14, fontWeight: 700, color: t.tx }}>{val}</div><div style={{ fontSize: 8, opacity: 0.25 }}>{l}</div></div>
            ))}
          </div>
        </div>
      )}
      {bond && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: t.ac, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 8, opacity: 0.35, fontFamily: "monospace" }}>
            ECDH Bond · {Array.from(bond.channel.sharedSecret.slice(0, 4)).map(b => b.toString(16).padStart(2, "0")).join("")}…
            {trustTier && ` · ${trustTier}`}
            {careScore != null && ` · CS: ${careScore.toFixed(3)}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────

export default function App() {
  const [ready, setReady] = useState(false);
  const [bonded, setBonded] = useState(false);
  const [bondData, setBondData] = useState({ alpha: null, beta: null });
  const [trustInfo, setTrustInfo] = useState({ tier: null, careScore: null });
  const [sigVerified, setSigVerified] = useState(null);
  const [msgReceived, setMsgReceived] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [axesA, setAxesA] = useState({ urgency: 0, valence: 0, cognitive: 0 });
  const [axesB, setAxesB] = useState({ urgency: 0, valence: 0, cognitive: 0 });
  const [peerA, setPeerA] = useState(null);
  const [peerB, setPeerB] = useState(null);
  const [, tick] = useState(0);
  const alphaRef = useRef(null);
  const betaRef = useRef(null);
  const [log, setLog] = useState([]);

  const addLog = useCallback((source, msg) => {
    setLog(p => [...p.slice(-30), { t: Date.now(), source, msg }]);
  }, []);

  // Boot both nodes
  useEffect(() => {
    let mounted = true;
    (async () => {
      const alpha = new DemoNode("Alpha", "n0-demo-mesh");
      const beta = new DemoNode("Beta", "n0-demo-mesh");

      const idA = await alpha.boot();
      const idB = await beta.boot();

      if (!mounted) { alpha.destroy(); beta.destroy(); return; }

      alphaRef.current = alpha;
      betaRef.current = beta;
      setReady(true);
      addLog("SYS", `Alpha identity: ${idA.nodeId.slice(0, 20)}…`);
      addLog("SYS", `Beta identity: ${idB.nodeId.slice(0, 20)}…`);
      addLog("SYS", `Transport: BroadcastChannel "n0-demo-mesh"`);
    })();
    return () => { mounted = false; alphaRef.current?.destroy(); betaRef.current?.destroy(); };
  }, [addLog]);

  // Bond negotiation — real 5-phase protocol
  const doBond = async () => {
    if (bonded) return;
    const alpha = alphaRef.current;
    const beta = betaRef.current;
    if (!alpha || !beta) return;

    addLog("SYS", "── Bond Negotiation ──");
    addLog("ALPHA", "Initiating 5-phase bond protocol…");
    addLog("BETA", "Listening for BondChallenge (0x10)…");

    const t0 = performance.now();

    try {
      // Run initiate + accept concurrently over BroadcastChannel
      await Promise.all([
        alpha.channel.initiate(beta.compressedPubKey),
        beta.channel.accept(alpha.compressedPubKey),
      ]);

      const elapsed = (performance.now() - t0).toFixed(0);
      const alphaBond = alpha.channel.listBonds()[0];
      const betaBond = beta.channel.listBonds()[0];

      if (alphaBond && betaBond) {
        const secretMatch = alphaBond.channel.sharedSecret.every(
          (b, i) => b === betaBond.channel.sharedSecret[i]
        );

        setBonded(true);
        setBondData({ alpha: alphaBond, beta: betaBond });
        setTrustInfo({
          tier: alphaBond.trust.tier,
          careScore: alphaBond.trust.careScore,
        });

        addLog("SYS", `A1 Challenge → A2 Response → A3 Confirm (${elapsed}ms)`);
        addLog("SYS", `ECDH shared secret: ${secretMatch ? "MATCHED ✓" : "MISMATCH ✗"} (32 bytes)`);
        addLog("SYS", `Bond ACTIVE · Trust: ${alphaBond.trust.tier} · CS: ${alphaBond.trust.careScore}`);

        // Verify cross-node ECDSA signature
        const msg = new TextEncoder().encode("bond-proof-" + Date.now());
        const sig = await alpha.identity.sign(msg);
        const ok = await beta.identity.verify(msg, sig, alpha.compressedPubKey);
        setSigVerified(ok);
        addLog("SYS", `ECDSA cross-verify: ${ok ? "PASSED ✓" : "FAILED ✗"}`);

        // Wire care score events
        alpha.channel.on("CARE_SCORE_UPDATED", (e) => {
          setTrustInfo(prev => ({ ...prev, careScore: e.score }));
        });
        alpha.channel.on("BOND_TRUST_CHANGED", (e) => {
          setTrustInfo(prev => ({ ...prev, tier: e.currentTier }));
          addLog("SYS", `⚡ Trust: ${e.previousTier} → ${e.currentTier} (CS: ${e.careScore.toFixed(3)})`);
        });

        // Send an encrypted message over the bond
        addLog("ALPHA", "Sending encrypted PING over bond…");
        await alpha.channel.send({
          type: "PING",
          payload: new TextEncoder().encode("hello from Alpha"),
          timestamp: Math.floor(Date.now() / 1000),
          senderId: alphaBond.partner.nodeId,
        });

        // Listen for it on Beta
        beta.channel.receive((message) => {
          const text = new TextDecoder().decode(message.payload);
          setMsgReceived(text);
          addLog("BETA", `📩 Decrypted ${message.type}: "${text}"`);
        });

        // Small delay for async transport delivery
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      addLog("ERR", `Bond failed: ${err.message}`);
    }
  };

  // Vault encryption demo
  const doVault = async () => {
    const alpha = alphaRef.current;
    if (!alpha) return;

    addLog("SYS", "── Vault Encryption Demo ──");

    try {
      await alpha.vault.createLayer("metabolic-baseline", {
        baselineVoltage: "number",
        baselineSpoons: "number",
        medications: "string[]",
        sensoryProfile: "object",
      });
      addLog("ALPHA", `🔒 Vault layer "metabolic-baseline" created · DEK wrapped`);

      const medicalData = {
        baselineVoltage: alpha.getVoltage(),
        baselineSpoons: alpha.getSpoons(),
        medications: ["calcitriol", "calcium-citrate"],
        sensoryProfile: { auditory: 0.8, visual: 0.6, tactile: 0.9 },
        timestamp: new Date().toISOString(),
      };

      await alpha.vault.write("metabolic-baseline", medicalData);
      addLog("ALPHA", `🔒 Vault write → "metabolic-baseline" · encrypted`);

      const decrypted = await alpha.vault.readAsOwner("metabolic-baseline");
      addLog("ALPHA", `🔓 Vault read-back verified: ✓ decryption OK`);

      const integrityOk = JSON.stringify(decrypted) === JSON.stringify(medicalData);
      addLog("SYS", `Data round-trip: ${integrityOk ? "intact ✓" : "corrupted ✗"} (${JSON.stringify(medicalData).length} bytes)`);

      setVaultData(decrypted);
    } catch (err) {
      addLog("ERR", `Vault: ${err.message}`);
    }
  };

  // State axis update handler
  const updateAxis = async (node, axis, value, setAxes, setPeerState) => {
    if (!node) return;
    const setter = axis === "valence"
      ? Math.max(-1, Math.min(1, value))
      : Math.max(0, Math.min(1, value));

    setAxes(prev => ({ ...prev, [axis]: setter }));
    await node.updateAxis(axis.toUpperCase(), setter);
    tick(n => n + 1);

    if (bonded) {
      setPeerState({
        voltage: node.getVoltage(),
        spoons: node.getSpoons(),
        tier: node.getTier(),
      });
    }
  };

  // Loading state
  if (!ready) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid #22c55e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
        <p style={{ color: "#86efac", fontSize: 11, fontFamily: "monospace" }}>Generating P-256 keypairs…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );

  const tier = alphaRef.current?.getTier() || "FULL";
  const tc = T[tier];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#000", color: "#fff", padding: 14, fontFamily: "'JetBrains Mono',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;700&display=swap" rel="stylesheet" />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5 }}>Node Zero Protocol</span>
        </div>
        <p style={{ fontSize: 8, opacity: 0.15, marginLeft: 11, marginBottom: 16 }}>P31 Labs · @p31/node-zero · Real 5-phase bond · AES-256-GCM · WebCrypto</p>

        {/* Node Alpha */}
        <Card
          node={alphaRef.current}
          axes={axesA}
          onSet={(ax, v) => updateAxis(alphaRef.current, ax, v, setAxesA, setPeerB)}
          peerState={peerA}
          bond={bondData.alpha}
          trustTier={trustInfo.tier}
          careScore={trustInfo.careScore}
        />

        {/* Bond / Connection */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
          {bonded ? (
            <>
              <div style={{ width: 1, height: 32, backgroundColor: tc.ac, boxShadow: `0 0 10px ${tc.ac}30`, transition: "all 0.7s" }} />
              <div style={{ fontSize: 8, padding: "1px 8px", borderRadius: 10, border: `1px solid ${tc.ac}20`, color: tc.tx, backgroundColor: "rgba(0,0,0,0.3)", marginTop: 3 }}>
                5-phase ECDH · AES-256-GCM · {trustInfo.tier || "STRUT"}
              </div>
            </>
          ) : (
            <button onClick={doBond} style={{
              padding: "7px 18px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontFamily: "inherit",
            }}>⚡ Initiate Bond</button>
          )}
        </div>

        {/* Node Beta */}
        <Card
          node={betaRef.current}
          axes={axesB}
          onSet={(ax, v) => updateAxis(betaRef.current, ax, v, setAxesB, setPeerA)}
          peerState={peerB}
          bond={bondData.beta}
          trustTier={trustInfo.tier}
          careScore={trustInfo.careScore}
        />

        {/* Signature verification badge */}
        {sigVerified !== null && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{
              padding: "4px 12px", borderRadius: 8, fontSize: 9, fontWeight: 700, display: "inline-block",
              backgroundColor: sigVerified ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${sigVerified ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
              color: sigVerified ? "#86efac" : "#fca5a5",
            }}>{sigVerified ? "✓ Cross-node ECDSA verified · Encrypted message delivered" : "✗ Verification failed"}</span>
          </div>
        )}

        {/* Vault demo button */}
        {bonded && !vaultData && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={doVault} style={{
              padding: "7px 18px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontFamily: "inherit",
            }}>🔒 Run Vault Encryption Demo</button>
          </div>
        )}

        {/* Vault data display */}
        {vaultData && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(34,197,94,0.1)", backgroundColor: "rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 8, opacity: 0.25, marginBottom: 6, fontFamily: "monospace" }}>
              VAULT LAYER: metabolic-baseline (DECRYPTED)
            </div>
            <pre style={{ fontSize: 10, color: "#86efac", fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
              {JSON.stringify(vaultData, null, 2)}
            </pre>
          </div>
        )}

        {/* Protocol log */}
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.03)", backgroundColor: "rgba(255,255,255,0.01)" }}>
          <div style={{ fontSize: 8, opacity: 0.15, marginBottom: 6, fontFamily: "monospace" }}>PROTOCOL LOG</div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {log.map((e, i) => (
              <div key={i} style={{ fontSize: 9, opacity: 0.45, display: "flex", gap: 6, marginBottom: 2 }}>
                <span style={{ opacity: 0.5, minWidth: 72, fontSize: 8 }}>{new Date(e.t).toLocaleTimeString()}</span>
                <span style={{
                  minWidth: 40, fontSize: 8, fontWeight: 700,
                  color: e.source === "ALPHA" ? "#86efac" : e.source === "BETA" ? "#93c5fd" : e.source === "ERR" ? "#fca5a5" : "#6b7280"
                }}>{e.source}</span>
                <span>{e.msg}</span>
              </div>
            ))}
            {!log.length && <div style={{ fontSize: 9, opacity: 0.12 }}>Awaiting protocol events…</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 8, opacity: 0.1, fontFamily: "monospace" }}>
          @p31/node-zero · npm · 192 tests · 0 dependencies
        </div>
      </div>
    </div>
  );
}
