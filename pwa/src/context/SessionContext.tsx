/**
 * SessionContext — single source of truth for P31 session state.
 *
 * Loaded once at app level. QuantumHelloWorld writes to it (birth + save).
 * Shelter reads from it (wallet, structure, dome).
 *
 * No private keys ever touch this context — only public identifiers
 * and engine snapshots.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { LedgerEngine } from "@p31/love-ledger";
import type { LedgerSnapshot } from "@p31/love-ledger";
import { GameEngine } from "@p31/game-engine";
import type { GameSnapshot } from "@p31/game-engine";
import {
  loadSession as dbLoad,
  saveSession as dbSave,
  clearSession as dbClear,
} from "../lib/p31-session";

// ─── Types ───────────────────────────────────────────────────────────

export interface AliveSession {
  phase: 5;
  nodeId: string;
  fingerprint: string;
  domeName: string;
  ledgerSnapshot: LedgerSnapshot;
  gameSnapshot: GameSnapshot;
  savedAt: string;
}

export interface SessionContextValue {
  /** null = no session yet, undefined = still loading */
  session: AliveSession | null | undefined;
  /** Live LedgerEngine instance (null if no session) */
  ledger: LedgerEngine | null;
  /** Live GameEngine instance (null if no session) */
  game: GameEngine | null;
  /** True while initial IndexedDB load is in flight */
  loading: boolean;
  /**
   * Called by QuantumHelloWorld after completeBirth.
   * Creates engines, runs genesis flow, persists to IndexedDB, updates context.
   */
  birthSession: (params: {
    nodeId: string;
    fingerprint: string;
    domeName: string;
    domeColor: string;
  }) => Promise<{ ledger: LedgerEngine; game: GameEngine }>;
  /**
   * Persist current engine state to IndexedDB.
   * Call after any mutation (e.g. challenge complete, LOVE earned).
   */
  persist: () => Promise<void>;
  /** Wipe session from memory + IndexedDB. */
  reset: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AliveSession | null | undefined>(undefined);
  const [ledger, setLedger] = useState<LedgerEngine | null>(null);
  const [game, setGame] = useState<GameEngine | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await dbLoad();
        if (cancelled) return;

        if (stored) {
          const l = new LedgerEngine(stored.nodeId);
          l.import(stored.ledgerSnapshot as LedgerSnapshot);

          const g = new GameEngine(stored.nodeId, {
            domeName: stored.domeName,
            domeColor: "#31ffa3",
          });
          g.import(stored.gameSnapshot as GameSnapshot);

          setLedger(l);
          setGame(g);
          setSession(stored as AliveSession);
        } else {
          setSession(null);
        }
      } catch (err) {
        console.warn("[SessionContext] restore failed:", err);
        setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Birth (genesis flow: donate 50 + two challenges) ────────────────
  const birthSession = useCallback(
    async ({
      nodeId,
      fingerprint,
      domeName,
      domeColor,
    }: {
      nodeId: string;
      fingerprint: string;
      domeName: string;
      domeColor: string;
    }) => {
      const l = new LedgerEngine(nodeId);
      const ledgerAdapter = {
        blockPlaced(meta?: Record<string, unknown>) {
          l.blockPlaced(meta);
        },
        challengeComplete(challengeId: string, love: number) {
          l.donate(love, { challengeId });
        },
      };
      const g = new GameEngine(nodeId, {
        domeName,
        domeColor,
        ledger: ledgerAdapter,
      });

      l.donate(50, { source: "genesis" });
      g.startChallenge("genesis_resonance");
      g.completeActiveChallenge();
      g.startChallenge("minimum_system");
      g.completeActiveChallenge();

      const now = new Date().toISOString();
      const alive: AliveSession = {
        phase: 5,
        nodeId,
        fingerprint,
        domeName,
        ledgerSnapshot: l.export(),
        gameSnapshot: g.export(),
        savedAt: now,
      };

      await dbSave({
        phase: 5,
        nodeId,
        fingerprint,
        domeName,
        ledgerSnapshot: alive.ledgerSnapshot,
        gameSnapshot: alive.gameSnapshot,
        savedAt: now,
      });
      setLedger(l);
      setGame(g);
      setSession(alive);

      return { ledger: l, game: g };
    },
    []
  );

  // ── Persist (re-save current engine state) ────────────────────────
  const persist = useCallback(async () => {
    if (!session || !ledger || !game) return;
    const updated = {
      ...session,
      ledgerSnapshot: ledger.export(),
      gameSnapshot: game.export(),
      savedAt: new Date().toISOString(),
    };
    await dbSave({
      phase: 5,
      nodeId: session.nodeId,
      fingerprint: session.fingerprint,
      domeName: session.domeName,
      ledgerSnapshot: updated.ledgerSnapshot,
      gameSnapshot: updated.gameSnapshot,
      savedAt: updated.savedAt,
    });
    setSession(updated);
  }, [session, ledger, game]);

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = useCallback(async () => {
    await dbClear();
    setLedger(null);
    setGame(null);
    setSession(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, ledger, game, loading, birthSession, persist, reset }}
    >
      {children}
    </SessionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within <SessionProvider>");
  }
  return ctx;
}
