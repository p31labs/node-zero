const DB_NAME = "p31-bonding";
const STORE = "games";
const VERSION = 1;

export interface PlacedAtom {
  id: number;
  element: string;
  x: number;
  y: number;
  placedBy: number;
  bonds: number[];
  timestamp: string;
}

export type PingReaction = "💚" | "🤔" | "😂" | "🔺";

export interface Ping {
  from: number;
  atomId: number;
  reaction: PingReaction;
  timestamp: string;
}

export interface Player {
  name: string;
  color: string;
  fingerprint?: string;
}

export interface GameState {
  id: string;
  name: string;
  players: Player[];
  currentTurn: number;
  atoms: PlacedAtom[];
  pings: Ping[];
  achievements: string[];
  formula: string;
  totalMass: number;
  createdAt: string;
  updatedAt: string;
  status: "active" | "complete";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function saveGame(game: GameState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const doc = { ...game, updatedAt: new Date().toISOString() };
    const req = store.put(doc);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function loadGame(id: string): Promise<GameState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      resolve(req.result ?? null);
      db.close();
    };
  });
}

export async function listGames(): Promise<GameState[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const list = (req.result ?? []) as GameState[];
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(list);
      db.close();
    };
  });
}

export function newGame(p1: Player, p2: Player, name: string): GameState {
  return {
    id: crypto.randomUUID(),
    name,
    players: [p1, p2],
    currentTurn: 0,
    atoms: [],
    pings: [],
    achievements: [],
    formula: "",
    totalMass: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
  };
}

let nextAtomId = 1;
export function nextId(): number {
  return nextAtomId++;
}
export function setNextAtomId(id: number): void {
  nextAtomId = Math.max(nextAtomId, id + 1);
}
