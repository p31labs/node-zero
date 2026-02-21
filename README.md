# Phosphorus-31

**Open-source assistive technology for neurodivergent minds.**

Three packages. 439 tests. Zero runtime dependencies. One live app.

[![Live App](https://img.shields.io/badge/app-node--zero.pages.dev-31ffa3?style=flat-square)](https://node-zero.pages.dev)
[![npm node-zero](https://img.shields.io/npm/v/@p31/node-zero?label=%40p31%2Fnode-zero&style=flat-square)](https://www.npmjs.com/package/@p31/node-zero)
[![npm love-ledger](https://img.shields.io/npm/v/@p31/love-ledger?label=%40p31%2Flove-ledger&style=flat-square)](https://www.npmjs.com/package/@p31/love-ledger)
[![npm game-engine](https://img.shields.io/npm/v/@p31/game-engine?label=%40p31%2Fgame-engine&style=flat-square)](https://www.npmjs.com/package/@p31/game-engine)

---

## Run the app

The live PWA is at **[node-zero.pages.dev](https://node-zero.pages.dev)**. Install it on any device — it works offline.

To run locally:

```bash
cd pwa
npm install
npm run dev
```

Open `http://localhost:5173`. The P31 tab walks through the Quantum Hello World — identity generation, covenant, molecule formation, geodesic building — all wired to the real stack. The Shelter tab shows system status.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        P31 PWA                              │
│              node-zero.pages.dev                            │
│         Vite + React + Service Worker                       │
└────────────┬──────────────┬──────────────┬──────────────────┘
             │              │              │
   ┌─────────▼────┐  ┌─────▼──────┐  ┌───▼──────────┐
   │  node-zero   │  │love-ledger │  │ game-engine  │
   │  protocol    │  │  economy   │  │  building    │
   │  220 tests   │  │  115 tests │  │  104 tests   │
   │  93.4 kB     │  │  14.2 kB   │  │  21.2 kB     │
   └──────────────┘  └────────────┘  └──────────────┘
```

The three packages connect through adapters and events — no hard dependencies between them. Each works standalone. Together they form a complete assistive technology platform.

### @p31/node-zero — Protocol

Cryptographic identity (ECDSA P-256), encrypted persistence (AES-GCM), reactive state, peer bonds with trust scoring, and transport-agnostic message routing. The foundation.

→ [npm](https://www.npmjs.com/package/@p31/node-zero) · [source](src/)

### @p31/love-ledger — Economy

L.O.V.E. tokens (Ledger of Ontological Volume and Entropy). Soulbound, non-transferable. Earned through building and caring. 50/50 split into Sovereignty and Performance pools. Age-gated vesting protects children's tokens.

→ [GitHub](https://github.com/p31labs/love-ledger) · [npm](https://www.npmjs.com/package/@p31/love-ledger)

### @p31/game-engine — Building

Geodesic construction from Platonic solids. Every structure validated against Maxwell's rigidity criterion (E ≥ 3V − 6). Player progression through five tiers, seven seed challenges, daily quests, build streaks.

→ [GitHub](https://github.com/p31labs/game-engine) · [npm](https://www.npmjs.com/package/@p31/game-engine)

---

## The minimum stable system

A tetrahedron has four vertices and six edges. Every vertex sees every other vertex. It is the only polyhedron where this is true, and the smallest structure that satisfies Maxwell's rigidity criterion with zero degrees of freedom.

This is not a metaphor. It is the design principle.

---

## Project structure

```
├── src/            # @p31/node-zero source
├── __tests__/      # 220 tests
├── pwa/            # Vite PWA (auto-deploys to Cloudflare Pages)
│   ├── src/
│   │   └── views/
│   │       ├── P31.tsx                 # Intro + onboarding
│   │       ├── QuantumHelloWorld.tsx    # Wired flow (real stack)
│   │       └── Shelter.tsx             # System status
│   ├── public/     # SW, manifest, offline fallback
│   └── wrangler.toml
├── package.json
└── README.md       # ← you are here
```

---

## Deploy

The PWA auto-deploys to Cloudflare Pages on every push to `main`. Build command: `npm run build`, output: `dist`, root: `pwa`.

---

## P31 Labs

A Georgia 501(c)(3) nonprofit developing open-source assistive technology for neurodivergent individuals. Named for Phosphorus-31, the only stable isotope of phosphorus — referencing Posner molecules (calcium phosphate clusters) and their role in quantum cognition research.

[phosphorus31.org](https://phosphorus31.org) · [GitHub](https://github.com/p31labs)

## License

MIT
