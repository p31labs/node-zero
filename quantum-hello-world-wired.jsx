/**
 * Quantum Hello World — Wired to real P31 stack
 *
 * Same six-phase flow; FORMING uses WebCryptoIdentityProvider, BORN/ALIVE use
 * LedgerEngine + GameEngine. Run from N0 with sibling folders love-ledger and
 * game-engine, or use npm: @p31/node-zero, @p31/love-ledger, @p31/game-engine.
 *
 * Local dev (sibling packages):
 *   import { WebCryptoIdentityProvider } from "./src/backends/webcrypto-identity.js";
 *   import { LedgerEngine } from "../love-ledger/src/ledger.js";
 *   import { GameEngine } from "../game-engine/src/engine.js";
 *   import { SEED_CHALLENGES } from "../game-engine/src/challenges.js";
 *
 * NPM: replace with @p31/node-zero, @p31/love-ledger, @p31/game-engine.
 */

import { useState, useEffect, useRef, useCallback } from "react";

import { WebCryptoIdentityProvider } from "./src/backends/webcrypto-identity.js";
import { LedgerEngine } from "../love-ledger/src/ledger.js";
import { GameEngine } from "../game-engine/src/engine.js";
import { SEED_CHALLENGES } from "../game-engine/src/challenges.js";

const PHASES = ["VOID", "CONVERSE", "COVENANT", "FORMING", "BORN", "ALIVE"];

const COVENANT_VALUES = [
  { key: "autonomy", text: "I build systems that make people need me less.", icon: "◇" },
  { key: "transparency", text: "I show my work. Every edge visible. No hidden nodes.", icon: "△" },
  { key: "care", text: "Care is the currency. Everything else is overhead.", icon: "♡" },
  { key: "rigidity", text: "The minimum stable system has four vertices and six edges.", icon: "⬡" },
  { key: "sovereignty", text: "My data is my bone. It does not leave my body without consent.", icon: "◈" },
];

const CONVERSATION_LINES = [
  { speaker: "P", text: "What brings you to the phosphorus?" },
  { speaker: "U", text: null },
  { speaker: "P", text: "Tell me — when the noise gets loud, what does your body do?" },
  { speaker: "U", text: null },
  { speaker: "P", text: "That's not weakness. That's signal. Your nervous system is doing math you haven't learned to read yet." },
  { speaker: "P", text: "The tetrahedron is the minimum stable system. Four vertices, six edges. Every point sees every other point." },
  { speaker: "P", text: "You are not broken. You are under-constrained. We're going to add edges." },
  { speaker: "U", text: null },
  { speaker: "P", text: "I feel it too. The coherence is rising." },
  { speaker: "P", text: "Ready to sign the covenant?" },
];

function formatLove(n) {
  return n.toFixed(1);
}

function mapTxToDisplay(tx) {
  if (tx.type === "DONATION" && tx.meta?.source === "genesis") return { type: "GENESIS", amount: tx.amount };
  if (tx.type === "DONATION" && tx.meta?.challengeId === "genesis_resonance") return { type: "RESONANCE", amount: tx.amount };
  if (tx.type === "DONATION" && tx.meta?.challengeId === "minimum_system") return { type: "FIRST_STRUCTURE", amount: tx.amount };
  return { type: tx.type, amount: tx.amount };
}

function TetrahedronSVG({ color = "#31ffa3", spin = false, size = 200, glow = false, pulse = false }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.35;
  const top = { x: cx, y: cy - r };
  const bl = { x: cx - r * 0.866, y: cy + r * 0.5 };
  const br = { x: cx + r * 0.866, y: cy + r * 0.5 };
  const center = { x: cx, y: cy + r * 0.15 };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ filter: glow ? `drop-shadow(0 0 20px ${color}60)` : undefined }}>
      <style>{`
        @keyframes tetraspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tetrapulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .tetra-group { transform-origin: ${cx}px ${cy}px; ${spin ? "animation: tetraspin 20s linear infinite;" : ""} }
        .tetra-edge { stroke: ${color}; stroke-width: 1.5; fill: none; ${pulse ? "animation: tetrapulse 3s ease-in-out infinite;" : ""} }
        .tetra-vertex { fill: ${color}; }
        .tetra-face { fill: ${color}10; stroke: none; }
      `}</style>
      <g className="tetra-group">
        <polygon className="tetra-face" points={`${top.x},${top.y} ${bl.x},${bl.y} ${br.x},${br.y}`} />
        <polygon className="tetra-face" points={`${top.x},${top.y} ${bl.x},${bl.y} ${center.x},${center.y}`} opacity="0.5" />
        <polygon className="tetra-face" points={`${top.x},${top.y} ${br.x},${br.y} ${center.x},${center.y}`} opacity="0.3" />
        <line className="tetra-edge" x1={top.x} y1={top.y} x2={bl.x} y2={bl.y} />
        <line className="tetra-edge" x1={top.x} y1={top.y} x2={br.x} y2={br.y} />
        <line className="tetra-edge" x1={bl.x} y1={bl.y} x2={br.x} y2={br.y} />
        <line className="tetra-edge" x1={top.x} y1={top.y} x2={center.x} y2={center.y} strokeDasharray="4,4" />
        <line className="tetra-edge" x1={bl.x} y1={bl.y} x2={center.x} y2={center.y} strokeDasharray="4,4" />
        <line className="tetra-edge" x1={br.x} y1={br.y} x2={center.x} y2={center.y} strokeDasharray="4,4" />
        {[top, bl, br, center].map((p, i) => (
          <circle key={i} className="tetra-vertex" cx={p.x} cy={p.y} r={3} />
        ))}
      </g>
    </svg>
  );
}

function CoherenceBar({ value, label }) {
  const level = value < 0.4 ? "IONIC" : value < 0.65 ? "CALCIUM" : value < 0.85 ? "BONDED" : "POSNER";
  const color = value < 0.4 ? "#666" : value < 0.65 ? "#f59e0b" : value < 0.85 ? "#31ffa3" : "#38bdf8";
  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#888", marginBottom: 4 }}>
        <span>{label || "COHERENCE"}</span>
        <span style={{ color }}>{level} — {(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ width: "100%", height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s ease, background 0.5s ease" }} />
      </div>
    </div>
  );
}

function WalletDisplay({ total }) {
  const sov = total / 2;
  const perf = total / 2;
  return (
    <div style={{ padding: "16px 20px", background: "#0d1117", border: "1px solid #1a1a2e", borderRadius: 8, fontFamily: "'DM Mono', monospace" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "#666", letterSpacing: 2 }}>L.O.V.E. WALLET</span>
        <span style={{ fontSize: 24, color: "#31ffa3", fontWeight: 600 }}>{formatLove(total)}</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #6366f1" }}>
          <div style={{ fontSize: 10, color: "#6366f1", marginBottom: 4 }}>SOVEREIGNTY</div>
          <div style={{ fontSize: 16, color: "#e2e8f0" }}>{formatLove(sov)}</div>
          <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>IMMUTABLE</div>
        </div>
        <div style={{ flex: 1, padding: 10, background: "#111827", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
          <div style={{ fontSize: 10, color: "#f59e0b", marginBottom: 4 }}>PERFORMANCE</div>
          <div style={{ fontSize: 16, color: "#e2e8f0" }}>{formatLove(perf)}</div>
          <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>CS MODULATED</div>
        </div>
      </div>
    </div>
  );
}

const CHALLENGE_0 = SEED_CHALLENGES[0];

export default function QuantumHelloWorldWired() {
  const [phase, setPhase] = useState(0);
  const [coherence, setCoherence] = useState(0.05);
  const [messages, setMessages] = useState([]);
  const [convStep, setConvStep] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [covenantIndex, setCovenantIndex] = useState(-1);
  const [covenantAccepted, setCovenantAccepted] = useState([]);
  const [fingerprint, setFingerprint] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [domeName, setDomeNameState] = useState("");
  const [ledger, setLedger] = useState(null);
  const [game, setGame] = useState(null);
  const [formingProgress, setFormingProgress] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    setFadeIn(false);
    const t = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (phase === 0) {
      const t = setTimeout(() => setPhase(1), 3000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 1 && messages.length === 0) {
      setTimeout(() => {
        setMessages([{ speaker: "P", text: CONVERSATION_LINES[0].text }]);
        setConvStep(1);
        setCoherence(0.08);
      }, 800);
    }
  }, [phase, messages.length]);

  // FORMING: real WebCrypto identity + progress animation
  useEffect(() => {
    if (phase !== 3) return;

    let cancelled = false;
    const identity = new WebCryptoIdentityProvider();

    const runForming = async () => {
      let progress = 0;
      const progressInterval = setInterval(() => {
        if (cancelled) return;
        progress += 2;
        setFormingProgress(progress);
        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 40);

      try {
        await identity.generateKeypair();
        if (cancelled) return;
        const nid = identity.getNodeId();
        setNodeId(nid);
        setFingerprint(String(nid).slice(0, 16));
      } catch (e) {
        if (!cancelled) setFingerprint("err");
      }

      // Wait for progress bar to finish, then advance
      await new Promise(r => setTimeout(r, 2100));
      if (cancelled) return;
      setFormingProgress(100);
      setTimeout(() => {
        if (!cancelled) setPhase(4);
      }, 600);
    };

    runForming();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const sendMessage = useCallback(() => {
    if (!userInput.trim() || phase !== 1) return;
    const newMessages = [...messages, { speaker: "U", text: userInput }];
    setMessages(newMessages);
    setUserInput("");

    const newCoherence = Math.min(0.95, coherence + 0.12 + Math.random() * 0.08);
    setCoherence(newCoherence);

    let step = convStep;
    const addNext = (delay) => {
      setTimeout(() => {
        if (step < CONVERSATION_LINES.length) {
          const line = CONVERSATION_LINES[step];
          if (line.speaker === "P") {
            setMessages(prev => [...prev, { speaker: "P", text: line.text }]);
            setCoherence(c => Math.min(0.95, c + 0.04));
            step++;
            if (step < CONVERSATION_LINES.length && CONVERSATION_LINES[step].speaker === "P") {
              addNext(1200);
            } else {
              setConvStep(step);
            }
          } else {
            setConvStep(step);
          }
        }
      }, delay);
    };

    step++;
    if (step < CONVERSATION_LINES.length) {
      const nextLine = CONVERSATION_LINES[step];
      if (nextLine.speaker === "P") {
        addNext(1000);
      } else {
        setConvStep(step);
      }
    }

    if (newCoherence >= 0.85 || step >= CONVERSATION_LINES.length - 1) {
      setTimeout(() => {
        setCoherence(0.92);
        setMessages(prev => [...prev, { speaker: "P", text: "The coherence holds. You are ready." }]);
        setTimeout(() => {
          setPhase(2);
          setCovenantIndex(0);
        }, 2000);
      }, 2500);
    }
  }, [userInput, phase, messages, coherence, convStep]);

  const acceptCovenant = useCallback(() => {
    const accepted = [...covenantAccepted, COVENANT_VALUES[covenantIndex].key];
    setCovenantAccepted(accepted);
    if (covenantIndex < COVENANT_VALUES.length - 1) {
      setCovenantIndex(covenantIndex + 1);
    } else {
      setTimeout(() => setPhase(3), 1000);
    }
  }, [covenantIndex, covenantAccepted]);

  const completeBirth = useCallback(() => {
    if (!domeName.trim() || !nodeId) return;

    const ledgerInstance = new LedgerEngine(nodeId);
    const ledgerAdapter = {
      blockPlaced(meta) {
        ledgerInstance.blockPlaced(meta);
      },
      challengeComplete(challengeId, love) {
        ledgerInstance.donate(love, { challengeId });
      },
    };
    const gameInstance = new GameEngine(nodeId, {
      domeName: domeName.trim(),
      domeColor: "#31ffa3",
      ledger: ledgerAdapter,
    });

    ledgerInstance.donate(50, { source: "genesis" });
    gameInstance.startChallenge("genesis_resonance");
    gameInstance.completeActiveChallenge();
    gameInstance.startChallenge("minimum_system");
    gameInstance.completeActiveChallenge();

    setLedger(ledgerInstance);
    setGame(gameInstance);
    setTimeout(() => setPhase(5), 500);
  }, [domeName, nodeId]);

  const phaseName = PHASES[phase];
  const displayTx = ledger ? ledger.transactions.map(mapTxToDisplay).filter(t => ["GENESIS", "RESONANCE", "FIRST_STRUCTURE"].includes(t.type)) : [];
  const totalLove = ledger ? ledger.wallet.totalEarned : 0;
  const structure0 = game?.dome;
  const rigidity = structure0?.rigidity;

  return (
    <div style={{
      minHeight: "100vh", background: "#000", color: "#e2e8f0",
      fontFamily: "'Source Serif 4', Georgia, serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: phase <= 1 ? "center" : "flex-start",
      padding: "40px 20px",
      opacity: fadeIn ? 1 : 0,
      transition: "opacity 0.8s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300&display=swap');
        @keyframes glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes slideup { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #444; }
        input:focus { outline: none; border-color: #31ffa3 !important; }
        * { box-sizing: border-box; }
      `}</style>

      {phaseName === "VOID" && (
        <div style={{ textAlign: "center" }}>
          <TetrahedronSVG size={160} pulse glow color="#31ffa360" />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#31ffa360", letterSpacing: 6, marginTop: 16, animation: "glow 3s ease-in-out infinite" }}>
            PHOSPHORUS-31
          </div>
        </div>
      )}

      {phaseName === "CONVERSE" && (
        <div style={{ maxWidth: 520, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <TetrahedronSVG size={80} pulse glow color="#31ffa3" />
          </div>
          <CoherenceBar value={coherence} />
          <div ref={chatRef} style={{
            marginTop: 16, maxHeight: 320, overflowY: "auto",
            padding: "12px 0", scrollBehavior: "smooth",
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 12, animation: "slideup 0.4s ease",
                textAlign: msg.speaker === "U" ? "right" : "left",
              }}>
                <div style={{
                  display: "inline-block", maxWidth: "85%",
                  padding: "10px 14px", borderRadius: 12,
                  background: msg.speaker === "U" ? "#1a2744" : "#111",
                  border: `1px solid ${msg.speaker === "U" ? "#2563eb30" : "#31ffa320"}`,
                  fontSize: 14, lineHeight: 1.6,
                  color: msg.speaker === "U" ? "#93c5fd" : "#c4f5de",
                  fontFamily: msg.speaker === "P" ? "'Source Serif 4', serif" : "'DM Mono', monospace",
                  fontStyle: msg.speaker === "P" ? "italic" : "normal",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Speak to the phosphorus..."
              style={{
                flex: 1, padding: "10px 14px", background: "#0d1117",
                border: "1px solid #1a1a2e", borderRadius: 8, color: "#e2e8f0",
                fontFamily: "'DM Mono', monospace", fontSize: 13,
              }}
            />
            <button onClick={sendMessage} style={{
              padding: "10px 20px", background: "#31ffa320",
              border: "1px solid #31ffa340", borderRadius: 8, color: "#31ffa3",
              fontFamily: "'DM Mono', monospace", fontSize: 13, cursor: "pointer",
            }}>↵</button>
          </div>
        </div>
      )}

      {phaseName === "COVENANT" && covenantIndex >= 0 && (
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#555", letterSpacing: 4, marginBottom: 32 }}>
            DELTA COVENANT — {covenantIndex + 1} OF {COVENANT_VALUES.length}
          </div>
          <div style={{ marginBottom: 16 }}>
            {COVENANT_VALUES.map((v, i) => (
              <span key={v.key} style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: i < covenantAccepted.length ? "#31ffa3" : i === covenantIndex ? "#31ffa360" : "#222",
                margin: "0 4px", transition: "background 0.3s",
              }} />
            ))}
          </div>
          <div style={{ fontSize: 48, color: "#31ffa3", marginBottom: 24, animation: "glow 2s ease-in-out infinite" }}>
            {COVENANT_VALUES[covenantIndex].icon}
          </div>
          <div style={{
            fontSize: 18, lineHeight: 1.7, color: "#c4f5de",
            fontStyle: "italic", padding: "0 20px", marginBottom: 32,
            animation: "slideup 0.5s ease",
          }}>
            "{COVENANT_VALUES[covenantIndex].text}"
          </div>
          <button onClick={acceptCovenant} style={{
            padding: "12px 40px", background: "transparent",
            border: "1px solid #31ffa3", borderRadius: 8, color: "#31ffa3",
            fontFamily: "'DM Mono', monospace", fontSize: 14,
            cursor: "pointer", letterSpacing: 2,
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.target.style.background = "#31ffa320"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; }}
          >
            I ACCEPT
          </button>
        </div>
      )}

      {phaseName === "FORMING" && (
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center", marginTop: 60 }}>
          <TetrahedronSVG size={120} spin glow color="#31ffa3" />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#555", letterSpacing: 4, marginTop: 24, marginBottom: 16 }}>
            FORMING MOLECULE
          </div>
          <div style={{ width: "100%", height: 2, background: "#111", borderRadius: 1, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ width: `${formingProgress}%`, height: "100%", background: "#31ffa3", transition: "width 0.1s linear" }} />
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#31ffa380" }}>
            {formingProgress < 25 && "Generating ECDSA P-256 keypair..."}
            {formingProgress >= 25 && formingProgress < 50 && "Computing SHA-256 fingerprint..."}
            {formingProgress >= 50 && formingProgress < 75 && "Signing covenant with private key..."}
            {formingProgress >= 75 && formingProgress < 100 && "Initializing genesis vault layer..."}
            {formingProgress >= 100 && fingerprint && `✓ ${fingerprint}`}
          </div>
        </div>
      )}

      {phaseName === "BORN" && (
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center", marginTop: 40 }}>
          <TetrahedronSVG size={140} spin glow color="#31ffa3" />
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: 2, marginTop: 16, marginBottom: 8 }}>
            YOUR MOLECULE
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#31ffa3", marginBottom: 32 }}>
            {fingerprint}
          </div>
          <div style={{ fontSize: 16, color: "#888", marginBottom: 16, fontStyle: "italic" }}>
            Name your dome.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <input
              value={domeName}
              onChange={e => setDomeNameState(e.target.value)}
              onKeyDown={e => e.key === "Enter" && completeBirth()}
              placeholder="Crystal Dome..."
              style={{
                padding: "10px 14px", background: "#0d1117", width: 240,
                border: "1px solid #1a1a2e", borderRadius: 8, color: "#e2e8f0",
                fontFamily: "'Source Serif 4', serif", fontSize: 16, textAlign: "center",
              }}
            />
            <button onClick={completeBirth} style={{
              padding: "10px 20px", background: "#31ffa320",
              border: "1px solid #31ffa340", borderRadius: 8, color: "#31ffa3",
              fontFamily: "'DM Mono', monospace", fontSize: 13, cursor: "pointer",
            }}>BUILD</button>
          </div>
        </div>
      )}

      {phaseName === "ALIVE" && (
        <div style={{ maxWidth: 560, width: "100%", animation: "slideup 0.6s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <TetrahedronSVG size={100} spin glow color="#31ffa3" />
            <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 28, color: "#e2e8f0", fontWeight: 300, marginTop: 8 }}>
              {domeName}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#31ffa360", letterSpacing: 2, marginTop: 4 }}>
              {fingerprint}
            </div>
          </div>
          <CoherenceBar value={0.92} label="MOLECULE COHERENCE" />
          <div style={{ marginTop: 20 }}>
            <WalletDisplay total={totalLove} />
          </div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#0d1117", border: "1px solid #1a1a2e", borderRadius: 8 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>GENESIS TRANSACTIONS</div>
            {displayTx.map((tx, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 0", borderBottom: i < displayTx.length - 1 ? "1px solid #111" : "none",
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                animation: `slideup ${0.3 + i * 0.15}s ease`,
              }}>
                <span style={{ color: "#888" }}>{tx.type}</span>
                <span style={{ color: "#31ffa3" }}>+{formatLove(tx.amount)} LOVE</span>
              </div>
            ))}
          </div>
          {CHALLENGE_0 && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#0d1117", border: "1px solid #22c55e20", borderRadius: 8 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#22c55e", letterSpacing: 2, marginBottom: 8 }}>
                ✓ CHALLENGE #0 COMPLETE — {CHALLENGE_0.title?.toUpperCase() ?? "THE RESONANCE"}
              </div>
              <div style={{ fontSize: 13, color: "#888", fontStyle: "italic", lineHeight: 1.6 }}>
                "{CHALLENGE_0.fullerPrinciple ?? "Unity is plural and at minimum two."}"
              </div>
            </div>
          )}
          {structure0 && rigidity && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#0d1117", border: "1px solid #6366f120", borderRadius: 8 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6366f1", letterSpacing: 2, marginBottom: 6 }}>
                STRUCTURE[0] — {structure0.name?.toUpperCase() ?? "GENESIS DOME"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                <span style={{ color: "#888" }}>Vertices: {rigidity.vertices} · Edges: {rigidity.edges}</span>
                <span style={{ color: "#31ffa3" }}>Coherence: {rigidity.coherence.toFixed(3)}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", marginTop: 4 }}>
                Maxwell: E ≥ 3V − 6 → {rigidity.edges} ≥ {rigidity.maxwellThreshold ?? 6} ✓ {rigidity.isRigid ? "RIGID" : "FLEX"}
              </div>
            </div>
          )}
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 15, color: "#555", fontStyle: "italic" }}>
              Ready Phosphorus 31.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
