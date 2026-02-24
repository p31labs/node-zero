# Connection infrastructure — wiring into SpaceshipEarth and DevMenu

The following files are already in place:

- `src/lib/connection-manager.ts`
- `src/hooks/useConnections.ts`
- `src/components/ConnectionPanel.tsx`
- `src/components/ConnectionBadge.tsx`
- `.env.example`

Apply the edits below to finish wiring.

---

## 1. SpaceshipEarth.tsx

**Imports** (add with existing imports):

```ts
import { ConnectionPanel } from './ConnectionPanel';
import { ConnectionBadge } from './ConnectionBadge';
```

**State** (add alongside existing state, e.g. `devMenuOpen`):

```ts
const [showConnections, setShowConnections] = useState(false);
```

**Keyboard handler** — in the same `useEffect` or handler where you handle `d` for DevMenu and `b` for breathing, add:

```ts
case 'c':
case 'C':
  setShowConnections(prev => !prev);
  break;
```

**Render** — add with other overlays (e.g. after `DeepLockOverlay`, before or after `DevMenu`):

```tsx
<ConnectionPanel visible={showConnections} onClose={() => setShowConnections(false)} />
```

**Telemetry bar** — add the badge next to existing items (e.g. next to spoons / node count):

```tsx
<ConnectionBadge onClick={() => setShowConnections(true)} />
```

---

## 2. DevMenu.tsx

**Import** (add with existing imports):

```ts
import { connectionManager, STATUS_ICONS, STATUS_COLORS } from '../lib/connection-manager';
```

**In the panel body** (e.g. below the Samson / trimtab section), add a CIRCUITS block:

```tsx
<div style={{ ...PATTERNS.sectionLabel, marginTop: SPACE[4] }}>CIRCUITS</div>
{Array.from(connectionManager.getServices().entries()).map(([id, svc]) => (
  <div key={id} style={{
    display: 'flex', justifyContent: 'space-between',
    fontSize: FONTS.size.xs, fontFamily: FONTS.mono,
    color: STATUS_COLORS[svc.status], padding: `${SPACE[0.5]} 0`,
  }}>
    <span>{STATUS_ICONS[svc.status]} {svc.label}</span>
    <span>{svc.latency ? `${svc.latency}ms` : svc.status}</span>
  </div>
))}
```

---

## Verification

- `npm run build --workspace=apps/web` passes.
- Press **C** → Connection panel slides in from the right.
- Panel shows 6 services; Dexie typically green; API/WS/Ollama/Serial/Web3 depend on environment.
- ⚙ opens config editor; ⟳ ALL re-probes.
- Telemetry bar shows connection badge (e.g. `◉○○ 1/6`).
- DevMenu (e.g. **D** key) shows CIRCUITS section with the same status.
