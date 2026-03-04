# Codebase Status — Detailed Update

**Generated:** 2025-02-24  
**Scope:** N0 workspace (Documents/N0 + node-zero mount)

---

## 1. Workspace Layout

| Root | Purpose |
|------|--------|
| **N0** (`Documents/N0`) | Main repo: p31-buffer (Spaceship Earth app), pwa (legacy PWA), worker, site, reports |
| **p31-buffer** | Monorepo: `apps/web` (Spaceship Earth), `packages/*` (graph-schema, quadray, contracts, whale-channel), `ship/` (extracted tarball reference) |
| **pwa** | Standalone PWA: React Router, P31/Shelter/Bonding/Mesh views, Session + CognitiveLoad context, no design-tokens |
| **worker** | Cloudflare Worker (p31-bonding-relay), Wrangler |

---

## 2. apps/web (Spaceship Earth) — Primary App

### 2.1 Stack

- **Runtime:** React 18, Vite 7, TypeScript 5.6
- **3D:** Three.js r128, OrbitControls, custom IVM geometry
- **Data:** Dexie (IndexedDB), @p31-buffer/graph-schema (local stub types in `src/types/graph-schema.d.ts`), ethers 6
- **Styling:** design-tokens.ts (COLORS, FONTS, SPACE, BORDER, SHADOW, LAYOUT, Z); Gate 3 passed

### 2.2 Entry & Shell

- **main.tsx** — Renders `<App />` in StrictMode.
- **App.tsx** — Phase-driven: `loading` → init screen; `wallet` / `intake` / `review` → OnboardingFlow; `complete` → lazy SpaceshipEarth + optional ConnectionPanel. **USE_DEMO_GRAPH = true** hard toggle: when true, ship always gets DEMO_GRAPH + DEMO_CALIBRATION (bypasses pipeline). C key toggles ConnectionPanel; review phase preloads SpaceshipEarth chunk.

### 2.3 Onboarding Pipeline

| Piece | Role |
|-------|------|
| **useOnboarding** | Phase state, intakeData, liveGraph (intakeToGraph), calibration (extractCalibration), wallet/sign/finalize. On load: if hasCompletedOnboarding() → getCompletedOnboarding() → hydrate intakeData then set phase 'complete'; else loadProgress() → wallet. |
| **OnboardingFlow** | WalletConnect → IntakeForm → PhaseCollapse (review/sign). Passes liveGraph, intakeData, updateField, etc. |
| **intake-to-graph** | intakeToGraph(data) → P31Graph (nodes with bary, axis, voltage); extractCalibration(data) → Calibration. INTAKE_SCHEMA drives sections/fields. |
| **onboarding-store** | Dexie DB: saveProgress (draft), loadProgress, finalizeOnboarding (completed record), hasCompletedOnboarding, getCompletedOnboarding. |
| **connection-manager** | Services (api, ws, ollama, web3, etc.), probeAll, connectWebSocket/connectWeb3/connectSerial, heartbeat. |
| **ConnectionPanel / ConnectionBadge** | Panel: service list, config editor, tier label; Badge: tier icon + count. Both use design-tokens (COLORS.tier, etc.). |

### 2.4 Ship (Three.js + UI)

| Layer | Files | Status |
|-------|--------|--------|
| **Geometry** | JitterbugFrame.ts, GeodesicShell.ts | Cuboctahedron↔octahedron wireframe (SCALE 0.7), geodesic shell (radius 1.2, wireframe). Idle breath oscillation; setBreathTarget / setIdleBreathing. |
| **Renderer** | IVMRenderer.ts | Scene, fog, camera, OrbitControls (damping, no pan, min/max distance), 4× InstancedMesh (axis colors), LineSegments edges, voltage-based glow + heat. setGraph, setBreathingState, setSensoryProfile, setTension, setDeepLock. **Limits:** MAX_PER_AXIS 500, MAX_EDGES 2000. **Radius clamp:** 0.02–0.06 (default 0.03). **Edge opacity:** 0.35. |
| **Adapter** | SpaceshipEarth.tsx `p31GraphToGraph` | P31Graph → IVM Graph: bary[0..2] → x,y,z; radius from metadata.radius (demo) or 0.025 + (urgency/10)*0.02, clamped 0.02–0.06. |
| **Hooks** | useSpoons, useBreathing, useSamson | Spoons: spend/restore/reset. Breathing: 4-2-6 cycle, optional onComplete. Samson: PID, tension, H, error, pTerm, drift, burnout. |
| **UI** | LoadingShip, TelemetryBar, BreathingOverlay, DeepLock, DevMenu | LoadingShip = Suspense fallback. TelemetryBar = spoons, BREATHE, GenSync, node count, connection badge. Backtick = DevMenu; &lt;25% spoons = DeepLock. |

### 2.5 Demo Graph (Pipeline Bypass)

- **File:** `src/lib/demo-graph.ts`
- **Exports:** DEMO_GRAPH (P31Graph: 18 nodes, 4 axes, bary4, voltage, metadata.radius), DEMO_CALIBRATION (Calibration).
- **Radii:** 0.02–0.06; metadata.radius passed so adapter uses them (no bowling balls).
- **Wiring:** App uses DEMO_GRAPH + DEMO_CALIBRATION when USE_DEMO_GRAPH is true.

### 2.6 Known Issues & Toggles

| Issue | Status |
|-------|--------|
| **0-node pipeline** | When USE_DEMO_GRAPH = false and user reaches complete (e.g. after refresh), liveGraph can be empty if getCompletedOnboarding() doesn’t return intakeData or shape differs. Hydration path exists (getCompletedOnboarding → setIntakeData); if still 0 nodes, use [ONBOARD]/[GRAPH]/[IVM] logs to find break (Scenario A/B/C). |
| **Diagnostic logs** | Still present: useOnboarding ([ONBOARD] phase, intakeData keys/sample, saved from Dexie), intakeToGraph ([GRAPH] input keys/sample), IVMRenderer ([IVM] setGraph). Remove for production or wrap in NODE_ENV. |
| **USE_DEMO_GRAPH** | true = ship always shows 18-node demo. Set false to use real onboarding data. |

### 2.7 Build & Quality

- **Scripts:** dev (Vite port 3031), typecheck (tsc -b --noEmit), lint, format.
- **No `build` script** in apps/web package.json (add `vite build` if needed).
- **Vite:** manualChunks for three + spaceship; React plugin.
- **Gate 3:** Token compliance done; design-tokens single source for colors/spacing/typography in components.
- **Tests:** Vitest + tests for onboarding-store, connection-manager, intake-schema, intake-to-graph, useOnboarding.

---

## 3. pwa (Legacy PWA)

- **Role:** Installable PWA with React Router; P31, Shelter, MeshView, BondingView, SoupStub, MakerStub.
- **Context:** SessionProvider, CognitiveLoadProvider.
- **No design-tokens.ts** — Gate 3 out of scope; CSS/Tailwind-style approach.
- **Deps:** @p31/game-engine, @p31/love-ledger, @p31/node-zero, react-router-dom.

---

## 4. worker

- **Name:** p31-bonding-relay.
- **Tooling:** Wrangler (dev/deploy).
- **Role:** Relay/bonding service (Cloudflare Worker).

---

## 5. p31-buffer Packages

| Package | Role |
|---------|------|
| **graph-schema** | Types/schema for graph (apps/web uses local stub in src/types when package not built). Built dist: index, schema, types, taxonomy. |
| **quadray** | IVM/quadray math, phyllotaxis, jitterbug, geodesic, barycentric. Built dist present. |
| **contracts** | Solidity + typechain (LoveLedger). Artifacts and typechain-types present. |
| **whale-channel** | Referenced in apps/web; present in workspaces. |

---

## 6. Other Artifacts

- **ship/** — Extracted ship-drop-in tarball (reference copy of lib/hooks/components); apps/web src already updated from it.
- **GATE_3_REPORT.md, GATE_2B_REPORT.md, GATE_5_REPORT.md** — Audit reports (tokens, wiring, etc.).
- **SHIP_DROP_IN_README.md, ONBOARDING_WIRING.md, WIRING_CONNECTION_INFRASTRUCTURE.md** — Wiring and drop-in notes.
- **SESSION_REPORT.md** — Session summary (if present).

---

## 7. Verification Commands

```bash
# apps/web typecheck
cd p31-buffer/apps/web && npx tsc -b --noEmit

# Run dev server (from apps/web)
npm run dev   # port 3031

# Lint/format
npm run lint
npm run format
```

---

## 8. One-Line Summary

**apps/web:** Onboarding → complete phase → lazy Spaceship Earth with demo graph (USE_DEMO_GRAPH=true), OrbitControls, jitterbug + shell + 18 nodes (radii 0.02–0.06), telemetry/BREATHE/DeepLock/DevMenu; pipeline data path fixed for reload hydration but still has diagnostic logs; typecheck passes. **pwa:** Router + views, no token system. **worker:** Wrangler bonding relay. **packages:** graph-schema, quadray, contracts built/present.
