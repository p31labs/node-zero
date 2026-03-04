import React, { Suspense, lazy } from 'react';
import { useOnboarding } from './hooks/useOnboarding';
import type { SensoryProfile } from './hooks/useOnboarding';

const SpaceshipEarth = lazy(() =>
  import('./components/SpaceshipEarth').then((m) => ({ default: m.SpaceshipEarth })),
);

function OnboardingGate0({ onAdvance }: { onAdvance: () => void }) {
  return (
    <div style={gateStyle}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: '#33FF33', fontWeight: 700 }}>
        P31 LABS
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 16,
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Spaceship Earth is a sovereign cognitive dashboard. Your data stays on your device. Nothing
        leaves without your permission.
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          marginTop: 16,
          maxWidth: 280,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        This tool helps you monitor and protect your cognitive energy. It is designed for
        neurodivergent operators.
      </div>
      <button type="button" onClick={onAdvance} style={btnStyle} aria-label="Begin onboarding">
        ENTER
      </button>
    </div>
  );
}

function OnboardingGate1({
  sensory,
  setSensory,
  onAdvance,
}: {
  sensory: SensoryProfile;
  setSensory: (s: SensoryProfile) => void;
  onAdvance: () => void;
}) {
  return (
    <div style={gateStyle}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#00D4FF', fontWeight: 600 }}>
        SENSORY CALIBRATION
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 12,
          maxWidth: 300,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        How much visual motion is comfortable for you?
      </div>
      <div style={{ marginTop: 20, width: 260 }}>
        <label style={labelStyle}>
          Motion
          <input
            type="range"
            min={0}
            max={100}
            value={sensory.motionScale * 100}
            onChange={(e) => setSensory({ ...sensory, motionScale: +e.target.value / 100 })}
            style={sliderStyle}
            aria-label="Motion sensitivity"
          />
          <div style={scaleLabels}>
            <span>Still</span>
            <span>Full</span>
          </div>
        </label>
        <label style={{ ...labelStyle, marginTop: 16 }}>
          Glow
          <input
            type="range"
            min={0}
            max={100}
            value={sensory.glowIntensity * 100}
            onChange={(e) => setSensory({ ...sensory, glowIntensity: +e.target.value / 100 })}
            style={sliderStyle}
            aria-label="Glow intensity"
          />
          <div style={scaleLabels}>
            <span>Dim</span>
            <span>Bright</span>
          </div>
        </label>
      </div>
      <button type="button" onClick={onAdvance} style={btnStyle} aria-label="Continue">
        CONTINUE
      </button>
    </div>
  );
}

function OnboardingGate2({
  spoons,
  setSpoons,
  onAdvance,
}: {
  spoons: number;
  setSpoons: (n: number) => void;
  onAdvance: () => void;
}) {
  return (
    <div style={gateStyle}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#FFB000', fontWeight: 600 }}>
        ENERGY CHECK
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 12,
          maxWidth: 300,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        How much energy do you have right now? Tap a number.
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => setSpoons(n)}
            aria-label={`${n} spoons`}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: n === spoons ? '2px solid #33FF33' : '1px solid rgba(255,255,255,0.1)',
              background: n === spoons ? 'rgba(51,255,51,0.15)' : 'rgba(255,255,255,0.03)',
              color: n === spoons ? '#33FF33' : 'rgba(255,255,255,0.4)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={onAdvance} style={btnStyle} aria-label="Continue">
        CONTINUE
      </button>
    </div>
  );
}

function OnboardingGate3({
  name,
  setName,
  onAdvance,
}: {
  name: string;
  setName: (n: string) => void;
  onAdvance: () => void;
}) {
  return (
    <div style={gateStyle}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: '#a78bfa', fontWeight: 600 }}>
        IDENTITY
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          marginTop: 12,
          maxWidth: 300,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        What should the system call you? (Optional)
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Operator"
        aria-label="Display name"
        style={{
          marginTop: 20,
          padding: '10px 16px',
          width: 240,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          color: '#F0F0F0',
          fontSize: 13,
          fontFamily: "'Courier New', monospace",
          outline: 'none',
          textAlign: 'center',
        }}
      />
      <button type="button" onClick={onAdvance} style={btnStyle} aria-label="Launch Spaceship Earth">
        LAUNCH
      </button>
    </div>
  );
}

function LoadingShip() {
  return (
    <div
      style={{
        ...gateStyle,
        background: '#050505',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '2px solid rgba(51,255,51,0.2)',
          borderTop: '2px solid #33FF33',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div
        style={{
          marginTop: 16,
          fontSize: 9,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        LOADING GEOMETRY
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const gateStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#050505',
  fontFamily: "'Courier New', Courier, monospace",
  padding: 24,
};

const btnStyle: React.CSSProperties = {
  marginTop: 32,
  padding: '10px 32px',
  borderRadius: 4,
  fontSize: 10,
  letterSpacing: 2,
  fontWeight: 700,
  background: 'rgba(51,255,51,0.08)',
  border: '1px solid rgba(51,255,51,0.25)',
  color: '#33FF33',
  cursor: 'pointer',
  fontFamily: "'Courier New', Courier, monospace",
  minWidth: 44,
  minHeight: 44,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 9,
  color: 'rgba(255,255,255,0.3)',
  letterSpacing: 1,
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#33FF33',
  height: 4,
};

const scaleLabels: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 8,
  color: 'rgba(255,255,255,0.2)',
};

export function App() {
  const onboarding = useOnboarding();

  if (!onboarding.isComplete) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh' }}>
        {onboarding.gate === 0 && <OnboardingGate0 onAdvance={onboarding.advance} />}
        {onboarding.gate === 1 && (
          <OnboardingGate1
            sensory={onboarding.sensory}
            setSensory={onboarding.setSensory}
            onAdvance={onboarding.advance}
          />
        )}
        {onboarding.gate === 2 && (
          <OnboardingGate2
            spoons={onboarding.initialSpoons}
            setSpoons={onboarding.setInitialSpoons}
            onAdvance={onboarding.advance}
          />
        )}
        {onboarding.gate === 3 && (
          <OnboardingGate3
            name={onboarding.name}
            setName={onboarding.setName}
            onAdvance={onboarding.advance}
          />
        )}
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingShip />}>
      <SpaceshipEarth
        sensoryProfile={onboarding.sensory}
        initialSpoons={onboarding.initialSpoons}
      />
    </Suspense>
  );
}
