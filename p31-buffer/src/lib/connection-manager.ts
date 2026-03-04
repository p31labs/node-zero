/**
 * connection-manager.ts — Service registry and probe logic
 * 6 circuits: API, WebSocket, Ollama, Web3, Serial (Node One), Service Worker
 */

export type ServiceId = 'api' | 'ws' | 'ollama' | 'web3' | 'serial' | 'sw';
export type ServiceStatus = 'unknown' | 'probing' | 'connected' | 'error' | 'unavailable' | 'connecting';
export type ConnectionTier = 'FULL' | 'ONLINE' | 'LOCAL' | 'OFFLINE';

export interface ServiceState {
  label: string;
  url: string;
  status: ServiceStatus;
  error?: string;
  latency?: number;
  offlineCapable: boolean;
}

export interface ConnectionConfig {
  apiUrl: string;
  wsUrl: string;
  ollamaUrl: string;
  web3Rpc: string;
  loveLedgerAddress: string;
}

export const STATUS_COLORS: Record<ServiceStatus, string> = {
  unknown: '#555',
  probing: '#F0B547',
  connected: '#00E878',
  error: '#FF4444',
  unavailable: '#333',
  connecting: '#F0B547',
};

export const STATUS_ICONS: Record<ServiceStatus, string> = {
  unknown: '○',
  probing: '◌',
  connected: '◉',
  error: '✕',
  unavailable: '—',
  connecting: '◌',
};

const DEFAULT_CONFIG: ConnectionConfig = {
  apiUrl: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8000/ws',
  ollamaUrl: 'http://localhost:11434',
  web3Rpc: 'http://localhost:8545',
  loveLedgerAddress: '',
};

function defaultServices(): Map<ServiceId, ServiceState> {
  return new Map<ServiceId, ServiceState>([
    ['api', { label: 'Buffer API', url: DEFAULT_CONFIG.apiUrl, status: 'unknown', offlineCapable: false }],
    ['ws', { label: 'WebSocket', url: DEFAULT_CONFIG.wsUrl, status: 'unknown', offlineCapable: false }],
    ['ollama', { label: 'Ollama (Local AI)', url: DEFAULT_CONFIG.ollamaUrl, status: 'unknown', offlineCapable: true }],
    ['web3', { label: 'Web3 RPC', url: DEFAULT_CONFIG.web3Rpc, status: 'unknown', offlineCapable: false }],
    ['serial', { label: 'Node One (Serial)', url: 'navigator.serial', status: 'unknown', offlineCapable: true }],
    ['sw', { label: 'Service Worker', url: 'navigator.serviceWorker', status: 'unknown', offlineCapable: true }],
  ]);
}

export function createConnectionManager() {
  let config = { ...DEFAULT_CONFIG };
  const services = defaultServices();
  const listeners: Set<() => void> = new Set();

  function notify() {
    listeners.forEach(fn => fn());
  }

  function setStatus(id: ServiceId, status: ServiceStatus, extra?: Partial<ServiceState>) {
    const svc = services.get(id);
    if (svc) {
      svc.status = status;
      if (extra?.error !== undefined) svc.error = extra.error;
      if (extra?.latency !== undefined) svc.latency = extra.latency;
      notify();
    }
  }

  async function probeHttp(id: ServiceId, url: string, path = '/health'): Promise<void> {
    setStatus(id, 'probing');
    const start = performance.now();
    try {
      const res = await fetch(url + path, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setStatus(id, 'connected', { latency: Math.round(performance.now() - start) });
      } else {
        setStatus(id, 'error', { error: `HTTP ${res.status}` });
      }
    } catch (e) {
      setStatus(id, 'error', { error: (e as Error).message.slice(0, 60) });
    }
  }

  function computeTier(): ConnectionTier {
    const s = (id: ServiceId) => services.get(id)?.status === 'connected';
    if (s('api') && s('ws') && s('ollama') && s('serial')) return 'FULL';
    if (s('api') && s('ws')) return 'ONLINE';
    if (s('ollama') || s('sw')) return 'LOCAL';
    return 'OFFLINE';
  }

  return {
    services,
    getConfig: () => ({ ...config }),
    updateConfig: (patch: Partial<ConnectionConfig>) => {
      config = { ...config, ...patch };
      const svc = services;
      if (patch.apiUrl) svc.get('api')!.url = patch.apiUrl;
      if (patch.wsUrl) svc.get('ws')!.url = patch.wsUrl;
      if (patch.ollamaUrl) svc.get('ollama')!.url = patch.ollamaUrl;
      if (patch.web3Rpc) svc.get('web3')!.url = patch.web3Rpc;
      notify();
    },
    probeService: async (id: ServiceId) => {
      if (id === 'api') return probeHttp('api', config.apiUrl, '/health');
      if (id === 'ws') return probeHttp('ws', config.apiUrl, '/health'); // WS shares API host
      if (id === 'ollama') return probeHttp('ollama', config.ollamaUrl, '/api/tags');
      if (id === 'web3') return probeHttp('web3', config.web3Rpc, '');
      if (id === 'serial') {
        setStatus('serial', 'serial' in navigator ? 'unknown' : 'unavailable');
      }
      if (id === 'sw') {
        setStatus('sw', 'serviceWorker' in navigator ? 'unknown' : 'unavailable');
      }
    },
    probeAll: async () => {
      await Promise.allSettled([
        probeHttp('api', config.apiUrl, '/health'),
        probeHttp('ollama', config.ollamaUrl, '/api/tags'),
      ]);
      // Serial and SW just check availability
      setStatus('serial', 'serial' in navigator ? 'unknown' : 'unavailable');
      setStatus('sw', 'serviceWorker' in navigator ? 'unknown' : 'unavailable');
    },
    connectWebSocket: () => setStatus('ws', 'connecting'),
    connectSerial: () => setStatus('serial', 'connecting'),
    connectWeb3: () => setStatus('web3', 'connecting'),
    get tier() { return computeTier(); },
    get tierLabel() {
      const labels: Record<ConnectionTier, string> = {
        FULL: 'FULL MESH', ONLINE: 'ONLINE', LOCAL: 'LOCAL ONLY', OFFLINE: 'OFFLINE',
      };
      return labels[computeTier()];
    },
    get connectedCount() {
      let c = 0;
      services.forEach(s => { if (s.status === 'connected') c++; });
      return c;
    },
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export type ConnectionManager = ReturnType<typeof createConnectionManager>;
