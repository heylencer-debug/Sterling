# Sterling Dashboard Audit Task

You are auditing the Sterling PSE trading dashboard for Carlo Rebadomia.

## What to audit

### Files to review:
1. `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\index.html`
2. `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\gold.js`
3. `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\app.js`
4. `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\style.css`
5. `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\data\sb.js`

### What was recently built (check these specifically):
- Gold tab: live XAU/USD price, positions table, broker recommendation cards
- Trade Log floating button + modal (buy/sell form for PSE stocks + gold)
- Trade submit logic in app.js (upserts to Supabase)
- TradingView Lightweight Charts on Learn page (Hammer, Doji, Engulfing, Higher Highs, Golden Cross, Death Cross)
- Pattern detection on portfolio (MBT, KEEPR, FILRT, GLO, DMC, MREIT, RRHI)
- Study My Portfolio section (TradingView widget per stock)
- Inline glossary tooltips (GLOSSARY object + applyGlossary function)

### Known architectural rules (verify these are respected):
- All Supabase calls use `window.sbFetch()` — NEVER bare `sbFetch()`
- `data/sb.js` loads BEFORE `app.js` (no defer on sb.js)
- NO supabase.min.js library — plain fetch() only
- Supabase anon key (NOT service role key) used in browser
- push-file.js used for all GitHub pushes (NOT git push)
- Sterling theme: dark `#0A0E1A` navy background, `#FFD700` gold accent
- Market hours check: Mon-Fri 9:30AM-3:30PM Manila (UTC+8)

### Phisix API rules:
- Response structure: `{ stocks: [{ price: { amount }, percentChange, volume, symbol }], as_of }`
- Field is `percentChange` NOT `percent_change`
- Access via `data.stocks[0]` NOT `data.stock[0]`

### Things that commonly break:
1. `sbFetch` called without `window.` prefix
2. Script load order (sb.js must be first)
3. TradingView widget loading when container div doesn't exist yet
4. Supabase column name mismatches (`qty` vs `quantity`, `avg_buy_price` vs `average_price`)
5. Gold API CORS issues (check if fallback exists)
6. Modal overlay not properly toggling (display:none vs flex)
7. IntersectionObserver not working if TV widget script not loaded
8. Glossary regex matching partial words (need word boundary \b)
9. TradingView widget `new TradingView.widget()` vs `new TradingViewWidget()` — the script from s3.tradingview.com uses `TradingView.widget`

## What to produce

Write a detailed audit report covering:
1. **Bugs found** — specific file + line, what's wrong, what the fix is
2. **Missing features** — anything from the task that wasn't implemented
3. **Performance concerns** — anything that could cause slow loading or SIGKILL
4. **Architecture violations** — anything breaking the rules above
5. **Quick wins** — small fixes that would improve stability

Then fix ALL bugs you find directly in the files.

After fixing, push the corrected files:
```
cd C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch
node push-file.js docs/app.js docs/app.js
node push-file.js docs/style.css docs/style.css
node push-file.js docs/index.html docs/index.html
node push-file.js docs/gold.js docs/gold.js
```

## Final notification

When audit + fixes are complete, send this via Telegram:
```
node -e "const {spawnSync}=require('child_process');spawnSync(process.execPath,['C:\\\\Users\\\\Carl Rebadomia\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\openclaw\\\\openclaw.mjs','message','send','--channel','telegram','--target','1424637649','--message','Sterling Audit Complete (Opus) ✅\\n\\nBugs found and fixed. Full audit report ready. Dashboard is clean — check: https://heylencer-debug.github.io/Sterling'],{stdio:\\'inherit\\'})"
```
