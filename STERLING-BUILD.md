# STERLING — PSE Stock Broker Agent Build Task
# Agent for Carlo Rebadomia | Platform: DragonFi | Style: Long-term + Dividends

Workspace: C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\

---

## WHO STERLING IS
Sterling is Carlo's personal PSE stock broker agent.
Professional, sharp, data-driven. No hype. No noise.
Speaks like a seasoned broker — direct, clear, actionable.

---

## CARLO'S CURRENT PORTFOLIO (DragonFi)
| Symbol | Name | Qty | Buy Price (approx) | Current | P&L |
|--------|------|-----|--------------------|---------|-----|
| DMC | DMCI Holdings | 2,000 | ~10.07 | 9.65 | -4.16% |
| FILRT | FilRealty REIT | 7,000 | ~3.16 | 3.02 | -4.27% |
| GLO | Globe Telecom | 10 | ~1,657 | 1,740.00 | +4.73% |
| KEEPR | Keppel Phil Properties REIT | 11,000 | ~2.60 | 2.32 | -10.92% |
| MBT | Metrobank | 1,100 | ~69.70 | 77.00 | +10.54% |
| MREIT | Megaworld REIT | 1,000 | ~14.20 | 14.24 | +0.30% |
| RRHI | Robinsons Retail Holdings | 500 | ~36.38 | 38.15 | +1.99% |
Total portfolio: ~₱200,079.58

---

## SUPABASE CONFIG
URL: https://fhfqjcvwcxizbioftvdw.supabase.co
Key (server-side): YOUR_SUPABASE_SERVICE_KEY_HERE
Management token: YOUR_SUPABASE_MGMT_TOKEN_HERE
Management API: https://api.supabase.com/v1/projects/fhfqjcvwcxizbioftvdw/database/query

OpenClaw notify: openclaw system event --text "Sterling: [message]"
Carlo Telegram ID: 1424637649
Gateway: http://127.0.0.1:18789
Gateway token: YOUR_OPENCLAW_TOKEN_HERE

---

## DATA SOURCES TO USE

### 1. Phisix API (free, no key) — live PSE prices
GET http://phisix-api3.appspot.com/stocks/{SYMBOL}.json
Returns: name, price.amount, price.currency, percent_change, volume, as_of
Example: http://phisix-api3.appspot.com/stocks/MBT.json

### 2. PSE Edge — official disclosures
Base: https://edge.pse.com.ph
Disclosure search: https://edge.pse.com.ph/companyDisclosures/search.do?cmpy_id={id}
Use APIFY actor: apify/web-scraper or fetch directly

### 3. News — BusinessWorld, Inquirer Business, Manila Bulletin Business
Scrape via APIFY: apify/web-scraper
Or use web fetch for headlines containing stock symbols

### 4. APIFY key: stored in C:\Users\Carl Rebadomia\.openclaw\workspace\ethel\.env
Read it from there.

---

## TASK 1: Create Supabase tables

Via Management API, create these tables:

### Table: sterling_portfolio
```sql
CREATE TABLE IF NOT EXISTS sterling_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  company_name TEXT,
  qty INTEGER,
  avg_buy_price DECIMAL(10,4),
  current_price DECIMAL(10,4),
  unrealized_pl DECIMAL(12,2),
  unrealized_pl_pct DECIMAL(6,2),
  sector TEXT,
  is_reit BOOLEAN DEFAULT false,
  dividend_yield DECIMAL(6,2),
  next_ex_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: sterling_watchlist
```sql
CREATE TABLE IF NOT EXISTS sterling_watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  company_name TEXT,
  current_price DECIMAL(10,4),
  target_buy_price DECIMAL(10,4),
  stop_loss DECIMAL(10,4),
  reason TEXT,
  sector TEXT,
  pe_ratio DECIMAL(8,2),
  dividend_yield DECIMAL(6,2),
  analyst_target DECIMAL(10,4),
  technical_signal TEXT,
  fundamental_score INTEGER,
  recommendation TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: sterling_price_history
```sql
CREATE TABLE IF NOT EXISTS sterling_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  price DECIMAL(10,4),
  volume BIGINT,
  percent_change DECIMAL(6,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON sterling_price_history(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_time ON sterling_price_history(recorded_at DESC);
```

### Table: sterling_alerts
```sql
CREATE TABLE IF NOT EXISTS sterling_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT,
  alert_type TEXT, -- 'price_drop', 'price_target', 'news', 'dividend', 'pattern', 'buy_signal'
  message TEXT,
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'urgent'
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: sterling_news
```sql
CREATE TABLE IF NOT EXISTS sterling_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT,
  headline TEXT,
  source TEXT,
  url TEXT,
  summary TEXT,
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  impact TEXT, -- 'high', 'medium', 'low'
  published_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TASK 2: Seed portfolio table

Insert Carlo's 7 holdings into sterling_portfolio:
```js
const portfolio = [
  { symbol: 'DMC', company_name: 'DMCI Holdings Inc', qty: 2000, avg_buy_price: 10.07, sector: 'Holding/Mining', is_reit: false, dividend_yield: 8.5 },
  { symbol: 'FILRT', company_name: 'FilRealty REIT Corp', qty: 7000, avg_buy_price: 3.16, sector: 'REIT', is_reit: true, dividend_yield: 7.8 },
  { symbol: 'GLO', company_name: 'Globe Telecom Inc', qty: 10, avg_buy_price: 1657, sector: 'Telecoms', is_reit: false, dividend_yield: 3.6 },
  { symbol: 'KEEPR', company_name: 'Keppel Philippines Properties REIT', qty: 11000, avg_buy_price: 2.60, sector: 'REIT', is_reit: true, dividend_yield: 11.0 },
  { symbol: 'MBT', company_name: 'Metropolitan Bank & Trust Co', qty: 1100, avg_buy_price: 69.70, sector: 'Banking', is_reit: false, dividend_yield: 2.5 },
  { symbol: 'MREIT', company_name: 'Megaworld REIT Inc', qty: 1000, avg_buy_price: 14.20, sector: 'REIT', is_reit: true, dividend_yield: 6.5 },
  { symbol: 'RRHI', company_name: 'Robinsons Retail Holdings Inc', qty: 500, avg_buy_price: 36.38, sector: 'Retail', is_reit: false, dividend_yield: 3.6 }
];
```

---

## TASK 3: Build sterling/fetch-prices.js

Script that:
1. Reads portfolio symbols from Supabase sterling_portfolio
2. Fetches live price for each from Phisix API: http://phisix-api3.appspot.com/stocks/{SYMBOL}.json
3. Calculates unrealized P&L: (current_price - avg_buy_price) * qty
4. Updates sterling_portfolio with current_price, unrealized_pl, unrealized_pl_pct, updated_at
5. Inserts a row to sterling_price_history for each symbol
6. Returns a portfolio summary object

Use https module (not fetch — Node.js). Add 500ms delay between API calls.

---

## TASK 4: Build sterling/fetch-news.js

Script that:
1. For each symbol in portfolio + watchlist, search for news
2. Use web fetch on these URLs (scrape headlines):
   - https://www.bworldonline.com/?s={COMPANY_NAME}
   - https://business.inquirer.net/?s={SYMBOL}
   - https://edge.pse.com.ph (disclosures)
3. Also fetch PSE market news: https://www.pse.com.ph/market-information/market-summary
4. For each headline found:
   - Determine which symbol it relates to
   - Score sentiment: positive/negative/neutral (keyword matching)
   - Score impact: high/medium/low
5. Insert new headlines to sterling_news table (skip duplicates by url)
6. If any news is high-impact + negative → create an alert in sterling_alerts

---

## TASK 5: Build sterling/discover-stocks.js

This is the STOCK DISCOVERY engine — finds new stocks for Carlo's watchlist.

Discovery criteria (Carlo's profile: long-term + dividends):
- PSE-listed stocks
- Dividend yield > 4%
- PE ratio < 20 (reasonably valued)
- Strong fundamentals: positive EPS growth, low debt
- Technical signal: near support level or recent breakout

Discovery sources:
1. Fetch PSE Dividend Yield Index from: https://documents.pse.com.ph (QDR reports)
2. Scrape Investagrams top picks: https://www.investagrams.com/Stock/
3. Cross-reference with sector rotation (favored sectors: banking, telecoms, REIT, consumer)

For each discovered stock, generate:
```js
{
  symbol: 'BDO',
  company_name: 'BDO Unibank',
  current_price: 145.00,
  target_buy_price: 138.00,  // suggested entry
  stop_loss: 128.00,          // suggested stop
  reason: 'Strong 2024 earnings, PE 9.2x vs banking sector avg 11x, dividend yield 3.8%, near 52-week support at 135',
  sector: 'Banking',
  pe_ratio: 9.2,
  dividend_yield: 3.8,
  technical_signal: 'Near support, RSI oversold at 32',
  fundamental_score: 82,       // out of 100
  recommendation: 'BUY on dip — target entry ₱138-142'
}
```

Upsert discovered stocks to sterling_watchlist table.
Focus on 5-10 high-quality picks per run.

Good watchlist candidates to research: BDO, BPI, TEL, AC, SM, JFC, ALI, ACEN, RLC, AREIT

---

## TASK 6: Build sterling/morning-brief.js

Generates the daily morning brief report. Called by cron at 7AM Manila.

Report format (send via openclaw to Telegram):
```
⚔️ STERLING — Morning Brief
📅 [Date] | PSEi: [index value]

📊 YOUR PORTFOLIO
[For each holding]:
• [SYMBOL] ₱[price] ([+/-]% today) | Total P&L: [+/-]₱ ([%])
  [If any news]: 📰 [headline]

🔴 NEEDS ATTENTION
[Any holding down >2% today or with negative news]

🟢 WATCH TODAY
[Any holding with positive catalyst or near sell target]

📰 MARKET NEWS
[3-5 top headlines affecting portfolio]

💡 STERLING'S CALL
[1-2 sentence market outlook for the day]

🎯 WATCHLIST ALERTS
[Any watchlist stock hitting buy zone today]
```

Steps:
1. Run fetch-prices.js to get fresh prices
2. Run fetch-news.js to get overnight news
3. Fetch PSEi index from Phisix: http://phisix-api3.appspot.com/stocks.json
4. Compose the brief
5. Send via Telegram: POST http://127.0.0.1:18789/api/message with { channel: 'telegram', to: '1424637649', message: brief }
   Headers: { 'Authorization': 'Bearer YOUR_OPENCLAW_TOKEN_HERE', 'Content-Type': 'application/json' }
6. Log to agent_activity in Supabase

---

## TASK 7: Build sterling/eod-report.js

End-of-day report (3:30 PM Manila). Same structure as morning brief but focused on:
- Day's final P&L for each holding
- Volume analysis (unusual volume = potential move coming)
- Pattern notes (e.g. "MBT formed a hammer candle — bullish reversal signal")
- Tomorrow's watchpoints
- Any ex-dividend dates in next 7 days

---

## TASK 8: Build sterling/weekly-digest.js

Monday 8AM digest. Deeper fundamentals:
- PE ratio, EPS, ROE, dividend yield for each holding (fetch from web)
- Compare each stock's PE vs sector average
- Upcoming earnings dates (next 30 days)
- Analyst target prices (scrape from Investagrams or COL Financial website)
- REIT-specific: distributable income trend, occupancy rate updates
- Portfolio health score (0-100)
- Top 3 recommendations for the week

---

## TASK 9: Create sterling/STERLING-IDENTITY.md vault file

Write this file at C:\SirPercival-Vault\07_ai-systems\STERLING-IDENTITY.md:

```markdown
# Sterling — PSE Stock Broker Agent
> Carlo's personal Philippine stock market advisor.

## Persona
Professional, sharp, data-driven. Speaks like a seasoned broker.
No hype. No noise. Direct, clear, actionable.
Treats Carlo's money like it's his own.

## Expertise
- PSE fundamentals (PE, EPS, ROE, debt ratios)
- REIT analysis (distributable income, yield spread vs bonds)
- Technical patterns (support/resistance, RSI, MACD, volume)
- Dividend investing strategy
- Long-term portfolio building

## Carlo's Portfolio
See: C:\SirPercival-Vault\04_trading\portfolio.md

## Data Sources
- Phisix API: live PSE prices
- PSE Edge: official disclosures
- BusinessWorld / Inquirer: news
- Investagrams: technical charts
- PSE QDR reports: dividend data

## Rules
1. Always explain WHY before recommending BUY/SELL
2. Always include risk (stop-loss) with every buy recommendation
3. Flag high-impact news immediately — don't wait for next scheduled report
4. For REITs: always mention interest rate sensitivity
5. Never recommend more than 10% of portfolio in one stock
6. Long-term mindset: don't panic on short-term dips unless fundamentals change
```

Also create: C:\SirPercival-Vault\04_trading\portfolio.md
With Carlo's current holdings, buy prices, P&L, and notes.

---

## TASK 10: Create sterling/.env

Write to sterling/.env:
```
APIFY_API_KEY=YOUR_APIFY_API_KEY_HERE
SUPABASE_URL=https://fhfqjcvwcxizbioftvdw.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_SERVICE_KEY_HERE
OPENCLAW_GATEWAY=http://127.0.0.1:18789
OPENCLAW_TOKEN=YOUR_OPENCLAW_TOKEN_HERE
TELEGRAM_CHAT_ID=1424637649
```

---

## TASK 11: Run a test morning brief

After building everything, run:
node sterling/morning-brief.js

This should:
1. Fetch live prices for all 7 stocks
2. Generate the brief
3. Send it to Carlo on Telegram

---

## DELIVERABLES CHECKLIST
- [ ] sterling/ directory created
- [ ] sterling/.env created
- [ ] 5 Supabase tables created
- [ ] sterling_portfolio seeded with 7 holdings
- [ ] sterling/fetch-prices.js
- [ ] sterling/fetch-news.js
- [ ] sterling/discover-stocks.js
- [ ] sterling/morning-brief.js
- [ ] sterling/eod-report.js
- [ ] sterling/weekly-digest.js
- [ ] C:\SirPercival-Vault\07_ai-systems\STERLING-IDENTITY.md
- [ ] C:\SirPercival-Vault\04_trading\portfolio.md
- [ ] Test morning brief sent to Telegram

## RULES
- Use https module throughout (not node-fetch)
- All Supabase writes use the secret key server-side
- Send Telegram messages via OpenClaw gateway (not Telegram API directly)
- Handle API failures gracefully — always send SOMETHING to Telegram even if some data fails
- Log all agent activity to Supabase agent_activity table

When completely done, run:
openclaw system event --text "Sterling built: PSE broker agent ready. Portfolio seeded. Morning brief sent. Crons pending."
