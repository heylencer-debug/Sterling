# Sterling — 3 Core Fixes
> Fix news, add real buy/sell triggers, add mentor note to every page.

## Files: knightwatch/docs/app.js + style.css
## Push: node push-file.js docs/app.js docs/app.js (and style.css)
## PAT: YOUR_GITHUB_PAT_HERE
## Notify: Carlo via Telegram 1424637649 when done

---

## FIX 1 — News Page Has No Data

In `loadNews()`, change:
```js
newsData = await window.sbFetch('sterling_news', { order: 'created_at.desc', limit: '50' });
```
To:
```js
newsData = await window.sbFetch('sterling_news', { order: 'published_at.desc', limit: '50' });
```
That's the only change needed for news. Column is `published_at` not `created_at`.

Also add a mentor note at the top of the news page section (see FIX 3 below).

---

## FIX 2 — Real BUY / SELL Triggers Per Stock (THE MAIN FEATURE)

Carlo wants Sterling to be an active broker — not just showing "HOLD". He wants to know:
- **When exactly to buy more** (price trigger)
- **When to take profit** (target price)
- **When to stop loss** (exit price)
- **Why** in one sentence

### Replace the existing signal card HTML in `renderStockAction(symbol)` with this structure:

```html
<div class="action-block">
  <!-- Row 1: The signal headline -->
  <div class="action-headline">
    <span class="action-badge [color-class]">[BADGE TEXT]</span>
    <span class="action-summary">[One sentence plain English]</span>
  </div>

  <!-- Row 2: Price triggers — always visible -->
  <div class="price-triggers">
    <div class="trigger-pill buy">
      <span class="trigger-label">BUY IF drops to</span>
      <span class="trigger-price">[entry price]</span>
    </div>
    <div class="trigger-pill tp">
      <span class="trigger-label">TAKE PROFIT at</span>
      <span class="trigger-price">[target price]</span>
    </div>
    <div class="trigger-pill sl">
      <span class="trigger-label">STOP LOSS at</span>
      <span class="trigger-price">[stop price]</span>
    </div>
  </div>

  <!-- Row 3: Tap to expand full rationale -->
  <div class="action-expand" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
    <span>⚔️ Full rationale + sources</span><span class="chevron">▸</span>
  </div>
  <div class="action-detail" style="display:none">
    [full detail text]
    [source links]
  </div>
</div>
```

### Updated STOCK_ACTIONS data (use this exact data):

```js
const STOCK_ACTIONS = {
  MBT: {
    badge: 'ADD ON DIP', badgeClass: 'badge-buy',
    summary: 'Strong bank, cheap valuation. Add more if it pulls back.',
    entry: '₱73–74', target: '₱86–97', stop: '₱69',
    detail: 'RSI 66.8 (strong momentum, not yet overbought) | All 12 moving averages = BUY | P/E 6.86x vs banking sector 11x = trading at a 38% discount to peers | 13 analyst consensus target ₱91, high ₱97.50 | EPS grew 18% last year | Catalyst: continued rate environment + consumer loan growth',
    sources: [
      { name: 'Technicals (Investing.com)', url: 'https://www.investing.com/equities/metropolitan-b-technical' },
      { name: 'Analyst targets (HelloSafe)', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company' },
      { name: 'Disclosures (PSE Edge)', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573' },
    ]
  },
  KEEPR: {
    badge: 'DCA ZONE', badgeClass: 'badge-dca',
    summary: 'Property value is ₱3.80 but you can buy it for ₱2.30. 40% discount + 11% dividend.',
    entry: '₱2.00–2.10', target: '₱2.80–3.20', stop: '₱1.90',
    detail: 'NAV (Net Asset Value) = ₱3.80 per share. Current price = ₱2.30. That\'s a 40% discount to the actual real estate value. 11% dividend yield means you earn ₱2,420/year on your 11,000 shares while waiting. 94% occupancy rate = stable income. Macro risk: high interest rates hurt REITs. Catalyst: BSP rate cut in H2 2026 = REIT rally. DCA zone ₱2.00–2.10. Stop-loss ₱1.90 (if it breaks below this, macro thesis is broken).',
    sources: [
      { name: 'Asia Securities Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart (TradingView)', url: 'https://www.tradingview.com/symbols/PSE-KEEPR/technicals/' },
    ]
  },
  FILRT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    summary: 'Ex-dividend date ~Mar 11. You get ₱420 cash. NAV discount = 28%.',
    entry: '₱2.90–3.00', target: '₱3.80–4.00', stop: '₱2.70',
    detail: 'Ex-dividend date ~March 11 — you already own 7,000 shares, so you will receive ₱0.06 × 7,000 = ₱420 cash dividend. NAV ₱4.21 vs price ₱3.02 = 28% discount to real estate value. 8.1% annual yield. Long-Term Buy rating from Asia Securities. If price dips to ₱2.90–3.00 range, consider adding.',
    sources: [
      { name: 'Asia Securities Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Disclosures', url: 'https://edge.pse.com.ph' },
    ]
  },
  GLO: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    summary: 'Cheap telecom with 6.36% dividend. Hold above 200-day MA.',
    entry: '₱1,700–1,720', target: '₱1,850–1,900', stop: '₱1,600',
    detail: 'Globe trades at P/E 11x vs global telecom average 21x — significantly undervalued. Dividend yield 6.36% (Fintel.io verified). Above the 200-day moving average = healthy long-term trend. EPS growing at 9.3%. High debt (D/E 2.1x) is normal for telecoms — infrastructure is capital-intensive. Add if pulls back to ₱1,700–1,720 range.',
    sources: [
      { name: 'Fundamentals (Fintel)', url: 'https://fintel.io/s/ph/glo' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-GLO/technicals/' },
    ]
  },
  DMC: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    summary: 'Cheap conglomerate with 9.7% dividend. Watch nickel commodity prices.',
    entry: '₱9.00–9.20', target: '₱11.81–14.89', stop: '₱8.50',
    detail: 'RSI 44.4 = neutral, not oversold yet. P/E 8x vs industry 12.2x = 35% discount to peers. Dividend yield 9.73% = exceptional. 4 out of 5 analysts rate BUY. Analyst price targets: ₱11.81 low, ₱14.89 high. Key risk: DMCI\'s nickel mining business is sensitive to global nickel prices — if nickel prices drop, so does DMC. Watch LME Nickel price as a leading indicator.',
    sources: [
      { name: 'HelloSafe PH', url: 'https://hellosafe.ph/investing/stock-market/stocks/dmc' },
      { name: 'Technicals', url: 'https://www.investing.com/equities/dmci-holdings-technical' },
    ]
  },
  MREIT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    summary: 'Ex-dividend ~Mar 20. NAV discount 28%. Megaworld expanding.',
    entry: '₱13.80–14.00', target: '₱17.50', stop: '₱13.00',
    detail: 'NAV ₱19.69 vs price ₱14.18 = 28% discount to Megaworld real estate portfolio. 7.2% dividend yield. Ex-date ~March 20 — hold through to collect dividend. Megaworld expanding to Iloilo and Davao CBDs = future rental income growth. BUY rating from Asia Securities. Target ₱17.50. Stop-loss ₱13.00.',
    sources: [
      { name: 'Asia Securities Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-MREIT/technicals/' },
    ]
  },
  RRHI: {
    badge: 'WAIT', badgeClass: 'badge-wait',
    summary: 'Mixed signals — 8 indicators say sell. Do not add until RSI drops under 40.',
    entry: '₱35.00–36.00', target: '₱43.00', stop: '₱34.00',
    detail: 'RSI 47 = neutral. MACD -0.284 = mild sell signal. Of 12 moving averages: 8 say Sell, only 4 say Buy. Same-store sales grew 5.65% (solid business) but technical momentum is weak. Sterling\'s rule: don\'t fight the technicals. Wait for RSI to drop below 40 (more oversold) before adding. If you see RSI < 40 + MACD cross up = that\'s your buy signal. Current stop-loss ₱34.00.',
    sources: [
      { name: 'Technicals (Investing.com)', url: 'https://www.investing.com/equities/robinsons-reta-technical' },
      { name: 'GuruFocus', url: 'https://www.gurufocus.com/stock/PHS:RRHI/summary' },
    ]
  },
};
```

### CSS for price trigger pills (add to style.css):
```css
/* Action Block — Buy/Sell Triggers */
.action-block { margin-top: 12px; border: 1px solid #1E2A3A; border-radius: 10px; overflow: hidden; }
.action-headline { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex-wrap: wrap; background: rgba(255,255,255,0.02); }
.action-badge { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.5px; white-space: nowrap; }
.badge-buy { background: rgba(0,212,160,0.2); color: #00D4A0; }
.badge-dca { background: rgba(255,215,0,0.2); color: #FFD700; }
.badge-hold { background: rgba(96,165,250,0.2); color: #60A5FA; }
.badge-wait { background: rgba(100,116,139,0.2); color: #94A3B8; }
.badge-sell { background: rgba(255,71,87,0.2); color: #FF4757; }
.action-summary { font-size: 12px; color: #CBD5E1; line-height: 1.4; flex: 1; }
.price-triggers { display: flex; gap: 6px; padding: 10px 12px; flex-wrap: wrap; border-top: 1px solid #1E2A3A; }
.trigger-pill { display: flex; flex-direction: column; align-items: center; padding: 8px 12px; border-radius: 8px; min-width: 80px; flex: 1; }
.trigger-pill.buy { background: rgba(0,212,160,0.08); border: 1px solid rgba(0,212,160,0.2); }
.trigger-pill.tp { background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.2); }
.trigger-pill.sl { background: rgba(255,71,87,0.08); border: 1px solid rgba(255,71,87,0.2); }
.trigger-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; margin-bottom: 3px; }
.trigger-pill.buy .trigger-label { color: #00D4A0; }
.trigger-pill.tp .trigger-label { color: #FFD700; }
.trigger-pill.sl .trigger-label { color: #FF4757; }
.trigger-price { font-size: 13px; font-weight: 800; font-family: monospace; }
.trigger-pill.buy .trigger-price { color: #00D4A0; }
.trigger-pill.tp .trigger-price { color: #FFD700; }
.trigger-pill.sl .trigger-price { color: #FF4757; }
.action-expand { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; cursor: pointer; border-top: 1px solid #1E2A3A; font-size: 12px; color: #64748B; }
.action-expand:hover { background: rgba(255,215,0,0.05); color: #FFD700; }
.action-expand .chevron { font-size: 10px; }
.action-detail { padding: 12px; border-top: 1px solid #1E2A3A; font-size: 12px; color: #94A3B8; line-height: 1.7; }
.action-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.action-src { font-size: 10px; color: #FFD700; background: rgba(255,215,0,0.1); padding: 2px 8px; border-radius: 4px; text-decoration: none; }

@media (max-width: 768px) {
  .price-triggers { gap: 4px; }
  .trigger-pill { padding: 6px 8px; min-width: 70px; }
  .trigger-price { font-size: 12px; }
}
```

### New `renderStockAction(symbol)` function:
```js
function renderStockAction(symbol) {
  const a = STOCK_ACTIONS[symbol];
  if (!a) return '';
  const sourceLinks = (a.sources || []).map(s =>
    `<a href="${s.url}" target="_blank" class="action-src">${s.name} ↗</a>`
  ).join('');
  return `
    <div class="action-block">
      <div class="action-headline">
        <span class="action-badge ${a.badgeClass}">${a.badge}</span>
        <span class="action-summary">${a.summary}</span>
      </div>
      <div class="price-triggers">
        <div class="trigger-pill buy">
          <span class="trigger-label">BUY IF drops to</span>
          <span class="trigger-price">${a.entry}</span>
        </div>
        <div class="trigger-pill tp">
          <span class="trigger-label">TAKE PROFIT</span>
          <span class="trigger-price">${a.target}</span>
        </div>
        <div class="trigger-pill sl">
          <span class="trigger-label">STOP LOSS</span>
          <span class="trigger-price">${a.stop}</span>
        </div>
      </div>
      <div class="action-expand" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
        <span>⚔️ Full rationale + sources</span><span class="chevron">▸</span>
      </div>
      <div class="action-detail" style="display:none">
        <div>${a.detail}</div>
        ${sourceLinks ? `<div class="action-sources">${sourceLinks}</div>` : ''}
      </div>
    </div>`;
}
```

---

## FIX 3 — Mentor Note on Every Page

Sterling is a mentor-broker. Every page must teach Carlo one thing relevant to what he's looking at.

### Add a `MENTOR_NOTES` object:
```js
const MENTOR_NOTES = {
  portfolio: {
    icon: '⚔️',
    title: "Today's Lesson: Unrealized Loss ≠ Real Loss",
    body: "A stock showing -10% in your portfolio hasn't actually cost you money yet — it's only a loss if you sell. If the fundamentals are intact (like KEEPR's 40% NAV discount), a red number is just a lower price tag on something still worth more. Sterling tracks both price AND value."
  },
  brief: {
    icon: '📋',
    title: "Today's Lesson: Why the Morning Brief Matters",
    body: "Professional traders review market setup before the open. You're doing the same. Knowing what happened overnight (US market, USD movement, PSEi futures) gives you 30 minutes to decide — before the crowd does."
  },
  watchlist: {
    icon: '🎯',
    title: "Today's Lesson: The Difference Between Watchlist and Portfolio",
    body: "Your portfolio = stocks you own. Your watchlist = stocks you're studying before you commit money. A good watchlist has an entry price and a reason. Sterling shows you both — entry price and why it's interesting."
  },
  alerts: {
    icon: '🔔',
    title: "Today's Lesson: Alerts = Your Decision Triggers",
    body: "You can't watch prices all day. Alerts act on your behalf. When Sterling fires an alert, it's saying 'the condition you cared about just happened.' An alert without an action plan is noise — Sterling includes the action."
  },
  news: {
    icon: '📰',
    title: "Today's Lesson: How to Read News as a Trader",
    body: "Not all news moves stocks equally. HIGH IMPACT = earnings, dividends, mergers, regulatory changes — can move price 5–20%. LOW IMPACT = analyst upgrades (already priced in), general market commentary. Sterling tags each article so you know what to act on."
  },
  dividends: {
    icon: '💰',
    title: "Today's Lesson: The Ex-Dividend Date",
    body: "You must OWN shares BEFORE the ex-date to receive the dividend. If FILRT's ex-date is March 11, you need to hold your shares on March 10. Sterling shows your estimated cash income so you can plan around it."
  },
  discovery: {
    icon: '🔍',
    title: "Today's Lesson: How to Screen Stocks",
    body: "Don't buy a stock because it looks cheap. Cheap stocks are cheap for a reason. Sterling screens by P/E ratio, dividend yield, and RSI together — a cheap P/E + high yield + RSI under 40 = potentially a good entry. That combination is what you're hunting."
  },
  gold: {
    icon: '🥇',
    title: "Today's Lesson: Gold vs Dollar (DXY)",
    body: "Gold (XAU/USD) and the US Dollar Index (DXY) move in OPPOSITE directions. When the dollar weakens (DXY drops), gold rises — and vice versa. Before every gold trade, check DXY. If DXY is falling, gold tailwind is in your favor."
  },
  learn: {
    icon: '📚',
    title: "Study Note",
    body: "The best investors spend more time studying than trading. Warren Buffett reads 500 pages per day. You don't need to — but 15 minutes here before you trade is the difference between investing and gambling."
  }
};
```

### Add `renderMentorNote(page)` function:
```js
function renderMentorNote(page) {
  const note = MENTOR_NOTES[page];
  if (!note) return '';
  return `
    <div class="mentor-note">
      <div class="mentor-header">
        <span class="mentor-icon">${note.icon}</span>
        <span class="mentor-title">${note.title}</span>
      </div>
      <p class="mentor-body">${note.body}</p>
    </div>`;
}
```

### Where to inject the mentor note:
At the TOP of each page's rendered HTML. In each render function, prepend `renderMentorNote('pagename')` to the page container's innerHTML.

For example in `renderPortfolio()`, before the holdings grid HTML, prepend:
```js
document.getElementById('page-portfolio').insertAdjacentHTML('afterbegin', renderMentorNote('portfolio'));
```

Do this for: portfolio, brief (renderBrief/renderBriefs), watchlist, alerts, news, dividends, discovery, gold (loadGoldPage), learn.

### CSS for mentor note (add to style.css):
```css
/* Mentor Note */
.mentor-note { background: linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(255,215,0,0.02) 100%); border: 1px solid rgba(255,215,0,0.2); border-left: 3px solid #FFD700; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
.mentor-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mentor-icon { font-size: 18px; }
.mentor-title { font-size: 13px; font-weight: 700; color: #FFD700; }
.mentor-body { font-size: 12px; color: #94A3B8; line-height: 1.7; margin: 0; }

@media (max-width: 768px) {
  .mentor-note { padding: 12px 14px; }
  .mentor-title { font-size: 12px; }
}
```

---

## Steps
1. Read full app.js
2. Fix news query (published_at)
3. Replace STOCK_ACTIONS + renderStockAction with new versions above
4. Add MENTOR_NOTES object + renderMentorNote() function
5. Inject mentor note into every page render
6. Read style.css, append .action-block and .mentor-note CSS
7. Push docs/app.js and docs/style.css
8. Notify Carlo: "Sterling updated: news loading, buy/sell/stop triggers on every stock, mentor note on every page. https://heylencer-debug.github.io/Sterling"

Use spawnSync for Telegram:
```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send', '--channel', 'telegram', '--target', '1424637649',
  '--message', 'Sterling updated ⚔️\n✅ News page loading\n✅ BUY / TAKE PROFIT / STOP LOSS prices on every stock card\n✅ Mentor lesson on every page\n\nhttps://heylencer-debug.github.io/Sterling'
]);
```
