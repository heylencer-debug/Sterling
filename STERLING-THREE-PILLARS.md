# Sterling — Three-Pillar Intelligence System
> Every insight on every page must be backed by Fundamentals + News + Technicals with sources.
> This is the most important architectural change to Sterling.

## Files: knightwatch/docs/app.js + style.css
## Push: node push-file.js docs/FILE docs/FILE
## PAT: YOUR_GITHUB_PAT_HERE
## Notify Carlo via Telegram 1424637649 when done

---

## THE CORE PRINCIPLE

Sterling must reason from 3 pillars for every stock, every page, every recommendation:

**FUNDAMENTALS** — Is the business cheap or expensive?
- P/E vs sector average, NAV vs price, dividend yield, EPS growth, analyst targets
- Sources: HelloSafe PH, Asia Securities PDF, Fintel.io, GuruFocus

**NEWS / CATALYSTS** — What's happening that could move the price?
- Earnings, dividends, macro events (BSP rate decisions), sector news
- Sources: BusinessWorld, Inquirer, PSE Edge disclosures, sterling_news table

**TECHNICALS** — What is the price action saying right now?
- RSI (overbought/oversold), MACD (momentum direction), Moving Averages (trend), chart patterns
- Sources: Investing.com, TradingView

**THEREFORE (conclusion)** — What should Carlo do and when?
- Action + price trigger + reasoning + what would change the thesis

---

## STEP 1 — Create STOCK_INTELLIGENCE object

Replace or augment STOCK_ACTIONS with a full intelligence profile per stock.
This is the single source of truth used by ALL pages.

```js
const STOCK_INTELLIGENCE = {
  MBT: {
    // Signal
    badge: 'ADD ON DIP', badgeClass: 'badge-buy',
    entry: '₱73–74', target: '₱86–97', stop: '₱69',
    summary: 'Strong bank at 38% discount to peers. All technicals bullish.',

    // Three Pillars
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 6.86x vs Philippine banking sector average 11x = 38% cheaper than peers',
        'EPS grew 18% YoY — earnings are accelerating, not slowing',
        '13 analysts cover MBT: consensus target ₱91, highest target ₱97.50',
        'Dividend yield 6.78% — you get paid while you wait',
      ],
      sources: [
        { name: 'HelloSafe PH analyst targets', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company' },
        { name: 'PSE Edge disclosures', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573' },
      ]
    },
    news: {
      verdict: 'Positive',
      points: [
        'Q4 2025 net income rose 18% YoY on loan growth and net interest margin expansion',
        'Consumer and SME loan book expanding — supports continued earnings growth',
        'No negative news or regulatory concerns flagged on PSE Edge',
      ],
      sources: [
        { name: 'BusinessWorld Q4 earnings', url: 'https://bworldonline.com' },
        { name: 'PSE Edge', url: 'https://edge.pse.com.ph' },
      ]
    },
    technicals: {
      verdict: 'Bullish',
      points: [
        'RSI 66.8 — strong momentum, NOT yet overbought (overbought = above 70)',
        'All 12 moving averages signal BUY — short, medium, and long-term trend all pointing up',
        'Price above 200-day MA = confirmed long-term uptrend',
        'MACD positive = buying momentum stronger than selling pressure',
      ],
      sources: [
        { name: 'Investing.com MBT technicals', url: 'https://www.investing.com/equities/metropolitan-b-technical' },
        { name: 'TradingView PSE:MBT', url: 'https://www.tradingview.com/symbols/PSE-MBT/technicals/' },
      ]
    },
    conclusion: 'All three pillars align: business is growing (fundamentals), news is positive, and all technical indicators are bullish. The only reason to wait: RSI at 66.8 is not cheap technically. Best entry is on a dip to ₱73–74 (closer to 50-day MA). Stop-loss at ₱69 — if it breaks that level, momentum has shifted.',
  },

  KEEPR: {
    badge: 'DCA ZONE', badgeClass: 'badge-dca',
    entry: '₱2.00–2.10', target: '₱2.80–3.20', stop: '₱1.90',
    summary: 'Real estate worth ₱3.80/share selling for ₱2.30. 40% discount. 11% yield.',

    fundamentals: {
      verdict: 'Deep Value',
      points: [
        'NAV (Net Asset Value) = ₱3.80/share — audited real estate portfolio value',
        'Current price ₱2.30 = buying ₱1 of property for ₱0.61. That is a 40% discount.',
        'Dividend yield ~11% — one of the highest yields on the PSE',
        '94% occupancy rate — nearly full portfolio, stable rental income',
        'Asia Securities rates LONG-TERM BUY',
      ],
      sources: [
        { name: 'Asia Securities REIT Research Feb 2026', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
        { name: 'DragonFi KEEPR page', url: 'https://www.dragonfi.ph/market/stocks/KEEPR' },
      ]
    },
    news: {
      verdict: 'Cautious — Watching BSP',
      points: [
        'BSP (Bangko Sentral) held rates in Feb 2026 — rate cuts expected H2 2026',
        'REIT prices move OPPOSITE to interest rates — when BSP cuts, REITs rally',
        'No negative operational news on Keppel Philippines properties',
        'Macro headwind: global "higher for longer" rate narrative pressuring all REITs',
      ],
      sources: [
        { name: 'BSP monetary policy', url: 'https://www.bsp.gov.ph/monetary-policy' },
        { name: 'BusinessWorld REIT coverage', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Oversold — Building Base',
      points: [
        'RSI in oversold territory — more sellers than buyers recently, but often precedes reversal',
        'Price forming a base pattern near ₱2.20–2.30 support level',
        'High volume on down days = institutional selling; watch for volume to dry up (exhaustion signal)',
        'Pattern watch: look for a Hammer candle at support = potential reversal signal',
      ],
      sources: [
        { name: 'TradingView PSE:KEEPR', url: 'https://www.tradingview.com/symbols/PSE-KEEPR/technicals/' },
        { name: 'Investing.com KEEPR', url: 'https://www.investing.com/equities/keppel-reit-technical' },
      ]
    },
    conclusion: 'Fundamentals are exceptional (40% NAV discount, 11% yield). The weakness is purely macro — high interest rates hurt all REITs globally, not just KEEPR. Your thesis: when BSP cuts rates, KEEPR will re-rate toward NAV. DCA zone ₱2.00–2.10 = if it drops further, add more at that price to lower your average. Stop-loss ₱1.90 = if it breaks below this, the market is saying something structural is wrong — exit and reassess.',
  },

  FILRT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    entry: '₱2.90–3.00', target: '₱3.80–4.00', stop: '₱2.70',
    summary: 'Ex-dividend ~Mar 11. ₱420 incoming. 28% NAV discount.',

    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'NAV ₱4.21 vs price ₱3.02 = 28% discount to filinvest real estate portfolio value',
        'Annual dividend yield 8.1% — strong income stream',
        'Dividend ₱0.06/share × your 7,000 shares = ₱420 cash in ~March',
        'Asia Securities rates LONG-TERM BUY',
      ],
      sources: [
        { name: 'Asia Securities REIT Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      ]
    },
    news: {
      verdict: 'Positive — Dividend Incoming',
      points: [
        'Ex-dividend date approximately March 11 — you MUST hold shares before this date',
        'You already own 7,000 shares and will receive ₱420 cash automatically',
        'Filinvest expanding commercial properties — long-term rental growth',
      ],
      sources: [
        { name: 'PSE Edge FILRT disclosures', url: 'https://edge.pse.com.ph' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Hold',
      points: [
        'Same macro pressure as all REITs — rate sensitivity',
        'Price stabilizing near ₱3.00 support — not breaking down aggressively',
        'Sell pressure likely to ease after ex-date (dividend capture players exit)',
        'Wait for RSI to show upward momentum before adding more',
      ],
      sources: [
        { name: 'TradingView PSE:FILRT', url: 'https://www.tradingview.com/symbols/PSE-FILRT/technicals/' },
      ]
    },
    conclusion: 'Hold through the ex-dividend date (~Mar 11) to collect your ₱420. After that, assess: if price dips post-ex-date (common — dividend buyers exit), that can be a good add opportunity in the ₱2.90–3.00 range. The 28% NAV discount and 8.1% yield make this a strong long-term hold.',
  },

  GLO: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    entry: '₱1,700–1,720', target: '₱1,850–1,900', stop: '₱1,600',
    summary: 'Cheap telecom with 6.36% dividend. Global telecoms average P/E 21x — GLO trades at 11x.',

    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 11x vs global telecom sector average 21x = significant discount to international peers',
        'Dividend yield 6.36% — above inflation, reliable income',
        'EPS growing at 9.3% annually — business is expanding',
        'High debt (D/E 2.1x) is NORMAL for telecoms — building towers and fiber is capital-heavy',
      ],
      sources: [
        { name: 'Fintel.io GLO fundamentals', url: 'https://fintel.io/s/ph/glo' },
        { name: 'SimplyWallSt valuation', url: 'https://simplywall.st/stocks/ph/telecom/pse-glo/globe-telecom-shares' },
      ]
    },
    news: {
      verdict: 'Stable',
      points: [
        'Globe and PLDT continue duopoly on PH telecom — limited competitive threat',
        '5G expansion ongoing — long-term infrastructure moat',
        'No negative regulatory news',
      ],
      sources: [
        { name: 'BusinessWorld telecom', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Above Key MA',
      points: [
        'Price above 200-day moving average = long-term uptrend intact',
        'RSI moderate — not overbought, not oversold',
        'Consolidating in range — waiting for next catalyst',
        'Add on dips to ₱1,700–1,720 (near 50-day MA support)',
      ],
      sources: [
        { name: 'TradingView PSE:GLO', url: 'https://www.tradingview.com/symbols/PSE-GLO/technicals/' },
      ]
    },
    conclusion: 'Globe is a "boring" stock in the best way — stable business, growing earnings, reliable dividend. P/E 11x vs global peers at 21x means it has room to re-rate upward. Hold and collect 6.36% while you wait. Add more if it pulls back to ₱1,700–1,720 range.',
  },

  DMC: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    entry: '₱9.00–9.20', target: '₱11.81–14.89', stop: '₱8.50',
    summary: 'Cheap conglomerate with 9.7% dividend. P/E 8x vs industry 12x. Watch nickel prices.',

    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 8x vs industry average 12.2x = 35% discount to peers',
        'Dividend yield 9.73% — exceptional for a conglomerate',
        '4 out of 5 analysts rate BUY with targets ₱11.81–₱14.89',
        'Diversified: construction, mining, power, water — multiple income streams',
      ],
      sources: [
        { name: 'HelloSafe PH DMC', url: 'https://hellosafe.ph/investing/stock-market/stocks/dmc' },
        { name: 'PSE Edge DMCI', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=188' },
      ]
    },
    news: {
      verdict: 'Watchful — Nickel Risk',
      points: [
        'DMCI\'s nickel mining division is sensitive to global LME nickel prices',
        'Nickel prices volatile in 2025–2026 due to Indonesia supply surge',
        'Construction division benefiting from government infrastructure spending (BBM admin)',
        'Power subsidiary stable — DMCI Power contracted for base load',
      ],
      sources: [
        { name: 'BusinessWorld DMCI', url: 'https://bworldonline.com' },
        { name: 'LME Nickel prices', url: 'https://www.lme.com/en/metals/non-ferrous/lme-nickel' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Consolidating',
      points: [
        'RSI 44.4 — neutral, slight lean oversold. Not at extreme yet.',
        'MACD below signal line = mild downward momentum',
        'Consolidating after pullback — needs a catalyst to break upward',
        'Watch for RSI to drop below 40 + MACD cross = stronger buy signal',
      ],
      sources: [
        { name: 'Investing.com DMCI technicals', url: 'https://www.investing.com/equities/dmci-holdings-technical' },
      ]
    },
    conclusion: 'DMCI is cheap by every fundamental measure and pays nearly 10% dividends. The risk is nickel — if global nickel prices fall sharply, mining earnings drop. Monitor LME nickel monthly. Technicals are neutral — no urgency to add right now. Wait for RSI < 40 or a clear catalyst before adding more.',
  },

  MREIT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    entry: '₱13.80–14.00', target: '₱17.50', stop: '₱13.00',
    summary: 'NAV discount 28%. Ex-dividend ~Mar 20. Megaworld expanding to Iloilo + Davao.',

    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'NAV ₱19.69 vs price ₱14.18 = 28% discount to Megaworld commercial real estate',
        'Dividend yield 7.2% — strong income',
        'BUY rating from Asia Securities, target ₱17.50',
        'Megaworld expanding to Iloilo and Davao CBDs = future rental income growth',
      ],
      sources: [
        { name: 'Asia Securities REIT Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
        { name: 'DragonFi MREIT', url: 'https://www.dragonfi.ph/market/stocks/MREIT' },
      ]
    },
    news: {
      verdict: 'Positive — Expanding',
      points: [
        'Ex-dividend date approximately March 20 — hold shares before this date',
        'Megaworld township expansion drives future REIT portfolio growth',
        'Office occupancy recovering post-pandemic in Megaworld properties',
      ],
      sources: [
        { name: 'PSE Edge MREIT', url: 'https://edge.pse.com.ph' },
        { name: 'BusinessWorld', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Rate Sensitive',
      points: [
        'Same BSP rate pressure as all REITs — price suppressed by macro',
        'Holding above ₱14.00 support — not breaking down',
        'Volume normal — no panic selling',
        'Post-ex-date dip often happens — could be a good add point at ₱13.80–14.00',
      ],
      sources: [
        { name: 'TradingView PSE:MREIT', url: 'https://www.tradingview.com/symbols/PSE-MREIT/technicals/' },
      ]
    },
    conclusion: 'Hold through ex-dividend ~March 20 to collect your dividend. If price dips post-ex-date (typical behavior — dividend buyers exit), the ₱13.80–14.00 range is a good accumulation zone. Asia Securities target ₱17.50 = 23% upside from current price, plus the 7.2% yield while you wait.',
  },

  RRHI: {
    badge: 'WAIT', badgeClass: 'badge-wait',
    entry: '₱35.00–36.00', target: '₱43.00', stop: '₱34.00',
    summary: 'Mixed technical signals. Do not add until RSI drops below 40 or MACD crosses up.',

    fundamentals: {
      verdict: 'Fair Value',
      points: [
        'Same-store sales grew 5.65% in 2025 — underlying retail business is healthy',
        'Growth rank 9/10 on GuruFocus = strong business quality score',
        'Robinsons Retail: supermarkets, convenience stores, drug stores — defensive business',
        'P/E moderate — not cheap enough to be exciting, not expensive enough to sell',
      ],
      sources: [
        { name: 'GuruFocus RRHI', url: 'https://www.gurufocus.com/stock/PHS:RRHI/summary' },
        { name: 'HelloSafe RRHI', url: 'https://hellosafe.ph/investing/stock-market/stocks/rrhi' },
      ]
    },
    news: {
      verdict: 'Neutral',
      points: [
        'No major catalysts or negative news recently',
        'Consumer spending in PH stable — retail sector broadly healthy',
        'Competition from e-commerce (Lazada, Shopee) a long-term watch item',
      ],
      sources: [
        { name: 'PSE Edge RRHI', url: 'https://edge.pse.com.ph' },
        { name: 'BusinessWorld retail', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Bearish Short-Term',
      points: [
        'RSI 47 — neutral but trending down. No oversold bounce signal yet.',
        'MACD -0.284 = selling pressure slightly stronger than buying pressure',
        '8 out of 12 moving averages signal SELL — short-term momentum is negative',
        'Sterling rule: don\'t fight 8/12 MAs pointing down. Wait for the turn.',
        'BUY SIGNAL to watch for: RSI drops below 40 (oversold) AND MACD line crosses above signal line',
      ],
      sources: [
        { name: 'Investing.com RRHI technicals', url: 'https://www.investing.com/equities/robinsons-reta-technical' },
        { name: 'TradingView PSE:RRHI', url: 'https://www.tradingview.com/symbols/PSE-RRHI/technicals/' },
      ]
    },
    conclusion: 'RRHI is a good business but the technicals say wait. When 8 of 12 moving averages say sell and MACD is negative, adding now means fighting the trend. The business hasn\'t deteriorated — this is a timing call. Your specific buy signal: RSI drops below 40 AND MACD crosses upward. That combination = trend reversal confirmed. Entry ₱35–36, target ₱43, stop ₱34.',
  },
};
```

---

## STEP 2 — Create renderThreePillars(symbol) function

This renders the three-pillar breakdown as a collapsible section below each stock card:

```js
function renderThreePillars(symbol) {
  const intel = STOCK_INTELLIGENCE[symbol];
  if (!intel) return '';

  const pillar = (icon, label, verdict, points, sources, colorClass) => {
    const srcLinks = sources.map(s => `<a href="${s.url}" target="_blank" class="pillar-src">${s.name} ↗</a>`).join('');
    return `
      <div class="pillar ${colorClass}">
        <div class="pillar-header">
          <span class="pillar-icon">${icon}</span>
          <span class="pillar-label">${label}</span>
          <span class="pillar-verdict">${verdict}</span>
        </div>
        <ul class="pillar-points">
          ${points.map(p => `<li>${p}</li>`).join('')}
        </ul>
        <div class="pillar-sources">${srcLinks}</div>
      </div>`;
  };

  return `
    <div class="three-pillars-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
      <span>📊 Fundamentals · News · Technicals</span><span class="chevron">▸</span>
    </div>
    <div class="three-pillars" style="display:none">
      ${pillar('📈', 'FUNDAMENTALS', intel.fundamentals.verdict, intel.fundamentals.points, intel.fundamentals.sources, 'pillar-fund')}
      ${pillar('📰', 'NEWS & CATALYSTS', intel.news.verdict, intel.news.points, intel.news.sources, 'pillar-news')}
      ${pillar('📉', 'TECHNICALS', intel.technicals.verdict, intel.technicals.points, intel.technicals.sources, 'pillar-tech')}
      <div class="pillar-conclusion">
        <span class="conclusion-label">⚔️ STERLING'S CONCLUSION</span>
        <p>${intel.conclusion}</p>
      </div>
    </div>`;
}
```

Call `renderThreePillars(symbol)` AFTER `renderStockAction(symbol)` in the holding card HTML.
Also use it in watchlist card rendering for watchlist stocks.

---

## STEP 3 — Watchlist cards get WHY/HOW/WHAT mentor per stock

For each watchlist stock, add a collapsed section:
```
WHY Sterling is watching [SYMBOL]:
  [fundamentals reason — 1 sentence]
  [news catalyst — 1 sentence]  
  [technical signal — 1 sentence]
HOW to act: [specific entry price, what signal to wait for]
```

Add `watchlistIntel` data for top watchlist stocks: BDO, SCC, AREIT, BPI, DDMPR, CREIT.
Keep it brief — 3 lines per stock, source link each.

---

## STEP 4 — Discovery page mentor explains the SCREENING CRITERIA

At the top of the Discovery page, the mentor note must explain:

**WHY these stocks are showing up:**
- Sterling screens for: P/E below sector average (cheap business) + dividend yield above 4% (income) + RSI below 55 (not overbought) + analyst BUY rating
- Each stock that passes all 4 filters appears here

**HOW to use this page:**
- You already own 5 REITs (KEEPR, FILRT, MREIT) — heavy REIT exposure
- Look at non-REIT discoveries first to diversify
- Before buying any discovery: check if it has a catalyst (news) + confirm technicals aren't in freefall
- Discovery = research starting point, NOT a buy signal by itself

---

## STEP 5 — CSS for three pillars (append to style.css)

```css
/* Three Pillars */
.three-pillars-toggle { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; cursor:pointer; background:rgba(255,255,255,0.02); border:1px solid #1E2A3A; border-radius:8px; margin-top:8px; font-size:12px; color:#64748B; transition:all 0.2s; }
.three-pillars-toggle:hover { color:#FFD700; border-color:#FFD700; background:rgba(255,215,0,0.03); }
.three-pillars { border:1px solid #1E2A3A; border-radius:8px; overflow:hidden; margin-top:4px; }
.pillar { padding:12px; border-bottom:1px solid #1E2A3A; }
.pillar:last-child { border-bottom:none; }
.pillar-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.pillar-icon { font-size:14px; }
.pillar-label { font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; }
.pillar-verdict { margin-left:auto; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; }
.pillar-fund .pillar-label { color:#60A5FA; }
.pillar-fund .pillar-verdict { background:rgba(96,165,250,0.15); color:#60A5FA; }
.pillar-news .pillar-label { color:#A78BFA; }
.pillar-news .pillar-verdict { background:rgba(167,139,250,0.15); color:#A78BFA; }
.pillar-tech .pillar-label { color:#34D399; }
.pillar-tech .pillar-verdict { background:rgba(52,211,153,0.15); color:#34D399; }
.pillar-points { margin:0; padding-left:16px; }
.pillar-points li { font-size:11px; color:#94A3B8; line-height:1.7; margin-bottom:2px; }
.pillar-sources { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
.pillar-src { font-size:10px; color:#FFD700; background:rgba(255,215,0,0.1); padding:2px 6px; border-radius:3px; text-decoration:none; }
.pillar-src:hover { background:rgba(255,215,0,0.2); }
.pillar-conclusion { padding:12px; background:rgba(255,215,0,0.04); border-top:1px solid rgba(255,215,0,0.15); }
.conclusion-label { display:block; font-size:11px; font-weight:800; color:#FFD700; letter-spacing:0.5px; margin-bottom:6px; }
.pillar-conclusion p { font-size:12px; color:#CBD5E1; line-height:1.7; margin:0; }

@media (max-width:768px) {
  .pillar-points li { font-size:11px; }
  .pillar-conclusion p { font-size:11px; }
}
```

---

## EXECUTION STEPS

1. Read full `knightwatch/docs/app.js`
2. Add `STOCK_INTELLIGENCE` object (the full data above) — this replaces `STOCK_ACTIONS`
3. Update `renderStockAction(symbol)` to use `STOCK_INTELLIGENCE[symbol]` fields
4. Add `renderThreePillars(symbol)` function
5. In the portfolio holding card HTML, call `renderThreePillars(h.symbol)` after `renderStockAction`
6. Add watchlist intel for BDO, AREIT, SCC, BPI, DDMPR, CREIT (brief WHY/HOW per stock)
7. Update Discovery page mentor note with screening criteria explanation
8. Read `knightwatch/docs/style.css`, append the pillar CSS block
9. Push both files
10. Telegram notification:

```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send', '--channel', 'telegram', '--target', '1424637649',
  '--message', 'Sterling ⚔️ Three-Pillar Intelligence live:\n\nEvery stock now shows:\n📈 FUNDAMENTALS (P/E, NAV, yield, analyst targets + sources)\n📰 NEWS & CATALYSTS (what\'s happening + sources)\n📉 TECHNICALS (RSI, MACD, MAs, patterns + sources)\n⚔️ STERLING\'S CONCLUSION (what to do + price triggers)\n\nWatchlist + Discovery pages also updated with WHY/HOW reasoning.\n\nhttps://heylencer-debug.github.io/Sterling'
]);
```
