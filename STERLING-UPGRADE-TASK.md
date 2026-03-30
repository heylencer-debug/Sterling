# Sterling Dashboard Upgrade Task

## Working Directory
`C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`

## Push Method
Use `push-file.js` in this directory. Never use `git push` — it hangs.
Usage: `node push-file.js <localFilePath> <githubPath>`
Example: `node push-file.js docs/app.js docs/app.js`

GitHub repo: `heylencer-debug/Sterling`
GitHub Pages URL: `https://heylencer-debug.github.io/Sterling`

## Supabase Config
- URL: `https://fhfqjcvwcxizbioftvdw.supabase.co`
- Anon key: `YOUR_SUPABASE_ANON_KEY_HERE`
- Service role key: `YOUR_SUPABASE_SERVICE_KEY_HERE`
- Tables: `sterling_portfolio`, `sterling_watchlist`, `sterling_price_history`, `sterling_alerts`, `sterling_news`, `sterling_briefs`

## Sterling Portfolio Holdings
DMC (2000 shares), FILRT (7000), GLO (10), KEEPR (11000), MBT (1100), MREIT (1000), RRHI (500)

## UPGRADE 1: Gold Trading Tab + Trade Log Form

### Goal
Add gold day trading support alongside PSE stocks in one dashboard.

### 1a. New "Gold" page in Sterling dashboard
Add a new nav item "Gold" (⚡ icon) in `docs/index.html` nav sidebar.
Create `docs/gold.js` with these sections:

**Gold Price Ticker (top of page)**
- Fetch live XAU/USD from: `https://api.gold-api.com/price/XAU` (free, no key)
- If that fails, fallback to: `https://open.er-api.com/v6/latest/XAU` — multiply by USD/PHP rate
- Also fetch USD/PHP rate from: `https://api.exchangerate-api.com/v4/latest/USD`
- Show: XAU/USD price + XAU/PHP equivalent + % change from previous close
- Refresh every 60 seconds

**Gold Positions Table**
- Fetch from new Supabase table `sterling_gold_trades` (create via fetch POST to Supabase Management API or just use existing insert pattern)
- Columns: id, date, direction (BUY/SELL), entry_price, exit_price, lot_size, profit_usd, profit_php, status (OPEN/CLOSED), notes
- Show P&L per trade in USD and PHP
- Show total running P&L

**Platform Recommendations Section**
Static HTML cards for 4 brokers:
1. XM — Beginner-friendly, free demo, MT4/MT5, GCash deposits
2. Exness — Most popular PH, tight spreads, instant withdrawal
3. IC Markets — Professional, tightest spreads globally
4. OANDA — No minimum, trusted, API available
Each card: logo placeholder + name + pros + link to official site + "Best for: [type]" badge

### 1b. Trade Log Form (works for BOTH stocks and gold)
Add a floating "Log Trade" button (bottom right, gold colored, ⚡ icon) to ALL pages in `docs/index.html`.
When clicked, show a modal form:

Fields:
- Asset Type: dropdown [PSE Stock | Gold (XAU/USD)]
- Symbol/Instrument: text input (e.g. MBT, XAU/USD)
- Action: dropdown [BUY | SELL]
- Price: number input
- Quantity/Lots: number input
- Date: date picker (default today)
- Notes: textarea (optional)
- [Submit Trade] button

On submit:
- If PSE Stock: upsert to `sterling_portfolio` (update quantity and avg_buy_price if existing, or insert new)
- If Gold: insert to `sterling_gold_trades`
- Show success toast: "Trade logged ✓"
- Close modal

Create `sterling_gold_trades` table via Supabase REST if it doesn't exist:
```
POST https://fhfqjcvwcxizbioftvdw.supabase.co/rest/v1/sterling_gold_trades
Headers: apikey + Authorization with service role key
Body: insert a seed row to force table creation, then delete it
```
Actually — just insert via the anon key with a real first trade (seed row):
```json
{ "date": "2026-03-02", "direction": "BUY", "entry_price": 2850.00, "lot_size": 0.01, "profit_usd": 0, "profit_php": 0, "status": "OPEN", "notes": "Seed row - delete when first real trade logged" }
```

## UPGRADE 2: Learn Page Visual Overhaul

### Goal
Replace text-only pattern cards with live TradingView charts + real pattern detection on Carlo's portfolio.

### 2a. TradingView Chart Widgets
In `docs/learn.js` (or `docs/app.js` — wherever the Learn tab renders), replace static pattern cards with embedded TradingView widgets.

Use TradingView Lightweight Charts (free, no API key, CDN):
```html
<script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script>
```

For each chart pattern (Hammer, Doji, Engulfing, Higher Highs, Golden Cross, Death Cross):
1. Show a labeled candlestick chart with synthetic/example OHLC data that visually demonstrates the pattern
2. Below the chart: plain-language explanation (1-2 sentences, Carlo-level: beginner)
3. "What it means for your portfolio" note

**Synthetic OHLC data per pattern:**

Hammer (6 candles, last candle is the hammer):
```js
[
  { time: '2024-01-01', open: 100, high: 102, low: 98, close: 101 },
  { time: '2024-01-02', open: 101, high: 103, low: 97, close: 99 },
  { time: '2024-01-03', open: 99, high: 100, low: 95, close: 97 },
  { time: '2024-01-04', open: 97, high: 98, low: 93, close: 95 },
  { time: '2024-01-05', open: 95, high: 96, low: 91, close: 93 },
  { time: '2024-01-06', open: 92, high: 93, low: 86, close: 92.5 } // hammer: long lower wick
]
```

Doji (6 candles, last is doji — open ≈ close):
Last candle: `{ open: 90, high: 95, low: 85, close: 90.1 }`

Bullish Engulfing (6 candles, last 2 show engulfing):
Candle 5 (bearish): `{ open: 95, high: 96, low: 91, close: 92 }`
Candle 6 (bullish engulfing): `{ open: 91, high: 98, low: 90, close: 97 }`

Higher Highs / Higher Lows (uptrend — 8 candles progressively higher):
Each candle's high and low are higher than the previous.

Golden Cross (show two lines — 50MA crossing above 200MA):
Use `createLineSeries` for both MA lines. 50MA crosses above 200MA at the 7th data point.

Death Cross (opposite — 50MA crosses below 200MA at 7th point):
Same pattern reversed.

Chart styling for all:
- Background: `#0A0E1A` (Sterling dark theme)
- Text color: `#FFD700`
- Grid lines: `#1a2035`
- Up color: `#00C97A`, Down color: `#FF6B6B`
- Chart height: 200px
- No time scale labels needed (these are example charts)

### 2b. Pattern Detection on Carlo's Portfolio
Add a new section to the Learn tab: **"Pattern Alerts — Your Portfolio"**

For each of Carlo's 7 stocks (MBT, KEEPR, FILRT, GLO, DMC, MREIT, RRHI):
1. Fetch last 20 price_history rows from `sterling_price_history` ordered by recorded_at
2. Run simple pattern detection logic:

**Hammer detection**: Last candle's (close - low) / (high - low) > 0.6 AND close > open AND (high - close) < (close - low) * 0.3
**Doji detection**: abs(open - close) / (high - low) < 0.1
**Bullish engulfing**: prev candle bearish (close < open) AND current candle bullish (close > open) AND current.open < prev.close AND current.close > prev.open
**Higher Highs**: last 3 highs are each higher than the previous
**Downtrend**: last 3 closes are each lower than the previous

For now, since price_history only has limited rows, use the existing data we have.
If a pattern is detected: show a colored badge `🔨 Hammer forming on DMC — possible reversal`
If no pattern: show `No pattern detected — watching`

Each stock row shows:
- Stock symbol + company name
- Current price (from `sterling_portfolio` price column)  
- Pattern badge
- Link: `View Chart →` that opens `https://www.tradingview.com/chart/?symbol=PSE:DMC` (etc.) in new tab

### 2c. "Study My Portfolio" Section
Add a third section to Learn tab: **"Study My Portfolio"**

For each of Carlo's 7 stocks, render a TradingView Widget embed (the full interactive chart):
```html
<div class="tradingview-widget-container">
  <div id="tv-chart-MBT"></div>
</div>
<script>
new TradingViewWidget({
  container_id: "tv-chart-MBT",
  symbol: "PSE:MBT",
  interval: "D",
  theme: "dark",
  style: "1",
  locale: "en",
  toolbar_bg: "#0A0E1A",
  enable_publishing: false,
  hide_top_toolbar: false,
  save_image: false,
  height: 350,
  width: "100%"
});
</script>
```
Use the TradingView widget script: `https://s3.tradingview.com/tv.js`
Each chart is lazy-loaded only when user scrolls to it (use IntersectionObserver).

Label each chart with the stock name + a teaching note:
- MBT: "📊 MBT — Watch the RSI (top indicator). Above 70 = overbought, below 30 = oversold."
- KEEPR: "📊 KEEPR — This is trading at a 40% discount to its real asset value (NAV). Watch for a reversal."
- FILRT: "📊 FILRT — Dividend stock. Focus on the trend line, not short-term dips."
- GLO: "📊 GLO — Telecom. Stable dividend payer. Check if price stays above its 200-day moving average."
- DMC: "📊 DMC — Construction conglomerate. Cyclical stock — moves with infrastructure spending news."
- MREIT: "📊 MREIT — REIT trading below NAV. Long-term hold for quarterly dividends."
- RRHI: "📊 RRHI — Retail. Mixed signals right now. Watch the MACD histogram for direction."

## Implementation Order
1. Create `sterling_gold_trades` table (seed row insert)
2. Build `docs/gold.js` with live XAU/USD price + positions table + broker cards
3. Add Gold nav item to `docs/index.html`
4. Add Trade Log floating button + modal to `docs/index.html`
5. Add trade submit logic in `docs/app.js` or new `docs/trade-log.js`
6. Update Learn tab in `docs/app.js` — replace pattern cards with TradingView candlestick charts
7. Add Pattern Alert section (portfolio pattern detection)
8. Add Study My Portfolio section (TradingView embeds)
9. Push ALL changed files via `push-file.js`

## Push All Files After Building
Run these pushes:
```
node push-file.js docs/index.html docs/index.html
node push-file.js docs/app.js docs/app.js
node push-file.js docs/gold.js docs/gold.js
```
And any other new .js files created.

## Notify When Done
When completely finished, run:
node -e "const {spawnSync}=require('child_process');spawnSync(process.execPath,['C:\\\\Users\\\\Carl Rebadomia\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\openclaw\\\\openclaw.mjs','message','send','--channel','telegram','--target','1424637649','--message','Sterling upgrade complete ✅ Gold tab live, Trade Log form live, Learn page now has TradingView charts + pattern detection on your 7 stocks. Check: https://heylencer-debug.github.io/Sterling'],{stdio:'inherit'})"
