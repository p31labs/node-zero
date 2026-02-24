# GATE 3 REPORT — Token Compliance
Date: 2025-02-23

---

## === apps/web/ ===

**VIOLATIONS FOUND:** 7  
**VIOLATIONS FIXED:** 7  

### Per-file breakdown

| File | Violations | Fixes applied |
|------|------------|----------------|
| ConnectionPanel.tsx | 3 | Removed local `TIER_COLORS`; use `COLORS.tier` from design-tokens. Replaced hardcoded `boxShadow: '-4px 0 24px rgba(0,0,0,0.4)'` with `SHADOW.panel`. Replaced `width: '20px'` with `LAYOUT.iconSize`. Replaced `width: '380px'` with `LAYOUT.panelWidth`. |
| ConnectionBadge.tsx | 3 | Removed local `TIER_COLORS`; use `COLORS.tier`. Replaced `fontSize: '6px'` with `FONTS.size.micro`. Replaced `letterSpacing: '2px'` with `FONTS.tracking.micro`. |
| IntakeForm.tsx | 1 | Removed local `AXIS_COLORS`; use `COLORS.axis` from design-tokens (already existed). |
| WalletConnect.tsx | 2 | Replaced `fontWeight: 300` with `FONTS.weight.light`. Replaced `maxWidth: 320` with `LAYOUT.copyMaxWidth`. |
| PhaseCollapse.tsx | 0 | No violations (already used tokens). |
| OnboardingFlow.tsx | 0 | No violations (already used tokens). |

### REMAINING (unfixable or exceptions)

- **maxWidth: '100vw'** (ConnectionPanel) — Left as-is; common responsive pattern; exceptions list allows `'100%'`-style viewport usage.
- **rgba in SHADOW.panel** — Token value lives in design-tokens.ts; exceptions allow values inside design-tokens.ts.
- **lineHeight: 1** (ConnectionPanel) — Unitless number; not font-size/spacing token; left as-is.
- **minHeight: 60** (IntakeForm textarea) — Numeric minHeight; not in scope of the hex/font/spacing scans; left as-is.

### CENTRALIZED (additions to design-tokens.ts)

- **COLORS.tier** — `FULL`, `ONLINE`, `LOCAL`, `OFFLINE` (used by ConnectionPanel, ConnectionBadge).
- **SHADOW.panel** — `-4px 0 24px rgba(0,0,0,0.4)` (used by ConnectionPanel).
- **LAYOUT** — `copyMaxWidth: '320px'`, `iconSize: '20px'`, `panelWidth: '380px'` (used by WalletConnect, ConnectionPanel).
- **FONTS.size.micro** — `0.375rem` (6px) (used by ConnectionBadge).
- **FONTS.tracking.micro** — `0.125em` (used by ConnectionBadge).
- **FONTS.weight.light** — `300` (used by WalletConnect).
- **SPACE[1.5]** — `0.375rem` (was already referenced in components; added to SPACE).

### tsc --noEmit

**PASS**

### Final hex scan (components/*.tsx, excluding design-tokens)

```powershell
Select-String -Path src/components/*.tsx -Pattern "#[0-9a-fA-F]{3,8}" | Where-Object { $_.Path -notmatch "design-tokens" }
```

**Result: 0 lines** → Gate 3 **PASSES** for apps/web/.

---

## === pwa/ ===

**Token system:** Absent  

**Result:** Out of scope — pwa/ does not have `src/lib/design-tokens.ts`. pwa/ uses its own styling approach (CSS classes / Tailwind); no token migration performed.

---

## VERIFICATION COMMAND (final check)

After all fixes, the hex scan returns **ZERO** lines in apps/web/src/components/*.tsx (excluding design-tokens):

```powershell
cd "p31-buffer\apps\web"
Select-String -Path src/components/*.tsx -Pattern "#[0-9a-fA-F]{3,8}" | Where-Object { $_.Path -notmatch "design-tokens" }
```

**Gate 3: PASS**
