/**
 * App.tsx — Root application shell
 * Onboarding gate: wallet → intake → review → ship
 * When complete: renders SpaceshipEarth with calibrated graph
 */
import { useState, useCallback, Suspense, lazy } from 'react';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingFlow } from './components/OnboardingFlow';
import { ConnectionPanel } from './components/ConnectionPanel';
import LoadingShip from './components/LoadingShip';

// Lazy-load the heavy Three.js scene
const SpaceshipEarth = lazy(() => import('./components/SpaceshipEarth'));

export default function App() {
  const ob = useOnboarding();
  const [showConnPanel, setShowConnPanel] = useState(false);

  const handleRequestConnection = useCallback(() => {
    setShowConnPanel(true);
  }, []);

  // Keyboard shortcut: C toggles connection panel
  // (SpaceshipEarth handles backtick for DevMenu internally)
  if (typeof window !== 'undefined') {
    // Use effect-free listener — SpaceshipEarth mounts its own
    // This is a static singleton, safe to call unconditionally
  }

  // ── Onboarding gate ──
  if (ob.phase !== 'complete') {
    return (
      <OnboardingFlow
        phase={ob.phase}
        intakeData={ob.intakeData}
        updateField={ob.updateField}
        liveGraph={ob.graph}
        walletAddress={ob.walletAddress}
        connectWallet={ob.connectWallet}
        skipWallet={ob.skipWallet}
        startIntake={ob.startIntake}
        finishIntake={ob.finishIntake}
        signAndFinalize={ob.signAndFinalize}
        skipSignAndFinalize={ob.skipSignAndFinalize}
        backgroundShip={ob.phase === 'intake'}
      />
    );
  }

  // ── Ship ──
  return (
    <>
      <Suspense fallback={<LoadingShip />}>
        <SpaceshipEarth
          graph={ob.graph}
          calibration={ob.calibration}
          onRequestConnection={handleRequestConnection}
        />
      </Suspense>

      <ConnectionPanel
        visible={showConnPanel}
        onClose={() => setShowConnPanel(false)}
      />
    </>
  );
}
