# GATE 2B REPORT — Dead Code Removal (apps/web/)

**Date:** 2025-02-23  

**Path note:** In this repo the app lives at **p31-buffer/apps/web**. There is no `apps/web` at the N0 repo root. All steps were run from `p31-buffer/apps/web`.

---

## FILE INVENTORY

**15** `.ts` / `.tsx` files in `src/` (sorted):

```
components\ConnectionBadge.tsx
components\ConnectionPanel.tsx
components\IntakeForm.tsx
components\OnboardingFlow.tsx
components\PhaseCollapse.tsx
components\WalletConnect.tsx
hooks\useConnections.ts
hooks\useOnboarding.ts
lib\connection-manager.ts
lib\design-tokens.ts
lib\intake-schema.ts
lib\intake-to-graph.ts
lib\onboarding-store.ts
types\graph-schema.d.ts
vite-env.d.ts
```

---

## TYPE CHECK

**PASS** — `npx tsc -b --noEmit` (from `p31-buffer/apps/web`) exits 0. No type errors.

---

## REMOVED FILES

None. No dead files identified.

---

## REMOVED EXPORTS

None. Every export is either:

- Imported and used within `apps/web/src`, or  
- A documented scaffold entry point for the host (Spaceship Earth / IVM / onboarding) and kept by design.

---

## KNOWN DEAD CODE (STEP 3)

| Check | Result |
|-------|--------|
| **CognitiveLoadDial** | **0 matches** — not present in apps/web. No action. |
| **HEARTBEAT_COLORS** | **0 matches** — not present. No action. |
| **PANEL_BG / DIM / ACCENT** (old color constants) | **0 matches** — colors come from `design-tokens.ts`. No action. |
| **Component const blocks (COLORS/BG/ACCENT)** | See “Hardcoded color constants” below. |

---

## SCAFFOLDED (kept, not wired inside apps/web)

These are entry points for the host app (Spaceship Earth, IVM, wallet, onboarding). They have **zero imports within apps/web** but are documented in `ONBOARDING_WIRING.md` and `WIRING_CONNECTION_INFRASTRUCTURE.md`. **Do not remove.**

| File | Exports | Pipeline |
|------|---------|----------|
| **ConnectionPanel.tsx** | `ConnectionPanel` | Connection infrastructure — wired via C key in SpaceshipEarth (see WIRING_CONNECTION_INFRASTRUCTURE.md). |
| **ConnectionBadge.tsx** | `ConnectionBadge` | Connection infrastructure — wired into telemetry bar. |
| **OnboardingFlow.tsx** | `OnboardingFlow`, `OnboardingFlowProps` | Onboarding — wired via App.tsx in host (see ONBOARDING_WIRING.md). |
| **useOnboarding.ts** | `useOnboarding`, `OnboardingPhase` | Onboarding — wired in host App. |
| **onboarding-store.ts** | `getCompletedOnboarding`, `OnboardingRecord` | Onboarding store API — for host to query completion; not yet used inside apps/web. |

**Wired internally:** WalletConnect, IntakeForm, PhaseCollapse (used by OnboardingFlow); useConnections (used by ConnectionPanel, ConnectionBadge); connection-manager, design-tokens, intake-schema, intake-to-graph, and the rest of onboarding-store (used by useOnboarding / OnboardingFlow).

**Not present:** No `FawnGuardInput.tsx`, no `SpaceshipEarth.tsx`, no `App.tsx` in apps/web — those live in the host app.

---

## HARDCODED COLOR CONSTANTS (flagged for Gate 3)

These are **not** raw hex in the sense of “old constants that should be in design-tokens”; they map tier/axis labels to **design-token** values (`COLORS.state.*`, `COLORS.axis.*`). Optional Gate 3 cleanup: move to `design-tokens` as named maps.

| File | Const | Note |
|------|--------|-----|
| **ConnectionPanel.tsx** | `TIER_COLORS` | Maps FULL/ONLINE/LOCAL/OFFLINE → `COLORS.state.*`. Could be centralized in design-tokens. |
| **ConnectionBadge.tsx** | `TIER_COLORS` | Same mapping. |
| **IntakeForm.tsx** | `AXIS_COLORS` | Maps A/B/C/D → `COLORS.axis.*`. Could be centralized. |

---

## CROSS-APP IMPORTS

**0 (CLEAN)**

- `apps/web` does **not** import from `pwa/`.  
- `pwa/` does **not** import from `apps/web`.

---

## tsc --noEmit

**PASS** — Exit code 0 after audit (no removals made).

---

## DO NOT REMOVE (confirmed)

- **packages/** (graph-schema, quadray, whale-channel) — not in apps/web; consumed via deps.  
- **Test/config/.env** — not in scope.  
- **Scaffolded pipeline files** — ConnectionPanel, ConnectionBadge, OnboardingFlow, useOnboarding, getCompletedOnboarding/OnboardingRecord — kept as above.  
- **design-tokens, connection-manager, intake-*, onboarding-store** — all in use.  
- **Three.js / IVM renderer** — no renderer files under apps/web/src (this app is components + hooks + lib only).
