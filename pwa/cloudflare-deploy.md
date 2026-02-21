# Cloudflare Pages — Deploy reference

## One-time: add config to repo

- **`pwa/wrangler.toml`** — already in repo (name, build command, output dir).
- **`pwa/README.md`** — deploy table + manual deploy commands.

## Dashboard setup (Git-connected)

1. **dash.cloudflare.com** → Workers & Pages → **Create**
2. **Connect to Git** → select the repo that contains `pwa/`
3. Configure:
   - **Project name:** `p31-pwa`
   - **Production branch:** `main`
   - **Root directory:** `pwa`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `20`
4. **Save and Deploy**

First deploy → `p31-pwa.pages.dev`. Add custom domain after.

## CLI deploy (no dashboard)

```powershell
cd pwa
npm run build
npx wrangler pages project create p31-pwa --production-branch main
npx wrangler pages deploy dist --project-name p31-pwa
```

## After deploy — verify

1. **Install:** Open on phone → “Add to Home Screen” prompt
2. **Offline:** Airplane mode → app loads from SW cache
3. **Tabs:** P31 → Quantum Hello World; Shelter → stack status
4. **SW:** DevTools → Application → Service Workers → `p31-shell-v2` active
