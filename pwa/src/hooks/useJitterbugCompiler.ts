// Adapted from 04_SOFTWARE/spaceship-earth/src/hooks/useJitterbugCompiler.ts
// Removed useSovereignStore dependency — uses local slot registry instead.

import { useState, useCallback, useEffect, useRef } from 'react';
import { ensureBabel, compileCentaurCode, moduleRegistry } from '../lib/jitterbugCompiler';
import { buildSrcdoc, validateManifest } from '../lib/cartridgeSandbox';
import { saveCartridge, listCartridges } from '../lib/cartridgeStore';
import type { CartridgeRecord } from '../lib/cartridgeStore';
import type { CartridgeTelemetry } from '../lib/cartridgeSandbox';

export type CompilerStatus = 'idle' | 'loading' | 'ready' | 'compiling' | 'error';

export interface MountedSlot {
  slot: number;
  name: string;
}

export interface JitterbugCompiler {
  status: CompilerStatus;
  error: string | null;
  telemetry: CartridgeTelemetry[];
  cartridges: CartridgeRecord[];
  mountedSlots: MountedSlot[];

  compile: (source: string) => string | null;
  compileAndMount: (source: string, slot: number, name: string) => boolean;
  buildSandboxed: (source: string, title: string) => string | null;
  persist: (record: Omit<CartridgeRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  validateManifest: (manifest: unknown) => { valid: boolean; errors: string[] };
  refreshCartridges: () => Promise<void>;
  unmountSlot: (slot: number) => void;
}

export function useJitterbugCompiler(): JitterbugCompiler {
  const [status, setStatus] = useState<CompilerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<CartridgeTelemetry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeRecord[]>([]);
  const [mountedSlots, setMountedSlots] = useState<MountedSlot[]>([]);
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  useEffect(() => {
    setStatus('loading');
    ensureBabel()
      .then(() => setStatus('ready'))
      .catch((err: Error) => {
        setStatus('error');
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.channel !== 'P31_CARTRIDGE') return;
      const msg: CartridgeTelemetry = {
        type: event.data.type,
        payload: event.data.payload,
        timestamp: event.data.timestamp ?? Date.now(),
      };
      setTelemetry(prev => [...prev.slice(-199), msg]);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    listCartridges().then(setCartridges).catch(() => {});
  }, []);

  const compile = useCallback((source: string): string | null => {
    try {
      setStatus('compiling');
      setError(null);
      if (!window.Babel) throw new Error('Babel not loaded');
      let code = source.trim();
      if (code.startsWith('```')) {
        code = code.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      const transformed = window.Babel.transform(code, { presets: ['react'] });
      if (!transformed.code) throw new Error('Babel transform returned empty');
      setStatus('ready');
      return transformed.code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('error');
      return null;
    }
  }, []);

  const compileAndMount = useCallback((source: string, slot: number, name: string): boolean => {
    try {
      setStatus('compiling');
      setError(null);
      const Component = compileCentaurCode(source);
      moduleRegistry.set(`SLOT_${slot}`, Component);
      setMountedSlots(prev => {
        const filtered = prev.filter(s => s.slot !== slot);
        return [...filtered, { slot, name }];
      });
      setStatus('ready');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('error');
      return false;
    }
  }, []);

  const buildSandboxed = useCallback((source: string, title: string): string | null => {
    const compiled = compile(source);
    if (!compiled) return null;
    return buildSrcdoc(compiled, title);
  }, [compile]);

  const persist = useCallback(async (record: Omit<CartridgeRecord, 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    await saveCartridge({ ...record, createdAt: now, updatedAt: now });
    const updated = await listCartridges();
    setCartridges(updated);
  }, []);

  const refreshCartridges = useCallback(async () => {
    const list = await listCartridges();
    setCartridges(list);
  }, []);

  const unmountSlot = useCallback((slot: number) => {
    moduleRegistry.delete(`SLOT_${slot}`);
    setMountedSlots(prev => prev.filter(s => s.slot !== slot));
  }, []);

  return {
    status, error, telemetry, cartridges, mountedSlots,
    compile, compileAndMount, buildSandboxed,
    persist, validateManifest, refreshCartridges, unmountSlot,
  };
}
