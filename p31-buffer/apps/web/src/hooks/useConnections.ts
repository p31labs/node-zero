import { useState, useEffect, useCallback } from 'react';
import {
  connectionManager,
  type ServiceId,
  type ServiceState,
  type ConnectionConfig,
} from '../lib/connection-manager';

export interface UseConnectionsReturn {
  services: Map<ServiceId, ServiceState>;
  tier: 'FULL' | 'ONLINE' | 'LOCAL' | 'OFFLINE';
  tierLabel: string;
  connectedCount: number;
  isOnline: boolean;
  hasLocalAI: boolean;
  hasHardware: boolean;
  hasWeb3: boolean;
  hasLocalCache: boolean;
  probeAll: () => Promise<void>;
  probeService: (id: ServiceId) => Promise<void>;
  connectWebSocket: () => Promise<void>;
  connectSerial: () => Promise<boolean>;
  connectWeb3: () => Promise<boolean>;
  updateConfig: (patch: Partial<ConnectionConfig>) => void;
  getConfig: () => ConnectionConfig;
}

export function useConnections(): UseConnectionsReturn {
  const [services, setServices] = useState<Map<ServiceId, ServiceState>>(
    connectionManager.getServices()
  );

  useEffect(() => {
    const unsub = connectionManager.subscribe(setServices);

    connectionManager.probeAll().then(() => {
      if (connectionManager.getService('api')?.status === 'connected') {
        connectionManager.connectWebSocket();
      }
      connectionManager.startHeartbeat();
    });

    return () => {
      unsub();
      connectionManager.stopHeartbeat();
    };
  }, []);

  return {
    services,
    tier: connectionManager.tier,
    tierLabel: connectionManager.tierLabel,
    connectedCount: connectionManager.connectedCount,
    isOnline: connectionManager.isOnline,
    hasLocalAI: connectionManager.hasLocalAI,
    hasHardware: connectionManager.hasHardware,
    hasWeb3: connectionManager.hasWeb3,
    hasLocalCache: connectionManager.hasLocalCache,
    probeAll: useCallback(() => connectionManager.probeAll(), []),
    probeService: useCallback((id: ServiceId) => connectionManager.probeService(id), []),
    connectWebSocket: useCallback(() => connectionManager.connectWebSocket(), []),
    connectSerial: useCallback(() => connectionManager.connectSerial(), []),
    connectWeb3: useCallback(() => connectionManager.connectWeb3(), []),
    updateConfig: useCallback((p: Partial<ConnectionConfig>) => connectionManager.updateConfig(p), []),
    getConfig: useCallback(() => connectionManager.getConfig(), []),
  };
}
