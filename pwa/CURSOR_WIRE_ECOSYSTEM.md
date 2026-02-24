# CURSOR: WIRE THE ECOSYSTEM — ONE PASS

## Context

P31 Labs. Two deployed surfaces:
- **p31ca.org** — Shelter PWA (Vite + React). QHW flow through covenant → molecule → dome naming → BUILD. Session in IndexedDB (`p31-pwa`). SessionContext shared across QHW and Shelter.
- **phosphorus31.org** — Corporate site + Living Mesh (`/mesh`). Mesh renders 9 nodes but all show 0 data (different origin → no IndexedDB).

**Bridge:** PWA encodes session into URL hash via `src/lib/session-export.ts`. Shelter links to mesh with `meshUrlWithSession(session)`. Mesh reads `loadSessionFromHash()` and populates nodes.

---

## TASK 1: Cross-Origin Session Bridge ✅ (in repo)

- `pwa/src/lib/session-export.ts` — `exportSession`, `encode`, `decode`, `meshUrlWithSession`, `loadSessionFromHash`.
- Shelter tab includes Living Mesh link; when session exists, href = `meshUrlWithSession(session)`.

**Mesh side (phosphorus31.org/mesh):** On load, call `loadSessionFromHash()`. If summary exists, map `session.love` → L.O.V.E. node, `session.fingerprint` → 31p, `session.vertices`/`edges`/`isRigid` → BONDING/structure, mark active nodes.

---

## TASK 2: Verify QHW → ALIVE → Shelter

1. Clear IndexedDB (DevTools → Application → IndexedDB → delete p31-pwa).
2. p31ca.org → complete QHW to ALIVE (BUILD with dome name).
3. Shelter tab: WalletCard shows 50 LOVE, GenesisDomeCard shows dome + rigidity.
4. Refresh: jumps to ALIVE, Shelter still shows data.

If BUILD doesn’t reach ALIVE: confirm `completeBirth` calls `birthSession()` from context and SessionProvider wraps App.

---

## TASK 3: Mesh data wiring (phosphorus31.org/mesh)

In mesh init:

```js
import { loadSessionFromHash } from './session-export'; // or reimplement decode from hash
const session = loadSessionFromHash();
if (session) {
  // L.O.V.E. node ← session.love
  // 31p node ← session.fingerprint
  // BONDING / structure ← session.vertices, session.edges, session.isRigid
  // Mark nodes active where value > 0
}
```

If no session: show “Open Shelter to begin” → p31ca.org.

---

## TASK 4: phosphorus31.org content (text-only)

- Node One: no SE050. Buffer: tags = Live in Shelter, TypeScript, PWA, Offline-first, IndexedDB. Centaur: name/description updated.
- Shelter link https://p31ca.org, description includes game engine, L.O.V.E. wallet. Spectrum & Geodesic Brain: “In Development.” Living Mesh: stay Live, link /mesh.
- HCB: “Coming Soon” badge, button disabled. GitHub → p31labs. Founder: DoD civilian engineer, no Navy/military metaphors.

---

## TASK 5: Shelter cards

WalletCard: `session.ledgerSnapshot.wallet` (totalEarned, sovereigntyPool, performancePool). GenesisDomeCard: `session.gameSnapshot.structures[0]` (name, rigidity.vertices, rigidity.edges, rigidity.coherence, rigidity.isRigid). If field names differ, align with actual snapshot shape.

---

## TASK 6: Living Mesh link in PWA ✅ (in repo)

Shelter tab has Living Mesh card; href = `meshUrlWithSession(session)` when session exists, else `https://phosphorus31.org/mesh`.

---

## Order

1. Verify QHW → ALIVE (Task 2).
2. session-export + mesh link (Tasks 1 & 6) — done in PWA.
3. Mesh reads hash (Task 3) — in phosphorus31.org repo.
4. Content fixes (Task 4) — phosphorus31.org index.
5. Shelter cards (Task 5) — already wired; verify only.

---

## Verification

1. Clear IndexedDB → p31ca.org → QHW → ALIVE.
2. Shelter: 50 LOVE, dome, rigidity.
3. Refresh → ALIVE restored.
4. Click Living Mesh → phosphorus31.org/mesh#session=… opens; mesh shows LOVE, fingerprint, structure.
5. phosphorus31.org main page content accurate; links correct.
