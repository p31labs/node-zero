# P31 PWA

Phosphorus 31 — assistive technology platform. Identity, economy, and geodesic building for neurodivergent minds.

Built on three packages: [@p31/node-zero](https://www.npmjs.com/package/@p31/node-zero) (protocol), [@p31/love-ledger](https://www.npmjs.com/package/@p31/love-ledger) (economy), [@p31/game-engine](https://www.npmjs.com/package/@p31/game-engine) (building).

## Dev

```bash
npm install
npm run dev          # localhost:5173
npm run build        # production build → dist/
npm run typecheck    # TypeScript verification
npm run preview      # preview production build
```

## Deploy

Connected to Cloudflare Pages. Every push to `main` triggers a build.

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | `pwa` |
| Node version | 20 |

### Manual deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name p31-pwa
```

### Custom domain

Cloudflare dashboard → Pages → p31-pwa → Custom domains → Add domain.

## Architecture

```
pwa/
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (cache-first shell)
│   ├── offline.html        # Offline fallback
│   └── icons/              # 192, 512, maskable
├── src/
│   ├── main.tsx            # React entry + SW registration
│   ├── App.tsx             # Tab nav + install prompt
│   ├── index.css           # Global styles
│   └── views/
│       ├── P31.tsx              # Intro → Quantum Hello World
│       ├── QuantumHelloWorld.tsx # Full wired flow (real stack)
│       └── Shelter.tsx          # Stack status dashboard
├── index.html              # Vite entry
├── index.standalone.html   # Zero-build fallback
├── vite.config.ts
├── wrangler.toml           # Cloudflare Pages config
└── package.json
```

## Offline

The service worker caches the app shell on first load. After install, the PWA works fully offline — identity generation, building, and wallet operations all run locally.

## License

MIT — [P31 Labs](https://phosphorus31.org)
