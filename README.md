# @p31/node-zero

**The identity, bond, and vault protocol for P31 assistive technology.**

Node Zero is a TypeScript implementation of a peer-to-peer protocol designed for neurodivergent individuals. It provides cryptographic identity, encrypted data storage, and care-based relationship tracking — all running in the browser with zero runtime dependencies.

Built by [P31 Labs](https://phosphorus31.org), a Georgia 501(c)(3) nonprofit developing open-source assistive technology.

## Install

```bash
npm install @p31/node-zero
```

## What It Does

**Identity** — WebCrypto P-256 keypair generation, key rotation with certificate chains, social recovery (M-of-N threshold), device migration. Your identity is a Base58Check-encoded hash of your public key.

**Bonds** — 5-phase ECDH handshake between two nodes. Trust evolves through four tiers (GHOST → STRUT → COHERENT → RESONANT) based on a Care Score computed from interaction frequency, reciprocity, and consistency over a 7-day sliding window.

**Vault** — AES-256-GCM encrypted storage organized in named layers (medical, legal, personal). Each layer has its own Data Encryption Key, wrapped per-bond so trusted peers can access shared layers without seeing private ones.

**State** — 4-axis emotional state vector (Urgency, Valence, Cognitive Load, Coherence) with scope tier transitions (PATTERN → REFLEX → TUNNEL → SHUTDOWN). Broadcasts encrypted state to bonded peers.

**Transport** — Pluggable transport layer. Ships with `BroadcastChannelTransport` for browser tab-to-tab communication. Designed for LoRa mesh (Meshtastic) on hardware.

## Quick Start

```typescript
import {
  WebCryptoIdentityProvider,
  BroadcastChannelTransport,
  ChannelManager,
  StateEngine,
  VaultStore,
  NodeZero,
} from "@p31/node-zero";

// Boot a node
const identity = new WebCryptoIdentityProvider();
await identity.provision();

const transport = new BroadcastChannelTransport("p31-mesh");
const channels = new ChannelManager(identity, transport);
const state = new StateEngine();
const vault = new VaultStore(identity);

const node = new NodeZero({ identity, transport, channels, state, vault });
await node.boot();

// Listen for events
node.on("BOND_FORMED", (e) => console.log("Bond formed:", e.bond.peerId));
node.on("CARE_SCORE_UPDATED", (e) => console.log("Care score:", e.score));
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  NodeZero                    │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Identity  │ │  Bonds   │ │   Vault    │  │
│  │ Provider  │ │ Channel  │ │   Store    │  │
│  │           │ │ Manager  │ │            │  │
│  └─────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│        │            │              │         │
│  ┌─────┴────────────┴──────────────┴──────┐  │
│  │           State Engine                 │  │
│  │    [U, V, C, Q] → Scope Tier          │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│  ┌────────────────┴───────────────────────┐  │
│  │         Transport (pluggable)          │  │
│  │   BroadcastChannel · LoRa · WebRTC    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Trust Tiers

| Tier | Access | Unlocked By |
|------|--------|-------------|
| GHOST | Public key + voltage only | Beacon discovery |
| STRUT | Shared secret, Layer 0 | Bond request accepted |
| COHERENT | Full state vector, personal layers | Care Score ≥ 0.5 over 7 days |
| RESONANT | Deep layers (medical, legal) | Care Score ≥ 0.8, sustained |

## Care Score

The Care Score is a [0, 1] normalized value computed from three weighted components:

- **Frequency** (0.3) — How often do we interact?
- **Reciprocity** (0.3) — Is initiation balanced?
- **Consistency** (0.4) — Do interactions happen regularly?

Updated daily over a 7-day sliding window. Drives trust tier promotions and economic pool modulation in [@p31/love-ledger](https://www.npmjs.com/package/@p31/love-ledger).

## Stats

- **192 tests** passing
- **89.7 kB** packed
- **0** runtime dependencies
- **WebCrypto** only — no Node.js crypto required
- **ES2022** module output

## Related Packages

- [@p31/love-ledger](https://www.npmjs.com/package/@p31/love-ledger) — Economic layer. Translates Node Zero events into LOVE transactions.

## License

MIT — P31 Labs, a Georgia 501(c)(3) nonprofit.
