# Sterling — Discovery vs Watchlist Redesign

## Working Directory
`C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`

## Push Method
`node push-file.js docs/app.js docs/app.js` etc. NEVER use git push.
Repo: `heylencer-debug/Sterling`

## Supabase
- URL: `https://fhfqjcvwcxizbioftvdw.supabase.co`
- Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZnFqY3Z3Y3hpemJpb2Z0dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTcxMzgsImV4cCI6MjA4NzkzMzEzOH0.g8K40DjhvxE7u4JdHICqKc1dMxS4eZdMhfA11M8ZMBc`
- All Supabase calls via `window.sbFetch()` — never bare `sbFetch()`
- Tables: `sterling_watchlist` (existing), `sterling_portfolio` (7 holdings)

## GOAL
Completely redesign the Discovery and Watchlist pages to be clearly distinct.

---

## PAGE 1: DISCOVERY — PSE Stock Market Scanner

### Concept
"Browse the entire PSE. Filter by what matters to you. Add what you like to your Watchlist."

### UI Layout
Header section:
```
🔭 Discovery
Browse all PSE-listed stocks. Filter, explore, and add to your watchlist.
```

Filter bar (sticky at top):
- **Sector dropdown**: All | Banking | REIT | Telecom | Property | Mining & Oil | Retail | Energy | Industrial | Holding Firms
- **Min Yield %**: number input (default 0)
- **Max P/E**: number input (default 999)
- **Sort by**: Yield (High→Low) | P/E (Low→High) | Price Change | Alphabetical
- [Apply Filters] button

Stock grid (cards):
Each card shows:
```
[SECTOR BADGE]
SYMBOL    Company Name
₱ Price   +1.5% today
Yield: 8.1%   P/E: 9.2x
[+ Add to Watchlist]
```

Color coding:
- Today % positive → green
- Today % negative → red
- Already in watchlist → button says "✓ In Watchlist" (disabled, gold color)
- Already in portfolio → badge "In Portfolio" (blue)

### PSE Stock Data
Use a hardcoded array of 40 PSE stocks (since Phisix only returns one at a time). Include real data:

```js
const PSE_UNIVERSE = [
  // Banking
  { symbol:'BDO', name:'BDO Unibank', sector:'Banking', yield:2.1, pe:10.2, price:132.50 },
  { symbol:'MBT', name:'Metrobank', sector:'Banking', yield:6.78, pe:6.86, price:76.00 },
  { symbol:'BPI', name:'Bank of the Philippine Islands', sector:'Banking', yield:3.2, pe:12.5, price:108.00 },
  { symbol:'SECB', name:'Security Bank', sector:'Banking', yield:3.8, pe:8.9, price:72.00 },
  { symbol:'EW', name:'East West Banking', sector:'Banking', yield:2.5, pe:7.2, price:8.50 },
  // REIT
  { symbol:'AREIT', name:'Ayala REIT', sector:'REIT', yield:5.8, pe:18.2, price:33.50 },
  { symbol:'MREIT', name:'Megaworld REIT', sector:'REIT', yield:7.2, pe:14.1, price:14.18 },
  { symbol:'FILRT', name:'Filinvest REIT', sector:'REIT', yield:8.1, pe:12.3, price:3.01 },
  { symbol:'DDMPR', name:'DoubleDragon REIT', sector:'REIT', yield:8.9, pe:11.5, price:1.35 },
  { symbol:'CREIT', name:'Citicore REIT', sector:'REIT', yield:7.5, pe:13.8, price:2.55 },
  { symbol:'KEEPR', name:'Keppel Philippines REIT', sector:'REIT', yield:11.0, pe:9.2, price:2.31 },
  { symbol:'RCR', name:'RL Commercial REIT', sector:'REIT', yield:6.9, pe:15.1, price:5.20 },
  // Telecom
  { symbol:'GLO', name:'Globe Telecom', sector:'Telecom', yield:6.36, pe:11.0, price:1689.00 },
  { symbol:'TEL', name:'PLDT Inc.', sector:'Telecom', yield:7.8, pe:9.5, price:1200.00 },
  // Property
  { symbol:'ALI', name:'Ayala Land', sector:'Property', yield:1.8, pe:22.0, price:28.50 },
  { symbol:'SM', name:'SM Prime Holdings', sector:'Property', yield:0.9, pe:28.5, price:35.00 },
  { symbol:'MEG', name:'Megaworld Corp', sector:'Property', yield:3.2, pe:8.5, price:2.10 },
  { symbol:'RLC', name:'Robinsons Land', sector:'Property', yield:2.5, pe:12.0, price:14.50 },
  { symbol:'SMPH', name:'SM Prime', sector:'Property', yield:0.9, pe:28.0, price:34.80 },
  // Mining & Oil
  { symbol:'DMC', name:'DMCI Holdings', sector:'Mining & Oil', yield:9.73, pe:8.0, price:9.65 },
  { symbol:'SCC', name:'Semirara Mining', sector:'Mining & Oil', yield:12.5, pe:5.2, price:38.00 },
  { symbol:'PX', name:'Philex Mining', sector:'Mining & Oil', yield:1.2, pe:15.0, price:3.80 },
  // Retail
  { symbol:'RRHI', name:'Robinsons Retail', sector:'Retail', yield:2.8, pe:18.5, price:37.40 },
  { symbol:'PGOLD', name:'Puregold Price Club', sector:'Retail', yield:2.1, pe:16.0, price:28.00 },
  { symbol:'CNPF', name:'Century Pacific Food', sector:'Retail', yield:1.8, pe:20.0, price:21.50 },
  // Energy
  { symbol:'ACEN', name:'ACEN Corporation', sector:'Energy', yield:0.5, pe:35.0, price:3.90 },
  { symbol:'SEM', name:'Semirara Mining & Power', sector:'Energy', yield:11.0, pe:5.5, price:37.50 },
  { symbol:'FGEN', name:'First Gen Corp', sector:'Energy', yield:3.5, pe:12.0, price:22.00 },
  // Industrial
  { symbol:'JFC', name:'Jollibee Foods', sector:'Industrial', yield:0.8, pe:45.0, price:210.00 },
  { symbol:'AC', name:'Ayala Corporation', sector:'Holding Firms', yield:1.5, pe:15.0, price:620.00 },
  { symbol:'SM', name:'SM Investments', sector:'Holding Firms', yield:0.7, pe:22.0, price:880.00 },
  { symbol:'AGI', name:'Alliance Global', sector:'Holding Firms', yield:1.2, pe:11.0, price:10.50 },
  { symbol:'ICT', name:'International Container Terminal', sector:'Industrial', yield:1.5, pe:14.0, price:280.00 },
  { symbol:'MONDE', name:'Monde Nissin', sector:'Industrial', yield:1.8, pe:25.0, price:10.20 },
  { symbol:'URC', name:'Universal Robina Corp', sector:'Industrial', yield:2.2, pe:22.0, price:105.00 },
  { symbol:'LTG', name:'LT Group Inc', sector:'Holding Firms', yield:4.5, pe:9.0, price:12.80 },
  { symbol:'BLOOM', name:'Bloomberry Resorts', sector:'Industrial', yield:0.5, pe:18.0, price:7.80 },
  { symbol:'MAXS', name:'Max\'s Group', sector:'Industrial', yield:3.2, pe:16.0, price:8.50 },
  { symbol:'EEI', name:'EEI Corporation', sector:'Industrial', yield:2.8, pe:10.0, price:6.20 },
  { symbol:'VITA', name:'Vitarich Corp', sector:'Industrial', yield:1.5, pe:12.0, price:2.10 },
];
```

### Add to Watchlist logic
When user clicks "+ Add to Watchlist":
- POST to `sterling_watchlist` table:
  ```json
  { "symbol": "BDO", "company": "BDO Unibank", "sector": "Banking", "target_price": null, "notes": "Added from Discovery", "recommendation": "WATCH", "rationale": "Added by user from Discovery scanner" }
  ```
- Use `window.sbFetch` with POST
- Button changes to "✓ In Watchlist" immediately
- Show toast: "BDO added to Watchlist ✓"

---

## PAGE 2: WATCHLIST — Your Personal Monitoring List

### Concept
"Stocks you've chosen to track closely. Each one is connected to your portfolio context."

### UI Layout
Header:
```
👁️ Watchlist
Your curated shortlist. Stocks you're monitoring for potential action.
```

Stats bar:
```
[12 Watching]  [3 Buy Signals]  [2 Near Target]
```

Each watchlist card:
```
[SECTOR]  [BUY SIGNAL / WATCH / AVOID badge]
SYMBOL — Company Name
₱ Current Price    Target: ₱XX.XX
Yield: X%   P/E: X.Xx

📎 Portfolio connection: "Similar to MREIT — same REIT sector, both discounted to NAV"

💡 Why watch: [rationale from DB or auto-generated based on sector]

Entry price: ₱X.XX  |  Stop-loss: ₱X.XX
[View Chart ↗]  [Remove ✕]
```

### Portfolio connection logic
Match watchlist stocks to Carlo's 7 holdings by sector:
```js
const PORTFOLIO_CONNECTIONS = {
  'Banking': 'Similar to MBT in your portfolio — same banking sector',
  'REIT': 'Same REIT category as MREIT, FILRT, KEEPR — dividend-focused',
  'Telecom': 'Same sector as GLO in your portfolio',
  'Mining & Oil': 'Same sector as DMC in your portfolio — cyclical',
  'Retail': 'Same sector as RRHI in your portfolio',
  'Property': 'Property developer — watch for REIT spin-off potential',
  'Energy': 'Growth sector — diversifies away from your current holdings',
  'Industrial': 'No direct match — pure diversification play',
  'Holding Firms': 'Conglomerate — broad market exposure',
};
```

### Buy signal logic (same as portfolio)
For each watchlist stock, show:
- 🟢 **BUY** if: yield > 6% AND pe < 15 AND sector in (Banking, REIT, Mining)
- 🟡 **WATCH** if: yield 3-6% OR pe 15-25
- 🔴 **AVOID** if: pe > 35 OR (yield < 1% AND not growth sector)

### Remove from Watchlist
DELETE from `sterling_watchlist` where symbol matches. Re-render.

---

## IMPLEMENTATION ORDER
1. Read existing `docs/app.js` first
2. Find `renderDiscovery()` and `renderWatchlist()` functions (or wherever those tabs render)
3. Replace both completely with the new designs above
4. Add `PSE_UNIVERSE` array as a constant at the top of app.js (or in the discovery section)
5. Add `addToWatchlist(stock)` function
6. Add `removeFromWatchlist(symbol)` function
7. Add styles to `docs/style.css`:
   - `.discovery-filters` — sticky filter bar
   - `.stock-card` — discovery card grid
   - `.sector-badge` — colored per sector
   - `.watchlist-card` — wider card with connection + signal
   - `.signal-badge.buy/.watch/.avoid`
   - `.portfolio-connection` — subtle linked note
8. Push: `node push-file.js docs/app.js docs/app.js` and `node push-file.js docs/style.css docs/style.css`
9. Notify Carlo:

```
node -e "const {spawnSync}=require('child_process');spawnSync(process.execPath,['C:\\\\Users\\\\Carl Rebadomia\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\openclaw\\\\openclaw.mjs','message','send','--channel','telegram','--target','1424637649','--message','Sterling Discovery + Watchlist redesign complete ✅\\n\\n🔭 Discovery: Browse 40 PSE stocks, filter by sector/yield/P/E, tap to add to watchlist\\n👁️ Watchlist: Your curated list with portfolio connections, buy signals, entry prices, and remove button\\n\\nhttps://heylencer-debug.github.io/Sterling'],{stdio:\\'inherit\\'})"
```
