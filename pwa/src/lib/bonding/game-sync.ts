/**
 * BONDING async multiplayer — relay client.
 * Set VITE_BONDING_RELAY_URL to your worker URL after deploy.
 */

const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: { VITE_BONDING_RELAY_URL?: string } }).env?.VITE_BONDING_RELAY_URL) ||
  "";

export interface SyncState {
  code: string;
  slot: number;
  polling: boolean;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let syncState: SyncState | null = null;

export function isRelayAvailable(): boolean {
  return Boolean(API_BASE);
}

export async function createOnlineGame(
  playerName: string,
  playerColor: string,
  moleculeName: string
): Promise<{ code: string; game: unknown }> {
  const res = await fetch(`${API_BASE}/api/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerName, playerColor, name: moleculeName }),
  });
  if (!res.ok) throw new Error("Could not create game");
  const data = (await res.json()) as { code: string; game: unknown };
  syncState = { code: data.code, slot: 0, polling: false };
  return data;
}

export async function joinOnlineGame(
  code: string,
  playerName: string,
  playerColor: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/game/${code.toUpperCase()}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerName, playerColor }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Join failed");
  syncState = { code: code.toUpperCase(), slot: 1, polling: false };
  return data;
}

export async function fetchGame(code: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/game/${code}`);
  if (!res.ok) throw new Error("Game not found");
  return res.json();
}

export async function pushMove(
  code: string,
  slot: number,
  atom: { element: string; x: number; y: number },
  bondToId: number | undefined,
  formula: string,
  totalMass: number,
  newAchievements: string[]
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/game/${code}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, atom, bondToId, formula, totalMass, newAchievements }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Move failed");
  return data;
}

export async function pushPing(
  code: string,
  slot: number,
  atomId: number,
  reaction: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/game/${code}/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, atomId, reaction }),
  });
  return res.ok ? res.json() : Promise.reject(new Error("Ping failed"));
}

export async function pushFinish(code: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/game/${code}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Finish failed");
  return res.json();
}

export function startPolling(code: string, onUpdate: (game: unknown) => void): void {
  if (pollInterval) stopPolling();
  let lastUpdatedAt = "";

  const poll = async () => {
    try {
      const game = await fetchGame(code);
      const g = game as { updatedAt?: string };
      if (g.updatedAt !== lastUpdatedAt) {
        lastUpdatedAt = g.updatedAt ?? "";
        onUpdate(game);
      }
    } catch {
      // Silent; will retry next interval
    }
  };

  poll();
  pollInterval = setInterval(poll, 10000);

  const onVisibility = () => {
    if (document.hidden) {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
    } else {
      poll();
      pollInterval = setInterval(poll, 10000);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function getSyncState(): SyncState | null {
  return syncState;
}

export function clearSyncState(): void {
  syncState = null;
}
