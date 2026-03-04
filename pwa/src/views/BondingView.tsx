import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "../context/SessionContext";
import { useCognitiveLoad } from "../context/CognitiveLoadContext";
import { MoleculeCanvas } from "../components/bonding/MoleculeCanvas";
import { PeriodicTable } from "../components/bonding/PeriodicTable";
import { GameHeader } from "../components/bonding/GameHeader";
import { PingFeed } from "../components/bonding/PingFeed";
import { AchievementToast } from "../components/bonding/AchievementToast";
import { ELEMENTS } from "../lib/bonding/elements";
import {
  newGame,
  loadGame,
  listGames,
  saveGame,
  nextId,
  setNextAtomId,
  type GameState,
  type Player,
  type PlacedAtom,
  type PingReaction,
} from "../lib/bonding/game-store";
import { buildFormula, totalMass, identifyMolecule, parseCounts, countsEqual } from "../lib/bonding/chemistry";
import { checkAchievements, ACHIEVEMENTS } from "../lib/bonding/achievements";
import { audio } from "../lib/bonding/sounds";
import {
  type Challenge,
  CHALLENGES,
  getUnlockedChallenges,
  getCompletedChallenges,
  markChallengeCompleted,
} from "../lib/bonding/challenges";
import {
  isRelayAvailable,
  createOnlineGame,
  joinOnlineGame,
  pushMove,
  pushPing,
  pushFinish,
  startPolling,
  stopPolling,
  getSyncState,
  clearSyncState,
} from "../lib/bonding/game-sync";

type View = "lobby" | "challenges" | "game" | "finished";

const P1_COLOR = "#39FF14";
const P2_COLOR = "#06B6D4";
const HINT_KEY = "p31-bonding-hint-seen";

/** Map relay game shape to our GameState */
function serverGameToState(server: {
  id: string;
  name: string;
  players: Array<{ name: string; color: string } | null>;
  currentTurn: number;
  atoms: PlacedAtom[];
  pings: { from: number; atomId: number; reaction: string; timestamp: string }[];
  achievements: string[];
  formula: string;
  totalMass: number;
  createdAt: string;
  updatedAt: string;
  status: string;
}): GameState {
  return {
    id: server.id,
    name: server.name,
    players: [
      server.players[0] ?? { name: "Player 1", color: P1_COLOR },
      server.players[1] ?? { name: "Player 2", color: P2_COLOR },
    ],
    currentTurn: server.currentTurn,
    atoms: server.atoms,
    pings: server.pings.map((p) => ({ ...p, reaction: (p.reaction || "💚") as PingReaction })),
    achievements: server.achievements ?? [],
    formula: server.formula ?? "",
    totalMass: server.totalMass ?? 0,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    status: server.status === "complete" ? "complete" : "active",
    score: 0,
    turnCount: 0,
  };
}

export function BondingView() {
  const { session } = useSession();
  const { isCrisis } = useCognitiveLoad();
  const [view, setView] = useState<View>("lobby");
  const [game, setGame] = useState<GameState | null>(null);
  const [games, setGames] = useState<GameState[]>([]);
  const [selectedElement, setSelectedElement] = useState<typeof ELEMENTS[0] | null>(null);
  const [toastAchievements, setToastAchievements] = useState<string[]>([]);
  const [dismissToast, setDismissToast] = useState(() => () => {});
  const [announcerText, setAnnouncerText] = useState("");
  const [mode, setMode] = useState<"local" | "online">("local");
  const [gameCode, setGameCode] = useState("");
  const [mySlot, setMySlot] = useState(0);
  const [waitingForJoin, setWaitingForJoin] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [p1Name, setP1Name] = useState("");
  const [p2Name, setP2Name] = useState("");

  const announce = useCallback((text: string) => {
    setAnnouncerText(text);
    const t = setTimeout(() => setAnnouncerText(""), 1500);
    return () => clearTimeout(t);
  }, []);
  const lastAnnouncedFormula = useRef<string | null>(null);
  useEffect(() => {
    if (view !== "game" || !game) return;
    const known = identifyMolecule(game.formula);
    if (known && game.formula !== lastAnnouncedFormula.current) {
      lastAnnouncedFormula.current = game.formula;
      announce(`Molecule identified: ${known}`);
    }
  }, [view, game?.formula, announce]);

  // Challenge completion detection
  const challengeCompleted = useRef(false);
  useEffect(() => {
    if (view !== "game" || !game || !activeChallenge || challengeCompleted.current) return;
    const SUBSCRIPT = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
    const asciiFormula = [...game.formula].map((c) => { const i = SUBSCRIPT.indexOf(c); return i >= 0 ? String(i) : c; }).join("");
    const inputCounts = parseCounts(asciiFormula);
    const targetCounts = parseCounts(activeChallenge.formulaAscii);
    if (countsEqual(inputCounts, targetCounts)) {
      challengeCompleted.current = true;
      // Calculate score: base points + turn bonus
      const turnBonus = Math.max(0, 50 - (game.turnCount * 5));
      const earned = activeChallenge.points + turnBonus;
      markChallengeCompleted(activeChallenge.id);
      const atomicNumbers = game.atoms.map(
        (a) => ELEMENTS.find((e) => e.symbol === a.element)?.number ?? 1
      );
      audio.playMoleculeChord(atomicNumbers);
      // Small delay so the molecule chord plays, then transition
      setTimeout(() => {
        setGame((prev) => prev ? { ...prev, status: "complete", score: earned } : prev);
        setView("finished");
      }, 800);
    }
  }, [view, game?.formula, game?.turnCount, game?.atoms, activeChallenge]);

  const loadGames = useCallback(async () => {
    const list = await listGames();
    setGames(list);
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Show hint on very first game
  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
    } catch { /* noop */ }
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, "1"); } catch { /* noop */ }
  }, []);

  const startGame = useCallback(
    (p1: string, p2: string, name: string, challengeId?: string) => {
      setMode("local");
      setGameCode("");
      setWaitingForJoin(false);
      challengeCompleted.current = false;
      const p1Player: Player = { name: p1.trim() || "Player 1", color: P1_COLOR };
      const p2Player: Player = { name: p2.trim() || "Player 2", color: P2_COLOR };
      const challenge = challengeId ? CHALLENGES.find((c) => c.id === challengeId) : undefined;
      const gameName = challenge ? challenge.name : (name || "Our Molecule");
      setActiveChallenge(challenge ?? null);
      const g = newGame(p1Player, p2Player, gameName, challengeId);
      setGame(g);
      setView("game");
      setSelectedElement(null);
      lastAnnouncedFormula.current = null;
      saveGame(g).catch(console.warn);
    },
    []
  );

  const updateGame = useCallback((updater: (g: GameState) => GameState) => {
    setGame((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      const formula = buildFormula(next.atoms);
      const mass = totalMass(next.atoms);
      const updated = { ...next, formula, totalMass: mass };
      saveGame(updated).catch(console.warn);
      const newAch = checkAchievements(updated);
      if (newAch.length > 0) {
        updated.achievements = [...updated.achievements, ...newAch];
        audio.playAchievement();
        const name = newAch.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).filter(Boolean).join(", ");
        announce(`Achievement: ${name}`);
        setToastAchievements((prev) => [...prev, ...newAch]);
        setDismissToast(() => () => setToastAchievements((p) => p.slice(1)));
      }
      return updated;
    });
  }, [announce]);

  const placeAtom = useCallback(
    async (x: number, y: number, bondToAtomId?: number) => {
      if (!game || !selectedElement) {
        audio.playError();
        return;
      }

      if (mode === "online" && gameCode) {
        const code = getSyncState()?.code ?? gameCode;
        const slot = getSyncState()?.slot ?? mySlot;
        const newAtom: PlacedAtom = {
          id: -1,
          element: selectedElement.symbol,
          x,
          y,
          placedBy: game.currentTurn,
          bonds: bondToAtomId != null ? [bondToAtomId] : [],
          timestamp: "",
        };
        const newAtoms: PlacedAtom[] =
          bondToAtomId != null
            ? [
                ...game.atoms.map((a) =>
                  a.id === bondToAtomId ? { ...a, bonds: [...a.bonds, -1] } : a
                ),
                newAtom,
              ]
            : [...game.atoms, newAtom];
        const formula = buildFormula(newAtoms);
        const totalMassVal = totalMass(newAtoms);
        const nextState = { ...game, atoms: newAtoms, formula, totalMass: totalMassVal };
        const newAchievements = checkAchievements(nextState).filter((id) => !game.achievements.includes(id));
        const doPush = (retries = 2) => {
          pushMove(code, slot, { element: selectedElement.symbol, x, y }, bondToAtomId, formula, totalMassVal, newAchievements)
            .then((serverGame) => {
              const g = serverGameToState(serverGame as Parameters<typeof serverGameToState>[0]);
              setGame(g);
              setNextAtomId(g.atoms.length);
              saveGame(g).catch(() => {});
              if (newAchievements.length > 0) {
                audio.playAchievement();
                const names = newAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).filter(Boolean).join(", ");
                announce(`Achievement: ${names}`);
                setToastAchievements((prev) => [...prev, ...newAchievements]);
                setDismissToast(() => () => setToastAchievements((p) => p.slice(1)));
              }
              const parent = bondToAtomId ? game.atoms.find((a) => a.id === bondToAtomId) : null;
              if (parent) {
                audio.playBond();
                announce(`${selectedElement.symbol} placed. Bond formed with ${parent.element}.`);
              } else {
                announce(`${selectedElement.symbol} placed.`);
              }
              audio.playElement(selectedElement.number);
              audio.playTurnChange();
              setSelectedElement(null);
            })
            .catch(() => {
              if (retries > 0) setTimeout(() => doPush(retries - 1), 1500);
            });
        };
        doPush();
        return;
      }

      const id = nextId();
      const bonds = bondToAtomId ? [bondToAtomId] : [];
      const parent = bondToAtomId ? game.atoms.find((a) => a.id === bondToAtomId) : null;
      const atom: PlacedAtom = {
        id,
        element: selectedElement.symbol,
        x,
        y,
        placedBy: game.currentTurn,
        bonds,
        timestamp: new Date().toISOString(),
      };
      if (bondToAtomId && parent) {
        audio.playBond();
        const parentBonds = [...parent.bonds, id];
        updateGame((g) => ({
          ...g,
          atoms: g.atoms.map((a) => (a.id === bondToAtomId ? { ...a, bonds: parentBonds } : a)).concat(atom),
          currentTurn: 1 - g.currentTurn,
          turnCount: g.turnCount + 1,
          updatedAt: new Date().toISOString(),
        }));
        const nextPlayer = game.players[1 - game.currentTurn];
        announce(`${selectedElement.symbol} placed. Bond formed with ${parent.element}. ${nextPlayer?.name}'s turn.`);
        audio.playTurnChange();
      } else if (bondToAtomId) {
        updateGame((g) => ({
          ...g,
          atoms: [...g.atoms, atom],
          currentTurn: 1 - g.currentTurn,
          turnCount: g.turnCount + 1,
          updatedAt: new Date().toISOString(),
        }));
        audio.playElement(selectedElement.number);
        setSelectedElement(null);
        return;
      } else {
        updateGame((g) => ({
          ...g,
          atoms: [...g.atoms, atom],
          currentTurn: 1 - g.currentTurn,
          turnCount: g.turnCount + 1,
          updatedAt: new Date().toISOString(),
        }));
        const nextPlayer = game.players[1 - game.currentTurn];
        announce(`${selectedElement.symbol} placed. ${nextPlayer?.name}'s turn.`);
        audio.playTurnChange();
      }
      audio.playElement(selectedElement.number);
      setSelectedElement(null);
    },
    [game, selectedElement, updateGame, announce, mode, gameCode, mySlot]
  );

  const pingAtom = useCallback(
    (atomId: number, reaction: PingReaction) => {
      if (!game) return;
      audio.playPing();
      const atom = game.atoms.find((a) => a.id === atomId);
      const fromPlayer = game.players[game.currentTurn];
      if (mode === "online" && gameCode) {
        const code = getSyncState()?.code ?? gameCode;
        const slot = getSyncState()?.slot ?? mySlot;
        pushPing(code, slot, atomId, reaction).catch(() => {});
      }
      updateGame((g) => ({
        ...g,
        pings: [...g.pings, { from: g.currentTurn, atomId, reaction, timestamp: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      }));
      announce(`Ping from ${fromPlayer?.name ?? "Player"} on ${atom?.element ?? "atom"}: ${reaction}`);
    },
    [game, updateGame, announce, mode, gameCode, mySlot]
  );

  const finishGame = useCallback(() => {
    if (!game) return;
    const atomicNumbers = game.atoms.map(
      (a) => ELEMENTS.find((e) => e.symbol === a.element)?.number ?? 1
    );
    audio.playMoleculeChord(atomicNumbers);
    if (mode === "online" && gameCode) {
      const code = getSyncState()?.code ?? gameCode;
      pushFinish(code)
        .then((serverGame) => {
          const g = serverGameToState(serverGame as Parameters<typeof serverGameToState>[0]);
          setGame(g);
          setView("finished");
          saveGame(g).catch(() => {});
        })
        .catch(() => {});
      return;
    }
    updateGame((g) => ({ ...g, status: "complete" }));
    setView("finished");
  }, [game, updateGame, mode, gameCode]);

  const backToLobby = useCallback(() => {
    stopPolling();
    clearSyncState();
    setGame(null);
    setView("lobby");
    setSelectedElement(null);
    setMode("local");
    setGameCode("");
    setWaitingForJoin(false);
    setActiveChallenge(null);
    challengeCompleted.current = false;
    loadGames();
  }, [loadGames]);

  const nextChallenge = useCallback(() => {
    if (!activeChallenge) { backToLobby(); return; }
    const idx = CHALLENGES.findIndex((c) => c.id === activeChallenge.id);
    const next = idx >= 0 && idx < CHALLENGES.length - 1 ? CHALLENGES[idx + 1] : null;
    if (next) {
      const unlocked = getUnlockedChallenges();
      if (unlocked.some((c) => c.id === next.id)) {
        challengeCompleted.current = false;
        startGame(p1Name, p2Name, next.name, next.id);
        return;
      }
    }
    setView("challenges");
    setGame(null);
    setActiveChallenge(null);
    challengeCompleted.current = false;
  }, [activeChallenge, startGame, p1Name, p2Name, backToLobby]);

  const resumeGame = useCallback(async (id: string) => {
    setMode("local");
    setGameCode("");
    challengeCompleted.current = false;
    const g = await loadGame(id);
    if (g && g.status === "active") {
      const maxId = g.atoms.reduce((m, a) => Math.max(m, a.id), 0);
      setNextAtomId(maxId + 1);
      if (g.challengeId) {
        const ch = CHALLENGES.find((c) => c.id === g.challengeId);
        setActiveChallenge(ch ?? null);
      } else {
        setActiveChallenge(null);
      }
      setGame(g);
      setView("game");
      setSelectedElement(null);
    }
  }, []);

  const syncCodeRef = useRef("");
  const onPollUpdate = useCallback(
    (serverGame: unknown) => {
      const g = serverGameToState(serverGame as Parameters<typeof serverGameToState>[0]);
      setGame(g);
      saveGame(g).catch(() => {});
      setNextAtomId(g.atoms.length);
      const status = (serverGame as { status?: string })?.status;
      if (status === "active") setWaitingForJoin(false);
      if (g.status === "complete") setView("finished");
    },
    []
  );

  const handleCreateOnline = useCallback(
    async (p1NameArg: string, name: string) => {
      if (!isRelayAvailable()) return;
      try {
        const { code, game: serverGame } = await createOnlineGame(
          p1NameArg.trim() || "Player 1",
          P1_COLOR,
          name || "Our Molecule"
        );
        const g = serverGameToState(serverGame as Parameters<typeof serverGameToState>[0]);
        setMode("online");
        setGameCode(code);
        setMySlot(0);
        setWaitingForJoin(true);
        setGame(g);
        setView("game");
        setSelectedElement(null);
        syncCodeRef.current = code;
        startPolling(code, onPollUpdate);
        saveGame(g).catch(() => {});
      } catch {
        // Silent; stay in lobby
      }
    },
    [onPollUpdate]
  );

  const handleJoinOnline = useCallback(
    async (code: string, p2NameArg: string) => {
      if (!isRelayAvailable() || !code.trim()) return;
      try {
        const serverGame = await joinOnlineGame(code.trim().toUpperCase(), p2NameArg.trim() || "Player 2", P2_COLOR);
        const g = serverGameToState(serverGame as Parameters<typeof serverGameToState>[0]);
        setMode("online");
        setGameCode(code.trim().toUpperCase());
        setMySlot(1);
        setWaitingForJoin(false);
        setGame(g);
        setView("game");
        setSelectedElement(null);
        syncCodeRef.current = code.trim().toUpperCase();
        startPolling(syncCodeRef.current, onPollUpdate);
        saveGame(g).catch(() => {});
      } catch {
        // Silent
      }
    },
    [onPollUpdate]
  );

  if (isCrisis) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <button
          style={{
            padding: "24px 48px",
            fontSize: 18,
            background: "#31ffa320",
            border: "1px solid #31ffa3",
            borderRadius: 12,
            color: "#31ffa3",
            fontFamily: "system-ui",
          }}
        >
          I'M HERE
        </button>
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <Lobby
        session={session}
        games={games}
        onStart={startGame}
        onResume={resumeGame}
        relayAvailable={isRelayAvailable()}
        onCreateOnline={handleCreateOnline}
        onJoinOnline={handleJoinOnline}
        onChallenges={(p1, p2) => {
          setP1Name(p1);
          setP2Name(p2);
          setView("challenges");
        }}
      />
    );
  }

  if (view === "challenges") {
    return (
      <ChallengeSelect
        onSelect={(ch) => startGame(p1Name, p2Name, ch.name, ch.id)}
        onBack={backToLobby}
      />
    );
  }

  if (view === "finished" && game) {
    return (
      <FinishedScreen
        game={game}
        challenge={activeChallenge}
        onBack={backToLobby}
        onNext={activeChallenge ? nextChallenge : undefined}
      />
    );
  }

  if (view === "game" && game) {
    const known = identifyMolecule(game.formula);
    const isMyTurn = mode === "local" || game.currentTurn === mySlot;
    const opponentName = game.players[1 - mySlot]?.name ?? "Opponent";
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", background: "#050510", position: "relative" }}>
        {showHint && <HowToPlay onDismiss={dismissHint} />}
        {waitingForJoin && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(5,5,16,0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Share this code</div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(gameCode).catch(() => {});
              }}
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 36,
                letterSpacing: 8,
                color: "#31ffa3",
                background: "transparent",
                border: "2px solid #31ffa340",
                borderRadius: 12,
                padding: "20px 32px",
                cursor: "pointer",
              }}
            >
              {gameCode}
            </button>
            <div style={{ fontSize: 12, color: "#666", marginTop: 12 }}>Tap to copy · Waiting for someone to join</div>
          </div>
        )}
        <div aria-live="polite" className="sr-only" id="game-announcer">
          {announcerText}
        </div>
        <GameHeader game={game} knownMolecule={known} challenge={activeChallenge ?? undefined} />
        <MoleculeCanvas
          game={game}
          selectedElement={selectedElement}
          onPlaceAtom={placeAtom}
          onPingAtom={pingAtom}
          isMyTurn={isMyTurn}
        />
        <PeriodicTable
          elements={ELEMENTS}
          selected={selectedElement}
          onSelect={setSelectedElement}
          disabled={!isMyTurn}
          waitingName={mode === "online" && !isMyTurn ? opponentName : undefined}
        />
        <PingFeed game={game} />
        {!activeChallenge && (
          <div style={{ padding: 12, textAlign: "center" }}>
            <button
              type="button"
              onClick={finishGame}
              style={{
                padding: "10px 24px",
                background: "#31ffa320",
                border: "1px solid #31ffa340",
                borderRadius: 8,
                color: "#31ffa3",
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              FINISH MOLECULE
            </button>
          </div>
        )}
        <AchievementToast achievementIds={toastAchievements} onDismiss={dismissToast} />
      </div>
    );
  }

  return null;
}

/* ─── How To Play ─── */

function HowToPlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(5,5,16,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        padding: 32,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 320, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 16 }}>HOW TO PLAY</div>
        <div style={{ fontSize: 15, color: "#ccc", lineHeight: 1.7, marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: "#31ffa3", fontWeight: 700 }}>1.</span> Pick an atom from the bottom
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: "#31ffa3", fontWeight: 700 }}>2.</span> Tap a green circle to place it
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: "#31ffa3", fontWeight: 700 }}>3.</span> Bonds form automatically
          </div>
          <div>
            <span style={{ color: "#31ffa3", fontWeight: 700 }}>4.</span> Build the molecule to win!
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "14px 40px",
            background: "#31ffa320",
            border: "1px solid #31ffa3",
            borderRadius: 10,
            color: "#31ffa3",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          GOT IT
        </button>
      </div>
    </div>
  );
}

/* ─── Challenge Select ─── */

function ChallengeSelect({
  onSelect,
  onBack,
}: {
  onSelect: (ch: Challenge) => void;
  onBack: () => void;
}) {
  const unlocked = getUnlockedChallenges();
  const completed = getCompletedChallenges();

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto", fontFamily: "system-ui" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "#666",
          fontSize: 12,
          cursor: "pointer",
          marginBottom: 16,
          padding: 0,
        }}
      >
        &larr; BACK
      </button>
      <div style={{ fontSize: 20, letterSpacing: 2, marginBottom: 4 }}>CHALLENGES</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Build each molecule to unlock the next one.</div>

      {CHALLENGES.map((ch, i) => {
        const isUnlocked = unlocked.some((u) => u.id === ch.id);
        const isDone = completed.has(ch.id);
        return (
          <button
            key={ch.id}
            type="button"
            disabled={!isUnlocked}
            onClick={() => isUnlocked && onSelect(ch)}
            style={{
              width: "100%",
              padding: 16,
              marginBottom: 8,
              background: isDone ? "rgba(49,255,163,0.08)" : isUnlocked ? "#0c0c18" : "#080812",
              border: `1px solid ${isDone ? "#31ffa340" : isUnlocked ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
              borderRadius: 10,
              cursor: isUnlocked ? "pointer" : "not-allowed",
              opacity: isUnlocked ? 1 : 0.4,
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 28 }}>{isUnlocked ? ch.emoji : "🔒"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: isUnlocked ? "#e2e8f0" : "#555", fontWeight: 600 }}>
                {ch.name}
                {isDone && <span style={{ color: "#31ffa3", marginLeft: 8 }}>✓</span>}
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                {isUnlocked ? ch.hint : `Complete ${CHALLENGES[i - 1]?.name ?? "previous"} first`}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace" }}>
              {ch.points}pts
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Lobby ─── */

function Lobby({
  session,
  games,
  onStart,
  onResume,
  relayAvailable,
  onCreateOnline,
  onJoinOnline,
  onChallenges,
}: {
  session: unknown;
  games: GameState[];
  onStart: (p1: string, p2: string, name: string) => void;
  onResume: (id: string) => void;
  relayAvailable: boolean;
  onCreateOnline: (p1Name: string, name: string) => void;
  onJoinOnline: (code: string, p2Name: string) => void;
  onChallenges: (p1: string, p2: string) => void;
}) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  useEffect(() => {
    if (session && typeof session === "object" && "domeName" in session) {
      setP1((session as { domeName?: string }).domeName ?? "");
    }
  }, [session]);

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto", fontFamily: "system-ui" }}>
      <div style={{ fontSize: 20, letterSpacing: 2, marginBottom: 8 }}>BONDING</div>
      <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Build molecules together.</div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>Your name</label>
        <input
          type="text"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          placeholder="Will"
          style={{
            width: "100%",
            padding: 10,
            background: "#0c0c18",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#e2e8f0",
            fontSize: 14,
          }}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>Partner</label>
        <input
          type="text"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          placeholder="Bash"
          style={{
            width: "100%",
            padding: 10,
            background: "#0c0c18",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#e2e8f0",
            fontSize: 14,
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => onChallenges(p1, p2)}
        style={{
          width: "100%",
          padding: 16,
          background: "rgba(49,255,163,0.12)",
          border: "1px solid #31ffa360",
          borderRadius: 10,
          color: "#31ffa3",
          fontFamily: "'DM Mono', monospace",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        CHALLENGES
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        <span style={{ fontSize: 11, color: "#444" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>Molecule name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Try"
          style={{
            width: "100%",
            padding: 10,
            background: "#0c0c18",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#e2e8f0",
            fontSize: 14,
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => onStart(p1, p2, name)}
        style={{
          width: "100%",
          padding: 14,
          background: "#0c0c18",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#888",
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        FREE BUILD
      </button>

      {relayAvailable && (
        <>
          <div style={{ marginTop: 28, marginBottom: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
            ———— OR PLAY ONLINE ————
          </div>
          <button
            type="button"
            onClick={() => onCreateOnline(p1, name)}
            style={{
              width: "100%",
              padding: 12,
              background: "rgba(6,182,212,0.15)",
              border: "1px solid rgba(6,182,212,0.4)",
              borderRadius: 8,
              color: "#06B6D4",
              fontFamily: "system-ui",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: 20,
            }}
          >
            CREATE ONLINE GAME
          </button>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>Game code</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              style={{
                width: "100%",
                padding: 10,
                background: "#0c0c18",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14,
                letterSpacing: 4,
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>Your name</label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Player 2"
              style={{
                width: "100%",
                padding: 10,
                background: "#0c0c18",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => onJoinOnline(joinCode, joinName || p2)}
            style={{
              width: "100%",
              padding: 12,
              background: "rgba(6,182,212,0.15)",
              border: "1px solid rgba(6,182,212,0.4)",
              borderRadius: 8,
              color: "#06B6D4",
              fontFamily: "system-ui",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            JOIN GAME
          </button>
        </>
      )}

      {games.length > 0 && (
        <>
          <div style={{ marginTop: 32, fontSize: 12, color: "#666", marginBottom: 12 }}>Previous builds</div>
          {games.slice(0, 5).map((g) => (
            <div
              key={g.id}
              style={{
                padding: 12,
                background: "#0c0c18",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{g.formula || "—"} · {g.atoms.length} atoms</div>
              </div>
              {g.status === "active" && (
                <button
                  type="button"
                  onClick={() => onResume(g.id)}
                  style={{
                    padding: "6px 12px",
                    background: "#31ffa318",
                    border: "1px solid #31ffa330",
                    borderRadius: 6,
                    color: "#31ffa3",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Resume
                </button>
              )}
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: 32, fontSize: 11, color: "#444", fontStyle: "italic" }}>
        It's okay to be a little wonky.
      </div>
    </div>
  );
}

/* ─── Finished / Celebration ─── */

const CONFETTI_COLORS = ["#39FF14", "#06B6D4", "#f59e0b", "#ec4899", "#a855f7", "#fff"];
const CONFETTI_COUNT = 40;

function FinishedScreen({
  game,
  challenge,
  onBack,
  onNext,
}: {
  game: GameState;
  challenge: Challenge | null;
  onBack: () => void;
  onNext?: () => void;
}) {
  const [confetti] = useState(() =>
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      size: 4 + Math.random() * 6,
      drift: -20 + Math.random() * 40,
    }))
  );

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto", fontFamily: "system-ui", position: "relative", overflow: "hidden", minHeight: "80vh" }}>
      {/* Confetti */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {confetti.map((c) => (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: -10,
              width: c.size,
              height: c.size,
              borderRadius: c.size > 7 ? "50%" : 1,
              background: c.color,
              animation: `confettiFall ${c.duration}s ease-in ${c.delay}s both`,
              ["--drift" as string]: `${c.drift}px`,
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {challenge && (
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>{challenge.emoji}</div>
        )}
        <div style={{ fontSize: 22, textAlign: "center", fontWeight: 700, marginBottom: 4, color: "#31ffa3" }}>
          {challenge ? `You made ${challenge.name.toUpperCase()}!` : game.name}
        </div>
        {challenge && (
          <div style={{ fontSize: 14, textAlign: "center", color: "#888", marginBottom: 16, fontStyle: "italic" }}>
            {challenge.funFact}
          </div>
        )}

        <div style={{
          padding: 16,
          background: "#0c0c18",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 16, fontFamily: "'DM Mono', monospace", color: "#ccc", marginBottom: 8 }}>
            {game.formula} · {game.totalMass.toFixed(1)} g/mol
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#666" }}>
            <span>{game.atoms.length} atoms</span>
            <span>{game.turnCount} turns</span>
            {game.score > 0 && (
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>{game.score} points</span>
            )}
          </div>
        </div>

        {game.achievements.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: "#0c0c18", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>Achievements</div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              {game.achievements.map((id) => {
                const a = ACHIEVEMENTS.find((a) => a.id === id);
                return a ? a.name : id;
              }).join(" · ")}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              style={{
                width: "100%",
                padding: 16,
                background: "rgba(49,255,163,0.15)",
                border: "1px solid #31ffa360",
                borderRadius: 10,
                color: "#31ffa3",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              NEXT CHALLENGE
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            style={{
              width: "100%",
              padding: 12,
              background: "#0c0c18",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#888",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Back to lobby
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(85vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
