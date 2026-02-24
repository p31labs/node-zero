// ═══════════════════════════════════════════════════════════
// P31 CONNECTION MANAGER — All service wiring in one place
// ═══════════════════════════════════════════════════════════
// Rule: The app works at EVERY degradation level.
// All 6 connected = full power. Zero connected = still safe.

import { COLORS } from './design-tokens';

// ─── TYPES ───────────────────────────────────────────────

export type ServiceId = 'api' | 'ws' | 'ollama' | 'serial' | 'web3' | 'dexie';

export type ServiceStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'unavailable';

export interface ServiceState {
  id: ServiceId;
  label: string;
  status: ServiceStatus;
  url: string;
  error?: string;
  latency?: number;
  lastChecked?: number;
  required: boolean;
  offlineCapable: boolean;
}

export interface ConnectionConfig {
  apiUrl: string;
  wsUrl: string;
  ollamaUrl: string;
  web3Rpc: string;
  loveLedgerAddress: string;
  serialBaud: number;
}

// ─── DEFAULTS (read from env, fallback to localhost) ─────

const DEFAULT_CONFIG: ConnectionConfig = {
  apiUrl:             import.meta.env.VITE_API_URL              || 'http://localhost:8031',
  wsUrl:              import.meta.env.VITE_WS_URL               || 'ws://localhost:8031/ws',
  ollamaUrl:          import.meta.env.VITE_OLLAMA_URL           || 'http://localhost:11434',
  web3Rpc:            import.meta.env.VITE_WEB3_RPC             || 'http://localhost:8545',
  loveLedgerAddress:  import.meta.env.VITE_LOVE_LEDGER_ADDRESS  || '',
  serialBaud: 115200,
};

function createInitialState(config: ConnectionConfig): Map<ServiceId, ServiceState> {
  return new Map<ServiceId, ServiceState>([
    ['dexie', {
      id: 'dexie', label: 'Local Cache', status: 'disconnected',
      url: 'indexeddb://p31-buffer', required: false, offlineCapable: true,
    }],
    ['api', {
      id: 'api', label: 'Buffer API', status: 'disconnected',
      url: config.apiUrl, required: false, offlineCapable: false,
    }],
    ['ws', {
      id: 'ws', label: 'WebSocket', status: 'disconnected',
      url: config.wsUrl, required: false, offlineCapable: false,
    }],
    ['ollama', {
      id: 'ollama', label: 'Local AI', status: 'disconnected',
      url: config.ollamaUrl, required: false, offlineCapable: true,
    }],
    ['web3', {
      id: 'web3', label: 'L.O.V.E. Ledger', status: 'disconnected',
      url: config.web3Rpc, required: false, offlineCapable: false,
    }],
    ['serial', {
      id: 'serial', label: 'Node One', status: 'disconnected',
      url: `serial:${config.serialBaud}`, required: false, offlineCapable: true,
    }],
  ]);
}

// ─── STATUS MAPPING ──────────────────────────────────────

export const STATUS_COLORS: Record<ServiceStatus, string> = {
  disconnected: COLORS.text.dim,
  connecting:   COLORS.state.yellow,
  connected:    COLORS.state.green,
  error:        COLORS.state.red,
  unavailable:  COLORS.text.dim,
};

export const STATUS_ICONS: Record<ServiceStatus, string> = {
  disconnected: '○',
  connecting:   '◌',
  connected:    '●',
  error:        '✗',
  unavailable:  '—',
};

// ─── PROBE FUNCTIONS ─────────────────────────────────────

async function probeHttp(
  url: string, path: string = '', timeoutMs: number = 3000
): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}${path}`, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    return { ok: res.ok, latency: Math.round(performance.now() - start) };
  } catch (e: unknown) {
    const err = e as Error;
    return { ok: false, latency: Math.round(performance.now() - start), error: err.message || 'unreachable' };
  }
}

async function probeWebSocket(
  url: string, timeoutMs: number = 3000
): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = performance.now();
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        resolve({ ok: false, latency: Math.round(performance.now() - start), error: 'timeout' });
      }, timeoutMs);
      ws.onopen = () => { clearTimeout(timer); ws.close(); resolve({ ok: true, latency: Math.round(performance.now() - start) }); };
      ws.onerror = () => { clearTimeout(timer); resolve({ ok: false, latency: Math.round(performance.now() - start), error: 'refused' }); };
    } catch (e: unknown) {
      const err = e as Error;
      resolve({ ok: false, latency: Math.round(performance.now() - start), error: err.message });
    }
  });
}

async function probeDexie(): Promise<{ ok: boolean; error?: string }> {
  try {
    return new Promise((resolve) => {
      const req = indexedDB.open('p31-buffer-probe', 1);
      req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('p31-buffer-probe'); resolve({ ok: true }); };
      req.onerror = () => resolve({ ok: false, error: 'IndexedDB blocked' });
    });
  } catch (e: unknown) {
    const err = e as Error;
    return { ok: false, error: err.message };
  }
}

// ─── CONNECTION MANAGER ──────────────────────────────────

export type ConnectionListener = (services: Map<ServiceId, ServiceState>) => void;

export class ConnectionManager {
  private services: Map<ServiceId, ServiceState>;
  private config: ConnectionConfig;
  private listeners: Set<ConnectionListener> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.services = createInitialState(this.config);
  }

  // ── State ──

  getServices(): Map<ServiceId, ServiceState> { return new Map(this.services); }
  getService(id: ServiceId): ServiceState | undefined { return this.services.get(id); }

  private update(id: ServiceId, patch: Partial<ServiceState>) {
    const current = this.services.get(id);
    if (current) {
      this.services.set(id, { ...current, ...patch, lastChecked: Date.now() });
      this.notify();
    }
  }

  // ── Pub/Sub ──

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    listener(this.getServices());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = this.getServices();
    this.listeners.forEach(fn => fn(snapshot));
  }

  // ── Probe All ──

  async probeAll(): Promise<void> {
    await Promise.allSettled([
      this.probeService('dexie'),
      this.probeService('api'),
      this.probeService('ws'),
      this.probeService('ollama'),
      this.probeService('web3'),
      this.probeService('serial'),
    ]);
  }

  async probeService(id: ServiceId): Promise<void> {
    switch (id) {
      case 'api': {
        this.update('api', { status: 'connecting' });
        const r = await probeHttp(this.config.apiUrl, '/health');
        this.update('api', { status: r.ok ? 'connected' : 'error', latency: r.latency, error: r.error });
        break;
      }
      case 'ws': {
        this.update('ws', { status: 'connecting' });
        const r = await probeWebSocket(this.config.wsUrl);
        this.update('ws', { status: r.ok ? 'connected' : 'error', latency: r.latency, error: r.error });
        break;
      }
      case 'ollama': {
        this.update('ollama', { status: 'connecting' });
        const r = await probeHttp(this.config.ollamaUrl, '/api/tags');
        this.update('ollama', { status: r.ok ? 'connected' : 'error', latency: r.latency, error: r.error });
        break;
      }
      case 'serial': {
        const available = 'serial' in navigator;
        this.update('serial', {
          status: available ? 'disconnected' : 'unavailable',
          error: available ? undefined : 'WebSerial not available',
        });
        break;
      }
      case 'web3': {
        const hasWallet = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum;
        if (!hasWallet) { this.update('web3', { status: 'unavailable', error: 'No wallet detected' }); break; }
        this.update('web3', { status: 'connecting' });
        const r = await probeHttp(this.config.web3Rpc, '', 2000);
        this.update('web3', { status: r.ok ? 'connected' : 'error', latency: r.latency, error: r.error });
        break;
      }
      case 'dexie': {
        this.update('dexie', { status: 'connecting' });
        const r = await probeDexie();
        this.update('dexie', { status: r.ok ? 'connected' : 'error', error: r.error });
        break;
      }
    }
  }

  // ── Active Connections ──

  async connectWebSocket(): Promise<void> {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.update('ws', { status: 'connecting' });

    try {
      this.ws = new WebSocket(this.config.wsUrl);
      this.ws.onopen = () => this.update('ws', { status: 'connected' });
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          window.dispatchEvent(new CustomEvent('p31:ws-message', { detail: data }));
        } catch { /* non-JSON */ }
      };
      this.ws.onclose = () => {
        this.update('ws', { status: 'disconnected' });
        setTimeout(() => {
          if (this.getService('ws')?.status === 'disconnected') this.connectWebSocket();
        }, 5000);
      };
      this.ws.onerror = () => this.update('ws', { status: 'error', error: 'connection failed' });
    } catch (e: unknown) {
      const err = e as Error;
      this.update('ws', { status: 'error', error: err.message });
    }
  }

  async connectSerial(): Promise<boolean> {
    if (!('serial' in navigator)) {
      this.update('serial', { status: 'unavailable', error: 'WebSerial not supported' });
      return false;
    }
    try {
      this.update('serial', { status: 'connecting' });
      const nav = navigator as unknown as { serial: { requestPort: () => Promise<{ open: (o: { baudRate: number }) => Promise<void> }> } };
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: this.config.serialBaud });
      this.update('serial', { status: 'connected' });
      (window as unknown as { __p31SerialPort?: unknown }).__p31SerialPort = port;
      window.dispatchEvent(new CustomEvent('p31:serial-connected', { detail: port }));
      return true;
    } catch (e: unknown) {
      const err = e as Error;
      this.update('serial', { status: 'error', error: err.name === 'NotFoundError' ? 'No device selected' : err.message });
      return false;
    }
  }

  async connectWeb3(): Promise<boolean> {
    const ethereum = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!ethereum) { this.update('web3', { status: 'unavailable', error: 'No wallet' }); return false; }
    try {
      this.update('web3', { status: 'connecting' });
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        this.update('web3', { status: 'connected' });
        window.dispatchEvent(new CustomEvent('p31:web3-connected', { detail: accounts[0] }));
        return true;
      }
      this.update('web3', { status: 'error', error: 'No accounts' });
      return false;
    } catch (e: unknown) {
      const err = e as Error;
      this.update('web3', { status: 'error', error: err.message });
      return false;
    }
  }

  // ── Heartbeat ──

  startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const api = this.getService('api');
      const ollama = this.getService('ollama');
      if (api?.status === 'connected') this.probeService('api');
      if (ollama?.status === 'connected') this.probeService('ollama');
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.listeners.clear();
  }

  // ── Computed ──

  get isOnline(): boolean { return this.getService('api')?.status === 'connected'; }
  get hasLocalAI(): boolean { return this.getService('ollama')?.status === 'connected'; }
  get hasHardware(): boolean { return this.getService('serial')?.status === 'connected'; }
  get hasWeb3(): boolean { return this.getService('web3')?.status === 'connected'; }
  get hasLocalCache(): boolean { return this.getService('dexie')?.status === 'connected'; }

  get tier(): 'FULL' | 'ONLINE' | 'LOCAL' | 'OFFLINE' {
    if (this.isOnline && this.hasLocalAI && this.hasLocalCache) return 'FULL';
    if (this.isOnline) return 'ONLINE';
    if (this.hasLocalAI || this.hasLocalCache) return 'LOCAL';
    return 'OFFLINE';
  }

  get tierLabel(): string {
    const labels = {
      FULL: 'ALL CIRCUITS NOMINAL',
      ONLINE: 'ONLINE MODE',
      LOCAL: 'LOCAL MODE',
      OFFLINE: 'OFFLINE — YOU ARE SAFE',
    };
    return labels[this.tier];
  }

  get connectedCount(): number {
    let n = 0; this.services.forEach(s => { if (s.status === 'connected') n++; }); return n;
  }

  getConfig(): ConnectionConfig { return { ...this.config }; }

  updateConfig(patch: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...patch };
    if (patch.apiUrl) this.update('api', { url: patch.apiUrl });
    if (patch.wsUrl) this.update('ws', { url: patch.wsUrl });
    if (patch.ollamaUrl) this.update('ollama', { url: patch.ollamaUrl });
    if (patch.web3Rpc) this.update('web3', { url: patch.web3Rpc });
  }
}

// SINGLETON — one instance for the entire app
export const connectionManager = new ConnectionManager();
