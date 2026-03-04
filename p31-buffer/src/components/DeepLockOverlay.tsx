import { useState } from 'react';
import { COLORS, FONTS, SPACE, BORDER } from '../lib/design-tokens';
import NodeOne from '../lib/serial';

interface DeepLockOverlayProps {
  onOverride: () => void;
}

export function DeepLockOverlay({ onOverride }: DeepLockOverlayProps) {
  const [totemPending, setTotemPending] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{
        color: COLORS.state.red,
        fontFamily: FONTS.mono,
        fontSize: FONTS.size.lg,
        marginBottom: SPACE[8],
      }}>
        DEEP LOCK ENGAGED
      </div>

      {NodeOne.isConnected && (
        <button
          onClick={async () => {
            setTotemPending(true);
            const granted = await NodeOne.requestTotemAuth("OVERRIDE LOCK?");
            setTotemPending(false);
            if (granted) onOverride();
          }}
          disabled={totemPending}
          style={{
            position: 'absolute',
            bottom: SPACE[8],
            padding: `${SPACE[3]} ${SPACE[6]}`,
            background: 'none',
            border: `${BORDER.width.thin} solid ${COLORS.state.red}`,
            color: COLORS.state.red,
            fontSize: FONTS.size.sm,
            letterSpacing: FONTS.tracking.wider,
            cursor: totemPending ? 'wait' : 'pointer',
            fontFamily: FONTS.mono,
            borderRadius: BORDER.radius.md,
          }}
        >
          {totemPending ? '◉ WAITING FOR THICK CLICK...' : '◉ TOTEM OVERRIDE'}
        </button>
      )}

      {/* KEEP the existing near-invisible software override EXACTLY as it is */}
      <button onClick={onOverride} style={{
        position: 'absolute', bottom: SPACE[4], right: SPACE[4],
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.06)',
        fontSize: FONTS.size.xs,
        cursor: 'pointer', fontFamily: FONTS.mono,
        letterSpacing: FONTS.tracking.wide,
      }}>
        OVERRIDE — RESUME
      </button>
    </div>
  );
}
