# Auto-Forwarder Integration Guide

The forwarder is part of node-zero as of v0.2.0. It wires NodeZero protocol events to @p31/love-ledger and @p31/game-engine automatically.

## Usage

```typescript
import { wire, boot } from "@p31/node-zero/forwarder";
// or from main entry:
import { wire, NodeZero, ... } from "@p31/node-zero";

import { LedgerEngine } from "@p31/love-ledger";
import { GameEngine } from "@p31/game-engine";

const ledger = new LedgerEngine(nodeId);
const game = new GameEngine(nodeId, {
  domeName: "Crystal Dome",
  ledger: {
    blockPlaced: (m) => ledger.blockPlaced(m),
    challengeComplete: (id, love) => ledger.donate(love, { challengeId: id }),
  },
});

const handle = wire(node, { ledger, game });
// All events flow. handle.teardown() to clean up.
```

## What It Wires

- **Protocol → Ledger (9 events):** BOND_FORMED, PEER_DISCOVERED, TRANSMIT_COMPLETE, REMOTE_STATE_RECEIVED, VAULT_LAYER_CREATED, COHERENCE_CHANGED, STATE_CHANGED, BOND_TRUST_CHANGED, CARE_SCORE_UPDATED
- **Protocol → Game:** BOND_FORMED → game.bondFormed(peerId)
- **Ledger → Game (optional):** LOVE_EARNED → game.loveEarned(amount). Default on; set `bridgeLoveToGame: false` to disable.

## Tests

28 forwarder tests in `__tests__/forwarder.test.ts`. Total node-zero: 220 tests.
