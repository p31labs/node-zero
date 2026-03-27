// D3.7: IndexedDB persistence for Centaur Cartridges
// Stores raw intent, source code, compiled output, and manifest.
// Uses raw IndexedDB (no idb-keyval dependency needed).

import type { P31AppManifest } from './cartridgeSandbox';

export interface CartridgeRecord {
  id: string;             // unique cartridge ID (slot name or UUID)
  name: string;
  intent: string;         // original user prompt / intent
  sourceCode: string;     // raw JSX source
  compiledCode: string;   // transpiled JS output
  manifest: P31AppManifest | null;
  createdAt: number;
  updatedAt: number;
  slot: number | null;    // mounted slot number, or null
}

const DB_NAME = 'p31-cartridges';
const DB_VERSION = 1;
const STORE_NAME = 'cartridges';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('slot', 'slot', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function saveCartridge(record: CartridgeRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(record);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getCartridge(id: string): Promise<CartridgeRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function listCartridges(): Promise<CartridgeRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').index('updatedAt').openCursor(null, 'prev');
    const results: CartridgeRecord[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteCartridge(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getCartridgesBySlot(slot: number): Promise<CartridgeRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').index('slot').getAll(slot);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
