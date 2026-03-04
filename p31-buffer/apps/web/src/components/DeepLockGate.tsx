interface DeepLockGateProps {
  spoons: number;
  onBreathe: () => void;
}

export function DeepLockGate({ spoons, onBreathe }: DeepLockGateProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(69,10,10,0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
        padding: 24,
      }}
      role="alertdialog"
      aria-label="Deep processing lock - energy protection"
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 3,
          color: '#f87171',
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        DEEP PROCESSING LOCK
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        Energy is critically low. The system is protecting you from making decisions that require
        resources you don&apos;t have right now.
      </div>

      <div
        style={{
          fontSize: 32,
          color: '#f87171',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {spoons}
      </div>
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: 2,
          marginBottom: 32,
        }}
      >
        SPOONS REMAINING
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        Three breathing cycles will recover 0.5 spoons. A meal recovers 2. A nap recovers 4. A dark
        room recovers 5.
      </div>

      <button
        type="button"
        onClick={onBreathe}
        aria-label="Start breathing to recover energy"
        style={{
          padding: '12px 32px',
          borderRadius: 6,
          fontSize: 11,
          letterSpacing: 2,
          fontWeight: 700,
          background: 'rgba(0,212,255,0.1)',
          border: '2px solid rgba(0,212,255,0.3)',
          color: '#00D4FF',
          cursor: 'pointer',
          fontFamily: 'inherit',
          minWidth: 44,
          minHeight: 44,
        }}
      >
        BREATHE
      </button>

      <div
        style={{
          position: 'absolute',
          bottom: 24,
          fontSize: 9,
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: 2,
        }}
      >
        YOU ARE SAFE
      </div>
    </div>
  );
}
