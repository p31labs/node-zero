/**
 * useConnections.ts — React hook wrapping ConnectionManager
 */
import { useSyncExternalStore, useMemo } from 'react';
import { createConnectionManager, type ConnectionManager } from '../lib/connection-manager';

// Singleton — one manager per app lifetime
let _manager: ConnectionManager | null = null;
function getManager(): ConnectionManager {
  if (!_manager) _manager = createConnectionManager();
  return _manager;
}

export function useConnections() {
  const mgr = useMemo(() => getManager(), []);

  // Force re-render on any status change
  useSyncExternalStore(
    mgr.subscribe,
    () => mgr.connectedCount + mgr.tier, // snapshot key
  );

  return mgr;
}
