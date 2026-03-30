# STERLING OHLCV — Real Market Data Task
> Agent: claude-opus-4-5 | Priority: CRITICAL
> Goal: Replace all simulated/point-in-time price data with real OHLCV from Yahoo Finance

---

## Problem

1. `sterling_price_history` stores point-in-time Phisix prices (just current price every 10min) — no OHLCV
2. `technicals-updater.js` calculates RSI/MACD from these point-in-time prices — NOT real daily candles — produces wrong signals
3. `fetchPSEIndex()` in `morning-brief.js` uses `6800 + Math.random() * 200` — fake PSEi
4. Dashboard charts fetch Yahoo Finance directly from browser — CORS-blocked on GitHub Pages
5. `analysis-data.js` has hardcoded static data from March 2, 2026 — goes stale

## Solution Architecture

```
Yahoo Finance (server-side)
       ↓
fetch-ohlcv.js (new) — runs daily 6AM + after market close 4PM
       ↓
Supabase: sterling_ohlcv (OHLCV per stock, per day)
       ↓
technicals-updater.js — reads from sterling_ohlcv, calculates real indicators
       ↓
Supabase: sterling_technicals (RSI, MACD, SMAs, support/resistance)
       ↓
app.js dashboard — reads sterling_ohlcv for charts, sterling_technicals for signals
(NO direct Yahoo Finance calls from browser — avoids CORS)
```

---

## Environment

Working dir: `C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\`
Push dir: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`
Push cmd: `node push-file.js docs/FILE docs/FILE` (from knightwatch dir)

Supabase URL: `https://fhfqjcvwcxizbioftvdw.supabase.co`
Supabase key: in `.env` as `SUPABASE_KEY`
Supabase service role: `YOUR_SUPABASE_SERVICE_KEY_HERE`

Portfolio symbols: MBT, KEEPR, FILRT, GLO, DMC, MREIT, RRHI
Yahoo Finance suffix: `.PS` (e.g., `MBT.PS`)
PSEi index: `^PSEi`

Yahoo Finance OHLCV URL:
`https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1d&range=1y`

Response structure:
```json
{
  "chart": {
    "result": [{
      "timestamp": [unix_seconds, ...],
      "indicators": {
        "quote": [{
          "open": [...],
          "high": [...],
          "low": [...],
          "close": [...],
          "volume": [...]
        }]
      }
    }]
  }
}
```

---

## Step 1 — Create `sterling_ohlcv` Supabase table

Run this SQL via Supabase REST API (Management API or direct):

```sql
CREATE TABLE IF NOT EXISTS sterling_ohlcv (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  source TEXT DEFAULT 'Yahoo Finance',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_date ON sterling_ohlcv(symbol, date DESC);

ALTER TABLE sterling_ohlcv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON sterling_ohlcv FOR SELECT USING (true);
CREATE POLICY "insert_all" ON sterling_ohlcv FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON sterling_ohlcv FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON sterling_ohlcv FOR DELETE USING (true);
```

Use the Supabase Management API to run the SQL:
POST `https://api.supabase.com/v1/projects/fhfqjcvwcxizbioftvdw/database/query`
Headers: `Authorization: Bearer YOUR_SUPABASE_MGMT_TOKEN_HERE`
Body: `{ "query": "<SQL>" }`

---

## Step 2 — Create `fetch-ohlcv.js`

File: `C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\fetch-ohlcv.js`

Requirements:
- Fetch 1 year of daily OHLCV from Yahoo Finance for ALL 7 portfolio symbols + `^PSEi` (PSEi index)
- For `^PSEi`, store with symbol `PSEi`
- Filter out rows where close is null (Yahoo sometimes has null on non-trading days)
- Upsert into `sterling_ohlcv` using `ON CONFLICT (symbol, date) DO UPDATE SET close=...`
  - Use Supabase `Prefer: resolution=merge-duplicates` header with POST
- Print progress per symbol: symbol, date range, row count inserted
- Add 500ms delay between symbols (rate limiting)
- On success: print summary + total rows upserted
- On error per symbol: log and continue (don't abort)

Yahoo Finance fetch (Node.js https, no npm packages):
```js
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
// Add headers:
// 'User-Agent': 'Mozilla/5.0'
// 'Accept': 'application/json'
```

Parse response:
```js
const result = json.chart.result[0];
const timestamps = result.timestamp;
const { open, high, low, close, volume } = result.indicators.quote[0];
// Convert unix timestamps to date string: new Date(ts * 1000).toISOString().split('T')[0]
// Filter: skip rows where close[i] === null
```

Upsert to Supabase:
```js
// Batch by 100 rows, use POST with Prefer: resolution=merge-duplicates
const rows = timestamps.map((ts, i) => ({
  symbol: storageSymbol, // 'PSEi' for '^PSEi', else symbol
  date: new Date(ts * 1000).toISOString().split('T')[0],
  open: open[i],
  high: high[i],
  low: low[i],
  close: close[i],
  volume: volume[i] || 0,
  source: 'Yahoo Finance'
})).filter(r => r.close !== null);
```

---

## Step 3 — Update `technicals-updater.js`

Change `fetchOurHistory()` to read from `sterling_ohlcv` instead of `sterling_price_history`:

```js
// OLD: reads sterling_price_history, returns array of prices (inaccurate)
// NEW: reads sterling_ohlcv, returns array of close prices (real daily OHLCV)

async function fetchOHLCV(symbol) {
  // GET /rest/v1/sterling_ohlcv?symbol=eq.{symbol}&order=date.asc&limit=300&select=date,open,high,low,close,volume
  // Returns array of {date, open, high, low, close, volume}
  // Return full OHLCV objects (not just close) so we can calculate support/resistance from highs/lows
}
```

Also update support/resistance calculation:
```js
// Calculate real support/resistance from OHLCV highs/lows (last 60 days)
// Support1 = lowest low of last 20 days
// Support2 = lowest low of last 60 days
// Resistance1 = highest high of last 20 days
// Resistance2 = highest high of last 60 days
// Remove dependency on analysis-data.js seed for these values
```

Remove the seed data fallback for support/resistance — use real OHLCV data.
Keep the seed data fallback ONLY for fundamentals (P/E, NAV, yield, analyst targets) since those don't come from price data.

---

## Step 4 — Fix `morning-brief.js` PSEi

Find `fetchPSEIndex()` function. Replace the `Math.random()` simulation with a real Supabase query:

```js
async function fetchPSEIndex() {
  // Read latest PSEi close from sterling_ohlcv where symbol='PSEi'
  // GET /rest/v1/sterling_ohlcv?symbol=eq.PSEi&order=date.desc&limit=2&select=date,close
  // Return { value: latest.close, change: ((latest.close - prev.close) / prev.close) * 100, date: latest.date, source: 'Yahoo Finance' }
  // If no data: return { value: null, change: null, error: 'No PSEi data — run fetch-ohlcv.js first' }
}
```

---

## Step 5 — Update `app.js` dashboard charts

Current: `app.js` fetches Yahoo Finance directly from browser (CORS-blocked on GitHub Pages)
Fix: read from Supabase `sterling_ohlcv` instead

In `app.js`, find the chart rendering functions. Change data source:

```js
// OLD (broken on GitHub Pages):
// fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.PS?interval=1d&range=3mo`)

// NEW (reads from Supabase, no CORS):
async function fetchOHLCV(symbol) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const since = cutoff.toISOString().split('T')[0];
  const data = await window.sbFetch(
    `sterling_ohlcv?symbol=eq.${symbol}&date=gte.${since}&order=date.asc&select=date,open,high,low,close,volume`
  );
  return data || [];
}
```

Then use the returned OHLCV to render Lightweight Charts candlestick series:
```js
// CandlestickSeries for portfolio cards (instead of line series)
const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a', downColor: '#ef5350',
  borderDownColor: '#ef5350', borderUpColor: '#26a69a',
  wickDownColor: '#ef5350', wickUpColor: '#26a69a'
});
candleSeries.setData(ohlcv.map(d => ({
  time: d.date,
  open: d.open,
  high: d.high,
  low: d.low,
  close: d.close
})));
```

Keep the line chart fallback if OHLCV returns empty.

---

## Step 6 — Run initial OHLCV fetch

After building `fetch-ohlcv.js`, run it:
```
cd "C:\Users\Carl Rebadomia\.openclaw\workspace\sterling"
node fetch-ohlcv.js
```

Confirm:
- All 7 portfolio symbols fetched successfully
- PSEi fetched
- Rows in Supabase (at least 200+ per symbol for 1 year)

Then run `technicals-updater.js` to recalculate with real data:
```
node technicals-updater.js
```

---

## Step 7 — Push `app.js` to GitHub

```
cd "C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch"
node push-file.js docs/app.js docs/app.js
```

---

## Completion Checklist

- [ ] `sterling_ohlcv` table created in Supabase
- [ ] `fetch-ohlcv.js` written and tested — 8 symbols (7 + PSEi) fetched successfully
- [ ] `technicals-updater.js` updated to use `sterling_ohlcv` OHLCV data
- [ ] Support/resistance now calculated from real OHLCV highs/lows
- [ ] `morning-brief.js` PSEi fixed (no more Math.random)
- [ ] `app.js` charts read from Supabase (not Yahoo Finance direct)
- [ ] Candlestick charts rendering in app.js (not just line charts)
- [ ] Initial OHLCV fetch run successfully
- [ ] Technicals updated with real data
- [ ] `app.js` pushed to GitHub
- [ ] Telegram notify Carlo: "Sterling OHLCV live — real Yahoo Finance data, real candles, real TA. Charts now read from Supabase (no CORS). PSEi no longer simulated."

## Telegram Notify (on success)

Use openclaw CLI to notify:
```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send',
  '--channel', 'telegram',
  '--target', '1424637649',
  '--message', '⚔️ Sterling OHLCV live — Real Yahoo Finance daily candles for all 7 PSE holdings + PSEi index. Charts now read from Supabase (no CORS issues). Technicals recalculated from real data. Candlestick charts enabled.'
], { stdio: 'inherit' });
```
