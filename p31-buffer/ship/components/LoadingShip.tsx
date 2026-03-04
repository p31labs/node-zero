export default function LoadingShip() {
  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#050510',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48,
        border: '2px solid #00E87833', borderTopColor: '#00E878',
        borderRadius: '50%', animation: 'ivm-spin 1s linear infinite',
      }} />
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: '#00E87866', letterSpacing: 4, textTransform: 'uppercase',
      }}>
        Initializing IVM
      </span>
      <style>{`@keyframes ivm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
