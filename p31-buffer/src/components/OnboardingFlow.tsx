import type { P31Graph } from '../types/graph';
import { WalletConnect } from './WalletConnect';
import { IntakeForm } from './IntakeForm';
import { PhaseCollapse } from './PhaseCollapse';
import { COLORS, FONTS } from '../lib/design-tokens';

export interface OnboardingFlowProps {
  phase: string;
  intakeData: Record<string, unknown>;
  updateField: (fieldId: string, value: unknown) => void;
  liveGraph: P31Graph;
  walletAddress: string | null;
  connectWallet: () => void;
  skipWallet: () => void;
  startIntake: () => void;
  finishIntake: () => void;
  signAndFinalize: () => void;
  skipSignAndFinalize: () => void;
  backgroundShip?: boolean;
}

export function OnboardingFlow({
  phase,
  intakeData,
  updateField,
  liveGraph,
  walletAddress,
  connectWallet,
  skipWallet,
  startIntake,
  finishIntake,
  signAndFinalize,
  skipSignAndFinalize,
  backgroundShip = false,
}: OnboardingFlowProps) {
  if (phase === 'wallet') {
    return (
      <WalletConnect
        onConnect={connectWallet}
        onSkip={() => { skipWallet(); startIntake(); }}
      />
    );
  }

  if (phase === 'intake') {
    return (
      <>
        {backgroundShip && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              opacity: 0.15,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.mono,
              color: COLORS.text.dim,
              fontSize: FONTS.size.xs,
            }}
          >
            <span>IVM · {liveGraph?.nodes?.length ?? 0} nodes</span>
          </div>
        )}
        <IntakeForm
          data={intakeData}
          onUpdate={updateField}
          onFinish={finishIntake}
        />
      </>
    );
  }

  if (phase === 'review') {
    return (
      <PhaseCollapse
        intakeData={intakeData}
        walletAddress={walletAddress}
        onSignAndFinalize={signAndFinalize}
        onSkipSignAndFinalize={skipSignAndFinalize}
      />
    );
  }

  return null;
}
