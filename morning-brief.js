/**
 * Sterling - Morning Brief (Mentor-Broker Edition)
 * Daily morning report with teaching + brokerage insights
 * Carlo is learning stocks. Sterling teaches AND brokers simultaneously.
 */

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { fetchPrices, getPortfolio } = require('./fetch-prices');
// generateMarketIntel: reads from DB if available, otherwise returns placeholder intel
function generateMarketIntel(holdings) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(__dirname, 'sterling.db'));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='news'").all();
    if (tables.length > 0) {
      const symbols = holdings.map(h => h.symbol);
      const placeholders = symbols.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT symbol, headline, ai_summary as explanation FROM news WHERE symbol IN (${placeholders}) ORDER BY fetched_at DESC LIMIT 8`
      ).all(...symbols);
      if (rows.length > 0) return rows;
    }
  } catch (e) { /* DB not ready */ }
  // Fallback: generic market intel
  return [
    { headline: 'PSE market opens for Wednesday session', explanation: 'Monitor opening prints for your positions before making any moves.' },
    { headline: 'Dividend stocks remain resilient amid market volatility', explanation: 'Your MREIT and FILRT positions benefit from steady dividend income regardless of price swings.' },
    { headline: 'Banking sector watches BSP rate decisions', explanation: 'MBT performance is sensitive to interest rate moves — higher rates can boost net interest margins.' },
    { headline: 'Run fetch-news.js to populate live market intel', explanation: 'No news DB found. Run `node fetch-news.js` to start pulling real headlines for your holdings.' },
  ];
}
const analysisData = require('./analysis-data');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Sector mappings for portfolio stocks
const SECTOR_MAP = {
  'DMC': 'Holding Firms',
  'FILRT': 'REITs',
  'GLO': 'Telecommunications',
  'KEEPR': 'REITs',
  'MBT': 'Banking',
  'MREIT': 'REITs',
  'RRHI': 'Consumer'
};

// Lessons array for the mentor component
const LESSONS = [
  {
    trigger: 'reit_down',
    title: 'Why REITs Drop When Rates Rise',
    content: `REITs like FILRT, KEEPR, and MREIT borrow money to buy properties.
When the BSP raises interest rates, their borrowing costs increase -> less profit -> smaller dividends.
That's why REIT prices often drop when rate hikes are announced.
The flip side: when rates fall, REITs rally. So REIT investing = tracking BSP policy closely.
Key: Always check if a REIT price drop is due to rates (temporary) or fundamentals (serious).`
  },
  {
    trigger: 'stock_down_big',
    title: 'Unrealized Loss vs Actual Loss',
    content: `A stock showing -10% on your portfolio feels bad -- but that money isn't "gone" yet.
An unrealized loss only becomes real when you SELL. As long as you hold, you still own the same number of shares.
The question to ask: Have the FUNDAMENTALS changed? If the company's business is still solid -- the stock is just temporarily cheap.
If the fundamentals are broken (declining revenue, massive debt) -- then reassess.
Never sell based on price alone. Sell based on fundamentals.`
  },
  {
    trigger: 'monday',
    title: 'How to Read a Stock\'s Week',
    content: `Mondays are good for planning, not panicking.
Professional traders look at the weekly chart first -- not the daily. Weekly charts filter out noise.
This week, watch the support and resistance levels on your holdings.
Set your watchpoints at the start of the week. Don't react intraday -- react to week-close prices.
Lesson: A stock that closes the week above support is healthy. Below support = warning sign.`
  },
  {
    trigger: 'dividend_approaching',
    title: 'Dividend Ex-Date -- What It Means',
    content: `Your REIT holdings pay dividends quarterly. Here's how it works:
1. PSE announces an "ex-dividend date" (ex-date)
2. You must OWN the stock BEFORE the ex-date to receive the dividend
3. On the ex-date, the stock price typically drops by roughly the dividend amount
4. The actual cash hits your account on the "payment date" (usually 2-4 weeks later)
Action: Check PSE Edge for upcoming ex-dates on your REIT holdings.`
  },
  {
    trigger: 'stock_up_big',
    title: 'When to Take Profits',
    content: `A stock up 10%+ is exciting -- but gains on paper can disappear.
Consider the "Rule of Thirds": Sell 1/3 to lock in profit, hold 1/3 for more upside, keep 1/3 as core position.
Key questions: Has the stock hit resistance? Is the rally on news or just momentum?
Never feel bad about taking profit. "No one ever went broke taking profits."
But also: don't sell just because it's green. Sell with a reason.`
  },
  {
    trigger: 'default',
    title: 'Reading a Candlestick Chart',
    content: `Every candle on a price chart tells a story about one trading day.
- Body = distance between open and close price
- Green candle = closed HIGHER than it opened (buyers won)
- Red candle = closed LOWER than it opened (sellers won)
- Wick = the high and low of the day beyond the open/close
A long lower wick on a green candle (called a "hammer") means sellers pushed the price way down but buyers reversed it. That's a bullish signal.
Next time you look at a chart, try to "read" what the last 3 candles are saying.`
  }
];

// Study assignments rotation
const STUDY_ASSIGNMENTS = [
  `Read FILRT's latest dividend disclosure on PSE Edge: edge.pse.com.ph -> search FILRT -> Disclosures. Look for the dividend per share and ex-date. Come back and tell me what you found.`,
  `Google "RSI indicator explained for beginners" -- read any one article. Tomorrow I'll show you where your stocks are on the RSI scale.`,
  `Look up MBT (Metrobank) on Investagrams. Check the "Fundamentals" tab. Note down the P/E ratio and Dividend Yield.`,
  `Read about "support and resistance" in stock trading. These are the invisible lines that guide price movement.`,
  `Check the BSP website for the latest monetary policy statement. Interest rates affect all your holdings, especially REITs.`,
  `Look at the 1-year chart of KEEPR. Identify the highest price and lowest price. That's the trading range.`,
  `Search "how to read stock volume" -- volume tells you if a price move is real or fake.`
];

function supabaseRequest(endpoint, method = 'GET', body = null) {
  const url = new URL(endpoint, SUPABASE_URL);
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      }
    };

    const req = https.request(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fetchPSEIndex() {
  return new Promise((resolve) => {
    // Read latest PSEi close from sterling_ohlcv (Yahoo Finance data)
    const path = `/rest/v1/sterling_ohlcv?symbol=eq.PSEi&order=date.desc&limit=2&select=date,close`;
    https.get({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (!Array.isArray(rows) || rows.length < 1) {
            resolve({ value: null, change_pct: null, as_of: new Date().toISOString(), error: 'No PSEi data — run fetch-ohlcv.js first' });
            return;
          }
          const latest = rows[0];
          const prev = rows[1] || rows[0];
          const change = prev.close > 0 ? ((latest.close - prev.close) / prev.close) * 100 : 0;
          resolve({
            value: parseFloat(latest.close),
            change_pct: parseFloat(change.toFixed(2)),
            as_of: latest.date,
            source: 'Yahoo Finance (sterling_ohlcv)'
          });
        } catch {
          resolve({ value: null, change_pct: null, as_of: new Date().toISOString(), error: 'Parse error' });
        }
      });
    }).on('error', () => resolve({ value: null, change_pct: null, error: 'Network error' }));
  });
}

async function getWatchlistAlerts() {
  const res = await supabaseRequest('/rest/v1/sterling_watchlist?select=*');
  const watchlist = res.data || [];

  return watchlist.filter(w => {
    if (!w.current_price || !w.target_buy_price) return false;
    return w.current_price <= w.target_buy_price * 1.02;
  });
}

async function sendTelegram(message) {
  const { spawnSync } = require('child_process');
  const openclaw = 'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';
  const result = spawnSync(
    process.execPath,
    [openclaw, 'message', 'send', '--channel', 'telegram', '--target', String(TELEGRAM_CHAT_ID), '--message', message],
    { timeout: 30000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.error) {
    console.log('Telegram send error:', result.error.message);
    return { status: 500, error: result.error.message };
  }
  console.log('Telegram send output:', (result.stdout || result.stderr || '(no output)').substring(0, 200));
  return { status: result.status === 0 ? 200 : 500 };
}

async function logActivity(action, details) {
  try {
    await supabaseRequest('/rest/v1/agent_activity', 'POST', {
      agent_name: 'sterling',
      action,
      details: JSON.stringify(details),
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.log('Failed to log activity:', err.message);
  }
}

async function saveBriefToSupabase(brief, summary) {
  try {
    const briefData = {
      brief_date: new Date().toISOString().split('T')[0],
      brief_text: brief,
      portfolio_value: summary.portfolio_value || 0,
      total_pl: summary.total_unrealized_pl || 0,
      total_pl_pct: summary.total_unrealized_pl_pct || 0,
      created_at: new Date().toISOString()
    };
    await supabaseRequest('/rest/v1/sterling_briefs', 'POST', briefData);
    console.log('Brief saved to Supabase');
  } catch (err) {
    console.log('Failed to save brief to Supabase:', err.message);
  }
}

function formatDate() {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  };
  return new Date().toLocaleDateString('en-PH', options);
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDayOfWeek() {
  return new Date().toLocaleDateString('en-PH', { weekday: 'long', timeZone: 'Asia/Manila' });
}

function selectLesson(holdings) {
  const dayOfWeek = getDayOfWeek();

  // Check for Monday
  if (dayOfWeek === 'Monday') {
    return LESSONS.find(l => l.trigger === 'monday');
  }

  // Check for REIT down >2%
  const reits = ['FILRT', 'KEEPR', 'MREIT'];
  const reitDown = holdings.find(h =>
    reits.includes(h.symbol) && (parseFloat(h.percent_change) || 0) < -2
  );
  if (reitDown) {
    return LESSONS.find(l => l.trigger === 'reit_down');
  }

  // Check for any stock down >5%
  const bigDown = holdings.find(h => (parseFloat(h.unrealized_pl_pct) || 0) < -5);
  if (bigDown) {
    return LESSONS.find(l => l.trigger === 'stock_down_big');
  }

  // Check for any stock up >8%
  const bigUp = holdings.find(h => (parseFloat(h.unrealized_pl_pct) || 0) > 8);
  if (bigUp) {
    return LESSONS.find(l => l.trigger === 'stock_up_big');
  }

  // Default - rotate by day of month
  const dayOfMonth = new Date().getDate();
  const defaultLessons = LESSONS.filter(l => l.trigger === 'default' || l.trigger === 'dividend_approaching');
  return defaultLessons[dayOfMonth % defaultLessons.length] || LESSONS.find(l => l.trigger === 'default');
}

function getStudyAssignment() {
  const dayOfMonth = new Date().getDate();
  return STUDY_ASSIGNMENTS[dayOfMonth % STUDY_ASSIGNMENTS.length];
}

function generateStockInsight(holding, livePrice, dayChange) {
  const symbol = holding.symbol;
  const analysis = analysisData.stocks[symbol];

  if (!analysis) {
    // Fallback for stocks not in analysis database
    return `Data unavailable. Check TradingView: https://www.tradingview.com/symbols/PSE-${symbol}/`;
  }

  const t = analysis.technical;
  const r = analysis.recommendation;

  // Build real insight from analysis data
  let insight = `${r.action}\n`;
  insight += `   Technical: ${t.overallSignal} | RSI: ${t.rsi14} (${t.rsiSignal})\n`;
  insight += `   ${t.pattern}\n`;
  insight += `   Target: ${r.take_profit_1} | Stop: ${r.stop_loss}`;

  return insight;
}

// Build detailed stock section with real analysis
function buildStockSection(holding, livePrice, liveChange) {
  const analysis = analysisData.stocks[holding.symbol];
  if (!analysis) return '';

  const avgBuy = parseFloat(holding.avg_buy_price) || 0;
  const price = livePrice || parseFloat(holding.current_price) || 0;
  const plPct = avgBuy > 0 ? ((price - avgBuy) / avgBuy * 100).toFixed(2) : 0;
  const plAmt = avgBuy > 0 ? ((price - avgBuy) * (holding.qty || 0)).toFixed(0) : 0;
  const dayEmoji = liveChange >= 1 ? '\u{1F7E2}' : liveChange <= -1 ? '\u{1F534}' : '\u26AA';

  let section = `${dayEmoji} ${holding.symbol} -- ${analysis.company}\n`;
  section += `Price: P${price.toFixed(2)} | Day: ${liveChange > 0 ? '+' : ''}${liveChange.toFixed(2)}% | P&L: ${plAmt >= 0 ? '+' : ''}P${parseInt(plAmt).toLocaleString()} (${plPct}%)\n`;
  section += `Action: ${analysis.recommendation.action}\n`;
  section += `${analysis.technical.pattern}\n`;
  section += `Target: ${analysis.recommendation.take_profit_1} | Stop: ${analysis.recommendation.stop_loss}\n`;

  return section;
}

function generateAnalysis(holdings) {
  // Pick the stock with most movement for deep dive using real data
  const sorted = [...holdings].sort((a, b) =>
    Math.abs(parseFloat(b.unrealized_pl_pct) || 0) - Math.abs(parseFloat(a.unrealized_pl_pct) || 0)
  );

  const topStock = sorted[0];
  if (!topStock) return '';

  const symbol = topStock.symbol;
  const data = analysisData.stocks[symbol];

  if (!data) {
    return `${symbol} -- Data unavailable. Check TradingView manually: https://www.tradingview.com/symbols/PSE-${symbol}/`;
  }

  const t = data.technical;
  const f = data.fundamental;
  const a = data.analyst;
  const r = data.recommendation;

  let analysis = `${symbol} -- ${data.company} (${data.sector})\n\n`;

  // Fundamentals with real data
  analysis += `FUNDAMENTALS:\n`;
  analysis += `- P/E: ${f.pe}x vs sector avg ${f.sectorAvgPE || 11}x -> ${f.pe < (f.sectorAvgPE || 11) ? 'CHEAP' : 'FAIR'}\n`;
  analysis += `- Dividend Yield: ${f.dividendYield}% -> ${f.dividendYield > 6 ? 'STRONG' : f.dividendYield > 4 ? 'GOOD' : 'MODERATE'}\n`;
  if (f.nav) analysis += `- NAV: P${f.nav} | Discount to NAV: ${f.discountToNav}%\n`;
  if (f.roe) analysis += `- ROE: ${f.roe}%\n`;

  analysis += `\nTECHNICALS (Investing.com):\n`;
  analysis += `- RSI(14): ${t.rsi14} -> ${t.rsiSignal}\n`;
  analysis += `- Moving Averages: ${t.allMAsignal}\n`;
  analysis += `- Pattern: ${t.pattern}\n`;
  analysis += `- Support: P${t.support1}${t.support2 ? ' / P' + t.support2 : ''}\n`;
  analysis += `- Resistance: P${t.resistance1}${t.resistance2 ? ' / P' + t.resistance2 : ''}\n`;

  if (a) {
    analysis += `\nANALYST VIEW:\n`;
    analysis += `- Consensus: ${a.consensusRating}`;
    if (a.numberOfAnalysts) analysis += ` (${a.numberOfAnalysts} analysts)`;
    analysis += `\n`;
    if (a.targetPriceAvg) {
      const upside = ((a.targetPriceAvg - data.currentPrice) / data.currentPrice * 100).toFixed(1);
      analysis += `- Avg Target: P${a.targetPriceAvg} (+${upside}% upside)\n`;
    }
    if (a.source) analysis += `- Source: ${a.source}\n`;
  }

  analysis += `\nVERDICT: ${r.action}\n`;
  analysis += `Entry: ${r.entry_zone} | Stop: ${r.stop_loss}\n`;
  analysis += `Target 1: ${r.take_profit_1}\n`;
  analysis += `Target 2: ${r.take_profit_2}`;

  return analysis;
}

async function generateMorningBrief() {
  console.log('Sterling: Generating morning brief (Mentor-Broker Mode)...\n');

  // Step 1: Fetch fresh prices
  console.log('Step 1: Fetching live prices...');
  let priceResult;
  try {
    priceResult = await fetchPrices();
  } catch (err) {
    console.log('Price fetch error:', err.message);
    priceResult = { success: false, holdings: [] };
  }

  // Step 2: Get portfolio data
  const portfolio = await getPortfolio();
  const holdings = priceResult.holdings || [];

  // Step 3: Get PSEi
  const psei = await fetchPSEIndex();

  // Step 4: Get watchlist alerts
  const watchlistAlerts = await getWatchlistAlerts();

  // Step 5: Generate market intel
  const marketIntel = generateMarketIntel(holdings);

  // Build the brief
  const date = formatDate();
  const dayOfWeek = getDayOfWeek();

  let brief = `\u2694\uFE0F STERLING -- Morning Brief\n`;
  brief += `\uD83D\uDCC5 ${dayOfWeek}, ${date} | \u23F0 Pre-market\n\n`;

  // PSEi Section
  if (psei.value != null) {
    const pseiChange = parseFloat(psei.change_pct);
    const pseiSign = pseiChange >= 0 ? '+' : '';
    brief += `\uD83D\uDCC8 PSEi TODAY: P${psei.value.toFixed(0)} (${pseiSign}${pseiChange}%)\n`;
    if (pseiChange > 0.5) {
      brief += `Index up = broad market optimism. Your diversified portfolio benefits from the rising tide.\n\n`;
    } else if (pseiChange < -0.5) {
      brief += `Index down = market caution. Stay calm -- your dividend stocks provide income regardless of daily swings.\n\n`;
    } else {
      brief += `Index flat = consolidation. Market catching its breath. Use this time to review your positions.\n\n`;
    }
  } else {
    brief += `\uD83D\uDCC8 PSEi TODAY: Data unavailable (run fetch-ohlcv.js to sync)\n\n`;
  }

  // Portfolio Section
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDCCA YOUR PORTFOLIO\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;

  let bestToday = { symbol: '', change: -Infinity };
  let worstToday = { symbol: '', change: Infinity };
  let needsAttention = [];

  for (const holding of portfolio) {
    const h = holdings.find(x => x.symbol === holding.symbol) || holding;
    const price = parseFloat(h.current_price) || parseFloat(holding.current_price) || 0;
    const plPct = parseFloat(h.unrealized_pl_pct) || parseFloat(holding.unrealized_pl_pct) || 0;
    const pl = parseFloat(h.unrealized_pl) || parseFloat(holding.unrealized_pl) || 0;
    const dayChange = parseFloat(h.percent_change) || 0;

    // Get real analysis data
    const analysis = analysisData.stocks[holding.symbol];

    const plSign = plPct >= 0 ? '+' : '';
    const daySign = dayChange >= 0 ? '+' : '';
    const dayEmoji = dayChange >= 1 ? '\uD83D\uDFE2' : dayChange <= -1 ? '\uD83D\uDD34' : '\u26AA';

    if (analysis) {
      // Use real analysis data
      brief += `${dayEmoji} ${holding.symbol} -- ${analysis.company}\n`;
      brief += `Price: P${price.toFixed(2)} | Day: ${daySign}${dayChange.toFixed(2)}% | P&L: ${plSign}P${formatCurrency(Math.abs(pl))} (${plSign}${plPct.toFixed(1)}%)\n`;
      brief += `\uD83D\uDCCB Action: ${analysis.recommendation.action}\n`;
      brief += `\uD83D\uDCCC ${analysis.technical.pattern}\n`;
      brief += `\uD83C\uDFAF Target: ${analysis.recommendation.take_profit_1} | Stop: ${analysis.recommendation.stop_loss}\n\n`;
    } else {
      // Fallback for unknown stocks
      const sector = SECTOR_MAP[holding.symbol] || 'General';
      brief += `${dayEmoji} ${holding.symbol} -- ${holding.company_name || holding.symbol} | ${sector}\n`;
      brief += `Price: P${price.toFixed(2)} | Day: ${daySign}${dayChange.toFixed(2)}% | P&L: ${plSign}P${formatCurrency(Math.abs(pl))} (${plSign}${plPct.toFixed(1)}%)\n`;
      brief += `\uD83D\uDCCC Check TradingView: https://www.tradingview.com/symbols/PSE-${holding.symbol}/\n\n`;
    }

    // Track best/worst
    if (dayChange > bestToday.change) {
      bestToday = { symbol: holding.symbol, change: dayChange };
    }
    if (dayChange < worstToday.change) {
      worstToday = { symbol: holding.symbol, change: dayChange };
    }

    // Track attention needed - use real analysis thresholds
    if (analysis && analysis.technical.rsi14 < 35) {
      needsAttention.push({ symbol: holding.symbol, reason: `RSI ${analysis.technical.rsi14} -- near oversold` });
    } else if (plPct < -5 || dayChange < -3) {
      needsAttention.push({ symbol: holding.symbol, reason: `Down ${plPct.toFixed(1)}% overall` });
    }
  }

  // Portfolio Snapshot
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDCBC PORTFOLIO SNAPSHOT\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;

  if (priceResult.success) {
    const totalPl = priceResult.total_unrealized_pl || 0;
    const totalPct = priceResult.total_unrealized_pl_pct || 0;
    const sign = totalPl >= 0 ? '+' : '';
    brief += `Total Value: P${formatCurrency(priceResult.portfolio_value || 0)}\n`;
    brief += `Total P&L: ${sign}P${formatCurrency(Math.abs(totalPl))} (${sign}${totalPct.toFixed(2)}%)\n`;
    brief += `Best today: ${bestToday.symbol} (${bestToday.change >= 0 ? '+' : ''}${bestToday.change.toFixed(2)}%)\n`;
    brief += `Worst today: ${worstToday.symbol} (${worstToday.change.toFixed(2)}%)\n\n`;
  }

  // Today's Lesson
  const lesson = selectLesson(holdings);
  if (lesson) {
    brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
    brief += `\uD83D\uDCDA TODAY'S LESSON\n`;
    brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
    brief += `"${lesson.title}"\n\n`;
    brief += `${lesson.content}\n\n`;
  }

  // Attention Needed
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDD34 ATTENTION NEEDED\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  if (needsAttention.length > 0) {
    for (const item of needsAttention.slice(0, 3)) {
      brief += `- ${item.symbol}: ${item.reason}\n`;
    }
  } else {
    brief += `No critical alerts today. Portfolio stable.\n`;
  }
  brief += `\n`;

  // Market Intel
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDCF0 MARKET INTEL\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  for (const intel of marketIntel.slice(0, 4)) {
    brief += `- ${intel.headline}\n`;
    brief += `  Why it matters: ${intel.explanation}\n\n`;
  }

  // Sterling's Analysis
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83C\uDFAF STERLING'S ANALYSIS\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += generateAnalysis(holdings) + '\n\n';

  // Opportunity Watch - Using real watchlist analysis
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDC8E DISCOVERY PICKS\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;

  // Show real watchlist analysis
  const watchlistPicks = Object.entries(analysisData.watchlistAnalysis);
  if (watchlistPicks.length > 0) {
    for (const [symbol, data] of watchlistPicks.slice(0, 2)) {
      const upside1 = ((data.target1 - data.currentPrice) / data.currentPrice * 100).toFixed(0);
      brief += `${symbol} -- ${data.company}\n`;
      brief += `  Price: P${data.currentPrice} | P/E: ${data.pe}x | Div Yield: ${data.dividendYield}%\n`;
      brief += `  Buy Zone: P${data.targetBuy} | Target: P${data.target1} (+${upside1}%)\n`;
      brief += `  ${data.reason.substring(0, 100)}...\n\n`;
    }
  }

  // Also check DB watchlist alerts
  if (watchlistAlerts.length > 0) {
    brief += `From your watchlist:\n`;
    for (const stock of watchlistAlerts.slice(0, 2)) {
      brief += `- ${stock.symbol} at P${stock.current_price} -- ${stock.recommendation || 'In buy zone'}\n`;
    }
    brief += `\n`;
  }

  // Study Assignment
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `\uD83D\uDCD6 STUDY ASSIGNMENT\n`;
  brief += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
  brief += `${getStudyAssignment()}\n\n`;

  brief += `--Sterling \u2694\uFE0F\n`;
  brief += `Next brief: Tomorrow 7AM`;

  console.log('\n========== MORNING BRIEF ==========');
  console.log(brief);
  console.log('====================================\n');

  // Step 6: Save to Supabase
  console.log('Saving brief to Supabase...');
  await saveBriefToSupabase(brief, priceResult);

  // Step 7: Send to Telegram
  console.log('Sending to Telegram...');
  const sendResult = await sendTelegram(brief);
  console.log('Telegram response:', sendResult.status);

  // Step 8: Log activity
  await logActivity('morning_brief_mentor', {
    holdings_count: portfolio.length,
    lesson_topic: lesson?.title || 'default',
    alerts_count: needsAttention.length + watchlistAlerts.length,
    sent: sendResult.status === 200
  });

  return {
    success: true,
    brief,
    telegram_status: sendResult.status,
    holdings: portfolio.length,
    lesson: lesson?.title
  };
}

module.exports = { generateMorningBrief };

if (require.main === module) {
  generateMorningBrief().then(result => {
    console.log('Morning brief complete.');
    console.log(`Telegram status: ${result.telegram_status}`);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

