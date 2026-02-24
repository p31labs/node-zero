import React from 'react';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingFlow } from './components/OnboardingFlow';
import { COLORS, FONTS } from './lib/design-tokens';

export function App() {
  const onboarding = useOnboarding();

  if (onboarding.phase === 'loading') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: COLORS.bg.deep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONTS.mono, color: COLORS.text.dim, fontSize: FONTS.size.xs,
        letterSpacing: FONTS.tracking.wide,
      }}>
        INITIALIZING...
      </div>
    );
  }

  if (onboarding.phase === 'complete') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: COLORS.bg.deep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
        fontFamily: FONTS.mono, color: COLORS.text.primary,
      }}>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.state.green, letterSpacing: FONTS.tracking.widest }}>
          ONBOARDING COMPLETE
        </div>
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.text.secondary }}>
          {onboarding.liveGraph.nodes.length} nodes mapped
        </div>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.text.dim, marginTop: '24px' }}>
          Spaceship Earth will render here once wired
        </div>
      </div>
    );
  }

  return (
    <OnboardingFlow
      phase={onboarding.phase}
      intakeData={onboarding.intakeData}
      updateField={onboarding.updateField}
      liveGraph={onboarding.liveGraph}
      walletAddress={onboarding.walletAddress}
      connectWallet={onboarding.connectWallet}
      skipWallet={onboarding.skipWallet}
      startIntake={onboarding.startIntake}
      finishIntake={onboarding.finishIntake}
      signAndFinalize={onboarding.signAndFinalize}
      skipSignAndFinalize={onboarding.skipSignAndFinalize}
      backgroundShip={onboarding.phase === 'intake' || onboarding.phase === 'review'}
    />
  );
}
