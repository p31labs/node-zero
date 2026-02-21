# PWA Icons

You need these four PNGs in this folder:

| File | Size | Purpose |
|------|------|---------|
| `p31-192.png` | 192×192 | Standard |
| `p31-512.png` | 512×512 | Standard (large) |
| `p31-maskable-192.png` | 192×192 | Maskable (safe zone) |
| `p31-maskable-512.png` | 512×512 | Maskable (large) |

## Option A — Use existing PNGs

If you have the four PNGs from an earlier build or this chat, copy them into `pwa/icons/`.

## Option B — Generate from SVG (Node + sharp)

From the **pwa** directory (one level up):

```powershell
cd "c:\Users\sandra\Documents\N0\pwa"
npm install
node icons/generate-icons.js
```

That writes all four PNGs from `p31-icon.svg`. Standard icons are resized to 192 and 512; maskable icons are rendered smaller and centered on black (safe zone for Android).

The service worker precaches all four so the app is installable offline.
