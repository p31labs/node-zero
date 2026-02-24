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
import { buildFormula, totalMass, identifyMolecule } from "../lib/bonding/chemistry";
import { checkAchievements, ACHIEVEMENTS } from "../lib/bonding/achievements";
import { audio } from "../lib/bonding/sounds";
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

type View = "lobby" | "game" | "finished";

const P1_COLOR = "#39FF14";
const P2_COLOR = "#06B6D4";

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

  const loadGames = useCallback(async () => {
    const list = await listGames();
    setGames(list);
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const startGame = useCallback(
    (p1Name: string, p2Name: string, name: string) => {
      setMode("local");
      setGameCode("");
      setWaitingForJoin(false);
      const p1: Player = { name: p1Name.trim() || "Player 1", color: P1_COLOR };
      const p2: Player = { name: p2Name.trim() || "Player 2", color: P2_COLOR };
      const g = newGame(p1, p2, name || "Our Molecule");
      setGame(g);
      setView("game");
      setSelectedElement(null);
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
    loadGames();
  }, [loadGames]);

  const resumeGame = useCallback(async (id: string) => {
    setMode("local");
    setGameCode("");
    const g = await loadGame(id);
    if (g && g.status === "active") {
      const maxId = g.atoms.reduce((m, a) => Math.max(m, a.id), 0);
      setNextAtomId(maxId + 1);
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
    async (p1Name: string, name: string) => {
      if (!isRelayAvailable()) return;
      try {
        const { code, game: serverGame } = await createOnlineGame(
          p1Name.trim() || "Player 1",
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
    async (code: string, p2Name: string) => {
      if (!isRelayAvailable() || !code.trim()) return;
      try {
        const serverGame = await joinOnlineGame(code.trim().toUpperCase(), p2Name.trim() || "Player 2", P2_COLOR);
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
      />
    );
  }

  if (view === "finished" && game) {
    return (
      <FinishedScreen
        game={game}
        onBack={backToLobby}
      />
    );
  }

  if (view === "game" && game) {
    const known = identifyMolecule(game.formula);
    const isMyTurn = mode === "local" || game.currentTurn === mySlot;
    const opponentName = game.players[1 - mySlot]?.name ?? "Opponent";
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 48px)", background: "#050510", position: "relative" }}>
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
        <GameHeader game={game} knownMolecule={known} />
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
        <AchievementToast achievementIds={toastAchievements} onDismiss={dismissToast} />
      </div>
    );
  }

  return null;
}

function Lobby({
  session,
  games,
  onStart,
  onResume,
  relayAvailable,
  onCreateOnline,
  onJoinOnline,
}: {
  session: unknown;
  games: GameState[];
  onStart: (p1: string, p2: string, name: string) => void;
  onResume: (id: string) => void;
  relayAvailable: boolean;
  onCreateOnline: (p1Name: string, name: string) => void;
  onJoinOnline: (code: string, p2Name: string) => void;
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
      <div style={{ marginBottom: 12 }}>
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
      <div style={{ marginBottom: 20 }}>
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
          background: "#31ffa320",
          border: "1px solid #31ffa340",
          borderRadius: 8,
          color: "#31ffa3",
          fontFamily: "'DM Mono', monospace",
          fontSize: 14,
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        START BUILDING
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

function FinishedScreen({ game, onBack }: { game: GameState; onBack: () => void }) {
  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto", fontFamily: "system-ui" }}>
      <div style={{ fontSize: 18, marginBottom: 16 }}>{game.name}</div>
      <div style={{ fontSize: 14, color: "#31ffa3", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
        {game.formula} · {game.totalMass.toFixed(1)} g/mol
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>{game.atoms.length} atoms</div>
      {game.achievements.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>Achievements</div>
          <div style={{ fontSize: 13, color: "#ccc" }}>{game.achievements.join(", ")}</div>
        </div>
      )}
      <button
        type="button"
        onClick={onBack}
        style={{
          padding: "10px 24px",
          background: "#31ffa320",
          border: "1px solid #31ffa340",
          borderRadius: 8,
          color: "#31ffa3",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Back to lobby
      </button>
    </div>
  );
}
