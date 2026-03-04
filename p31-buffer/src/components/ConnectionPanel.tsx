import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useConnections } from '../hooks/useConnections';
import {
  STATUS_COLORS,
  STATUS_ICONS,
  type ServiceId,
  type ServiceStatus,
  type ConnectionConfig,
} from '../lib/connection-manager';
import { COLORS, FONTS, SPACE, BORDER, TRANSITION, PATTERNS, Z, SHADOW, LAYOUT } from '../lib/design-tokens';

interface ConnectionPanelProps {
  visible: boolean;
  onClose: () => void;
}

function ServiceRow({
  id: _id, label, status, url, error, latency, offlineCapable,
  onProbe, onConnect,
}: {
  id: ServiceId; label: string; status: ServiceStatus; url: string;
  error?: string; latency?: number; offlineCapable: boolean;
  onProbe: () => void; onConnect?: () => void;
}) {
  const color = STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];
  const isConnectable = status !== 'connected' && status !== 'unavailable' && status !== 'connecting' && onConnect;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: SPACE[3],
      padding: `${SPACE[3]} ${SPACE[4]}`,
      borderBottom: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
      transition: TRANSITION.fast,
    }}>
      <span style={{ color, fontSize: FONTS.size.lg, lineHeight: 1, width: LAYOUT.iconSize, textAlign: 'center' }}>
        {status === 'connecting' ? '◌' : icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium,
          color: COLORS.text.primary, fontFamily: FONTS.mono,
          display: 'flex', alignItems: 'center', gap: SPACE[2],
        }}>
          {label}
          {offlineCapable && (
            <span style={{
              fontSize: FONTS.size.xs, color: COLORS.text.dim,
              border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
              borderRadius: BORDER.radius.sm, padding: `0 ${SPACE[1]}`,
            }}>LOCAL</span>
          )}
        </div>
        <div style={{
          fontSize: FONTS.size.xs, color: COLORS.text.dim,
          fontFamily: FONTS.mono, marginTop: SPACE[0.5],
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {error && status === 'error' ? (
            <span style={{ color: COLORS.state.red }}>{error}</span>
          ) : (
            <>
              {url}
              {latency !== undefined && status === 'connected' && (
                <span style={{ color: COLORS.state.green, marginLeft: SPACE[2] }}>{latency}ms</span>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: SPACE[1] }}>
        <button
          type="button"
          onClick={onProbe}
          title="Re-probe"
          style={{
            background: 'none', border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
            color: COLORS.text.secondary, cursor: 'pointer', fontFamily: FONTS.mono,
            fontSize: FONTS.size.xs, padding: `${SPACE[1]} ${SPACE[2]}`,
            borderRadius: BORDER.radius.sm, transition: TRANSITION.fast,
          }}
        >⟳</button>

        {isConnectable && (
          <button
            type="button"
            onClick={onConnect}
            style={{
              background: 'none', border: `${BORDER.width.thin} solid ${COLORS.accent.primary}`,
              color: COLORS.accent.primary, cursor: 'pointer', fontFamily: FONTS.mono,
              fontSize: FONTS.size.xs, padding: `${SPACE[1]} ${SPACE[2]}`,
              borderRadius: BORDER.radius.sm, transition: TRANSITION.fast,
            }}
          >CONNECT</button>
        )}
      </div>
    </div>
  );
}

function ConfigEditor({
  config, onSave, onCancel,
}: {
  config: ConnectionConfig; onSave: (c: Partial<ConnectionConfig>) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(config);

  const fieldStyle: CSSProperties = {
    ...PATTERNS.input,
    fontSize: FONTS.size.xs,
    padding: `${SPACE[1.5]} ${SPACE[2]}`,
    marginTop: SPACE[1],
  };

  const labelStyle: CSSProperties = {
    fontSize: FONTS.size.xs, color: COLORS.text.dim,
    fontFamily: FONTS.mono, letterSpacing: FONTS.tracking.wide,
    marginTop: SPACE[3], display: 'block',
  };

  return (
    <div style={{ padding: `${SPACE[3]} ${SPACE[4]}` }}>
      <div style={{ ...PATTERNS.sectionLabel, marginBottom: SPACE[3] }}>ENDPOINTS</div>

      <label style={labelStyle}>BUFFER API
        <input style={fieldStyle} value={draft.apiUrl}
          onChange={e => setDraft(d => ({ ...d, apiUrl: e.target.value }))} />
      </label>

      <label style={labelStyle}>WEBSOCKET
        <input style={fieldStyle} value={draft.wsUrl}
          onChange={e => setDraft(d => ({ ...d, wsUrl: e.target.value }))} />
      </label>

      <label style={labelStyle}>OLLAMA (LOCAL AI)
        <input style={fieldStyle} value={draft.ollamaUrl}
          onChange={e => setDraft(d => ({ ...d, ollamaUrl: e.target.value }))} />
      </label>

      <label style={labelStyle}>WEB3 RPC
        <input style={fieldStyle} value={draft.web3Rpc}
          onChange={e => setDraft(d => ({ ...d, web3Rpc: e.target.value }))} />
      </label>

      <label style={labelStyle}>LOVE LEDGER ADDRESS
        <input style={fieldStyle} value={draft.loveLedgerAddress}
          onChange={e => setDraft(d => ({ ...d, loveLedgerAddress: e.target.value }))} />
      </label>

      <div style={{ display: 'flex', gap: SPACE[2], marginTop: SPACE[4] }}>
        <button type="button" onClick={onCancel} style={{
          ...PATTERNS.filterButton, flex: 1,
        }}>CANCEL</button>
        <button type="button" onClick={() => onSave(draft)} style={{
          ...PATTERNS.filterButton, ...PATTERNS.filterButtonActive, flex: 1,
        }}>SAVE + RE-PROBE</button>
      </div>
    </div>
  );
}

export function ConnectionPanel({ visible, onClose }: ConnectionPanelProps) {
  const conn = useConnections();
  const [showConfig, setShowConfig] = useState(false);

  const handleSaveConfig = useCallback((patch: Partial<ConnectionConfig>) => {
    conn.updateConfig(patch);
    setShowConfig(false);
    conn.probeAll();
  }, [conn]);

  if (!visible) return null;

  const tierColor = (COLORS.tier as Record<string, string>)[conn.tier] ?? COLORS.text.dim;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: LAYOUT.panelWidth, maxWidth: '100vw',
      background: COLORS.bg.base,
      borderLeft: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
      zIndex: Z.overlay,
      display: 'flex', flexDirection: 'column',
      fontFamily: FONTS.mono,
      boxShadow: SHADOW.panel,
    }}>
      <div style={{
        padding: `${SPACE[4]} ${SPACE[4]}`,
        borderBottom: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
            letterSpacing: FONTS.tracking.widest, color: tierColor,
          }}>
            {conn.tierLabel}
          </div>
          <div style={{
            fontSize: FONTS.size.xs, color: COLORS.text.dim, marginTop: SPACE[1],
          }}>
            {conn.connectedCount}/6 circuits · Press C to close
          </div>
        </div>
        <div style={{ display: 'flex', gap: SPACE[2] }}>
          <button type="button" onClick={() => setShowConfig(!showConfig)} style={{
            background: 'none', border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
            color: COLORS.text.secondary, cursor: 'pointer', fontFamily: FONTS.mono,
            fontSize: FONTS.size.xs, padding: `${SPACE[1]} ${SPACE[2]}`,
            borderRadius: BORDER.radius.sm,
          }}>⚙</button>
          <button type="button" onClick={() => conn.probeAll()} style={{
            background: 'none', border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
            color: COLORS.text.secondary, cursor: 'pointer', fontFamily: FONTS.mono,
            fontSize: FONTS.size.xs, padding: `${SPACE[1]} ${SPACE[2]}`,
            borderRadius: BORDER.radius.sm,
          }}>⟳ ALL</button>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
            color: COLORS.text.secondary, cursor: 'pointer', fontFamily: FONTS.mono,
            fontSize: FONTS.size.xs, padding: `${SPACE[1]} ${SPACE[2]}`,
            borderRadius: BORDER.radius.sm,
          }}>✕</button>
        </div>
      </div>

      {showConfig && (
        <ConfigEditor
          config={conn.getConfig()}
          onSave={handleSaveConfig}
          onCancel={() => setShowConfig(false)}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Array.from(conn.services.entries()).map(([id, svc]) => (
          <ServiceRow
            key={id}
            id={id}
            label={svc.label}
            status={svc.status}
            url={svc.url}
            error={svc.error}
            latency={svc.latency}
            offlineCapable={svc.offlineCapable}
            onProbe={() => conn.probeService(id)}
            onConnect={
              id === 'ws' ? () => conn.connectWebSocket() :
              id === 'serial' ? () => conn.connectSerial() :
              id === 'web3' ? () => conn.connectWeb3() :
              undefined
            }
          />
        ))}
      </div>

      <div style={{
        padding: `${SPACE[3]} ${SPACE[4]}`,
        borderTop: `${BORDER.width.thin} solid ${COLORS.bg.border}`,
        fontSize: FONTS.size.xs, color: COLORS.text.dim,
        lineHeight: FONTS.leading.relaxed,
      }}>
        {conn.tier === 'FULL' && 'All systems operational. Graph data live, AI local, cache warm, hardware linked.'}
        {conn.tier === 'ONLINE' && 'API connected. Graph data live. Add Ollama for local AI failover.'}
        {conn.tier === 'LOCAL' && 'Running on local resources. Graph data from cache. AI via Ollama.'}
        {conn.tier === 'OFFLINE' && 'No external connections. The geometry still holds. You are safe.'}
      </div>
    </div>
  );
}
