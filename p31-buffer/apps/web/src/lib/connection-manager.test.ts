import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from './connection-manager';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock WebSocket
const mockWebSocketInstance = {
  close: vi.fn(),
  onopen: vi.fn(),
  onerror: vi.fn(),
  onclose: vi.fn(),
};
vi.stubGlobal('WebSocket', vi.fn(() => mockWebSocketInstance));


// Mock indexedDB
vi.stubGlobal('indexedDB', {
  open: () => {
    const req = { onsuccess: null as any, onerror: null as any, result: { close() {} } };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  },
  deleteDatabase: () => {},
});

describe('ConnectionManager', () => {
  let mgr: ConnectionManager;

  beforeEach(() => {
    mgr = new ConnectionManager();
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('starts with 6 services', () => {
      expect(mgr.getServices().size).toBe(6);
    });

    it('all services start disconnected', () => {
      for (const [, svc] of mgr.getServices()) {
        expect(['disconnected', 'unavailable']).toContain(svc.status);
      }
    });

    it('tier is OFFLINE when nothing connected', () => {
      expect(mgr.tier).toBe('OFFLINE');
    });

    it('tierLabel is "OFFLINE — YOU ARE SAFE"', () => {
      expect(mgr.tierLabel).toBe('OFFLINE — YOU ARE SAFE');
    });

    it('connectedCount is 0', () => {
      expect(mgr.connectedCount).toBe(0);
    });
  });

  describe('probeApi', () => {
    it('sets status to connected when API returns 200', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await mgr.probeService('api');
      expect(mgr.getService('api')?.status).toBe('connected');
    });

    it('sets status to error when API unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await mgr.probeService('api');
      expect(mgr.getService('api')?.status).toBe('error');
    });

    it('records latency on successful probe', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await mgr.probeService('api');
      expect(mgr.getService('api')?.latency).toBeDefined();
      expect(mgr.getService('api')?.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('probeOllama', () => {
    it('probes /api/tags endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await mgr.probeService('ollama');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        expect.any(Object)
      );
      expect(mgr.getService('ollama')?.status).toBe('connected');
    });
  });

  describe('probeDexie', () => {
    it('sets status to connected when IndexedDB available', async () => {
      await mgr.probeService('dexie');
      // With our mock, this should succeed
      expect(mgr.getService('dexie')?.status).toBe('connected');
    });
  });

  describe('probeSerial', () => {
    it('sets unavailable when WebSerial not in navigator', () => {
      // jsdom doesn't have navigator.serial
      mgr.probeService('serial');
      expect(mgr.getService('serial')?.status).toBe('unavailable');
    });
  });

  describe('tier computation', () => {
    it('returns ONLINE when only API connected', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }); // api
      await mgr.probeService('api');
      expect(mgr.tier).toBe('ONLINE');
    });

    it('returns LOCAL when only Dexie connected', async () => {
      await mgr.probeService('dexie');
      expect(mgr.tier).toBe('LOCAL');
    });

    it('returns FULL when API + Ollama + Dexie connected', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true }); // api
      await mgr.probeService('api');
      mockFetch.mockResolvedValueOnce({ ok: true }); // ollama
      await mgr.probeService('ollama');
      await mgr.probeService('dexie');
      expect(mgr.tier).toBe('FULL');
    });
  });

  describe('subscribe', () => {
    it('calls listener immediately with current state', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.any(Map));
    });

    it('calls listener on state change', async () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      listener.mockClear();

      mockFetch.mockResolvedValueOnce({ ok: true });
      await mgr.probeService('api');

      // Should have been called for 'connecting' and 'connected'
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      listener.mockClear();

      unsub();
      mockFetch.mockResolvedValueOnce({ ok: true });
      mgr.probeService('api');

      // Listener should NOT be called after unsubscribe
      // (give it a tick for the async probe)
      setTimeout(() => {
        expect(listener).not.toHaveBeenCalled();
      }, 100);
    });
  });

  describe('config', () => {
    it('returns default config', () => {
      const config = mgr.getConfig();
      expect(config.serialBaud).toBe(115200);
    });

    it('updateConfig changes service URLs', () => {
      mgr.updateConfig({ apiUrl: 'http://newhost:9999' });
      expect(mgr.getService('api')?.url).toBe('http://newhost:9999');
    });
  });
});
