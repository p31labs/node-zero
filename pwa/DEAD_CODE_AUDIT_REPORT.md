# Dead code audit report — pwa/src

**Date:** 2025-02-23  
**Scope:** `pwa/src/` — every export checked for imports across the tree.  
**Excluded:** `@p31-buffer/*`, `packages/`, test files, `.env`.

---

## Known dead code (from chat brief)

| Item | Status |
|------|--------|
| `src/components/CognitiveLoadDial.tsx` | **Not present** — file does not exist in repo (already removed or never in this tree). No `CognitiveLoadDial` references found. |
| Imports of `CognitiveLoadDial` | None found. |
| `HEARTBEAT_COLORS` from `constants.ts` | **Not present** — no `constants.ts` in `pwa/src/`; no `HEARTBEAT_COLORS` or `design-tokens.ts` in src. No action. |

---

## Removed (this audit)

### 1. **Export removed: `deleteGame`** — `src/lib/bonding/game-store.ts`

- **Justification:** Grep of `pwa/src` for `deleteGame` showed only the definition; no file imports or calls it.
- **Change:** Deleted the entire `deleteGame` function (IDB delete path). All other game-store exports are used (BondingView, MoleculeCanvas, PingFeed, GameHeader, achievements, chemistry).

### 2. **Export removed: default `ShelterLive`** — `src/views/ShelterLive.tsx`

- **Justification:** Only `WalletCard` and `GenesisDomeCard` are imported (by `Shelter.tsx`). The default component `ShelterLive` is never imported; App uses `<Shelter />`, not `<ShelterLive />`.
- **Change:** Removed the default export and the `ShelterLive()` component. File now only exports `WalletCard` and `GenesisDomeCard`.

### 3. **Exports removed: `playAtomTone`, `playPing`, `playAchievement`** — `src/lib/bonding/sounds.ts`

- **Justification:** Only `audio` is imported (by BondingView). The three standalone functions were never imported; callers use `audio.playPing()`, `audio.playAchievement()`, `audio.playElement()`, etc.
- **Change:** Removed the three exported function wrappers. Kept `export const audio = new AudioEngine();`.

### 4. **Export removed: `KNOWN_MOLECULES`** — `src/lib/bonding/chemistry.ts`

- **Justification:** Only used inside `chemistry.ts` by `identifyMolecule()`. No other file imports `KNOWN_MOLECULES`.
- **Change:** Changed `export const KNOWN_MOLECULES` to `const KNOWN_MOLECULES` so it remains available to `identifyMolecule` but is no longer a public export.

---

## Checked and kept

- **`fetchGame`** (game-sync.ts): Used internally by `startPolling`; not imported elsewhere but required for polling. Kept.
- **`SyncState`** (game-sync.ts): Used as return type of `getSyncState()`; BondingView uses getSyncState(). Kept.
- **`Ping`** (game-store.ts): Type only, used by `GameState`; no direct import elsewhere. Kept as part of module API.
- **`StoredSession`** (p31-session.ts): Not imported elsewhere; SessionContext uses load/save/clear only. Kept for public API clarity.
- **All view/context/component exports** (P31, Shelter, MeshView, BondingView, SoupStub, MakerStub, QuantumHelloWorld, WalletCard, GenesisDomeCard, CognitiveLoadProvider, useCognitiveLoad, SessionProvider, useSession, etc.): All referenced from App.tsx, Shelter.tsx, or BondingView. Kept.
- **All bonding lib exports** other than those removed above: Used by BondingView, MoleculeCanvas, GameHeader, PingFeed, AchievementToast, PeriodicTable, achievements, chemistry, elements. Kept.

---

## Verification

- `npx tsc -b --noEmit` run from `pwa/`: **passes** (zero type errors).

---

## Summary

| Action | Count |
|--------|--------|
| Files deleted | 0 |
| Exports removed (function/const/component) | 5 (`deleteGame`, default `ShelterLive`, `playAtomTone`, `playPing`, `playAchievement`, `KNOWN_MOLECULES`) |
| Known dead from brief (CognitiveLoadDial, HEARTBEAT_COLORS) | Not present in tree |
