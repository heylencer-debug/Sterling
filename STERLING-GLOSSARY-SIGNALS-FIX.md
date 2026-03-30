# Sterling Fix — Glossary on All Pages + Visible Buy/Sell Signals
> Fix two specific things. Do not change anything else.

## File to edit: `knightwatch/docs/app.js`
## Push method: `node push-file.js docs/app.js docs/app.js` in knightwatch/
## GitHub PAT: `YOUR_GITHUB_PAT_HERE`

---

## FIX 1 — Inline Glossary on ALL Pages

### Problem
`window.applyGlossary()` is only called inside `renderLearnPage()`. It needs to run after EVERY page renders so terms like RSI, DCA, NAV, P/E, MACD, REIT, Dividend, etc. get underlined with gold dashes and show tooltips on tap/hover everywhere.

### How to fix
Search app.js for every function that renders page content and add `window.applyGlossary(document.getElementById('page-X'))` at the END of it.

The render functions are:
- `renderPortfolio()` or `renderHoldings()` — add at end: `window.applyGlossary(document.getElementById('page-portfolio'))`
- `renderBrief()` — add: `window.applyGlossary(document.getElementById('page-brief'))`
- `renderWatchlist()` — add: `window.applyGlossary(document.getElementById('page-watchlist'))`
- `renderAlerts()` — add: `window.applyGlossary(document.getElementById('page-alerts'))`
- `renderNews()` — add: `window.applyGlossary(document.getElementById('page-news'))`
- `renderDividends()` — add: `window.applyGlossary(document.getElementById('page-dividends'))`
- `renderDiscovery()` — add: `window.applyGlossary(document.getElementById('page-discovery'))`
- `loadGoldPage()` — add: `window.applyGlossary(document.getElementById('page-gold'))`
- `renderLearn*` — already done

Also call it globally after every tab switch. In the nav click handler / `showPage(id)` function, add:
```js
setTimeout(() => window.applyGlossary(document.getElementById('page-' + id)), 200);
```

---

## FIX 2 — Prominent Buy/Hold/Sell/DCA Signals on Portfolio Cards

### Problem
The `renderStockAction()` function exists but:
1. The detail is hidden behind a tap (`display:none`) — Carlo doesn't know to tap it
2. The signal is not visually prominent enough
3. There's no clear BUY / DCA / HOLD / SELL badge

### What Carlo wants
Each stock card should clearly show:
- A big color-coded badge: **BUY MORE** (green) / **DCA ZONE** (yellow) / **HOLD** (blue) / **WAIT** (gray) / **SELL / STOP LOSS** (red)
- Entry price recommendation: "Entry: ₱73–74" or "DCA zone: ₱2.00–₱2.10"
- Stop-loss level: "Stop: ₱69"
- One-line plain English reason
- Tap to expand full detail + source links

### New `renderStockAction(symbol, plPct)` — replace the existing one completely:

```js
function renderStockAction(symbol, plPct) {
  const a = STOCK_ACTIONS[symbol];
  if (!a) return '';
  const sourceLinks = (a.sources || []).map(s =>
    `<a href="${s.url}" target="_blank" class="signal-source">${s.name} ↗</a>`
  ).join('');
  return `
    <div class="signal-card" onclick="this.classList.toggle('expanded')">
      <div class="signal-top">
        <span class="signal-badge" style="background:${a.badgeBg || 'rgba(255,215,0,0.15)'};color:${a.color}">${a.badge || '⚔️ HOLD'}</span>
        <div class="signal-prices">
          ${a.entry ? `<span class="signal-entry">Entry ${a.entry}</span>` : ''}
          ${a.stop ? `<span class="signal-stop">Stop ${a.stop}</span>` : ''}
        </div>
        <span class="signal-expand-icon">▸</span>
      </div>
      <div class="signal-reason">${a.reason}</div>
      <div class="signal-detail">
        <div class="signal-full">${a.detail}</div>
        ${sourceLinks ? `<div class="signal-sources">${sourceLinks}</div>` : ''}
      </div>
    </div>`;
}
```

### Update STOCK_ACTIONS to include new fields:
Add `badge`, `badgeBg`, `reason`, `entry`, `stop` to each stock entry.

```js
const STOCK_ACTIONS = {
  MBT: {
    badge: '🟢 HOLD — Add on Dip',
    badgeBg: 'rgba(0,212,160,0.15)',
    color: '#00D4A0',
    entry: '₱73–74',
    stop: '₱69',
    reason: 'All 12 MAs bullish. 13 analysts avg target ₱91. P/E 6.86x vs sector 11x — cheap bank.',
    detail: 'RSI 66.8 (strong, not overbought) | All 12 MAs = Buy | P/E 6.86x vs sector 11x | 13 analysts avg target ₱91, high ₱97.50 | Take profit 1st at ₱86',
    sources: [
      { name: 'Technicals', url: 'https://www.investing.com/equities/metropolitan-b-technical' },
      { name: 'Targets', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company' },
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573' },
    ]
  },
  KEEPR: {
    badge: '🟡 DCA ZONE ₱2.00–₱2.10',
    badgeBg: 'rgba(255,215,0,0.15)',
    color: '#FFD700',
    entry: '₱2.00–₱2.10',
    stop: '₱1.90',
    reason: 'Price ₱2.30 vs real asset value ₱3.80 = 40% discount. 11% dividend yield. Macro dip, not a broken company.',
    detail: 'NAV ₱3.80 vs price ₱2.30 = 40% discount | ~11% dividend yield | 94% occupancy | BSP rate cut H2 2026 = REIT rally catalyst | DCA zone: ₱2.00–₱2.10 | Stop-loss ₱1.90',
    sources: [
      { name: 'Asia Sec Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-KEEPR/technicals/' },
    ]
  },
  FILRT: {
    badge: '🟡 HOLD — Ex-Div ~Mar 11',
    badgeBg: 'rgba(255,215,0,0.15)',
    color: '#FFD700',
    entry: '₱2.90–₱3.00',
    stop: '₱2.70',
    reason: 'Dividend ₱0.06/share × 7,000 = ₱420 incoming ~Mar 11. NAV ₱4.21 = 28% discount.',
    detail: 'Ex-date ~March 11 | ₱420 dividend incoming | 8.1% annual yield | NAV ₱4.21 vs ₱3.02 = 28% discount | LT Buy (Asia Securities)',
    sources: [
      { name: 'Asia Sec Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph' },
    ]
  },
  GLO: {
    badge: '🟢 HOLD — Dividend Play',
    badgeBg: 'rgba(0,212,160,0.15)',
    color: '#00D4A0',
    entry: '₱1,700–₱1,720',
    stop: '₱1,600',
    reason: 'P/E 11x vs global telecom avg 21x. 6.36% dividend yield. Above 200-day MA.',
    detail: 'P/E 11x (vs telecom avg 21x globally) | 6.36% yield | EPS growth 9.3% | High debt D/E 2.1x (normal for telecoms) | Target ₱1,850–1,900',
    sources: [
      { name: 'Fintel Fundamentals', url: 'https://fintel.io/s/ph/glo' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-GLO/technicals/' },
    ]
  },
  DMC: {
    badge: '🟡 HOLD — Watch Nickel',
    badgeBg: 'rgba(255,215,0,0.15)',
    color: '#FFD700',
    entry: '₱9.00–₱9.20',
    stop: '₱8.50',
    reason: 'P/E 8x vs industry 12.2x = undervalued. 9.73% dividend yield. 4/5 analysts BUY.',
    detail: 'RSI 44.4 — neutral (Investing.com) | P/E 8x vs industry 12.2x | Yield 9.73% | 4/5 analysts BUY | Target ₱11.81–₱14.89 | Risk: nickel commodity cycle',
    sources: [
      { name: 'HelloSafe PH', url: 'https://hellosafe.ph/investing/stock-market/stocks/dmc' },
      { name: 'Technicals', url: 'https://www.investing.com/equities/dmci-holdings-technical' },
    ]
  },
  MREIT: {
    badge: '🟢 HOLD — Ex-Div ~Mar 20',
    badgeBg: 'rgba(0,212,160,0.15)',
    color: '#00D4A0',
    entry: '₱13.80–₱14.00',
    stop: '₱13.00',
    reason: 'NAV ₱19.69 vs price ₱14.18 = 28% discount. 7.2% yield. BUY rating from Asia Sec.',
    detail: 'NAV ₱19.69 vs ₱14.18 = 28% discount | 7.2% yield | Ex-date ~March 20 | Megaworld expanding to Iloilo + Davao | BUY (Asia Sec) | Target ₱17.50',
    sources: [
      { name: 'Asia Sec Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-MREIT/technicals/' },
    ]
  },
  RRHI: {
    badge: '⚪ WAIT — Mixed Signals',
    badgeBg: 'rgba(100,116,139,0.15)',
    color: '#94A3B8',
    entry: '₱35.00–₱36.00',
    stop: '₱34.00',
    reason: 'MACD sell signal. 8/12 MAs say sell. Same-store sales +5.65% but momentum weak — wait for clearer signal.',
    detail: 'RSI 47 — neutral | MACD -0.284 = mild sell | 8 MAs Sell, 4 Buy = mixed | Same-store sales +5.65% | Do not add at current levels — wait for RSI < 40 or MACD cross',
    sources: [
      { name: 'Technicals', url: 'https://www.investing.com/equities/robinsons-reta-technical' },
      { name: 'GuruFocus', url: 'https://www.gurufocus.com/stock/PHS:RRHI/summary' },
    ]
  },
};
```

### Add CSS for the new signal card to style.css:
```css
/* Signal Card */
.signal-card { background: rgba(255,255,255,0.03); border: 1px solid #1E2A3A; border-radius: 8px; padding: 12px; margin-top: 12px; cursor: pointer; transition: border-color 0.2s; }
.signal-card:hover, .signal-card.expanded { border-color: #FFD700; }
.signal-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.signal-badge { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.3px; }
.signal-prices { display: flex; gap: 8px; margin-left: auto; }
.signal-entry { font-size: 11px; color: #00D4A0; background: rgba(0,212,160,0.1); padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.signal-stop { font-size: 11px; color: #FF4757; background: rgba(255,71,87,0.1); padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.signal-expand-icon { color: #64748B; font-size: 12px; margin-left: auto; transition: transform 0.2s; }
.signal-card.expanded .signal-expand-icon { transform: rotate(90deg); }
.signal-reason { font-size: 12px; color: #94A3B8; line-height: 1.5; }
.signal-detail { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #1E2A3A; }
.signal-card.expanded .signal-detail { display: block; }
.signal-full { font-size: 12px; color: #CBD5E1; line-height: 1.6; margin-bottom: 8px; }
.signal-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.signal-source { font-size: 10px; color: #FFD700; background: rgba(255,215,0,0.1); padding: 2px 8px; border-radius: 4px; text-decoration: none; }
.signal-source:hover { background: rgba(255,215,0,0.2); }
```

---

## Steps
1. Read current `knightwatch/docs/app.js`
2. Replace `renderStockAction` function and `STOCK_ACTIONS` with the new versions above
3. Find every page render function and add `window.applyGlossary(container)` at the end
4. Find the `showPage(id)` or nav tab switch handler and add `setTimeout(() => window.applyGlossary(document.getElementById('page-' + id)), 200)`
5. Read `knightwatch/docs/style.css`, append the `.signal-card` CSS block above
6. Push both files:
   - `node push-file.js docs/app.js docs/app.js`
   - `node push-file.js docs/style.css docs/style.css`
7. Notify Carlo via Telegram:

```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send', '--channel', 'telegram', '--target', '1424637649',
  '--message', 'Sterling fixed:\n✅ Buy/DCA/Hold signals now visible on every stock card (entry price + stop-loss always shown, tap for full detail)\n✅ Glossary tooltips now work on ALL pages\n\nhttps://heylencer-debug.github.io/Sterling'
]);
```
