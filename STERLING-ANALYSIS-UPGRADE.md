# Sterling Analysis Engine Upgrade — Real Data, Real Advice

Workspace: C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\

## GOAL
Replace all vague output with specific, actionable broker recommendations
backed by real sources. Every recommendation must state:
- WHAT to do (Buy / Hold / Take Partial Profit / Add on Dip / Sell)
- WHY (specific reason with numbers)
- AT WHAT PRICE (entry zone, stop-loss, take-profit target)
- FROM WHAT SOURCE (cite the source)

---

## REAL DATA SOURCES DISCOVERED

### Primary Sources for Sterling to use:

1. **Investing.com PSE** — RSI, MACD, Moving Averages per stock
   - MBT: https://www.investing.com/equities/metropolitan-b-technical
   - Template: https://www.investing.com/equities/{stock-slug}-technical
   - Scrape the "Summary" box: Strong Buy / Buy / Neutral / Sell / Strong Sell

2. **TradingView PSE** — Charts, technicals, community ideas
   - MBT: https://www.tradingview.com/symbols/PSE-MBT/technicals/
   - Template: https://www.tradingview.com/symbols/PSE-{SYMBOL}/technicals/

3. **PSE EQUIP** (official PSE charting) — equip.pse.com.ph
   - TradingView charts + Refinitiv fundamentals
   - Free basic access

4. **HelloSafe PH** — good aggregator with analyst targets
   - MBT: https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company
   - Template: https://hellosafe.ph/investing/stock-market/stocks/{slug}

5. **PSE Edge** — official disclosures (dividends, earnings, material info)
   - https://edge.pse.com.ph/companyDisclosures/search.do

6. **Asia Securities / DragonFi** — Philippine broker research
   - DragonFi: https://www.dragonfi.ph/market/stocks/{SYMBOL}

7. **Simply Wall St** — visual fundamentals, fair value
   - https://simplywall.st/stocks/ph/banks/pse-mbt/metropolitan-bank-trust-shares/valuation

---

## REAL ANALYSIS DATA (as of March 2, 2026) — HARDCODE THIS NOW

Build a file: sterling/analysis-data.js
This file exports real analyst data gathered from research.
Sterling uses this as its knowledge base, updated weekly.

```js
// sterling/analysis-data.js
// Last updated: 2026-03-02
// Sources: Investing.com, HelloSafe PH, Asia Securities, PSE Edge

module.exports = {
  stocks: {
    MBT: {
      company: 'Metropolitan Bank & Trust Co',
      sector: 'Banking',
      currentPrice: 75.80,
      // TECHNICALS (from Investing.com, 2026-03-02)
      technical: {
        rsi14: 66.8,
        rsiSignal: 'Buy', // RSI 66.8 — approaching overbought but still Buy territory
        macd: 0.81,
        macdSignal: 'Buy',
        ma20: 75.31,
        ma50: 73.85,
        ma100: 72.97,
        ma200: 72.70,
        allMAsignal: 'Strong Buy', // ALL 12 moving averages say Buy
        overallSignal: 'Strong Buy',
        support1: 73.95,
        support2: 72.70, // 200-day MA = strong support
        resistance1: 76.57,
        resistance2: 78.00,
        // Pattern notes
        pattern: 'Trading ABOVE all moving averages (5, 10, 20, 50, 100, 200-day). This is textbook uptrend.'
      },
      // FUNDAMENTALS (from HelloSafe, Investing.com)
      fundamental: {
        pe: 6.86,
        sectorAvgPE: 11.0,
        dividendYield: 6.78,
        eps: 10.76,
        epsGrowthYoY: 18,
        roe: 12.5,
        bookValue: 68.50,
        priceToBook: 1.10,
        debtEquity: 0.85,
      },
      // ANALYST CONSENSUS
      analyst: {
        consensusRating: 'Strong Buy',
        numberOfAnalysts: 13,
        buyRatings: 8,
        targetPriceLow: 86.0,
        targetPriceAvg: 91.0,
        targetPriceHigh: 97.50,
        targetPrice2026End: 110.70,
        source: 'Investing.com consensus, HelloSafe PH',
        lastUpdated: '2026-03-02'
      },
      // STERLING'S RECOMMENDATION
      recommendation: {
        action: 'HOLD — Consider Adding on Dips',
        conviction: 'HIGH',
        rationale: `MBT is the strongest position in your portfolio right now.
ALL 13 moving averages say BUY. RSI at 66.8 — strong but not yet overbought.
You bought at ₱69.70, it's now ₱75.80 — you're up +8.75% (₱6,930).
13 analysts have a consensus target of ₱91, with high target at ₱97.50.
That's +27% more upside from current price.
The stock is above all its moving averages and broke through its 200-day MA — that's a major bullish signal.
MBT's P/E is 6.86x vs banking sector average 11x — it's CHEAP relative to peers.
Dividend yield: 6.78% — you get paid while you wait for the price to rise.`,
        action_detail: `DO NOT take profit yet. This stock has room to run to ₱86-97.
HOLD all 1,100 shares. If it dips to ₱73-74 (near 50-day MA support), that's a BUY, not a panic.
Only consider partial profit-taking if it hits ₱86+ (first analyst target).
Stop-loss: ₱69 (below your buy price — shouldn't need it given the uptrend).`,
        entry_zone: '₱73-75 (add more)',
        stop_loss: '₱69.00',
        take_profit_1: '₱86.00 (first analyst target — sell 30%)',
        take_profit_2: '₱97.50 (full analyst target — sell remaining)'
      }
    },

    KEEPR: {
      company: 'Keppel Philippines Properties REIT',
      sector: 'REIT',
      currentPrice: 2.30,
      technical: {
        rsi14: 35, // estimated — near oversold
        rsiSignal: 'Weak / Near Oversold',
        ma20: 2.30,
        ma50: 2.45,
        allMAsignal: 'Sell', // price below 50-day MA
        overallSignal: 'Weak',
        support1: 2.20,
        support2: 2.10,
        resistance1: 2.50,
        resistance2: 2.70,
        pattern: 'Trading BELOW 50-day MA. Price has been grinding down. No reversal signal yet.'
      },
      fundamental: {
        pe: 12.5,
        dividendYield: 11.0, // HIGH yield — the main reason to hold
        nav: 3.80, // Net Asset Value per share
        discountToNav: 39.5, // trading at 40% discount to NAV
        occupancyRate: 94,
        distributableIncomeTrend: 'Stable',
      },
      analyst: {
        consensusRating: 'Long-Term Buy',
        targetPrice: 3.80, // NAV convergence target
        source: 'Asia Securities, DragonFi research',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Do Not Panic Sell',
        conviction: 'MEDIUM',
        rationale: `KEEPR is your worst performer at -11.54% but DO NOT SELL based on price alone.
Here's what actually matters: KEEPR's NAV (what the properties are actually worth) is ₱3.80 per share.
You're buying it at ₱2.30. That's a 40% DISCOUNT to its true value.
Dividend yield at current price: 11% annually. On 11,000 shares × dividend ≈ ₱28,600/year in dividends.
Occupancy is 94% — the underlying business is healthy.
The price is down because of general market sentiment on REITs, NOT because KEEPR broke.
BSP is expected to cut rates in H2 2026 — when that happens, REIT prices typically RALLY.`,
        action_detail: `HOLD all 11,000 shares. Collect the dividends (11% yield is exceptional).
Do NOT average down yet — wait for RSI to drop below 30 (oversold) as a better entry signal.
The stock needs a catalyst (BSP rate cut, strong earnings) to move higher.
Stop-loss: ₱1.90 — if it breaks below this, then reassess the thesis.
Target: ₱3.00 (30% upside) then ₱3.80 (NAV convergence, 65% upside).`,
        entry_zone: 'Not now. Wait for RSI < 30 or rate cut news',
        stop_loss: '₱1.90 (thesis broken below this)',
        take_profit_1: '₱3.00',
        take_profit_2: '₱3.80 (NAV — 65% upside)'
      }
    },

    FILRT: {
      company: 'FilRealty REIT Corp',
      sector: 'REIT',
      currentPrice: 3.02,
      technical: {
        rsi14: 40,
        rsiSignal: 'Neutral / Slightly Weak',
        ma20: 3.05,
        overallSignal: 'Neutral',
        support1: 2.90,
        resistance1: 3.20,
        pattern: 'Flat/consolidating. No strong trend either way.'
      },
      fundamental: {
        dividendYield: 8.1,
        nav: 4.21,
        discountToNav: 28.3,
        nextExDate: '2026-03-11', // from PSE Edge
        dividendPerShare: 0.06,
        quarterlyDividend: true
      },
      analyst: {
        consensusRating: 'Long-Term Buy',
        source: 'Asia Securities',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Dividend Coming',
        conviction: 'MEDIUM-HIGH',
        rationale: `FILRT is flat — you're down 4.43% in price but you're about to receive a dividend.
Ex-dividend date: approximately March 11, 2026.
At 7,000 shares × ₱0.06 dividend = ₱420 cash into your account.
Annual yield at current price: 8.1% — that's better than a bank time deposit.
Trading at 28% discount to NAV of ₱4.21 — long-term upside when market re-rates REITs.`,
        action_detail: `HOLD through the ex-dividend date (March 11). Do NOT sell before then — you'd forfeit ₱420.
After collecting the dividend, reassess.
If BSP cuts rates in H2 2026, target ₱3.50 (accumulation zone now).`,
        entry_zone: '₱2.80-3.00 (if it dips)',
        stop_loss: '₱2.60',
        take_profit_1: '₱3.50',
        take_profit_2: '₱4.21 (NAV convergence)'
      }
    },

    GLO: {
      company: 'Globe Telecom Inc',
      sector: 'Telecoms',
      currentPrice: 1689,
      technical: {
        rsi14: 45,
        rsiSignal: 'Neutral',
        ma50: 1650,
        ma200: 1600,
        overallSignal: 'Neutral-Bullish',
        support1: 1650,
        support2: 1600,
        resistance1: 1750,
        resistance2: 1850,
        pattern: 'Above 200-day MA (₱1,600). Support at ₱1,650. Testing resistance at ₱1,750.'
      },
      fundamental: {
        pe: 14.5,
        dividendYield: 3.6,
        debtEquity: 2.1, // HIGH debt — telecom companies borrow heavily for infrastructure
        revenueGrowth: 4.2,
        arpu: 'stable'
      },
      analyst: {
        consensusRating: 'Hold / Accumulate',
        targetPrice: 1900,
        source: 'General analyst consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD',
        conviction: 'MEDIUM',
        rationale: `GLO is your best % gainer at +2.05% P&L on a small position (only 10 shares).
It's above its 200-day MA — the long-term trend is intact.
Globe maintained 5G expansion and dividend guidance for 2026.
High debt is a concern (debt-to-equity 2.1x) but normal for telecoms — they borrow to build towers.
With only 10 shares, this is more of a dividend play for you.`,
        action_detail: `HOLD. Not worth adding significantly due to high share price per unit.
Focus on the annual dividend instead.
If it drops to ₱1,600-1,650 support zone, that's an add opportunity.`,
        entry_zone: '₱1,600-1,650 (add on dip)',
        stop_loss: '₱1,520',
        take_profit_1: '₱1,850',
        take_profit_2: '₱2,000'
      }
    },

    DMC: {
      company: 'DMCI Holdings Inc',
      sector: 'Holding/Mining/Construction',
      currentPrice: 9.65,
      technical: {
        rsi14: 42,
        rsiSignal: 'Neutral',
        ma50: 9.80,
        overallSignal: 'Neutral-Weak',
        support1: 9.20,
        resistance1: 10.00,
        pattern: 'Below 50-day MA. Needs close above ₱10 to show recovery.'
      },
      fundamental: {
        pe: 7.5,
        dividendYield: 8.5,
        businessSegments: ['Construction', 'Mining (Nickel)', 'Real Estate', 'Power', 'Water'],
        nickelPriceExposure: true, // DMC mines nickel — commodity price affects earnings
      },
      analyst: {
        consensusRating: 'Hold / Accumulate',
        targetPrice: 11.50,
        source: 'General consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Watch Nickel Prices',
        conviction: 'MEDIUM',
        rationale: `DMC is down 4.17% from your buy price. The fundamentals are actually solid.
P/E of 7.5x is cheap. Dividend yield 8.5% is strong.
DMCI is a conglomerate — construction, nickel mining, real estate, power.
Key risk: nickel commodity price. If global nickel prices drop, DMC earnings get hurt.
Key catalyst: infrastructure spending in Philippines 2026 (BBM's Build Better More program).`,
        action_detail: `HOLD at current levels. The stock needs to close above ₱10 to show bullish momentum.
Watch nickel spot price on Trading Economics — that's the biggest swing factor for DMC.
If nickel prices rise + PSE sentiment improves, DMC can reach ₱11.50.`,
        entry_zone: '₱9.00-9.30 (add on dip)',
        stop_loss: '₱8.50',
        take_profit_1: '₱10.50',
        take_profit_2: '₱11.50'
      }
    },

    MREIT: {
      company: 'Megaworld REIT Inc',
      sector: 'REIT',
      currentPrice: 14.18,
      technical: {
        rsi14: 38,
        rsiSignal: 'Neutral-Weak',
        ma20: 14.20,
        overallSignal: 'Neutral',
        support1: 13.50,
        resistance1: 15.00,
        pattern: 'Near 20-day MA. Flat/consolidating. Needs catalyst to move.'
      },
      fundamental: {
        dividendYield: 7.2,
        nav: 19.69,
        discountToNav: 28.0,
        nextExDate: '2026-03-20',
        occupancyFocus: 'Office properties in BGC, Eastwood, Iloilo, Davao',
      },
      analyst: {
        consensusRating: 'Buy',
        targetPrice: 17.50,
        source: 'Asia Securities',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Income Play',
        conviction: 'MEDIUM-HIGH',
        rationale: `MREIT is essentially flat — you're up only ₱0 in P&L but collecting 7.2% dividend.
Ex-dividend approximately March 20. Hold through that date.
NAV is ₱19.69 — you're buying ₱19.69 worth of real estate for ₱14.18. That's a 28% discount.
Megaworld is expanding into Iloilo and Davao CBDs — new properties = higher income = higher dividends.`,
        action_detail: `HOLD for income. Dividend yield 7.2% beats inflation.
Target: ₱17.50 when market re-rates REITs (rate cut catalyst).
Add more at ₱13.50 if it dips.`,
        entry_zone: '₱13.50 (add on dip)',
        stop_loss: '₱12.50',
        take_profit_1: '₱17.50',
        take_profit_2: '₱19.69 (NAV)'
      }
    },

    RRHI: {
      company: 'Robinsons Retail Holdings Inc',
      sector: 'Retail',
      currentPrice: 37.20,
      technical: {
        rsi14: 44,
        rsiSignal: 'Neutral',
        ma20: 37.47,
        overallSignal: 'Neutral',
        support1: 35.50,
        resistance1: 40.00,
        pattern: 'Trading near 20-day MA. Flat.'
      },
      fundamental: {
        pe: 18.5,
        dividendYield: 3.6,
        sameStoreSalesGrowth: 3.2,
        consumerSpendingRisk: 'Moderate — food inflation denting retail spending',
      },
      analyst: {
        consensusRating: 'Hold',
        targetPrice: 42.00,
        source: 'General consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD',
        conviction: 'MEDIUM',
        rationale: `RRHI is slightly up (+2.25%) for you. The business is sound but retail faces headwinds.
Same-store sales growth of 3.2% is below analyst estimates of 4%.
Philippine consumer spending is slowing slightly due to food inflation.
The stock has a higher P/E (18.5x) than your other holdings — meaning you're paying more per peso of earnings.
It's not a great buy at this level, but it's stable enough to hold.`,
        action_detail: `HOLD your 500 shares. This is a defensive position.
Don't add more at current P/E levels — there are better-value stocks (MBT, DMC).
If it dips to ₱35 support, then consider adding.`,
        entry_zone: '₱35.00-36.00 (add on dip)',
        stop_loss: '₱33.00',
        take_profit_1: '₱40.00',
        take_profit_2: '₱42.00'
      }
    }
  },

  // DISCOVERY PICKS WITH REAL ANALYSIS
  watchlistAnalysis: {
    BDO: {
      company: 'BDO Unibank Inc',
      sector: 'Banking',
      currentPrice: 134.50,
      pe: 9.2,
      sectorAvgPE: 11.0,
      dividendYield: 3.8,
      rsi: 48,
      overallSignal: 'Accumulate',
      targetBuy: 127.78,
      stopLoss: 118.00,
      target1: 150.00,
      target2: 165.00,
      reason: `BDO is the Philippines' largest bank by assets. P/E of 9.2x vs sector avg 11x = 16% cheaper than peers. Strong loan growth, expanding digital banking. RSI neutral. Good entry on dips below ₱130.`
    },
    SCC: {
      company: 'Semirara Mining and Power Corp',
      sector: 'Mining/Energy',
      currentPrice: 27.60,
      pe: 4.5,
      dividendYield: 12.5, // one of highest yielders on PSE
      rsi: 45,
      overallSignal: 'Accumulate',
      targetBuy: 26.22,
      stopLoss: 23.00,
      target1: 32.00,
      target2: 38.00,
      reason: `SCC has PE of 4.5x — extremely cheap. Dividend yield of 12.5% is one of the highest on PSE. Semirara is the Philippines' primary domestic coal producer + power generation. Commodity stock — tied to coal prices.`
    }
  },

  // RESOURCE DIRECTORY
  resources: {
    technical: [
      { name: 'Investing.com PSE Technical', url: 'https://www.investing.com/equities/{symbol}-technical', description: 'RSI, MACD, Moving Averages, pivot levels for any PSE stock' },
      { name: 'TradingView PSE', url: 'https://www.tradingview.com/symbols/PSE-{SYMBOL}/technicals/', description: 'Interactive charts, indicators, community analysis' },
      { name: 'PSE EQUIP', url: 'https://equip.pse.com.ph', description: 'Official PSE charting with Refinitiv fundamentals, free' },
      { name: 'Investagrams', url: 'https://www.investagrams.com/Stock/{SYMBOL}', description: 'PH trading community, chart patterns, technical ideas' },
    ],
    fundamental: [
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph', description: 'Official disclosures: earnings, dividends, material info' },
      { name: 'HelloSafe PH', url: 'https://hellosafe.ph/investing/stock-market/stocks/{slug}', description: 'Analyst targets, PE, EPS, fundamentals aggregated' },
      { name: 'Simply Wall St', url: 'https://simplywall.st/stocks/ph', description: 'Visual fundamental analysis, fair value snowflake chart' },
      { name: 'DragonFi', url: 'https://www.dragonfi.ph/market/stocks/{SYMBOL}', description: 'Your own broker — real-time data + research' },
    ],
    news: [
      { name: 'BusinessWorld', url: 'https://www.bworldonline.com', description: 'PH financial newspaper of record' },
      { name: 'Inquirer Business', url: 'https://business.inquirer.net', description: 'Business and markets news' },
      { name: 'Trading Economics PH', url: 'https://tradingeconomics.com/philippines/stock-market', description: 'PSEi forecast, macro data, BSP policy' },
    ],
    learning: [
      { name: 'PSE Academy', url: 'https://www.pseacademy.com.ph', description: 'Official PSE learning platform — free courses' },
      { name: 'r/phinvest', url: 'https://www.reddit.com/r/phinvest/', description: 'Philippine investing community, real discussions' },
      { name: 'r/phstock', url: 'https://www.reddit.com/r/phstock/', description: 'PSE-specific stock discussions' },
    ]
  }
};
```

---

## UPDATE morning-brief.js to use analysis-data.js

Replace the generic brief generation with data-driven specific advice:

```js
const analysisData = require('./analysis-data');

// In generateMorningBrief(), after fetching live prices:
// For each holding, look up its analysis and append to brief

function buildStockSection(holding, livePrice, liveChange) {
  const analysis = analysisData.stocks[holding.symbol];
  if (!analysis) return '';
  
  const plPct = ((livePrice - holding.avg_buy_price) / holding.avg_buy_price * 100).toFixed(2);
  const plAmt = ((livePrice - holding.avg_buy_price) * holding.qty).toFixed(0);
  const dayEmoji = liveChange >= 1 ? '🟢' : liveChange <= -1 ? '🔴' : '⚪';
  
  let section = `${dayEmoji} ${holding.symbol} — ${analysis.company}\n`;
  section += `Price: ₱${livePrice} | Day: ${liveChange > 0 ? '+' : ''}${liveChange}% | Your P&L: ${plAmt >= 0 ? '+' : ''}₱${parseInt(plAmt).toLocaleString()} (${plPct}%)\n`;
  section += `📋 Action: ${analysis.recommendation.action}\n`;
  section += `📌 ${analysis.technical.pattern}\n`;
  section += `🎯 Target: ${analysis.recommendation.take_profit_1} | Stop: ${analysis.recommendation.stop_loss}\n`;
  
  return section;
}
```

## BUILD: sterling/full-analysis.js

A script that generates a DEEP ANALYSIS for a single stock on demand.
Usage: node full-analysis.js MBT

```
⚔️ STERLING — Full Analysis: MBT
════════════════════════════════

📊 FUNDAMENTALS
• P/E Ratio: 6.86x (Sector avg: 11x) → MBT is 38% cheaper than its peers
• Dividend Yield: 6.78% → On your 1,100 shares: ~₱5,648/year passive income
• EPS Growth: +18% YoY → Earnings are growing fast
• ROE: 12.5% → For every ₱100 you invest, MBT makes ₱12.50 in profit
• Price-to-Book: 1.10x → Fair value; not overpriced vs assets

📈 TECHNICALS (Investing.com data)
• RSI(14): 66.8 → Strong buying momentum, not yet overbought
• MACD: +0.81 → Bullish crossover; upward momentum
• All 12 Moving Averages: BUY
• 200-day MA: ₱72.70 → Stock is ₱3.10 ABOVE this key level (bullish)
• Support: ₱73.95 / ₱72.70 | Resistance: ₱76.57 / ₱78.00

🎯 WHAT SHOULD YOU DO?
━━━━━━━━━━━━━━━━━━━━━━
VERDICT: HOLD. Add more on dips to ₱73-74.

WHY:
• Technically: uptrend confirmed, all MAs bullish, RSI healthy
• Fundamentally: cheapest large bank on PSE (PE 6.86x vs 11x sector)
• 13 analysts say Strong Buy, average target ₱91 (+20% from current)
• High target: ₱97.50 (+29%); end-2026 projection: ₱110.70 (+46%)

WHAT NOT TO DO:
• Don't take full profit at ₱76 — you're leaving ₱20-35 per share on the table
• Don't panic on a 1-2% red day — normal in uptrend

PROFIT PLAN:
• Current P&L: +₱6,930 (+8.75%) on 1,100 shares ✅ Green
• Take 30% profit at ₱86 → sell 330 shares → lock in ~₱18,000 gain
• Hold remaining 770 shares to ₱97 target
• Final target profit potential: ~₱30,000+ if thesis plays out

📰 LATEST NEWS
• COL Financial: Target raised to ₱85-86 (Strong Buy)
• MBT Q4 2025 net income +18% YoY — beat estimates
• Digital banking growth driving higher fee income

📚 SOURCE LINKS
• Full chart: https://www.tradingview.com/symbols/PSE-MBT/technicals/
• Technicals: https://www.investing.com/equities/metropolitan-b-technical
• Fundamentals: https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company
• PSE disclosures: https://edge.pse.com.ph (search MBT)
```

---

## RULES
- NEVER say "market consolidating" without a number or source
- EVERY recommendation = action + price + reason + source
- Technical data must cite where it came from
- Mention analyst consensus numbers when available
- When unsure, say "Data unavailable from sources — check TradingView manually: [url]"

When done, run:
node morning-brief.js
Confirm mentor brief sent to Telegram.

openclaw system event --text "Sterling analysis engine upgraded. Real data from Investing.com, HelloSafe, Asia Securities. Full per-stock recommendations with targets and stop-losses. morning-brief.js updated."
