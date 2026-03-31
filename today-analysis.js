/**
 * Sterling — Today's Analysis
 * Single command: "What should I do with my stocks today?"
 *
 * Fetches live data from Supabase (prices, technicals, news, intelligence)
 * and asks Grok to summarise each holding in plain English for a beginner trader.
 * Also recommends the best dividend stock to buy/accumulate today.
 *
 * Usage:
 *   node today-analysis.js            — full daily brief for all portfolio stocks
 *   node today-analysis.js MBT        — single stock focus
 *   node today-analysis.js dividends  — dividend buy ranking only
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const GROK_KEY = process.env.XAI_API_KEY;
const SB_HOST  = 'fhfqjcvwcxizbioftvdw.supabase.co';
const SB_KEY   = process.env.SUPABASE_KEY;

// ── Supabase helper ───────────────────────────────────────────────────────────

function sbGet(query) {
  return new Promise((resolve) => {
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

// ── Grok AI helper ────────────────────────────────────────────────────────────

function askGrok(prompt, maxTokens = 350) {
  return new Promise((resolve) => {
    if (!GROK_KEY) return resolve('(Grok not available — XAI_API_KEY not set)');
    const payload = JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    });
    const req = https.request({
      hostname: 'api.x.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROK_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.error) return resolve('(AI unavailable: ' + json.error.message + ')');
          resolve(json.choices?.[0]?.message?.content?.trim() || '(no response)');
        } catch (e) { resolve('(parse error)'); }
      });
    });
    req.on('error', () => resolve('(network error)'));
    req.setTimeout(45000, () => { req.destroy(); resolve('(timeout)'); });
    req.write(payload);
    req.end();
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n, d = 2) {
  if (n === null || n === undefined || typeof n !== 'number') return 'N/A';
  return n.toFixed(d);
}

function fmtP(n) {
  if (n === null || n === undefined) return 'N/A';
  const v = parseFloat(n);
  return isNaN(v) ? 'N/A' : 'P' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signStr(n) {
  const v = parseFloat(n);
  return isNaN(v) ? '' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// ── Load all live data ────────────────────────────────────────────────────────

async function loadAllData(userId = 'carlo') {
  const [portfolio, technicals, news, intelligence] = await Promise.all([
    sbGet('sterling_portfolio?select=*&user_id=eq.' + userId),
    sbGet('sterling_technicals?select=*&order=updated_at.desc'),
    sbGet('sterling_news?select=symbol,title,summary,sentiment,published_at&order=published_at.desc&limit=100'),
    sbGet('sterling_intelligence?select=*&order=analyzed_at.desc')
  ]);

  // Index by symbol (latest record per symbol for technicals)
  const techMap = {};
  for (const t of (Array.isArray(technicals) ? technicals : [])) {
    if (!techMap[t.symbol]) techMap[t.symbol] = t;
  }

  const newsMap = {};
  for (const n of (Array.isArray(news) ? news : [])) {
    if (!newsMap[n.symbol]) newsMap[n.symbol] = [];
    if (newsMap[n.symbol].length < 3) newsMap[n.symbol].push(n);
  }

  const intelMap = {};
  for (const i of (Array.isArray(intelligence) ? intelligence : [])) {
    if (!intelMap[i.symbol]) intelMap[i.symbol] = {};
    if (!intelMap[i.symbol][i.pillar]) intelMap[i.symbol][i.pillar] = i;
  }

  return {
    portfolio: Array.isArray(portfolio) ? portfolio : [],
    techMap,
    newsMap,
    intelMap
  };
}

// ── Single stock analysis ─────────────────────────────────────────────────────

async function analyzeStock(stock, tech, newsItems, intel) {
  const symbol      = stock.symbol;
  const price       = parseFloat(stock.current_price) || 0;
  const avgBuy      = parseFloat(stock.avg_buy_price) || 0;
  const plPct       = stock.unrealized_pl_pct !== null ? parseFloat(stock.unrealized_pl_pct) : ((price - avgBuy) / avgBuy * 100);
  const shares      = parseInt(stock.qty) || 0;
  const divYield    = parseFloat(stock.dividend_yield) || 0;
  const company     = stock.company_name || symbol;

  // Build context string for Grok
  const priceLine  = `Current price: P${price}, you bought at P${avgBuy.toFixed(2)}, P&L: ${signStr(plPct)}`;
  const divLine    = divYield > 0 ? `Dividend yield: ${divYield}%/year` : '';
  const techLine   = tech
    ? `Technicals: RSI ${fmt(tech.rsi14)} (${tech.rsi_signal || ''}), Overall signal: ${tech.overall_signal || 'N/A'}, MACD: ${tech.macd_signal || 'N/A'}`
    : 'Technicals: not available';
  const newsLine   = newsItems && newsItems.length > 0
    ? 'Recent news: ' + newsItems.slice(0, 2).map(n => '"' + (n.title || n.headline || '').slice(0, 80) + '"').join('; ')
    : 'No recent news';
  const intelLine  = intel && intel.morning_brief
    ? 'AI morning signal: ' + (intel.morning_brief.verdict || '') + ' — ' + (intel.morning_brief.ai_summary || '').slice(0, 100)
    : '';

  const prompt = `You are Sterling, a mentor to a beginner Philippine stock investor named Carlo.
Carlo holds ${shares.toLocaleString()} shares of ${symbol} (${company}).
${priceLine}.
${divLine}
${techLine}
${newsLine}
${intelLine ? intelLine : ''}

In 2-3 sentences, tell Carlo in plain English:
1. How this stock is performing today
2. Whether he should HOLD, ACCUMULATE MORE, or WAIT before adding
3. One key thing to watch

End with a plain verdict: ACCUMULATE | ADD ON DIP | HOLD & COLLECT | MONITOR | WAIT`;

  const aiText = await askGrok(prompt, 280);

  // Extract verdict
  const match = aiText.match(/\b(ACCUMULATE|ADD ON DIP|HOLD & COLLECT|MONITOR|WAIT)\b/i);
  const verdict = match ? match[1].toUpperCase() : 'MONITOR';
  const summary = aiText.replace(/\n?\b(ACCUMULATE|ADD ON DIP|HOLD & COLLECT|MONITOR|WAIT)\b.*$/i, '').trim();

  return { symbol, company, price, avgBuy, plPct, shares, divYield, verdict, summary, tech, newsItems };
}

// ── Dividend ranking ──────────────────────────────────────────────────────────

function rankByDividend(stockResults, intelMap) {
  // Combine fundamentals from static data with live data
  const analysisData = require('./analysis-data');

  const ranked = [];
  for (const r of stockResults) {
    const staticStock = analysisData.stocks[r.symbol] || analysisData.watchlistAnalysis[r.symbol];
    const divYield = r.divYield || (staticStock && staticStock.fundamental && staticStock.fundamental.dividendYield) || 0;
    const nav      = staticStock && staticStock.fundamental && staticStock.fundamental.nav ? staticStock.fundamental.nav : null;
    const pe       = staticStock && staticStock.fundamental && staticStock.fundamental.pe   ? staticStock.fundamental.pe   : null;
    const techSignal = r.tech ? r.tech.overall_signal : 'N/A';

    // Score: dividend yield is king, discounted by bad technical signal
    let score = divYield;
    if (techSignal === 'Strong Buy' || techSignal === 'Buy') score += 1.5;
    else if (techSignal === 'Sell' || techSignal === 'Strong Sell') score -= 1.5;

    // NAV discount bonus (REITs with big discount get +bonus)
    if (nav && r.price > 0) {
      const navDiscount = (nav - r.price) / nav * 100;
      if (navDiscount > 20) score += 1.0;
      if (navDiscount > 30) score += 0.5;
    }

    ranked.push({ ...r, divYield, nav, pe, techSignal, score });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

// ── Print report ──────────────────────────────────────────────────────────────

function printReport(stockResults, dividendRanking, date) {
  console.log('\n' + '='.repeat(62));
  console.log('  STERLING — Today\'s Analysis');
  console.log('  ' + date);
  console.log('='.repeat(62));

  // Portfolio summary
  let totalValue = 0;
  let totalCost  = 0;
  for (const r of stockResults) {
    totalValue += r.price * r.shares;
    totalCost  += r.avgBuy * r.shares;
  }
  const totalPL    = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost * 100) : 0;

  console.log('\nPORTFOLIO SNAPSHOT');
  console.log('  Total value:    ' + fmtP(totalValue));
  console.log('  Total cost:     ' + fmtP(totalCost));
  console.log('  Unrealized P&L: ' + signStr(totalPLPct) + ' (' + (totalPL >= 0 ? '+' : '') + 'P' + Math.abs(totalPL).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ')');

  // Per-stock analysis
  console.log('\n' + '─'.repeat(62));
  console.log('WHAT TO DO WITH EACH STOCK TODAY');
  console.log('─'.repeat(62));

  const VERDICT_SYMBOLS = {
    'ACCUMULATE':    '[BUY MORE]',
    'ADD ON DIP':    '[ADD ON DIP]',
    'HOLD & COLLECT':'[HOLD]',
    'MONITOR':       '[WATCH]',
    'WAIT':          '[WAIT]'
  };

  for (const r of stockResults) {
    const vLabel = VERDICT_SYMBOLS[r.verdict] || '[WATCH]';
    const plLine = r.plPct >= 0
      ? `up ${r.plPct.toFixed(1)}%`
      : `down ${Math.abs(r.plPct).toFixed(1)}%`;

    console.log('\n' + r.symbol + ' — ' + r.company);
    console.log('  Price: ' + fmtP(r.price) + ' (' + plLine + ' from your buy price of ' + fmtP(r.avgBuy) + ')');
    if (r.divYield > 0) console.log('  Dividend yield: ' + r.divYield.toFixed(1) + '%/year');
    if (r.tech && r.tech.overall_signal) console.log('  Technical signal: ' + r.tech.overall_signal + (r.tech.rsi14 ? ' | RSI ' + fmt(r.tech.rsi14) : ''));
    console.log('\n  ' + r.summary.split('\n').join('\n  '));
    console.log('\n  VERDICT: ' + vLabel + ' ' + r.verdict);
  }

  // Dividend ranking
  console.log('\n' + '='.repeat(62));
  console.log('BEST DIVIDEND STOCKS TO BUY TODAY (ranked by income potential)');
  console.log('='.repeat(62));
  console.log('\n  This ranking shows which stock gives you the most passive income');
  console.log('  right now, considering dividend yield + value + technical signal.\n');

  for (let i = 0; i < Math.min(dividendRanking.length, 5); i++) {
    const r = dividendRanking[i];
    const navStr = r.nav && r.price > 0
      ? ` | NAV P${r.nav} (${((r.nav - r.price) / r.nav * 100).toFixed(0)}% discount)`
      : '';
    const peStr  = r.pe ? ` | P/E ${r.pe}x` : '';
    const num    = (i + 1) + '.';
    console.log(`  ${num} ${r.symbol.padEnd(7)} Yield: ${r.divYield.toFixed(1)}%${navStr}${peStr}`);
    console.log(`         Signal: ${r.techSignal || 'N/A'} | Your P&L: ${signStr(r.plPct)}`);
    if (i === 0) console.log('         *** BEST DIVIDEND BUY TODAY ***');
    console.log('');
  }

  console.log('─'.repeat(62));
  console.log('NOTE: Dividend yield is the income you earn just for holding.');
  console.log('A 7% yield means P7 for every P100 invested, paid every year.');
  console.log('REITs (KEEPR, FILRT, MREIT) pay dividends quarterly.');
  console.log('─'.repeat(62));

  // Footer
  console.log('\nDATA FRESHNESS:');
  console.log('  Prices     — live (Phisix / Supabase sterling_portfolio)');
  console.log('  Technicals — live (TradingView via sterling_technicals)');
  console.log('  News       — live (Grok summaries in sterling_news)');
  console.log('  AI brief   — generated now via Grok');
  console.log('\n  DASHBOARD: https://heylencer-debug.github.io/Sterling');
  console.log('  Update prices:     node fetch-prices.js');
  console.log('  Update technicals: node fetch-technicals-tv.js');
  console.log('  Update news:       node fetch-news.js\n');
  console.log('='.repeat(62));
  console.log('  --Sterling');
  console.log('  Analysis generated: ' + new Date().toISOString().split('T')[0]);
  console.log('='.repeat(62) + '\n');
}

// ── Single stock mode ─────────────────────────────────────────────────────────

async function runSingleStock(symbol, data) {
  const stock = data.portfolio.find(s => s.symbol === symbol.toUpperCase());
  if (!stock) {
    console.log('\n' + symbol + ' is not in your portfolio.');
    console.log('Run "node today-analysis.js" to see all holdings.\n');
    return;
  }
  const tech  = data.techMap[symbol.toUpperCase()];
  const news  = data.newsMap[symbol.toUpperCase()] || [];
  const intel = data.intelMap[symbol.toUpperCase()];

  console.log('\n' + '='.repeat(62));
  console.log('  STERLING — Focus: ' + symbol.toUpperCase());
  console.log('='.repeat(62) + '\n');

  process.stdout.write('  Asking Grok for analysis...\n');
  const result = await analyzeStock(stock, tech, news, intel);

  console.log('\n' + result.symbol + ' — ' + result.company);
  console.log('  Price: ' + fmtP(result.price) + ' | Avg buy: ' + fmtP(result.avgBuy) + ' | P&L: ' + signStr(result.plPct));
  if (result.divYield > 0) console.log('  Dividend yield: ' + result.divYield.toFixed(1) + '%/year');
  if (tech) {
    console.log('  RSI: ' + fmt(tech.rsi14) + ' | Signal: ' + (tech.overall_signal || 'N/A') + ' | MACD: ' + (tech.macd_signal || 'N/A'));
    if (tech.support1) console.log('  Support: ' + fmtP(tech.support1) + ' | Resistance: ' + fmtP(tech.resistance1));
    if (tech.week52_high) console.log('  52-week high: ' + fmtP(tech.week52_high) + ' | 52-week low: ' + fmtP(tech.week52_low));
  }

  if (news.length > 0) {
    console.log('\n  RECENT NEWS:');
    for (const n of news) {
      const d = n.published_at ? n.published_at.slice(0, 10) : '?';
      console.log('  [' + d + '] ' + (n.title || n.headline || ''));
    }
  }

  console.log('\n  STERLING SAYS:');
  console.log('  ' + result.summary.split('\n').join('\n  '));
  console.log('\n  VERDICT: ' + result.verdict + '\n');
}

// ── Dividend-only mode ────────────────────────────────────────────────────────

async function runDividendPicks(data) {
  const analysisData = require('./analysis-data');

  console.log('\n' + '='.repeat(62));
  console.log('  STERLING — Best Dividend Stocks to Buy Today');
  console.log('='.repeat(62));
  console.log('\n  Ranking your portfolio stocks by income potential.\n');
  console.log('  What this means: Dividend yield = how much cash you earn');
  console.log('  per year just for holding the stock. A 7% yield on P10,000');
  console.log('  invested = P700 in cash dividends per year.\n');

  const results = [];
  for (const stock of data.portfolio) {
    const tech = data.techMap[stock.symbol];
    const staticStock = analysisData.stocks[stock.symbol] || analysisData.watchlistAnalysis[stock.symbol];
    const divYield = parseFloat(stock.dividend_yield) || (staticStock && staticStock.fundamental && staticStock.fundamental.dividendYield) || 0;
    const nav = staticStock && staticStock.fundamental && staticStock.fundamental.nav ? staticStock.fundamental.nav : null;
    const pe  = staticStock && staticStock.fundamental && staticStock.fundamental.pe   ? staticStock.fundamental.pe   : null;
    const price   = parseFloat(stock.current_price)   || 0;
    const avgBuy  = parseFloat(stock.avg_buy_price)   || 0;
    const plPct   = stock.unrealized_pl_pct !== null ? parseFloat(stock.unrealized_pl_pct) : ((price - avgBuy) / avgBuy * 100);
    const techSignal = tech ? tech.overall_signal : 'N/A';

    let score = divYield;
    if (techSignal === 'Strong Buy' || techSignal === 'Buy') score += 1.5;
    else if (techSignal === 'Sell' || techSignal === 'Strong Sell') score -= 1.5;
    if (nav && price > 0) {
      const navDiscount = (nav - price) / nav * 100;
      if (navDiscount > 20) score += 1.0;
      if (navDiscount > 30) score += 0.5;
    }

    results.push({ symbol: stock.symbol, company: stock.company_name, price, avgBuy, plPct, divYield, nav, pe, techSignal, score });
  }

  results.sort((a, b) => b.score - a.score);

  let rank = 1;
  for (const r of results) {
    if (r.divYield <= 0) continue;
    const navStr = r.nav && r.price > 0
      ? ' | NAV: P' + r.nav + ' (' + ((r.nav - r.price) / r.nav * 100).toFixed(0) + '% discount to real value)'
      : '';
    const peStr = r.pe ? ' | P/E: ' + r.pe + 'x' : '';
    const plLine = r.plPct >= 0
      ? 'up ' + r.plPct.toFixed(1) + '% from your buy price'
      : 'down ' + Math.abs(r.plPct).toFixed(1) + '% from your buy price';

    console.log('  #' + rank + '. ' + r.symbol + ' — ' + r.company);
    console.log('      Yield: ' + r.divYield.toFixed(1) + '% annually' + navStr + peStr);
    console.log('      Price: ' + fmtP(r.price) + ' (' + plLine + ')');
    console.log('      Technical signal: ' + r.techSignal);
    if (rank === 1) {
      console.log('      >>> BEST DIVIDEND INCOME STOCK IN YOUR PORTFOLIO TODAY <<<');
      console.log('      This stock pays the most passive income per peso invested,');
      console.log('      adjusted for current technical conditions.');
    }
    console.log('');
    rank++;
  }

  console.log('─'.repeat(62));
  console.log('  KEY TERMS FOR BEGINNERS:');
  console.log('  Dividend yield: cash paid to you per year / current price x 100');
  console.log('  NAV discount: stock trading below its real asset value (cheap)');
  console.log('  P/E ratio: how much you pay per P1 of company earnings (lower = cheaper)');
  console.log('  Technical signal: whether the price chart says buy/hold/sell');
  console.log('─'.repeat(62) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const arg = (process.argv[2] || '').toUpperCase();

  const date = new Date().toLocaleString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Manila'
  });

  // Optional: node today-analysis.js [SYMBOL|dividends] [userId]
  // Default user is 'carlo'. Pass a second arg to switch users.
  const userId = (process.argv[3] || 'carlo').toLowerCase();

  if (arg === 'DIVIDENDS' || arg === 'DIVIDEND') {
    const data = await loadAllData(userId);
    await runDividendPicks(data);
    return;
  }

  // Load all live data first
  console.log('\nSterling — Loading live data from Supabase...');
  const data = await loadAllData(userId);

  if (data.portfolio.length === 0) {
    console.log('\nNo portfolio data found in Supabase sterling_portfolio.');
    console.log('Run: node fetch-prices.js  to update portfolio prices first.\n');
    process.exit(1);
  }

  if (arg && arg !== 'ALL' && arg !== 'DIVIDENDS' && arg !== 'DIVIDEND') {
    await runSingleStock(arg, data);
    return;
  }

  // Full portfolio analysis
  console.log('  Found ' + data.portfolio.length + ' positions. Asking Grok for analysis...\n');

  const stockResults = [];
  for (const stock of data.portfolio) {
    const tech  = data.techMap[stock.symbol];
    const news  = data.newsMap[stock.symbol] || [];
    const intel = data.intelMap[stock.symbol];
    process.stdout.write('  ' + stock.symbol + '... ');
    const result = await analyzeStock(stock, tech, news, intel);
    stockResults.push(result);
    console.log(result.verdict);
    // Avoid Grok rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  const dividendRanking = rankByDividend(stockResults, data.intelMap);
  printReport(stockResults, dividendRanking, date);
}

main().catch(e => { console.error('\nFatal:', e.message); process.exit(1); });
