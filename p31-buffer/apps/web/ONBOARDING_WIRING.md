# Onboarding pipeline — App and SpaceshipEarth wiring

The following files are in place:

- `src/lib/intake-schema.ts`
- `src/lib/intake-to-graph.ts`
- `src/lib/onboarding-store.ts`
- `src/hooks/useOnboarding.ts`
- `src/components/WalletConnect.tsx`
- `src/components/IntakeForm.tsx`
- `src/components/PhaseCollapse.tsx`
- `src/components/OnboardingFlow.tsx`

Apply the edits below to complete the flow.

---

## 1. App.tsx — onboarding vs ship routing

**Imports:**

```ts
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SpaceshipEarth } from './components/SpaceshipEarth';
```

**Top-level routing (replace or wrap existing root render):**

```tsx
function App() {
  const onboarding = useOnboarding();

  if (onboarding.phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', background: '#050810', color: '#94a3b8' }}>
        Loading…
      </div>
    );
  }

  if (onboarding.phase !== 'complete') {
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

  return (
    <SpaceshipEarth
      initialCalibration={onboarding.calibration}
      initialGraph={onboarding.liveGraph}
    />
  );
}
```

If you already have a gateway/landing that should run *after* onboarding, show the gateway when `phase === 'complete'` and the user hasn’t chosen “enter ship” yet; or show SpaceshipEarth when phase is complete and pass calibration/graph as above.

---

## 2. SpaceshipEarth.tsx — calibration on mount

**Props (add to existing props):**

```ts
initialCalibration?: {
  initialSpoons?: number;
  suggestedOS?: string;
  initialEntropy?: number;
  sensoryPrefs?: string[];
  displayName?: string;
  pronouns?: string | null;
};
initialGraph?: P31Graph;
```

**On mount:**

- If `initialCalibration?.initialSpoons` is set, initialize spoon state with that value (e.g. pass it into `useSpoons(initialSpoons)` or call `setSpoons(initialSpoons)` once).
- If `initialCalibration?.suggestedOS` is set, call `switchOS(suggestedOS)` from `useGenSync()` in a `useEffect` (cast or guard so it’s a valid `HumanOS`).
- If `initialCalibration?.initialEntropy` is set and your Samson hook accepts an initial value, pass it in.
- If `initialCalibration?.sensoryPrefs` includes `'Minimal animations'`, disable jitterbug or other auto-animations; if it includes `'Large text'`, set a larger base font (e.g. `document.documentElement.style.fontSize`).
- If `initialGraph` is provided, use it as the initial graph instead of (or merged with) the API graph until the first fetch completes.

---

## 3. graph-schema types

If `@p31-buffer/graph-schema` does not export `Axis` as `'A' | 'B' | 'C' | 'D'`, or `GraphNode` / `P31Graph` use different shapes, adjust:

- `intake-schema.ts`: use a local type for axis in sections, e.g. `axis: 'A' | 'B' | 'C' | 'D'`, and cast when calling `intakeToGraph` / `fieldToNode`.
- `intake-to-graph.ts`: cast return values to `GraphNode` / `P31Graph` as needed to match the package’s types.

---

## Verification

1. Run through flow: Wallet (skip or connect) → Intake (fill a few fields) → Review → Save.
2. After “complete”, SpaceshipEarth should mount with calibration (e.g. spoons from `energy_baseline`, GenSync from `comm_preference`).
3. `hasCompletedOnboarding()` is true; next load goes straight to ship (or your gateway) with calibration applied.
