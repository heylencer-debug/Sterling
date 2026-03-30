/**
 * Sterling - Full Analysis Generator
 * Reads live data from Supabase; falls back to analysis-data.js for
 * fundamentals / analyst consensus / recommendation sections that are
 * not yet stored in the database.
 *
 * Usage:
 *   node full-analysis.js MBT          — single symbol
 *   node full-analysis.js ALL          — every symbol in portfolio + watchlist
 *   node full-analysis.js              — list available symbols
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const analysisData = require('./analysis-data');

const SB_HOST = 'fhfqjcvwcxizbioftvdw.supabase.co';
const SB_KEY  = process.env.SUPABASE_KEY;

const STOCK_SLUGS = {
  MBT:   'metropolitan-b',
  BDO:   'bdo-unibank',
  GLO:   'globe-telecom',
  DMC:   'dmci-holdings',
  RRHI:  'robinsons-retail-holdings',
  FILRT: 'filinvest-reit-corp',
  KEEPR: 'keppel-philippines-properties',
  MREIT: 'megaworld-reit',
  SCC:   'semirara-mining-and-power'
};

// ─── Supabase helper ──────────────────────────────────────────────────────────

function sbGet(query) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SB_HOST,
      path: `/rest/v1/${query}`,
      method: 'GET',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Accept': 'application/json'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return resolve([]);
        try { resolve(JSON.parse(d)); } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  if (typeof amount !== 'number') return amount;
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRSIStatus(rsi) {
  if (rsi === null || rsi === undefined) return 'No data';
  if (rsi < 30) return 'OVERSOLD — Strong buying signal';
  if (rsi < 40) return 'Near oversold — Watch for reversal';
  if (rsi > 70) return 'OVERBOUGHT — Consider taking profits';
  if (rsi > 60) return 'Strong momentum, not yet overbought';
  return 'Neutral territory';
}

function getPEAnalysis(pe, sectorAvg) {
  if (!pe || !sectorAvg) return 'Data unavailable';
  const diff = ((sectorAvg - pe) / sectorAvg * 100).toFixed(0);
  if (pe < sectorAvg * 0.8) return `${diff}% CHEAPER than sector — undervalued`;
  if (pe < sectorAvg)       return `${diff}% cheaper than sector — fair value`;
  if (pe > sectorAvg * 1.2) return `${Math.abs(diff)}% more expensive than sector — premium valuation`;
  return 'Trading near sector average';
}

function fmtNum(v, d = 2) {
  return (v !== null && v !== undefined && typeof v === 'number') ? v.toFixed(d) : 'N/A';
}

// ─── Core report builder ──────────────────────────────────────────────────────

async function generateFullAnalysis(symbol) {
  const now = new Date().toISOString().split('T')[0];

  // 1. Fetch live data from Supabase in parallel
  const [portfolioRows, techRows, newsRows, intelRows] = await Promise.all([
    sbGet(`sterling_portfolio?symbol=eq.${symbol}&select=*`),
    sbGet(`sterling_technicals?symbol=eq.${symbol}&select=*&order=updated_at.desc&limit=1`),
    sbGet(`sterling_news?symbol=eq.${symbol}&select=title,summary,published_at&order=published_at.desc&limit=3`),
    sbGet(`sterling_intelligence?symbol=eq.${symbol}&select=*&order=analyzed_at.desc`)
  ]);

  const livePortfolio = portfolioRows && portfolioRows[0]  ? portfolioRows[0]  : null;
  const liveTech      = techRows      && techRows[0]       ? techRows[0]       : null;
  const liveNews      = Array.isArray(newsRows) ? newsRows : [];
  const liveIntel     = Array.isArray(intelRows) ? intelRows : [];

  // 2. Static fallback data
  const staticStock     = analysisData.stocks[symbol]            || null;
  const staticWatchlist = analysisData.watchlistAnalysis[symbol] || null;
  const staticData      = staticStock || staticWatchlist;
  const isPortfolio     = !!(staticStock || livePortfolio);

  // Determine live price: prefer Supabase portfolio, then technicals, then static
  const livePrice =
    (livePortfolio && livePortfolio.current_price) ||
    (liveTech && liveTech.current_price) ||
    (staticData && staticData.currentPrice) ||
    null;

  const hasLiveData = !!(livePortfolio || liveTech);

  if (!staticData && !hasLiveData) {
    console.log(`\nStock ${symbol} not found in Supabase or static database.`);
    console.log('Try: node full-analysis.js ALL  to see all symbols from Supabase');
    return null;
  }

  // Company name / sector: prefer static, fallback to symbol
  const company = (staticData && staticData.company) || symbol;
  const sector  = (staticData && staticData.sector)  || 'Unknown';
  const slug    = STOCK_SLUGS[symbol] || symbol.toLowerCase();

  let report = '';

  // ── Header ──────────────────────────────────────────────────────────────────
  report += `\n${'='.repeat(60)}\n`;
  report += `STERLING — Full Analysis: ${symbol}\n`;
  report += `${'='.repeat(60)}\n\n`;
  report += `${company}\n`;
  report += `Sector: ${sector}\n`;
  report += `Current Price: P${livePrice !== null ? formatCurrency(livePrice) : 'N/A'}\n`;

  if (livePortfolio && livePortfolio.updated_at) {
    report += `Price source: Supabase sterling_portfolio (live)\n`;
    report += `Last price update: ${livePortfolio.updated_at.slice(0, 16).replace('T', ' ')} UTC\n`;
  } else if (liveTech && liveTech.updated_at) {
    report += `Price source: Supabase sterling_technicals (live)\n`;
    report += `Last tech update: ${liveTech.updated_at.slice(0, 16).replace('T', ' ')} UTC\n`;
  } else {
    report += `Price source: Static data (analysis-data.js — 2026-03-02)\n`;
  }
  report += '\n';

  // ── Portfolio position ───────────────────────────────────────────────────────
  if (livePortfolio) {
    report += `${'━'.repeat(50)}\n`;
    report += `YOUR POSITION (live from Supabase)\n`;
    report += `${'━'.repeat(50)}\n\n`;

    const shares   = livePortfolio.qty || livePortfolio.shares || null;
    const avgBuy   = livePortfolio.avg_buy_price || livePortfolio.cost_basis || null;
    const pnlPct   = livePortfolio.unrealized_pl_pct !== undefined ? livePortfolio.unrealized_pl_pct : null;
    const pnlAmt   = livePortfolio.unrealized_pl !== undefined ? livePortfolio.unrealized_pl : null;

    if (shares)  report += `• Shares held: ${shares.toLocaleString()}\n`;
    if (avgBuy)  report += `• Avg buy price: P${formatCurrency(parseFloat(avgBuy))}\n`;
    if (livePrice && avgBuy) {
      const pct = ((livePrice - parseFloat(avgBuy)) / parseFloat(avgBuy) * 100).toFixed(2);
      report += `• Unrealized P&L: ${pct >= 0 ? '+' : ''}${pct}%`;
      if (pnlAmt !== null) report += ` (P${formatCurrency(Math.abs(parseFloat(pnlAmt)))})`;
      report += '\n';
    }
    report += '\n';
  }

  // ── Fundamentals (static only — not yet in Supabase) ─────────────────────────
  report += `${'━'.repeat(50)}\n`;
  report += `FUNDAMENTALS\n`;
  report += `${'━'.repeat(50)}\n\n`;

  if (staticStock && staticStock.fundamental) {
    const f = staticStock.fundamental;
    const sectorAvg = f.sectorAvgPE || 11;
    report += `• P/E Ratio: ${f.pe}x (Sector avg: ${sectorAvg}x) -> ${getPEAnalysis(f.pe, sectorAvg)}\n`;
    report += `• Dividend Yield: ${f.dividendYield}% -> ${f.dividendYield > 6 ? 'Excellent income' : f.dividendYield > 4 ? 'Good income' : 'Moderate income'}\n`;
    if (f.eps)          report += `• EPS: P${f.eps} ${f.epsGrowthYoY ? `(+${f.epsGrowthYoY}% YoY growth)` : ''}\n`;
    if (f.roe)          report += `• ROE: ${f.roe}% -> For every P100 invested, company makes P${f.roe} profit\n`;
    if (f.priceToBook)  report += `• Price-to-Book: ${f.priceToBook}x -> ${f.priceToBook < 1 ? 'Trading below book value!' : f.priceToBook < 1.5 ? 'Fair value' : 'Premium to book'}\n`;
    if (f.nav) {
      report += `• NAV (Net Asset Value): P${f.nav}\n`;
      report += `• Discount to NAV: ${f.discountToNav}% -> Buying P${f.nav} of assets for P${livePrice || staticData.currentPrice}\n`;
    }
    if (f.occupancyRate) report += `• Occupancy Rate: ${f.occupancyRate}% -> ${f.occupancyRate > 90 ? 'Healthy' : 'Needs attention'}\n`;
    if (f.debtEquity)    report += `• Debt/Equity: ${f.debtEquity}x -> ${f.debtEquity < 1 ? 'Low leverage' : f.debtEquity < 2 ? 'Moderate leverage' : 'High leverage'}\n`;
  } else if (staticWatchlist) {
    report += `• P/E Ratio: ${staticWatchlist.pe}x (Sector avg: ${staticWatchlist.sectorAvgPE || 11}x)\n`;
    report += `• Dividend Yield: ${staticWatchlist.dividendYield}%\n`;
  } else {
    report += `• Fundamental data not yet available in static database.\n`;
    report += `  (Add to analysis-data.js to enable this section)\n`;
  }
  report += '\n';

  // ── Technicals (live from Supabase, with static fallback) ─────────────────────
  report += `${'━'.repeat(50)}\n`;
  if (liveTech) {
    report += `TECHNICALS (live — ${liveTech.data_source ? liveTech.data_source.split('(')[0].trim() : 'Supabase'})\n`;
  } else {
    report += `TECHNICALS (static — analysis-data.js 2026-03-02)\n`;
  }
  report += `${'━'.repeat(50)}\n\n`;

  if (liveTech) {
    const t = liveTech;
    const rsi = t.rsi14 !== null ? parseFloat(t.rsi14) : null;

    report += `• RSI(14): ${fmtNum(rsi)} -> ${getRSIStatus(rsi)}\n`;

    if (t.macd_line !== null) {
      report += `• MACD Line: ${fmtNum(t.macd_line, 4)}`;
      if (t.macd_signal_line !== null) report += ` | Signal: ${fmtNum(t.macd_signal_line, 4)}`;
      if (t.macd_histogram  !== null) report += ` | Hist: ${fmtNum(t.macd_histogram, 4)}`;
      report += `\n• MACD Signal: ${t.macd_signal || 'N/A'}\n`;
    }

    if (t.tv_recommend_all !== null) {
      report += `• TradingView Overall: ${t.overall_signal || 'N/A'} (score: ${fmtNum(t.tv_recommend_all, 2)})\n`;
      report += `• TradingView MA signal: ${t.ma_signal || 'N/A'} (score: ${fmtNum(t.tv_recommend_ma, 2)})\n`;
    } else if (t.overall_signal) {
      report += `• Overall Signal: ${t.overall_signal}\n`;
      if (t.ma_signal) report += `• MA Signal: ${t.ma_signal}\n`;
    }

    report += `\n• Moving Averages:\n`;
    if (t.sma20)  report += `  - SMA20:  P${formatCurrency(parseFloat(t.sma20))}\n`;
    if (t.sma50)  report += `  - SMA50:  P${formatCurrency(parseFloat(t.sma50))}\n`;
    if (t.sma200) report += `  - SMA200: P${formatCurrency(parseFloat(t.sma200))}\n`;
    if (t.ema12)  report += `  - EMA20:  P${formatCurrency(parseFloat(t.ema12))}\n`;
    if (t.ema26)  report += `  - EMA50:  P${formatCurrency(parseFloat(t.ema26))}\n`;
    if (t.ma_trend) report += `• MA Trend: ${t.ma_trend}\n`;

    report += `\n`;

    if (t.support1)    report += `• Support 1:    P${formatCurrency(parseFloat(t.support1))}\n`;
    if (t.support2)    report += `• Support 2:    P${formatCurrency(parseFloat(t.support2))}\n`;
    if (t.resistance1) report += `• Resistance 1: P${formatCurrency(parseFloat(t.resistance1))}\n`;
    if (t.resistance2) report += `• Resistance 2: P${formatCurrency(parseFloat(t.resistance2))}\n`;

    if (t.week52_high || t.week52_low) {
      report += `\n• 52-Week High: ${t.week52_high ? 'P' + formatCurrency(parseFloat(t.week52_high)) : 'N/A'}\n`;
      report += `• 52-Week Low:  ${t.week52_low  ? 'P' + formatCurrency(parseFloat(t.week52_low))  : 'N/A'}\n`;
      if (t.week52_high && t.week52_low && livePrice) {
        const range = parseFloat(t.week52_high) - parseFloat(t.week52_low);
        const pos   = ((livePrice - parseFloat(t.week52_low)) / range * 100).toFixed(1);
        report += `• 52-Week Position: ${pos}% of range (0%=at year low, 100%=at year high)\n`;
      }
    }

    if (t.volume || t.avg_volume_10d) {
      report += `\n• Volume:        ${t.volume ? parseInt(t.volume).toLocaleString() : 'N/A'}\n`;
      report += `• Avg Vol 10d:   ${t.avg_volume_10d ? parseInt(t.avg_volume_10d).toLocaleString() : 'N/A'}\n`;
      if (t.volume && t.avg_volume_10d && parseFloat(t.avg_volume_10d) > 0) {
        const spike = (parseFloat(t.volume) / parseFloat(t.avg_volume_10d)).toFixed(2);
        report += `• Volume vs Avg: ${spike}x (${parseFloat(spike) >= 2 ? 'HIGH — unusual activity' : parseFloat(spike) >= 1.5 ? 'Elevated' : 'Normal'})\n`;
      }
    }

    if (t.updated_at) report += `\n• Data as of: ${t.updated_at.slice(0, 16).replace('T', ' ')} UTC\n`;
    if (t.candles_used) report += `• Candles used: ${t.candles_used} days of OHLCV\n`;

  } else if (staticData && staticData.technical) {
    const t = staticData.technical;
    report += `• RSI(14): ${t.rsi14} -> ${getRSIStatus(t.rsi14)}\n`;
    if (t.macd !== undefined) report += `• MACD: ${t.macd > 0 ? '+' : ''}${t.macd} -> ${t.macdSignal}\n`;
    report += `• Moving Averages Signal: ${t.allMAsignal}\n`;
    if (t.ma20)  report += `  - 20-day MA: P${formatCurrency(t.ma20)}\n`;
    if (t.ma50)  report += `  - 50-day MA: P${formatCurrency(t.ma50)}\n`;
    if (t.ma100) report += `  - 100-day MA: P${formatCurrency(t.ma100)}\n`;
    if (t.ma200) report += `  - 200-day MA: P${formatCurrency(t.ma200)}\n`;
    report += `\n• Support Levels: P${formatCurrency(t.support1)}`;
    if (t.support2) report += ` / P${formatCurrency(t.support2)}`;
    report += `\n• Resistance Levels: P${formatCurrency(t.resistance1)}`;
    if (t.resistance2) report += ` / P${formatCurrency(t.resistance2)}`;
    report += `\n\n• Pattern: ${t.pattern}\n`;
    report += `• Overall Signal: ${t.overallSignal}\n`;
  } else if (staticWatchlist) {
    report += `• RSI: ${staticWatchlist.rsi} -> ${getRSIStatus(staticWatchlist.rsi)}\n`;
    report += `• Overall Signal: ${staticWatchlist.overallSignal}\n`;
  }
  report += '\n';

  // ── Intelligence signals (live from sterling_intelligence) ───────────────────
  if (liveIntel.length > 0) {
    report += `${'━'.repeat(50)}\n`;
    report += `INTELLIGENCE SIGNALS (live from Supabase)\n`;
    report += `${'━'.repeat(50)}\n\n`;

    for (const intel of liveIntel) {
      report += `[${(intel.pillar || 'signal').toUpperCase()}] Verdict: ${intel.verdict || 'N/A'}\n`;
      if (intel.ai_summary) report += `${intel.ai_summary}\n`;
      if (intel.points) {
        try {
          const pts = JSON.parse(intel.points);
          if (Array.isArray(pts) && pts.length > 0) {
            pts.forEach(p => { report += `  • ${p}\n`; });
          }
        } catch (e) { /* non-JSON points, skip */ }
      }
      if (intel.analyzed_at) report += `  (as of ${intel.analyzed_at.slice(0, 16).replace('T', ' ')} UTC)\n`;
      report += '\n';
    }
  }

  // ── Analyst Consensus (static only) ──────────────────────────────────────────
  if (staticStock && staticStock.analyst) {
    report += `${'━'.repeat(50)}\n`;
    report += `ANALYST CONSENSUS (static — ${staticStock.analyst.lastUpdated || '2026-03-02'})\n`;
    report += `${'━'.repeat(50)}\n\n`;

    const a = staticStock.analyst;
    report += `• Consensus: ${a.consensusRating}\n`;
    if (a.numberOfAnalysts) report += `• Number of Analysts: ${a.numberOfAnalysts}\n`;
    if (a.buyRatings)       report += `• Buy Ratings: ${a.buyRatings} out of ${a.numberOfAnalysts}\n`;
    if (a.targetPriceLow)   report += `• Target Price Low: P${formatCurrency(a.targetPriceLow)}\n`;
    if (a.targetPriceAvg) {
      const base = livePrice || staticData.currentPrice;
      const upside = base ? ((a.targetPriceAvg - base) / base * 100).toFixed(1) : '?';
      report += `• Target Price Average: P${formatCurrency(a.targetPriceAvg)} (+${upside}% upside from current)\n`;
    }
    if (a.targetPriceHigh) {
      const base = livePrice || staticData.currentPrice;
      const upside = base ? ((a.targetPriceHigh - base) / base * 100).toFixed(1) : '?';
      report += `• Target Price High: P${formatCurrency(a.targetPriceHigh)} (+${upside}% upside)\n`;
    }
    if (a.targetPrice2026End) report += `• 2026 End Target: P${formatCurrency(a.targetPrice2026End)}\n`;
    report += `• Source: ${a.source}\n\n`;
  } else if (staticWatchlist && staticWatchlist.targetBuy) {
    report += `${'━'.repeat(50)}\n`;
    report += `TARGETS\n`;
    report += `${'━'.repeat(50)}\n\n`;
    report += `• Target Buy Price: P${formatCurrency(staticWatchlist.targetBuy)}\n`;
    report += `• Stop Loss: P${formatCurrency(staticWatchlist.stopLoss)}\n`;
    report += `• Target 1: P${formatCurrency(staticWatchlist.target1)}\n`;
    report += `• Target 2: P${formatCurrency(staticWatchlist.target2)}\n\n`;
  }

  // ── Latest News (live from sterling_news) ─────────────────────────────────────
  if (liveNews.length > 0) {
    report += `${'━'.repeat(50)}\n`;
    report += `LATEST NEWS (live from Supabase)\n`;
    report += `${'━'.repeat(50)}\n\n`;

    for (const item of liveNews) {
      const dateStr = item.published_at ? item.published_at.slice(0, 10) : 'unknown date';
      report += `[${dateStr}] ${item.title || '(no title)'}\n`;
      if (item.summary) {
        const summary = item.summary.length > 200 ? item.summary.slice(0, 197) + '...' : item.summary;
        report += `  ${summary}\n`;
      }
      report += '\n';
    }
  }

  // ── What should you do? (static recommendation) ───────────────────────────────
  report += `${'━'.repeat(50)}\n`;
  report += `WHAT SHOULD YOU DO?\n`;
  report += `${'━'.repeat(50)}\n\n`;

  if (staticStock && staticStock.recommendation) {
    const r = staticStock.recommendation;
    report += `VERDICT: ${r.action}\n`;
    report += `Conviction: ${r.conviction}\n\n`;
    report += `WHY:\n`;
    report += `${r.rationale.split('\n').map(line => `  ${line}`).join('\n')}\n\n`;
    report += `ACTION PLAN:\n`;
    report += `${r.action_detail.split('\n').map(line => `  ${line}`).join('\n')}\n\n`;
    report += `PRICE LEVELS:\n`;
    report += `• Entry Zone: ${r.entry_zone}\n`;
    report += `• Stop Loss: ${r.stop_loss}\n`;
    report += `• Take Profit 1: ${r.take_profit_1}\n`;
    report += `• Take Profit 2: ${r.take_profit_2}\n\n`;
    report += `NOTE: Recommendation is from static database (${staticStock.analyst?.lastUpdated || '2026-03-02'}). Price levels above may be stale — use live technicals section for current support/resistance.\n\n`;
  } else if (staticWatchlist) {
    report += `VERDICT: ${staticWatchlist.overallSignal}\n\n`;
    report += `ANALYSIS:\n${staticWatchlist.reason}\n\n`;
    report += `PRICE LEVELS:\n`;
    report += `• Buy Zone: P${formatCurrency(staticWatchlist.targetBuy)} or below\n`;
    report += `• Stop Loss: P${formatCurrency(staticWatchlist.stopLoss)}\n`;
    report += `• Target 1: P${formatCurrency(staticWatchlist.target1)}\n`;
    report += `• Target 2: P${formatCurrency(staticWatchlist.target2)}\n\n`;
  } else {
    report += `Recommendation data not yet in static database.\n`;
    report += `Review live technicals and intelligence signals above for trade planning.\n\n`;
  }

  // ── Source links ──────────────────────────────────────────────────────────────
  report += `${'━'.repeat(50)}\n`;
  report += `SOURCE LINKS\n`;
  report += `${'━'.repeat(50)}\n\n`;
  report += `• TradingView Chart: https://www.tradingview.com/symbols/PSE-${symbol}/technicals/\n`;
  report += `• Investing.com Technicals: https://www.investing.com/equities/${slug}-technical\n`;
  report += `• PSE Edge Disclosures: https://edge.pse.com.ph (search ${symbol})\n`;
  report += `• Investagrams: https://www.investagrams.com/Stock/${symbol}\n`;
  report += `• DragonFi: https://www.dragonfi.ph/market/stocks/${symbol}\n`;

  report += `\n${'='.repeat(60)}\n`;
  report += `--Sterling\n`;
  report += `Analysis generated: ${now}\n`;
  report += `Data freshness: ${hasLiveData ? 'LIVE (Supabase)' : 'STATIC (analysis-data.js — 2026-03-02)'}\n`;
  report += `${'='.repeat(60)}\n`;

  return report;
}

// ─── List available symbols (from static + Supabase) ─────────────────────────

async function listAvailableStocks() {
  console.log('\nSterling Analysis Database');
  console.log('='.repeat(40));
  console.log('\nStatic portfolio stocks (analysis-data.js):');
  for (const [sym, data] of Object.entries(analysisData.stocks)) {
    console.log(`  ${sym.padEnd(8)} - ${data.company}`);
  }
  if (analysisData.watchlistAnalysis) {
    console.log('\nStatic watchlist stocks:');
    for (const [sym, data] of Object.entries(analysisData.watchlistAnalysis)) {
      console.log(`  ${sym.padEnd(8)} - ${data.company}`);
    }
  }

  // Also pull live symbols from Supabase
  try {
    const [portfolioRows, watchlistRows] = await Promise.all([
      sbGet('sterling_portfolio?select=symbol'),
      sbGet('sterling_watchlist?select=symbol')
    ]);
    const liveSymbols = [...new Set([
      ...portfolioRows.map(r => r.symbol),
      ...watchlistRows.map(r => r.symbol)
    ])].filter(Boolean);
    if (liveSymbols.length > 0) {
      console.log('\nLive symbols in Supabase (sterling_portfolio + sterling_watchlist):');
      console.log(' ', liveSymbols.join(', '));
    }
  } catch (e) {
    console.log('\n(Could not fetch live Supabase symbols)');
  }

  console.log('\nUsage: node full-analysis.js <SYMBOL>');
  console.log('       node full-analysis.js ALL  (run all portfolio symbols)\n');
}

// ─── ALL mode: run for every symbol in portfolio ──────────────────────────────

async function runAll() {
  let symbols = Object.keys(analysisData.stocks);
  try {
    const rows = await sbGet('sterling_portfolio?select=symbol');
    const live = rows.map(r => r.symbol).filter(Boolean);
    symbols = [...new Set([...symbols, ...live])];
  } catch (e) { /* use static list */ }

  console.log(`\nRunning full analysis for ${symbols.length} symbols: ${symbols.join(', ')}\n`);
  for (const sym of symbols) {
    const report = await generateFullAnalysis(sym);
    if (report) console.log(report);
    // brief pause between symbols to avoid hammering Supabase
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const symbol = process.argv[2]?.toUpperCase();

  if (!symbol || symbol === '--HELP' || symbol === '-H') {
    listAvailableStocks().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  } else if (symbol === 'ALL') {
    runAll().catch(e => { console.error('Fatal:', e); process.exit(1); });
  } else {
    generateFullAnalysis(symbol).then(report => {
      if (report) { console.log(report); process.exit(0); }
      else process.exit(1);
    }).catch(e => { console.error('Fatal:', e); process.exit(1); });
  }
}

module.exports = { generateFullAnalysis, listAvailableStocks };
