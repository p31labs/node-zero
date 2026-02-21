# P31 PWA — Deployment Guide

## File Structure

```
pwa/                        ← Deploy this folder to Cloudflare Pages (as site root)
├── index.html              ← App shell (React, SW registration, install prompt)
├── sw.js                   ← Service worker (cache-first shell, network-first data)
├── offline.html            ← Offline fallback page
├── manifest.json           ← PWA manifest (installability)
├── DEPLOY.md               ← This file
└── icons/
    ├── p31-192.png         ← Standard icon
    ├── p31-512.png         ← Standard icon (large)
    ├── p31-maskable-192.png  ← Maskable icon (safe zone)
    ├── p31-maskable-512.png  ← Maskable icon (large)
    └── p31-icon.svg        ← Source SVG (optional)
```

## Deploy to Cloudflare Pages

### Option A: Direct upload
1. Go to [Cloudflare Pages](https://dash.cloudflare.com/) → your project
2. Upload the contents of `pwa/` (so `index.html`, `sw.js`, etc. are at the root)
3. Ensure `icons/` contains the four PNGs

### Option B: Git-based deploy
1. Put the contents of `pwa/` in the repo root (or in the branch Cloudflare builds from)
2. Push to GitHub; Cloudflare auto-deploys

### Option C: phosphorus31-org.pages.dev
If the site already exists, replace or add these files at the project root. Copy `icons/` with the PNGs.

## Installability Checklist

- [x] **HTTPS** — Cloudflare Pages provides this
- [x] **Valid manifest** — name, icons, start_url, display
- [x] **Service worker** — `sw.js` registered from `index.html`
- [x] **Icons** — 192×192 and 512×512 PNG (standard + maskable)
- [x] **Apple meta tags** — apple-mobile-web-app-capable, touch icon
- [x] **beforeinstallprompt** — Custom install banner

## Icons

Generate PNGs from the tetrahedron SVG (e.g. with sharp, cairosvg, or ImageMagick). Maskable versions should have ~20% safe-zone padding so Android doesn’t crop the shape. Place all four PNGs in `icons/`.

## Cache Versioning

When you change the app, bump the cache version in `sw.js`:

```javascript
const CACHE_NAME = "p31-shell-v2"; // was v1
```

Old caches are removed on SW activate.

## No Build Step

No Vite, Webpack, or Babel. Vanilla JS + React from CDN. Deploy the files and go.
