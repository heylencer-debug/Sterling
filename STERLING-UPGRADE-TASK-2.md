# Sterling Dashboard Upgrade — Continuation Task

## Context
Previous agent (grand-kelp) was SIGKILL'd. Files already saved:
- `docs/gold.js` ✅ (live XAU/USD price + positions + broker cards)
- `docs/index.html` ✅ (Gold nav + Trade Log button + modal added)

## Still needs to be done:
1. Update `docs/app.js` — add trade submit logic + gold nav handler + Learn tab TradingView charts + pattern detection + Study Portfolio
2. Update `docs/style.css` — gold page + trade log + chart styles + glossary tooltip styles
3. Create inline glossary system (NEW — see below)
4. Push all changed files via push-file.js
5. Send Telegram notification when done

## Working Directory
`C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`

## Push Method
Use `push-file.js` in this directory. Usage: `node push-file.js <localFilePath> <githubPath>`
Example: `node push-file.js docs/app.js docs/app.js`
GitHub repo: `heylencer-debug/Sterling`

## Supabase Config
- URL: `https://fhfqjcvwcxizbioftvdw.supabase.co`
- Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZnFqY3Z3Y3hpemJpb2Z0dmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTcxMzgsImV4cCI6MjA4NzkzMzEzOH0.g8K40DjhvxE7u4JdHICqKc1dMxS4eZdMhfA11M8ZMBc`

## TASK 1: app.js — Trade Submit Logic + Gold Nav

Read the existing `docs/app.js` first to understand the structure.

Add to `app.js`:

### Gold Page Handler
In the nav click handler (wherever `portfolio`, `watchlist`, etc. are handled), add case for `gold`:
```js
case 'gold':
  loadScript('gold.js', () => { if(window.initGold) window.initGold(); });
  break;
```

### Trade Log Modal Submit
Find the trade log form submit handler (or add it if not present).
On submit:
- Read: assetType, symbol, action, price, quantity, date, notes from form
- If assetType === 'PSE Stock':
  - Fetch existing row from `sterling_portfolio` where symbol matches
  - If exists: recalculate average price + update qty
  - If new: insert row
  - Show toast: "Trade logged ✓"
- If assetType === 'Gold (XAU/USD)':
  - Insert to `sterling_gold_trades` table
  - Show toast: "Gold trade logged ✓"
- Close modal after success

Use `window.sbFetch` for all Supabase calls (defined in `data/sb.js`).
For inserts: POST to `${SUPABASE_URL}/rest/v1/table_name` with proper headers.

## TASK 2: Learn Tab — TradingView Charts + Pattern Detection

In the Learn tab render function (look for `case 'learn':` or `renderLearn()` or similar):

### 2a. Replace pattern cards with TradingView Lightweight Charts

Add CDN at top of Learn section render (only load once):
```js
loadScript('https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js', () => {
  renderPatternCharts();
});
```

`renderPatternCharts()` — for each of 6 patterns, create a div with a chart:

Chart config (same for all):
```js
const chartOptions = {
  layout: { background: { color: '#0d1117' }, textColor: '#FFD700' },
  grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
  width: container.offsetWidth || 300,
  height: 200,
  timeScale: { visible: false }
};
```

OHLC data and descriptions for each pattern:

**Hammer** — `{ name: 'Hammer', emoji: '🔨', description: 'A long lower shadow after a downtrend. Means buyers pushed back hard — possible reversal up.' }`
Data: 6 candles declining, last = `{ time:'2024-01-06', open:92, high:93, low:86, close:92.5 }`

**Doji** — `{ name: 'Doji', emoji: '➕', description: 'Open and close almost equal. Means the market is undecided — watch for what happens next.' }`
Last candle: `{ open:90, high:95, low:85, close:90.1 }`

**Bullish Engulfing** — `{ name: 'Bullish Engulfing', emoji: '📈', description: 'A big green candle completely covers the previous red candle. Strong signal that buyers are taking over.' }`
Candle 5 (red): `{ open:95, high:96, low:91, close:92 }`, Candle 6 (green): `{ open:91, high:98, low:90, close:97 }`

**Higher Highs** — `{ name: 'Higher Highs / Higher Lows', emoji: '⬆️', description: 'Each high and low is higher than the last. This IS an uptrend. Follow the trend, don\'t fight it.' }`
8 candles, each progressively higher (open+2, high+2, low+2, close+2 per step starting from 85)

**Golden Cross** — `{ name: 'Golden Cross', emoji: '✨', description: 'The 50-day moving average crosses ABOVE the 200-day MA. One of the strongest buy signals in investing.' }`
Show two line series instead of candles: 50MA starts below 200MA, crosses at step 7 of 12 data points.

**Death Cross** — `{ name: 'Death Cross', emoji: '💀', description: 'The 50-day MA crosses BELOW the 200-day MA. Strong warning that a downtrend may be starting.' }`
Opposite of golden cross.

For Golden/Death Cross, use `createLineSeries` with colors:
- 50MA: `#FFD700` (gold)
- 200MA: `#FF6B6B` (coral/red)

### 2b. Pattern Alert Section — Carlo's Portfolio

After the pattern charts section, add:

```html
<div class="section-header">🎯 Pattern Alerts — Your Portfolio</div>
<div id="pattern-alerts-grid"></div>
```

Fetch last 20 rows from `sterling_price_history` ordered by `recorded_at ASC`.
Group by symbol.

For each of Carlo's 7 stocks (MBT, KEEPR, FILRT, GLO, DMC, MREIT, RRHI):
Get that symbol's price data. Run detection:

```js
function detectPattern(candles) {
  if (candles.length < 3) return 'Watching...';
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  
  // Higher Highs uptrend
  if (last.price > prev.price && prev.price > prev2.price) return '⬆️ Uptrend — Higher Highs';
  // Downtrend
  if (last.price < prev.price && prev.price < prev2.price) return '⬇️ Downtrend — Lower Lows';
  // Consolidating
  const range = Math.abs(last.price - prev.price) / prev.price;
  if (range < 0.005) return '➕ Consolidating — watch for breakout';
  return '👀 No clear pattern yet';
}
```

For each stock card show:
- Symbol badge + company name
- Current price (from portfolio data)
- Pattern badge (colored: green for uptrend, red for downtrend, gray for watching)
- TradingView link: `https://www.tradingview.com/chart/?symbol=PSE:${symbol}` — "View Live Chart →"

### 2c. Study My Portfolio Section

After pattern alerts, add:

```html
<div class="section-header">📚 Study My Portfolio</div>
<p class="section-desc">Live charts for each of your holdings. Click the teaching note to learn what to look for.</p>
<div id="portfolio-study-grid"></div>
```

For each of 7 stocks, render a TradingView widget container:
```html
<div class="study-card">
  <div class="study-header">
    <span class="study-symbol">PSE:MBT</span>
    <span class="study-company">Metrobank</span>
  </div>
  <div class="tradingview-widget-container" id="tv-MBT" style="height:350px;"></div>
  <details class="teach-note">
    <summary>📖 What to look for</summary>
    <p>RSI indicator above 70 = overbought (might drop soon). Below 30 = oversold (possible buy opportunity). MBT's RSI is currently 66.8 — approaching overbought. Watch for a pullback before adding more.</p>
  </details>
</div>
```

Teaching notes per stock:
- MBT: "RSI 66.8 — approaching overbought zone (70). All 12 moving averages = Strong Buy. 13 analysts have ₱91 average target. You're up +10.5% — hold, don't sell yet. Upside to ₱86–₱97.50."
- KEEPR: "Down -11% but the real asset value (NAV) is ₱3.80 vs price of ₱2.30. That's a 40% discount. The market is pricing it cheap due to high interest rates — but it still pays 11% dividends. DCA opportunity if it drops to ₱2.00–₱2.10."
- FILRT: "28% discount to NAV (₱4.21 real value vs ₱3.02 price). Ex-dividend date ~March 11 — you'll receive ₱420 in dividends (7,000 shares × ₱0.06). Dividend stocks = buy and hold, not trade."
- GLO: "Globe Telecom. Defensive stock — moves less than the market. P/E of 11x is fair for telecom. Watch the 200-day moving average (the slow line) — as long as price is above it, the long-term trend is healthy."
- DMC: "DMCI Holdings. Construction/mining conglomerate. RSI 44.4 — neutral zone. Strong dividend yield 9.73%. Waiting for infrastructure news catalyst. Watch for a break above ₱10 resistance."
- MREIT: "Megaworld REIT. 28% discount to NAV (₱19.69). Ex-dividend ~March 20. 7.2% yield. The chart shows a sideways pattern — accumulation phase before a potential move up."
- RRHI: "Robinsons Retail. Mixed signals — 8 of 12 MAs say Sell, 4 say Buy. MACD is negative. This one needs a catalyst (earnings beat, expansion news) before the trend turns. Monitor, don't add yet."

Load TradingView widget script once:
```html
<script src="https://s3.tradingview.com/tv.js"></script>
```

Then for each stock create widget:
```js
new TradingView.widget({
  container_id: `tv-${symbol}`,
  symbol: `PSE:${symbol}`,
  interval: 'D',
  theme: 'dark',
  style: '1',
  locale: 'en',
  toolbar_bg: '#0A0E1A',
  enable_publishing: false,
  hide_top_toolbar: false,
  save_image: false,
  height: 350,
  width: '100%',
  studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies']
});
```

Use IntersectionObserver so widgets only load when scrolled into view (performance).

## TASK 3: Inline Glossary Tooltips (NEW — HIGH PRIORITY)

Carlo's request: "Every time a trading term appears anywhere in the dashboard, show a small tooltip explaining it right there — not just in the Learn page."

### Implementation:

Add to `docs/app.js` a global `GLOSSARY` object:
```js
const GLOSSARY = {
  'RSI': 'RSI (Relative Strength Index) — measures momentum from 0-100. Above 70 = overbought (may drop). Below 30 = oversold (may bounce). Above 50 = bullish momentum.',
  'MACD': 'MACD — tracks trend changes. When MACD line crosses above signal line = buy signal. When it crosses below = sell signal.',
  'P/E': 'P/E Ratio — how expensive a stock is vs its earnings. Lower P/E = cheaper. Example: MBT P/E 6.86x vs sector average 11x means MBT is undervalued.',
  'NAV': 'NAV (Net Asset Value) — for REITs, this is the true value of all properties owned. If stock price < NAV, you\'re buying at a discount.',
  'EPS': 'EPS (Earnings Per Share) — company profit divided by number of shares. Rising EPS = growing business.',
  'DCA': 'DCA (Dollar-Cost Averaging) — buying more shares at a lower price to reduce your average cost. Best for stocks with solid fundamentals that temporarily dropped.',
  'REIT': 'REIT (Real Estate Investment Trust) — a company that owns properties and pays 90%+ of profits as dividends. Like owning real estate without buying a building.',
  'Dividend': 'Dividend — cash payment from a company to shareholders, usually quarterly. Ex-dividend date = last day to own shares to receive payment.',
  'Support': 'Support Level — a price where buyers consistently step in. Like a floor. If price drops to support and holds, it often bounces back up.',
  'Resistance': 'Resistance Level — a price where sellers consistently appear. Like a ceiling. If price can break above resistance, it often continues higher.',
  'Moving Average': 'Moving Average (MA) — the average price over N days. 50-day MA = short-term trend. 200-day MA = long-term trend. Price above both = healthy uptrend.',
  'Bullish': 'Bullish — expecting the price to go UP. "MBT is bullish" = analysts expect MBT price to rise.',
  'Bearish': 'Bearish — expecting the price to go DOWN. "Market is bearish" = investors expect prices to fall.',
  'Stop-loss': 'Stop-loss — a pre-set price where you sell to limit losses. Example: "Stop-loss at ₱1.90 for KEEPR" means if it drops to ₱1.90, sell to protect your capital.',
  'Volume': 'Volume — number of shares traded in a day. High volume + price rise = strong move. High volume + price drop = panic selling.',
  'Market Cap': 'Market Cap — total value of a company (price × total shares). Large cap = stable, blue chip. Small cap = higher risk, higher potential.',
  'Blue Chip': 'Blue Chip — large, established, financially stable companies. In PSE: BDO, SM, Metrobank, Globe, Ayala are blue chips.',
  'Yield': 'Dividend Yield — annual dividend divided by share price. 11% yield = for every ₱100 invested, you receive ₱11/year in dividends.',
  'ex-date': 'Ex-Dividend Date — you must OWN shares BEFORE this date to receive the upcoming dividend payment.',
  'PSEi': 'PSEi (Philippine Stock Exchange Index) — tracks the top 30 companies on the PSE. When PSEi rises, most stocks tend to rise. It\'s the "temperature" of the Philippine market.'
};
```

Add a `window.applyGlossary(container)` function:
```js
window.applyGlossary = function(container) {
  const el = container || document.body;
  Object.keys(GLOSSARY).forEach(term => {
    // Find all text nodes containing the term (not already in a tooltip)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement.classList.contains('glossary-term')) return;
      if (node.parentElement.tagName === 'SCRIPT') return;
      const regex = new RegExp(`\\b${term}\\b`, 'g');
      if (regex.test(node.textContent)) {
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(
          new RegExp(`\\b${term}\\b`, 'g'),
          `<span class="glossary-term" data-term="${term}">${term}</span>`
        );
        node.parentElement.replaceChild(span, node);
      }
    });
  });
  
  // Attach tooltip behavior
  el.querySelectorAll('.glossary-term').forEach(el => {
    el.addEventListener('mouseenter', showGlossaryTooltip);
    el.addEventListener('touchstart', showGlossaryTooltip);
    el.addEventListener('mouseleave', hideGlossaryTooltip);
  });
};

function showGlossaryTooltip(e) {
  const term = e.currentTarget.dataset.term;
  let tip = document.getElementById('glossary-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'glossary-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = GLOSSARY[term];
  tip.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  tip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  tip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
}

function hideGlossaryTooltip() {
  const tip = document.getElementById('glossary-tooltip');
  if (tip) tip.style.display = 'none';
}
```

Call `window.applyGlossary()` after every tab renders (add to boot and after each `lazyLoadTab` completes).

## TASK 4: style.css Updates

Add to `docs/style.css`:

```css
/* Glossary tooltips */
.glossary-term {
  border-bottom: 1px dashed #FFD700;
  cursor: help;
  color: inherit;
}
#glossary-tooltip {
  display: none;
  position: absolute;
  background: #1a2035;
  color: #e0e0e0;
  border: 1px solid #FFD700;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  max-width: 300px;
  z-index: 9999;
  line-height: 1.5;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

/* Gold page */
.gold-ticker { background: #1a2035; border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; gap: 24px; align-items: center; }
.gold-price { font-size: 32px; font-weight: 700; color: #FFD700; font-family: monospace; }
.gold-change.pos { color: #00C97A; }
.gold-change.neg { color: #FF6B6B; }
.broker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 20px; }
.broker-card { background: #1a2035; border-radius: 12px; padding: 16px; border: 1px solid #2a3050; }
.broker-card h3 { color: #FFD700; margin: 0 0 8px; }
.broker-badge { display: inline-block; background: #FFD700; color: #0A0E1A; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 700; margin-bottom: 8px; }

/* Trade log modal */
.trade-log-btn { position: fixed; bottom: 24px; right: 24px; background: #FFD700; color: #0A0E1A; border: none; border-radius: 50px; padding: 14px 20px; font-weight: 700; cursor: pointer; z-index: 1000; font-size: 15px; box-shadow: 0 4px 20px rgba(255,215,0,0.4); }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1001; align-items: center; justify-content: center; }
.modal-overlay.active { display: flex; }
.modal-box { background: #0d1117; border: 1px solid #FFD700; border-radius: 16px; padding: 24px; width: 90%; max-width: 400px; }
.modal-box h3 { color: #FFD700; margin: 0 0 16px; }
.modal-box select, .modal-box input, .modal-box textarea { width: 100%; background: #1a2035; border: 1px solid #2a3050; color: #fff; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 14px; box-sizing: border-box; }
.modal-box button.submit { width: 100%; background: #FFD700; color: #0A0E1A; border: none; border-radius: 8px; padding: 12px; font-weight: 700; cursor: pointer; font-size: 15px; }
.toast { position: fixed; bottom: 80px; right: 24px; background: #00C97A; color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 600; z-index: 2000; display: none; }

/* Pattern charts */
.pattern-charts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-bottom: 32px; }
.pattern-card { background: #0d1117; border-radius: 12px; padding: 16px; border: 1px solid #1a2035; }
.pattern-card h4 { color: #FFD700; margin: 0 0 8px; font-size: 14px; }
.pattern-chart-container { width: 100%; height: 200px; }
.pattern-desc { color: #aaa; font-size: 12px; margin-top: 10px; line-height: 1.5; }

/* Pattern alerts */
.pattern-alert-card { background: #0d1117; border-radius: 12px; padding: 16px; border: 1px solid #1a2035; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.pattern-badge.up { background: #00C97A22; color: #00C97A; border: 1px solid #00C97A44; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
.pattern-badge.down { background: #FF6B6B22; color: #FF6B6B; border: 1px solid #FF6B6B44; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
.pattern-badge.neutral { background: #FFD70022; color: #FFD700; border: 1px solid #FFD70044; padding: 4px 10px; border-radius: 6px; font-size: 12px; }

/* Study portfolio */
.study-card { background: #0d1117; border-radius: 12px; padding: 16px; border: 1px solid #1a2035; margin-bottom: 20px; }
.study-header { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.study-symbol { color: #FFD700; font-weight: 700; font-size: 16px; font-family: monospace; }
.study-company { color: #aaa; font-size: 13px; }
.teach-note { margin-top: 12px; }
.teach-note summary { color: #FFD700; cursor: pointer; font-size: 13px; padding: 4px 0; }
.teach-note p { color: #ccc; font-size: 13px; line-height: 1.6; margin: 8px 0 0; background: #1a2035; padding: 12px; border-radius: 8px; }
```

## TASK 5: Push Everything + Notify

After all files are updated, run:
```
node push-file.js docs/app.js docs/app.js
node push-file.js docs/style.css docs/style.css
```

(index.html and gold.js were already pushed by the previous agent — confirm by checking if they exist in the repo, if not push them too)

Then notify:
```js
node -e "const {spawnSync}=require('child_process');spawnSync(process.execPath,['C:\\\\Users\\\\Carl Rebadomia\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\openclaw\\\\openclaw.mjs','message','send','--channel','telegram','--target','1424637649','--message','Sterling upgrade complete ✅\\n\\nWhat\\'s new:\\n• ⚡ Gold Tab — live XAU/USD price, broker recommendations (XM, Exness, IC Markets, OANDA)\\n• 📝 Trade Log button — log PSE + gold trades from any page, updates portfolio instantly\\n• 📊 Learn page — TradingView candlestick charts for every pattern (Hammer, Doji, Engulfing, Golden Cross, Death Cross)\\n• 🎯 Pattern Alerts — scans your 7 stocks for patterns in real data\\n• 📚 Study My Portfolio — live TradingView charts for all 7 holdings with teaching notes\\n• 📖 Inline Glossary — tap any trading term (RSI, MACD, NAV, DCA...) anywhere in the dashboard for instant plain-English explanation\\n\\nCheck it: https://heylencer-debug.github.io/Sterling'],{stdio:\\'inherit\\'})"
```
