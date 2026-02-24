/**
 * P31 session persistence — IndexedDB.
 * Saves ALIVE state (nodeId, fingerprint, domeName, ledger + game snapshots)
 * so refresh restores the session. No private keys stored.
 */

const DB_NAME = "p31-pwa";
const STORE = "session";
const KEY = "alive";

export interface StoredSession {
  version: 1;
  phase: 5;
  nodeId: string;
  fingerprint: string;
  domeName: string;
  ledgerSnapshot: unknown;
  gameSnapshot: unknown;
  savedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
  });
}

export async function saveSession(session: Omit<StoredSession, "version">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const doc = { id: KEY, version: 1 as const, ...session };
    const req = store.put(doc);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function loadSession(): Promise<StoredSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const doc = req.result;
      if (!doc || doc.version !== 1 || doc.phase !== 5) {
        resolve(null);
        return;
      }
      resolve({
        version: 1,
        phase: 5,
        nodeId: doc.nodeId,
        fingerprint: doc.fingerprint,
        domeName: doc.domeName,
        ledgerSnapshot: doc.ledgerSnapshot,
        gameSnapshot: doc.gameSnapshot,
        savedAt: doc.savedAt,
      });
    };
    tx.oncomplete = () => db.close();
  });
}

export async function clearSession(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}
