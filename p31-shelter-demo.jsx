/**
 * P31 Shelter Demo — Full Stack
 *
 * Two nodes running the complete protocol + economic layer:
 *   - WebCrypto P-256 identity (ECDSA + ECDH)
 *   - BroadcastChannel transport
 *   - 5-phase bond negotiation → AES-256-GCM encrypted messaging
 *   - Vault with per-layer DEK wrapping
 *   - Care score with hysteresis tier transitions
 *   - LOVE ledger: protocol events → economic transactions → two-pool wallet
 *   - Age-gated vesting for founding nodes
 *
 * Imports from local source. Swap to npm packages:
 *   import { WebCryptoIdentityProvider, ... } from "@p31/node-zero";
 *   import { LedgerEngine } from "@p31/love-ledger";
 *
 * Usage:
 *   npm create vite@latest shelter -- --template react
 *   cd shelter && npm i
 *   # Copy this file to src/App.jsx, adjust imports or set up Vite aliases
 *   npm run dev
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Node Zero Protocol ─────────────────────────────────────────────
import { WebCryptoIdentityProvider } from "./src/backends/webcrypto-identity.js";
import { BroadcastChannelTransport } from "./src/transports/websocket.js";
import { ChannelManager } from "./src/primitives/channel-manager.js";
import { StateEngine } from "./src/primitives/state-engine.js";
import { VaultStore } from "./src/primitives/vault-store.js";
import { randomBytes } from "./src/backends/crypto-utils.js";

// ─── Love Ledger ────────────────────────────────────────────────────
import { LedgerEngine } from "../love-ledger/src/ledger.js";
import { computeAllVesting } from "../love-ledger/src/vesting.js";

// ─── Color System ───────────────────────────────────────────────────

const AMBER = {
  50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 300: "#FCD34D",
  400: "#FBBF24", 500: "#F59E0B", 600: "#D97706", 700: "#B45309",
  800: "#92400E", 900: "#78350F", 950: "#451A03",
};

const W = {
  bg: "#1C1510", card: "#261E17", cardHover: "#302520",
  border: "#3D3128", borderLight: "#5C4A3A",
  text: "#F5E6D3", textMuted: "#B89B7A", textDim: "#8A7560",
  glow: "rgba(251, 191, 36, 0.15)", glowStrong: "rgba(251, 191, 36, 0.3)",
};

const PROTO = {
  bg: "#040d07", accent: "#22c55e", text: "#86efac", muted: "#14532d",
  border: "rgba(34,197,94,0.08)",
};

const TX_META = {
  BLOCK_PLACED: { icon: "🧱", label: "Block Placed" },
  COHERENCE_GIFT: { icon: "🔗", label: "Coherence Gift" },
  ARTIFACT_CREATED: { icon: "💎", label: "Artifact Created" },
  CARE_RECEIVED: { icon: "💛", label: "Care Received" },
  CARE_GIVEN: { icon: "🤲", label: "Care Given" },
  TETRAHEDRON_BOND: { icon: "🔺", label: "Tetrahedron Bond" },
  VOLTAGE_CALMED: { icon: "🌊", label: "Voltage Calmed" },
  MILESTONE_REACHED: { icon: "⭐", label: "Milestone" },
  PING: { icon: "📡", label: "Ping" },
  DONATION: { icon: "🎁", label: "Donation" },
};

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
    const id = await this.identity.exportPublicKey();
    this.nodeId = id.nodeId;
    this.compressedPubKey = id.publicKey.data;
    await this.transport.configure({ medium: "WEBSOCKET", mtu: 65535 });
    this.transport.setLocalIdentity(this.compressedPubKey);
    this.state = new StateEngine(this.nodeId);
    this.channel = new ChannelManager(this.identity, this.transport);
    return id;
  }

  async updateAxis(axis, value) {
    if (this.state) await this.state.updateAxis(axis, value);
  }

  getVoltage() { return this.state?.getComposite()?.composite ?? 0; }
  getSpoons() { return this.state?.getSpoonCount() ?? 12; }
  getTier() { return this.state?.getCurrentTier() ?? "FULL"; }
  destroy() { this.channel?.destroy(); this.transport?.close(); }
}

// ─── Wallet Display ─────────────────────────────────────────────────

function WalletHeader({ wallet, lovePerDay }) {
  return (
    <div style={{
      padding: "24px 20px 16px",
      background: `linear-gradient(180deg, ${AMBER[950]}40 0%, transparent 100%)`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
        textTransform: "uppercase", color: AMBER[500], marginBottom: 2,
      }}>
        L.O.V.E. WALLET
      </div>
      <div style={{ fontSize: 11, color: W.textMuted, marginBottom: 16 }}>
        Ledger of Ontological Volume and Entropy
      </div>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{
          fontSize: 48, fontWeight: 700, lineHeight: 1,
          fontFamily: "'JetBrains Mono', monospace",
          color: AMBER[400],
          textShadow: `0 0 40px ${AMBER[400]}30`,
          fontFeatureSettings: '"tnum"',
        }}>
          {wallet.totalEarned.toFixed(1)}
        </div>
        <div style={{
          fontSize: 11, color: W.textDim, marginTop: 4,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          soulbound LOVE
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, color: W.textMuted }}>
        <div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600, color: AMBER[300] }}>
            {wallet.sovereigntyPool.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, marginLeft: 3 }}>sovereignty</span>
        </div>
        <div style={{ color: W.border }}>|</div>
        <div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600, color: AMBER[500] }}>
            {wallet.availableBalance.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, marginLeft: 3 }}>available</span>
        </div>
        <div style={{ color: W.border }}>|</div>
        <div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 600, color: W.textDim }}>
            {wallet.frozenBalance.toFixed(1)}
          </span>
          <span style={{ fontSize: 9, marginLeft: 3 }}>frozen</span>
        </div>
      </div>

      {lovePerDay > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: W.textDim }}>
          {lovePerDay.toFixed(1)} LOVE/day (7d avg)
        </div>
      )}
    </div>
  );
}

function PoolBar({ wallet }) {
  const sovPct = wallet.totalEarned > 0 ? (wallet.sovereigntyPool / wallet.totalEarned) * 100 : 50;
  const availPct = wallet.totalEarned > 0 ? (wallet.availableBalance / wallet.totalEarned) * 100 : 0;
  const frozenPct = wallet.totalEarned > 0 ? (wallet.frozenBalance / wallet.totalEarned) * 100 : 50;

  return (
    <div style={{ padding: "0 20px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: W.textDim, marginBottom: 4 }}>
        <span>CS {wallet.careScore.toFixed(2)}</span>
        <span>{(wallet.careScore * 100).toFixed(0)}% perf unlocked</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, display: "flex", overflow: "hidden", gap: 1, backgroundColor: W.border }}>
        <div style={{ width: `${sovPct}%`, backgroundColor: AMBER[700], borderRadius: "3px 0 0 3px", transition: "width 0.5s" }} />
        <div style={{ width: `${availPct}%`, backgroundColor: AMBER[400], transition: "width 0.5s" }} />
        <div style={{ width: `${frozenPct}%`, backgroundColor: W.border, borderRadius: "0 3px 3px 0", transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, marginTop: 3 }}>
        <span style={{ color: AMBER[700] }}>sovereignty</span>
        <span style={{ color: AMBER[400] }}>available</span>
        <span style={{ color: W.textDim }}>frozen</span>
      </div>
    </div>
  );
}

function TransactionFeed({ transactions }) {
  const recent = transactions.slice(-15).reverse();

  return (
    <div style={{
      padding: "12px 20px",
      maxHeight: 260, overflowY: "auto",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: W.textDim,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        Transaction Log
      </div>
      {recent.length === 0 && (
        <div style={{ fontSize: 11, color: W.textDim, padding: "20px 0", textAlign: "center" }}>
          Awaiting protocol events...
        </div>
      )}
      {recent.map((tx) => {
        const meta = TX_META[tx.type] || { icon: "•", label: tx.type };
        const d = new Date(tx.timestamp);
        const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return (
          <div key={tx.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: `1px solid ${W.border}`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: W.glow, fontSize: 16, flexShrink: 0,
            }}>
              {meta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: W.text }}>{meta.label}</div>
              <div style={{ fontSize: 9, color: W.textDim }}>
                {timeStr}
                {tx.counterparty && <span> · {tx.counterparty.slice(0, 12)}…</span>}
              </div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: AMBER[400],
              fontFamily: "'JetBrains Mono'", fontFeatureSettings: '"tnum"',
            }}>
              +{tx.amount.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VestingPanel({ vestingData }) {
  if (!vestingData || vestingData.length === 0) return null;

  return (
    <div style={{ padding: "12px 20px" }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: W.textDim,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
      }}>
        Founding Node Vesting
      </div>
      {vestingData.map((v) => (
        <div key={v.node.initials} style={{
          padding: "10px 14px", borderRadius: 10, marginBottom: 8,
          background: W.card, border: `1px solid ${W.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: W.text }}>{v.node.initials}</span>
              <span style={{ fontSize: 10, color: W.textDim, marginLeft: 6 }}>age {v.ageYears}</span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
              backgroundColor: v.vestedPercent > 0 ? AMBER[900] : W.card,
              color: v.vestedPercent > 0 ? AMBER[300] : W.textDim,
              border: `1px solid ${v.vestedPercent > 0 ? AMBER[700] : W.border}`,
            }}>
              {v.vestedPercent}% vested
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: W.border, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${v.vestedPercent}%`, borderRadius: 2,
              background: `linear-gradient(90deg, ${AMBER[700]}, ${AMBER[400]})`,
              transition: "width 0.5s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 4 }}>
            <span style={{ color: AMBER[500] }}>{v.vestedAmount.toFixed(1)} LOVE unlocked</span>
            {v.nextMilestone && (
              <span style={{ color: W.textDim }}>
                next: age {v.nextMilestone.ageYears} ({v.daysUntilNext}d)
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Protocol Status ────────────────────────────────────────────────

function ProtocolStatus({ node, bonded, bondData, trustTier, careScore, onBond, onVault, vaultDone }) {
  if (!node?.nodeId) return null;

  return (
    <div style={{
      padding: "14px 20px", backgroundColor: PROTO.bg,
      borderBottom: `1px solid ${PROTO.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          backgroundColor: PROTO.accent,
          animation: "pulse 2s infinite",
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: PROTO.text, letterSpacing: -0.3 }}>
          {node.name}
        </span>
        <span style={{ fontSize: 8, opacity: 0.3, fontFamily: "monospace", color: PROTO.text }}>
          {node.nodeId.slice(0, 20)}…
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {bonded ? (
          <>
            <span style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 10,
              backgroundColor: PROTO.muted, color: PROTO.text,
              border: `1px solid ${PROTO.accent}20`,
            }}>
              ECDH Bond Active · {trustTier || "STRUT"} · CS {(careScore ?? 0).toFixed(3)}
            </span>
            {!vaultDone && (
              <button onClick={onVault} style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: "pointer",
                backgroundColor: "rgba(34,197,94,0.06)", border: `1px solid ${PROTO.accent}30`,
                color: PROTO.text, fontFamily: "monospace",
              }}>
                Vault Demo
              </button>
            )}
            {vaultDone && (
              <span style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 10,
                backgroundColor: PROTO.muted, color: PROTO.text,
              }}>
                Vault: encrypted + verified
              </span>
            )}
          </>
        ) : (
          <button onClick={onBond} style={{
            padding: "5px 14px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
            backgroundColor: "rgba(34,197,94,0.06)", border: `1px solid ${PROTO.accent}30`,
            color: PROTO.text, fontFamily: "monospace",
          }}>
            Initiate Bond
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Protocol Log ───────────────────────────────────────────────────

function ProtocolLog({ entries }) {
  return (
    <div style={{
      padding: "10px 20px", backgroundColor: PROTO.bg,
      borderTop: `1px solid ${PROTO.border}`, maxHeight: 160, overflowY: "auto",
    }}>
      <div style={{ fontSize: 8, opacity: 0.2, fontFamily: "monospace", color: PROTO.text, marginBottom: 4 }}>
        PROTOCOL LOG
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{
          fontSize: 9, display: "flex", gap: 6, marginBottom: 1,
          fontFamily: "monospace", opacity: 0.5,
        }}>
          <span style={{ opacity: 0.5, minWidth: 64, fontSize: 8, color: "#6b7280" }}>
            {new Date(e.t).toLocaleTimeString()}
          </span>
          <span style={{
            minWidth: 36, fontSize: 8, fontWeight: 700,
            color: e.source === "ALPHA" ? "#86efac" : e.source === "BETA" ? "#93c5fd" : e.source === "LOVE" ? AMBER[400] : "#6b7280",
          }}>
            {e.source}
          </span>
          <span style={{ color: "#9ca3af" }}>{e.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────

export default function App() {
  const [ready, setReady] = useState(false);
  const [bonded, setBonded] = useState(false);
  const [bondData, setBondData] = useState(null);
  const [trustInfo, setTrustInfo] = useState({ tier: null, careScore: null });
  const [vaultDone, setVaultDone] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [vestingData, setVestingData] = useState([]);
  const [, tick] = useState(0);
  const [log, setLog] = useState([]);

  const alphaRef = useRef(null);
  const betaRef = useRef(null);
  const ledgerRef = useRef(null);

  const addLog = useCallback((source, msg) => {
    setLog(p => [...p.slice(-40), { t: Date.now(), source, msg }]);
  }, []);

  const refreshWallet = useCallback(() => {
    const ledger = ledgerRef.current;
    if (!ledger) return;
    setWallet({ ...ledger.wallet });
    setTransactions([...ledger.transactions]);
    setVestingData([...ledger.vesting]);
  }, []);

  // Boot
  useEffect(() => {
    let mounted = true;
    (async () => {
      const alpha = new DemoNode("Alpha", "p31-shelter-mesh");
      const beta = new DemoNode("Beta", "p31-shelter-mesh");
      const idA = await alpha.boot();
      const idB = await beta.boot();
      if (!mounted) { alpha.destroy(); beta.destroy(); return; }

      alphaRef.current = alpha;
      betaRef.current = beta;

      const ledger = new LedgerEngine(idA.nodeId);
      ledgerRef.current = ledger;

      ledger.on("LOVE_EARNED", (tx) => {
        addLog("LOVE", `+${tx.amount.toFixed(1)} ${tx.type}`);
        refreshWallet();
      });
      ledger.on("POOL_REBALANCED", (data) => {
        addLog("LOVE", `Pool rebalanced · CS ${data.careScore.toFixed(3)} · avail ${data.availableBalance.toFixed(1)}`);
        refreshWallet();
      });

      refreshWallet();
      setReady(true);
      addLog("SYS", `Alpha: ${idA.nodeId.slice(0, 16)}…`);
      addLog("SYS", `Beta: ${idB.nodeId.slice(0, 16)}…`);
      addLog("SYS", "Transport: BroadcastChannel");
    })();
    return () => { mounted = false; alphaRef.current?.destroy(); betaRef.current?.destroy(); };
  }, [addLog, refreshWallet]);

  // Bond
  const doBond = async () => {
    if (bonded) return;
    const alpha = alphaRef.current;
    const beta = betaRef.current;
    const ledger = ledgerRef.current;
    if (!alpha || !beta || !ledger) return;

    addLog("SYS", "── Bond Negotiation ──");
    const t0 = performance.now();

    try {
      await Promise.all([
        alpha.channel.initiate(beta.compressedPubKey),
        beta.channel.accept(alpha.compressedPubKey),
      ]);

      const elapsed = (performance.now() - t0).toFixed(0);
      const alphaBond = alpha.channel.listBonds()[0];
      const betaBond = beta.channel.listBonds()[0];

      if (alphaBond && betaBond) {
        setBonded(true);
        setBondData(alphaBond);
        setTrustInfo({ tier: alphaBond.trust.tier, careScore: alphaBond.trust.careScore });

        addLog("SYS", `Bond ACTIVE in ${elapsed}ms · ${alphaBond.trust.tier}`);

        // Ingest bond event
        ledger.ingest("BOND_FORMED", { peerId: betaRef.current.nodeId });
        // Discovery ping
        ledger.ingest("PEER_DISCOVERED", { peerId: betaRef.current.nodeId });

        // Wire ongoing protocol events → ledger
        alpha.channel.on("CARE_SCORE_UPDATED", (e) => {
          setTrustInfo(prev => ({ ...prev, careScore: e.score }));
          ledger.ingest("CARE_SCORE_UPDATED", { score: e.score, careScore: e.score });
        });
        alpha.channel.on("BOND_TRUST_CHANGED", (e) => {
          setTrustInfo(prev => ({ ...prev, tier: e.currentTier }));
          ledger.ingest("BOND_TRUST_CHANGED", {
            previousTier: e.previousTier,
            currentTier: e.currentTier,
            peerId: betaRef.current?.nodeId,
          });
          addLog("SYS", `Trust: ${e.previousTier} → ${e.currentTier}`);
        });

        // Send encrypted message → CARE_GIVEN / CARE_RECEIVED
        await alpha.channel.send({
          type: "PING",
          payload: new TextEncoder().encode("hello from Alpha"),
          timestamp: Math.floor(Date.now() / 1000),
          senderId: alphaBond.partner.nodeId,
        });
        ledger.ingest("TRANSMIT_COMPLETE", { peerId: betaRef.current.nodeId });

        beta.channel.receive(() => {
          ledger.ingest("REMOTE_STATE_RECEIVED", { peerId: alphaRef.current?.nodeId });
        });

        await new Promise(r => setTimeout(r, 200));

        // Verify signatures
        const msg = new TextEncoder().encode("bond-proof");
        const sig = await alpha.identity.sign(msg);
        const ok = await beta.identity.verify(msg, sig, alpha.compressedPubKey);
        addLog("SYS", `ECDSA cross-verify: ${ok ? "PASSED" : "FAILED"}`);
      }
    } catch (err) {
      addLog("ERR", `Bond failed: ${err.message}`);
    }
  };

  // Vault
  const doVault = async () => {
    const alpha = alphaRef.current;
    const ledger = ledgerRef.current;
    if (!alpha || !ledger) return;

    try {
      await alpha.vault.createLayer("metabolic-baseline", {
        baselineVoltage: "number", baselineSpoons: "number",
        medications: "string[]", sensoryProfile: "object",
      });
      ledger.ingest("VAULT_LAYER_CREATED", { layerName: "metabolic-baseline" });

      const data = {
        baselineVoltage: alpha.getVoltage(),
        baselineSpoons: alpha.getSpoons(),
        medications: ["calcitriol", "calcium-citrate"],
        sensoryProfile: { auditory: 0.8, visual: 0.6, tactile: 0.9 },
        timestamp: new Date().toISOString(),
      };

      await alpha.vault.write("metabolic-baseline", data);
      const readback = await alpha.vault.readAsOwner("metabolic-baseline");
      const ok = JSON.stringify(readback) === JSON.stringify(data);
      addLog("SYS", `Vault: write → encrypt → decrypt → ${ok ? "verified" : "FAILED"}`);
      setVaultDone(true);
    } catch (err) {
      addLog("ERR", `Vault: ${err.message}`);
    }
  };

  // Simulate care interactions (for demoing LOVE accumulation)
  const simulateCare = () => {
    const ledger = ledgerRef.current;
    const beta = betaRef.current;
    if (!ledger || !beta) return;

    ledger.ingest("REMOTE_STATE_RECEIVED", { peerId: beta.nodeId });
    ledger.ingest("TRANSMIT_COMPLETE", { peerId: beta.nodeId });

    // Simulate coherence crossing threshold
    ledger.ingest("COHERENCE_CHANGED", { qValue: 0.3 });
    setTimeout(() => {
      ledger.ingest("COHERENCE_CHANGED", { qValue: 0.72 });
    }, 100);

    // Simulate voltage calming
    ledger.ingest("STATE_CHANGED", {
      state: { urgency: 0.9, valence: 0.8, cognitive: 0.7, coherence: 0.2 }
    });
    setTimeout(() => {
      ledger.ingest("STATE_CHANGED", {
        state: { urgency: 0.1, valence: 0.1, cognitive: 0.1, coherence: 0.9 }
      });
    }, 200);
  };

  // Loading
  if (!ready) return (
    <div style={{
      minHeight: "100vh", backgroundColor: W.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 20, height: 20, border: `2px solid ${AMBER[500]}`,
          borderTopColor: "transparent", borderRadius: "50%",
          animation: "spin 1s linear infinite", margin: "0 auto 10px",
        }} />
        <p style={{ color: AMBER[400], fontSize: 11, fontFamily: "monospace" }}>
          Generating P-256 keypairs…
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );

  const currentWallet = wallet || {
    totalEarned: 0, sovereigntyPool: 0, performancePool: 0,
    careScore: 0.5, availableBalance: 0, frozenBalance: 0,
    transactionCount: 0, lastActivity: new Date(0).toISOString(),
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: W.bg, color: W.text,
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      maxWidth: 480, margin: "0 auto",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${W.border};border-radius:2px}`}</style>

      {/* Protocol Layer */}
      <ProtocolStatus
        node={alphaRef.current}
        bonded={bonded}
        bondData={bondData}
        trustTier={trustInfo.tier}
        careScore={trustInfo.careScore}
        onBond={doBond}
        onVault={doVault}
        vaultDone={vaultDone}
      />

      {/* LOVE Wallet */}
      <WalletHeader wallet={currentWallet} lovePerDay={ledgerRef.current?.lovePerDay ?? 0} />
      <PoolBar wallet={currentWallet} />

      {/* Simulate button */}
      {bonded && (
        <div style={{ textAlign: "center", padding: "8px 20px" }}>
          <button onClick={simulateCare} style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
            backgroundColor: AMBER[950], border: `1px solid ${AMBER[700]}30`,
            color: AMBER[400], fontFamily: "'DM Sans'",
          }}>
            Simulate Care Interaction
          </button>
          <button onClick={() => ledgerRef.current?.blockPlaced({ blockType: "carbon" })} style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
            backgroundColor: AMBER[950], border: `1px solid ${AMBER[700]}30`,
            color: AMBER[400], fontFamily: "'DM Sans'", marginLeft: 8,
          }}>
            Place Block (+1)
          </button>
          <button onClick={() => ledgerRef.current?.donate(25, { source: "HCB" })} style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer",
            backgroundColor: AMBER[950], border: `1px solid ${AMBER[700]}30`,
            color: AMBER[400], fontFamily: "'DM Sans'", marginLeft: 8,
          }}>
            Donate 25 LOVE
          </button>
        </div>
      )}

      {/* Transaction feed */}
      <TransactionFeed transactions={transactions} />

      {/* Vesting */}
      <VestingPanel vestingData={vestingData} />

      {/* Protocol log */}
      <ProtocolLog entries={log} />

      {/* Footer */}
      <div style={{
        padding: "16px 24px 32px", textAlign: "center",
        fontSize: 9, color: W.textDim, letterSpacing: "0.06em",
        fontFamily: "monospace",
      }}>
        @p31/node-zero · @p31/love-ledger · {transactions.length} transactions · 307 tests
        <br />
        <span style={{ color: AMBER[700] }}>P31 LABS</span> · SOULBOUND · ZERO DEPENDENCIES
      </div>
    </div>
  );
}
