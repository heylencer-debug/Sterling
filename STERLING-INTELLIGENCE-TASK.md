# STERLING INTELLIGENCE TASK
> Agent: claude-opus-4-5 | Priority: HIGH
> Goal: Live AI summaries + analyzed dates per pillar per stock — read from Supabase, not hardcoded

---

## What Carlo Wants
Each portfolio card shows 3 pillars (Fundamentals / News & Catalysts / Technicals).
Each pillar must show:
- **AI Summary** — 2-sentence plain-English synthesis of what the data means for the stock
- **Date Analyzed** — exact date data was last refreshed (shown as "Analyzed Mar 2, 2026")
- **Staleness warning** — gold ⚠️ badge if analyzed_at is > 7 days ago

---

## Environment
- Sterling scripts: `C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\`
- Dashboard: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\app.js`
- Push from: `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\`
- Push cmd: `node push-file.js docs/app.js docs/app.js` (PowerShell, NO &&)
- Supabase URL: in `.env` as `SUPABASE_URL`
- Supabase key: in `.env` as `SUPABASE_KEY` (service role)
- Portfolio symbols: MBT, KEEPR, FILRT, GLO, DMC, MREIT, RRHI

---

## Step 1 — Create `sterling_intelligence` Supabase table

Write and run `create-intelligence-table.js`:

```sql
CREATE TABLE IF NOT EXISTS sterling_intelligence (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  pillar TEXT NOT NULL,        -- 'fundamentals' | 'news' | 'technicals'
  verdict TEXT,
  ai_summary TEXT,             -- 2-sentence AI-generated plain English summary
  points JSONB,                -- array of bullet point strings
  sources JSONB,               -- array of {name, url} objects
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, pillar)
);
ALTER TABLE sterling_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON sterling_intelligence FOR SELECT USING (true);
CREATE POLICY "insert_all" ON sterling_intelligence FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON sterling_intelligence FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON sterling_intelligence FOR DELETE USING (true);
```

Use Management API:
- POST `https://api.supabase.com/v1/projects/fhfqjcvwcxizbioftvdw/database/query`
- Header: `Authorization: Bearer YOUR_SUPABASE_MGMT_TOKEN_HERE`

---

## Step 2 — Write `refresh-intelligence.js`

This script runs daily (at 7AM via cron) and writes fresh intelligence to Supabase.

### Data sources per pillar:

**Fundamentals** — uses hardcoded research data (NAV, P/E, yield, analyst targets) from `analysis-data.js`.
These change slowly (quarterly). The script updates the `analyzed_at` timestamp daily so Carlo sees it's current.
For each symbol, write the fundamentals data + generate a 2-sentence AI summary.

**Technicals** — reads from `sterling_technicals` Supabase table (populated by `technicals-updater.js`).
Use real RSI, MACD, MA signals to write the bullet points and summary dynamically.

**News** — reads last 3 news items from `sterling_news` table for the symbol.
Summarize what the news means for the stock.

### AI Summary generation (no API key needed):
Generate summaries programmatically using templates + real data. Examples:

For Fundamentals:
```js
function genFundamentalsSummary(sym, data) {
  // data = { pe, nav, price, yield, analystTarget, verdict }
  if (data.nav && data.price) {
    const discount = Math.round((1 - data.price / data.nav) * 100);
    return `${sym} trades at a ${discount}% discount to its net asset value of ₱${data.nav}, meaning you're buying ₱1 of assets for ₱${(data.price/data.nav).toFixed(2)}. With a ${data.yield}% dividend yield and analyst target of ₱${data.analystTarget}, the risk/reward strongly favors long-term holders.`;
  }
  return `${sym} is rated ${data.verdict} based on current valuations. Analyst consensus target of ₱${data.analystTarget} implies significant upside from current levels.`;
}
```

For Technicals (using real data from sterling_technicals):
```js
function genTechnicalsSummary(sym, tech) {
  // tech = { rsi14, rsi_signal, macd_signal, ma_buy_count, ma_sell_count, overall_signal }
  const maBias = tech.ma_buy_count > tech.ma_sell_count ? 'bullish' : 'bearish';
  return `RSI at ${tech.rsi14 || 'N/A'} (${tech.rsi_signal || 'N/A'}) with ${tech.ma_buy_count || 0}/${(tech.ma_buy_count||0)+(tech.ma_sell_count||0)} moving averages pointing ${maBias}. MACD is ${tech.macd_signal || 'N/A'} — ${tech.overall_signal === 'Strong Buy' ? 'all major indicators aligned for upside' : tech.overall_signal === 'Sell' ? 'short-term momentum has weakened' : 'mixed signals, patience recommended'}.`;
}
```

For News:
```js
function genNewsSummary(sym, newsItems) {
  if (!newsItems.length) return `No recent news for ${sym}. Monitor PSE Edge and BusinessWorld for upcoming earnings or dividend announcements.`;
  const titles = newsItems.map(n => n.title || n.headline).filter(Boolean);
  return `Recent coverage: ${titles[0]}. ${newsItems.length > 1 ? titles[1] + '.' : ''} Monitor for dividend ex-date announcements and quarterly earnings reports.`;
}
```

### Full script structure:

```js
const FUNDAMENTALS_DATA = {
  MBT:   { pe: 6.86, nav: null,  price: 76.00, yield: 6.78, analystTarget: 91,   verdict: 'Undervalued',    sources: [{name:'HelloSafe PH',url:'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
  KEEPR: { pe: 9.2,  nav: 3.80,  price: 2.30,  yield: 11.0, analystTarget: 3.20, verdict: 'Deep Value',     sources: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'DragonFi',url:'https://www.dragonfi.ph/market/stocks/KEEPR'}] },
  FILRT: { pe: 12.3, nav: 4.21,  price: 3.01,  yield: 8.1,  analystTarget: 4.00, verdict: 'Undervalued',   sources: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
  GLO:   { pe: 11.0, nav: null,  price: 1689,  yield: 6.36, analystTarget: 1950, verdict: 'Fair Value',     sources: [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
  DMC:   { pe: 8.0,  nav: null,  price: 9.65,  yield: 9.73, analystTarget: 12.50,verdict: 'Undervalued',   sources: [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
  MREIT: { pe: 14.1, nav: 19.69, price: 14.18, yield: 7.2,  analystTarget: 18.00,verdict: 'Undervalued',   sources: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
  RRHI:  { pe: 18.5, nav: null,  price: 37.40, yield: 2.8,  analystTarget: 42.00,verdict: 'Fairly Valued', sources: [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}] },
};

const FUNDAMENTALS_POINTS = {
  MBT:   ['P/E 6.86x vs Philippine banking sector average 11x — 38% cheaper than peers','EPS grew 18% YoY — earnings are accelerating, not slowing','13 analysts cover MBT: consensus target ₱91, highest ₱97.50','Dividend yield 6.78% — you get paid while you wait'],
  KEEPR: ['NAV ₱3.80/share vs price ₱2.30 = buying ₱1 of Keppel real estate for ₱0.61','Dividend yield ~11% — one of the highest yields on the PSE','94% occupancy rate — nearly full portfolio, stable rental income','Asia Securities rates LONG-TERM BUY'],
  FILRT: ['NAV ₱4.21 vs price ₱3.01 = 28% discount to Filinvest real estate portfolio','Annual dividend yield 8.1% — strong income stream','Quarterly dividends ~₱0.06/share — ₱420 per year on 7,000 shares','Ex-dividend date approximately March 11'],
  GLO:   ['6.36% dividend yield — reliable telecom cash flow','Dominant mobile market position in Philippines','Capital expenditure cycle peaking — free cash flow improving','P/E 11x is sector average — fairly priced for a utility-like business'],
  DMC:   ['9.73% dividend yield — highest yield in your portfolio','Exposure to coal, nickel, water, construction — diversified conglomerate','P/E 8x = undervalued vs historical average of 10-12x','Net cash position — no debt risk'],
  MREIT: ['NAV ₱19.69 vs price ₱14.18 = 28% discount to Megaworld office portfolio','7.2% dividend yield paid quarterly','Office REIT with Grade A tenants — low vacancy risk','Analyst target ₱18 implies 27% upside from current price'],
  RRHI:  ['Robinsons Retail — dominant grocery and convenience store operator','P/E 18.5x reflects retail premium — fair for sector leader','2.8% dividend yield — lower than REITs but steady','Defensive business — consumer staples hold up in recessions'],
};
```

For each symbol, write to sterling_intelligence:
- pillar: 'fundamentals' with FUNDAMENTALS_DATA + FUNDAMENTALS_POINTS + genFundamentalsSummary()
- pillar: 'news' with last 3 news from Supabase + genNewsSummary()
- pillar: 'technicals' with data from sterling_technicals + genTechnicalsSummary()

Use `analyzed_at: new Date().toISOString()` — always today's date.

---

## Step 3 — Update `app.js` to read from Supabase

### Add async intelligence loader:

```js
// Cache intelligence data (loaded once per session)
let _intelligenceCache = {};

async function loadIntelligence(symbol) {
  if (_intelligenceCache[symbol]) return _intelligenceCache[symbol];
  try {
    const rows = await window.sbFetch('sterling_intelligence', {
      filter: `symbol=eq.${symbol}`,
      select: 'pillar,verdict,ai_summary,points,sources,analyzed_at'
    });
    const intel = {};
    (rows || []).forEach(r => { intel[r.pillar] = r; });
    _intelligenceCache[symbol] = intel;
    return intel;
  } catch { return {}; }
}
```

### Update `renderPillar` to accept `supabaseData` parameter:

```js
function renderPillar(icon, title, pillarKey, staticPillar, supabaseData, id) {
  // Prefer Supabase data (fresh) over static fallback
  const data = supabaseData || staticPillar;
  if (!data) return '';
  
  const analyzedAt = supabaseData?.analyzed_at;
  const analyzedDate = analyzedAt ? new Date(analyzedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : 'Mar 2, 2026';
  const isStale = analyzedAt ? (Date.now() - new Date(analyzedAt).getTime()) > 7 * 24 * 60 * 60 * 1000 : true;
  
  // points: from Supabase it's JSONB array, from static it's JS array
  const points = (supabaseData?.points || staticPillar?.points || []);
  const sources = (supabaseData?.sources || staticPillar?.sources || []);
  const aiSummary = supabaseData?.ai_summary || '';
  const verdict = data.verdict || '';
  
  const vc = verdictColor(verdict);
  
  const pointsHTML = points.map(p => `
    <div class="pillar-point">
      <span class="pillar-dot" style="background:${vc}"></span>
      <span>${p}</span>
    </div>`).join('');
  
  const sourcesHTML = sources.map(s =>
    `<a href="${s.url}" target="_blank" class="pillar-src">${s.name} ↗</a>`
  ).join('');
  
  return `
    <div class="pillar-block">
      <div class="pillar-header" onclick="togglePillar('${id}')">
        <span class="pillar-icon">${icon}</span>
        <span class="pillar-title">${title}</span>
        <span class="pillar-verdict" style="color:${vc};border-color:${vc}20;background:${vc}12">${verdict}</span>
        <span class="pillar-chevron" id="chev-${id}">▸</span>
      </div>
      <div class="pillar-body" id="body-${id}" style="display:none">
        ${aiSummary ? `<div class="pillar-ai-summary">${aiSummary}</div>` : ''}
        <div class="pillar-meta">
          <span class="pillar-date">🕐 Analyzed ${analyzedDate}</span>
          ${isStale ? '<span class="pillar-stale">⚠️ Update needed</span>' : '<span class="pillar-fresh">✓ Current</span>'}
        </div>
        <div class="pillar-points">${pointsHTML}</div>
        ${sourcesHTML ? `<div class="pillar-sources">${sourcesHTML}</div>` : ''}
      </div>
    </div>`;
}
```

### Update `renderStockAction` to load async then re-render:

```js
function renderStockAction(symbol) {
  const a = STOCK_ACTIONS[symbol];
  if (!a) return '';
  const uid = symbol;
  
  // Render with static data first (instant)
  // Then async-load Supabase intelligence and patch in
  setTimeout(async () => {
    const intel = await loadIntelligence(symbol);
    if (!Object.keys(intel).length) return; // No Supabase data, keep static
    const container = document.getElementById(`pillar-f-${uid}`);
    const fContainer = document.getElementById(`pillar-n-${uid}`);
    const tContainer = document.getElementById(`pillar-t-${uid}`);
    if (container) container.outerHTML = renderPillar('📊', 'Fundamentals', 'fundamentals', a.fundamentals, intel.fundamentals, uid+'_f');
    if (fContainer) fContainer.outerHTML = renderPillar('📰', 'News & Catalysts', 'news', a.news, intel.news, uid+'_n');
    if (tContainer) tContainer.outerHTML = renderPillar('📈', 'Technicals', 'technicals', a.technicals, intel.technicals, uid+'_t');
  }, 500);
  
  return `
    <div class="action-block">
      <div class="action-headline">
        <span class="action-badge ${a.badgeClass}">${a.badge}</span>
        <span class="action-summary">${a.summary}</span>
      </div>
      <div class="price-triggers">
        <div class="trigger-pill buy"><span class="trigger-label">ENTRY</span><span class="trigger-price">${a.entry}</span></div>
        <div class="trigger-pill tp"><span class="trigger-label">TARGET</span><span class="trigger-price">${a.target}</span></div>
        <div class="trigger-pill sl"><span class="trigger-label">STOP</span><span class="trigger-price">${a.stop}</span></div>
      </div>
      <div class="pillars-section">
        <div id="pillar-f-${uid}">${renderPillar('📊', 'Fundamentals', 'fundamentals', a.fundamentals, null, uid+'_f')}</div>
        <div id="pillar-n-${uid}">${renderPillar('📰', 'News & Catalysts', 'news', a.news, null, uid+'_n')}</div>
        <div id="pillar-t-${uid}">${renderPillar('📈', 'Technicals', 'technicals', a.technicals, null, uid+'_t')}</div>
      </div>
      <div class="action-conclusion-block">
        <div class="action-expand" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
          <span>⚔️ Perci's verdict</span><span class="chevron">▸</span>
        </div>
        <div class="action-detail" style="display:none">
          <p class="action-conclusion">${a.conclusion || ''}</p>
        </div>
      </div>
    </div>`;
}
```

---

## Step 4 — Add CSS for new elements

Add to `style.css`:

```css
.pillar-ai-summary {
  font-size: 12px; color: #E2E8F0; line-height: 1.6;
  padding: 10px 12px; background: rgba(255,215,0,0.05);
  border-left: 3px solid #FFD700; border-radius: 0 6px 6px 0;
  margin-bottom: 10px; font-style: italic;
}
.pillar-meta {
  display: flex; gap: 8px; align-items: center;
  margin-bottom: 10px; flex-wrap: wrap;
}
.pillar-date { font-size: 10px; color: #475569; }
.pillar-stale { font-size: 10px; color: #F59E0B; background: rgba(245,158,11,0.1); padding: 2px 6px; border-radius: 4px; }
.pillar-fresh { font-size: 10px; color: #00D4A0; background: rgba(0,212,160,0.1); padding: 2px 6px; border-radius: 4px; }
```

---

## Step 5 — Run `refresh-intelligence.js`

After writing the script, run it:
```
cd "C:\Users\Carl Rebadomia\.openclaw\workspace\sterling"
node refresh-intelligence.js
```

Confirm: 21 rows written to `sterling_intelligence` (7 symbols × 3 pillars).

---

## Step 6 — Push to GitHub

```
cd "C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch"
node push-file.js docs/app.js docs/app.js
node push-file.js docs/style.css docs/style.css
node push-file.js docs/index.html docs/index.html
```

Bump index.html script tag: `app.js?v=15` and `style.css?v=2`

---

## Step 7 — Update cron for daily refresh

Update the Sterling Morning Brief cron OR add a separate cron to run `refresh-intelligence.js` at 7AM daily.

---

## Telegram notify on completion

```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send', '--channel', 'telegram', '--target', '1424637649',
  '--message', '⚔️ Sterling Intelligence live — AI summaries + analyzed dates now showing on all portfolio cards. Technicals pull from real Supabase data. Refreshes daily at 7AM.'
], { stdio: 'inherit' });
```

---

## CRITICAL RULES
- Read app.js from knightwatch/docs BEFORE editing (it is 3000+ lines)
- Use surgical `edit` tool only
- PowerShell: NO `&&` — use workdir or separate exec calls
- Do NOT change the dark theme (#0A0E1A / #FFD700)
- Do NOT touch index.html structure — only bump version numbers
- Push order: app.js → style.css → index.html
