# Sterling Dashboard — Opus Fix Task
> Goal: Audit all files, fix all issues, push everything correctly so the live site shows all features on mobile and desktop.

## Context
- Repo: heylencer-debug/Sterling (GitHub)
- GitHub Pages now serves from: `/docs` folder, `main` branch
- Live URL: https://heylencer-debug.github.io/Sterling
- Local path: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`
- Push method: `node push-file.js docs/FILENAME docs/FILENAME` (use the push-file.js in knightwatch/)
- GitHub PAT: `YOUR_GITHUB_PAT_HERE`
- Telegram notify: use spawnSync with openclaw.mjs, target `1424637649`

## The Problem
GitHub Pages was serving from root `/`. It now serves from `/docs`. But the ROOT files (index.html 10771 bytes, app.js 65110 bytes, style.css 27387 bytes) are OLD and missing all new features. The `/docs` files ARE the new ones with all features. Pages is now pointed at `/docs` so this should be fine — but verify the live site shows all features after confirming.

## What Must Be Live (verify each one exists in docs/ files)
1. **Gold tab** — nav item + `#page-gold` section + `gold.js` script loaded
2. **Trade Log ⚡ FAB button** — floating button `.trade-log-fab`, opens modal
3. **Trade Log modal** — form for PSE Stock + Gold trades, submits to Supabase
4. **Learn page overhaul** — TradingView Lightweight Charts for 6 patterns, Pattern Alerts section, Study My Portfolio with TradingView widgets
5. **Inline Glossary** — `GLOSSARY` array in app.js, `applyGlossary()` function, `.glossary-term` CSS with dashed gold underline, tap shows tooltip
6. **Discovery page** — PSE Stock Scanner (not just a watchlist)
7. **Watchlist page** — personal curated list with per-stock action badges

## Your Tasks

### Step 1 — Audit docs/ files
Read each file in `knightwatch/docs/`:
- `index.html` — check for: Gold nav item, trade-log-fab button, gold.js script tag, TradingView CDN script tag
- `app.js` — check for: `loadGoldPage()`, `GLOSSARY`, `applyGlossary()`, `openTradeLog()`, `submitTrade()`, TradingView chart rendering functions, `renderDiscovery()`, `renderWatchlist()`
- `style.css` — check for: `.trade-log-fab`, `.glossary-term`, `.gold-` prefixed classes, mobile media queries for ALL new features
- `gold.js` — check it exists and has XAU/USD fetch + broker cards

### Step 2 — Fix any missing features
If any feature is missing from the docs/ files, implement it completely. Do NOT skip or stub — build the full working feature.

### Step 3 — Full mobile optimization pass
Every new feature must work on mobile (375px width). Fix:
- Trade Log modal: `position: fixed; top: 0; left: 0; width: 100%; height: 100%;` on mobile, large tap targets (min 44px)
- Gold page: single-column layout on mobile, `overflow-x: auto` on tables
- Learn page: 1-column grid for pattern cards and glossary cards on mobile
- Glossary tooltips: `position: fixed` on mobile (not absolute, which gets clipped)
- TradingView widgets: `width: 100%; height: 300px` containers
- Sidebar: hamburger nav works for ALL pages including Gold, Discovery, Watchlist
- All grids: `grid-template-columns: 1fr` at max-width 768px
- `.trade-log-fab`: bottom: 80px on mobile (above mobile browser bar), right: 16px

### Step 4 — Add cache-busting
In index.html, add `?v=2` to ALL script and CSS file references:
```html
<link rel="stylesheet" href="style.css?v=2">
<script src="data/sb.js?v=2"></script>
<script src="app.js?v=2"></script>
<script src="gold.js?v=2"></script>
```

### Step 5 — Push ALL files
Push every file in docs/ that was changed:
```
node push-file.js docs/index.html docs/index.html
node push-file.js docs/app.js docs/app.js
node push-file.js docs/style.css docs/style.css
node push-file.js docs/gold.js docs/gold.js
node push-file.js docs/data/sb.js docs/data/sb.js
```

### Step 6 — Notify Carlo
After all pushes succeed, send Telegram notification:
```
Sterling dashboard fully fixed and live!
✅ Gold tab
✅ Trade Log button  
✅ TradingView charts on Learn page
✅ Inline glossary tooltips
✅ Full mobile optimization
✅ Cache-busting added

Live at: https://heylencer-debug.github.io/Sterling
(Give it 2 min for GitHub Pages to rebuild)
```

Use spawnSync like this (exact method that works):
```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send',
  '--channel', 'telegram',
  '--target', '1424637649',
  '--message', 'your message here'
]);
```

## Critical Rules
- Use plain `fetch()` for ALL Supabase calls — NO supabase.min.js library
- Supabase anon key (browser safe): `YOUR_SUPABASE_ANON_KEY_HERE`
- Supabase URL: `https://fhfqjcvwcxizbioftvdw.supabase.co`
- All Supabase calls use `window.sbFetch()` defined in `data/sb.js`
- Sterling theme: dark `#0A0E1A` navy + `#FFD700` gold — NEVER change this
- Do NOT use `git push` — it hangs. ONLY use `node push-file.js`
- When done, run the notify command above
