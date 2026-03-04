# Ship Drop-In Files

Copy these into `apps/web/src/`. They replace whatever Composer has mangled.

## Files

```
lib/JitterbugFrame.ts    — Cuboctahedron ↔ octahedron wireframe (Fuller's jitterbug)
lib/GeodesicShell.ts     — Translucent wireframe sphere enclosing the jitterbug
lib/IVMRenderer.ts       — Complete Three.js scene: orbit controls, nodes, edges, all methods

hooks/useSpoons.ts       — Energy tracking: spend / restore / reset
hooks/useBreathing.ts    — 4-2-6 breathing cycle with auto-complete
hooks/useSamson.ts       — PID controller: H attractor, tension output

components/LoadingShip.tsx      — Suspense fallback during chunk load
components/TelemetryBar.tsx     — Bottom HUD: spoons, BREATHE, GenSync, nodes, connection
components/BreathingOverlay.tsx — Full-screen breathing pacer
components/DeepLock.tsx         — <25% spoons protection overlay
components/DevMenu.tsx          — Backtick-toggled debug panel (PID, FPS, jitterbug t)
components/SpaceshipEarth.tsx   — Orchestrator: wires renderer + hooks + overlays
```

## How to Drop In

```bash
# From repo root:
cp ship/lib/*.ts         apps/web/src/lib/
cp ship/hooks/*.ts       apps/web/src/hooks/
cp ship/components/*.tsx  apps/web/src/components/
```

Then run `npm run typecheck` (or `npx tsc --noEmit`).

## The 0-Node Data Pipeline Bug

These files are NOT the cause of the 0-node bug. The bug is in the DATA PIPELINE
that feeds graph data into SpaceshipEarth. Specifically:

The `graph` prop that SpaceshipEarth receives has `{ nodes: [], edges: [] }`.

To diagnose, add this in `App.tsx` right before the SpaceshipEarth JSX:

```tsx
console.log('[APP] graph to ship:', graph?.nodes?.length, 'nodes');
```

Then trace backward:
1. If 0 → the graph computed from intakeData is empty
2. Check `intakeToGraph(intakeData)` — log what `intakeData` actually is
3. If intakeData is `{}` → `getCompletedOnboarding()` isn't returning data on reload
4. If intakeData has keys but graph is empty → field names don't match

The fix will be 1-3 lines in `useOnboarding.ts` once you see which scenario.

## Keyboard Shortcuts

- **Backtick (`)** — Toggle DevMenu
- **C** — Toggle ConnectionPanel (wired in App.tsx, not in these files)
- **Click + Drag** — Orbit camera
- **Scroll** — Zoom camera

## OrbitControls Import

If the build fails on the OrbitControls import, try these alternatives:

```ts
// Option 1 (most common with Vite + three from npm):
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Option 2 (some setups):
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Option 3 (if three/examples isn't in node_modules):
// npm install three @types/three
// Then Option 1
```

## What These Files Do NOT Touch

- `App.tsx` — lazy import, Suspense, C key handler, onboarding flow
- `useOnboarding.ts` — data pipeline, persistence
- `intake-to-graph.ts` — graph generation from intake data
- `persistence.ts` / `onboarding-store.ts` — Dexie storage
- `connection-manager.ts` — WebSocket / WebRTC
- `ConnectionPanel.tsx` / `ConnectionBadge.tsx`
- `vite.config.ts`

Those files are WHERE THE BUG IS but I can't fix them without seeing their
current contents. The ship rendering layer (these files) is correct.
