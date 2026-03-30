// refresh-intelligence.js — Refresh sterling_intelligence table with AI summaries
// Runs daily at 7AM via cron or manually
// Reads from sterling_technicals and sterling_news, writes to sterling_intelligence

require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const SYMBOLS = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI'];

// ============ FUNDAMENTALS DATA (from research, updates quarterly) ============
const FUNDAMENTALS_DATA = {
  MBT:   { pe: 6.4,  nav: null,  price: 67.70, yield: 6.99, analystTarget: 91,    verdict: 'Undervalued' },
  KEEPR: { pe: null, nav: 3.80,  price: 2.14,  yield: 11.0, analystTarget: 3.20,  verdict: 'Deep Value' },
  FILRT: { pe: null, nav: 4.21,  price: 2.88,  yield: 8.1,  analystTarget: 4.00,  verdict: 'Undervalued' },
  GLO:   { pe: 11.0, nav: null,  price: 1600,  yield: 6.36, analystTarget: 1950,  verdict: 'Fair Value' },
  DMC:   { pe: 8.0,  nav: null,  price: 9.20,  yield: 9.73, analystTarget: 12.50, verdict: 'Undervalued' },
  MREIT: { pe: null, nav: 19.69, price: 13.66, yield: 7.1,  analystTarget: 18.00, verdict: 'Undervalued' },
  RRHI:  { pe: 7.2,  nav: null,  price: 35.30, yield: 5.3,  analystTarget: 42.00, verdict: 'Undervalued' },
};

const FUNDAMENTALS_POINTS = {
  MBT:   ['P/E 6.4x vs Philippine banking sector average 11x — 42% cheaper than peers','EPS ₱10.76 — earnings accelerating, strong Q4 2025 results','13 analysts cover MBT: consensus target ₱91, highest ₱97.50','Dividend yield 6.99% — you get paid while you wait at ₱67.70'],
  KEEPR: ['NAV ₱3.80/share vs price ₱2.14 = buying ₱1 of Keppel real estate for ₱0.56','Dividend yield ~11% — one of the highest yields on the PSE','94% occupancy rate — nearly full portfolio, stable rental income','Asia Securities rates LONG-TERM BUY'],
  FILRT: ['NAV ₱4.21 vs price ₱2.88 = 32% discount to Filinvest real estate portfolio','Annual dividend yield 8.1% — strong income stream','Quarterly dividends ~₱0.06/share — paid consistently','Ex-dividend date approximately March 11 2026'],
  GLO:   ['6.36% dividend yield — reliable telecom cash flow','Dominant mobile market position in Philippines','Capital expenditure cycle peaking — free cash flow improving','P/E 11x at ₱1,600 — analyst target ₱1,950 implies 22% upside'],
  DMC:   ['9.73% dividend yield — highest yield in your portfolio','Exposure to coal, nickel, water, construction — diversified conglomerate','P/E 8x = undervalued vs historical average of 10-12x','Net cash position — no debt risk at ₱9.20'],
  MREIT: ['NAV ₱19.69 vs price ₱13.66 = 31% discount to Megaworld office portfolio','7.1% dividend yield paid quarterly','Office REIT with Grade A tenants — low vacancy risk','Analyst target ₱18 implies 32% upside from current price'],
  RRHI:  ['Robinsons Retail — dominant grocery and convenience store operator','P/E 7.2x = deep discount to retail sector average, highly undervalued','5.3% dividend yield — strong for a retail conglomerate','Analyst target ₱42 implies 19% upside from ₱35.30'],
};

const FUNDAMENTALS_SOURCES = {
  MBT:   [{name:'HelloSafe PH',url:'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
  KEEPR: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'DragonFi',url:'https://www.dragonfi.ph/market/stocks/KEEPR'}],
  FILRT: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
  GLO:   [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
  DMC:   [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
  MREIT: [{name:'Asia Securities',url:'https://www.asiasecequities.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
  RRHI:  [{name:'COL Financial',url:'https://www.colfinancial.com'},{name:'PSE Edge',url:'https://edge.pse.com.ph'}],
};

// ============ AI SUMMARY GENERATORS ============

function genFundamentalsSummary(sym, data) {
  // Beginner-friendly: explain what each number means in plain language
  if (data.nav && data.price) {
    const discount = Math.round((1 - data.price / data.nav) * 100);
    const navRatio = (data.price / data.nav).toFixed(2);
    return `Think of NAV (Net Asset Value) as what the company's buildings and assets are actually worth per share — ₱${data.nav}. Right now ${sym} is trading at ₱${data.price}, which is ${discount}% BELOW that real value. In simple terms: you're buying ₱1 worth of real estate assets for just ₱${navRatio}. On top of that, it pays you ${data.yield}% per year in dividends just for holding it. Analysts believe the fair price should be around ₱${data.analystTarget}.`;
  }
  if (data.pe && data.analystTarget) {
    const upside = Math.round((data.analystTarget / data.price - 1) * 100);
    return `The P/E ratio (Price-to-Earnings) of ${data.pe}x tells you how cheap or expensive a stock is — lower is cheaper. ${sym}'s P/E of ${data.pe}x means you're paying only ₱${data.pe} for every ₱1 the company earns. That's considered ${data.verdict.toLowerCase()}. It also pays ${data.yield}% in dividends annually. Analysts who study this company professionally think it should be worth ₱${data.analystTarget} — that's ${upside}% higher than today's price.`;
  }
  return `${sym} is considered ${data.verdict} based on current valuations. It pays ${data.yield}% in dividends annually, which means you earn passive income just for holding the stock.`;
}

function genTechnicalsSummary(sym, tech) {
  // Beginner-friendly: explain every indicator in plain language
  if (!tech) {
    return `Price data for ${sym} is being updated. Check back soon for the latest signals.`;
  }
  const rsi = tech.rsi14 || tech.rsi_14 || 'N/A';
  const rsiNum = parseFloat(rsi);
  const maBuy = tech.ma_buy_count || 0;
  const maSell = tech.ma_sell_count || 0;
  const maTotal = maBuy + maSell || 12;
  const macdSignal = tech.macd_signal || 'Neutral';
  const overall = tech.overall_signal || 'Hold';

  // Plain English RSI explanation
  let rsiPlain = '';
  if (!isNaN(rsiNum)) {
    if (rsiNum < 30) rsiPlain = `RSI is ${rsi} — this stock is deeply oversold (beaten down a lot). Think of it like a rubber band stretched too far down. It may bounce soon.`;
    else if (rsiNum < 40) rsiPlain = `RSI is ${rsi} — the stock is weak and losing energy, but not yet at the extreme floor.`;
    else if (rsiNum < 60) rsiPlain = `RSI is ${rsi} — neutral territory. No strong signal either way right now.`;
    else if (rsiNum < 70) rsiPlain = `RSI is ${rsi} — the stock has good momentum and buyers are in control.`;
    else rsiPlain = `RSI is ${rsi} — the stock is overheated. It's gone up a lot and may need to cool down before going higher.`;
  }

  // Plain English MACD
  let macdPlain = '';
  if (macdSignal === 'Buy') macdPlain = 'MACD says Buy — momentum is picking up, more people are buying.';
  else if (macdSignal === 'Sell') macdPlain = 'MACD says Sell — momentum is fading, sellers are taking over.';
  else if (macdSignal && macdSignal.includes('Weakening buy')) macdPlain = 'MACD: the buying momentum is slowing down — not a sell yet, but watch carefully.';
  else if (macdSignal && macdSignal.includes('Weakening sell')) macdPlain = 'MACD: the selling pressure is easing — could be a sign the worst is almost over.';
  else macdPlain = `MACD is neutral — no clear direction yet.`;

  // Plain English moving averages
  const maPlain = `${maBuy} out of ${maTotal} trend indicators are pointing up${maBuy > maSell ? ' — the longer-term trend still has buyers' : maBuy < maSell ? ' — most trend lines are still pointing down' : ' — trend is mixed'}.`;

  // Overall verdict in plain English
  let verdictPlain = '';
  if (overall === 'Strong Buy') verdictPlain = '✅ Overall: Strong signal to buy. Most indicators are lined up positively.';
  else if (overall === 'Buy') verdictPlain = '🟢 Overall: Leaning toward buy. More good signs than bad.';
  else if (overall === 'Neutral') verdictPlain = '🟡 Overall: No clear direction. Best to wait and watch.';
  else if (overall === 'Sell') verdictPlain = '🔴 Overall: Leaning toward sell. More bad signs than good — not a great time to add.';
  else if (overall === 'Strong Sell') verdictPlain = '⛔ Overall: Strong signal to avoid buying more. Most indicators are pointing down.';
  else verdictPlain = `Overall signal: ${overall}.`;

  return `${rsiPlain} ${macdPlain} ${maPlain} ${verdictPlain}`;
}

function genNewsSummary(sym, newsItems) {
  // Beginner-friendly: explain what the news means for the stock
  if (!newsItems || newsItems.length === 0) {
    return `No major news for ${sym} right now. Quiet periods are normal — keep watching for dividend announcements or earnings reports, which can move the stock price.`;
  }
  const titles = newsItems.map(n => n.title || n.headline).filter(Boolean);
  if (titles.length === 0) {
    return `There's some recent activity around ${sym} but nothing major today. Keep an eye on PSE Edge for official company announcements — dividends and earnings are the big ones that move price.`;
  }
  const first = titles[0].length > 80 ? titles[0].substring(0, 80) + '...' : titles[0];
  const second = titles[1] ? (titles[1].length > 60 ? titles[1].substring(0, 60) + '...' : titles[1]) : '';
  const intro = `Latest news: "${first}". ${second ? `Also: "${second}". ` : ''}`;
  return `${intro}News like this can affect the stock price — positive earnings or dividend announcements tend to push prices up, while bad news or delays can push them down. Stay updated on PSE Edge for official disclosures.`;
}

// ============ SUPABASE HELPERS ============

async function sbFetch(table, opts = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const params = [];
  if (opts.filter) params.push(opts.filter);
  if (opts.select) params.push(`select=${opts.select}`);
  if (opts.order) params.push(`order=${opts.order}`);
  if (opts.limit) params.push(`limit=${opts.limit}`);
  if (params.length) url += '?' + params.join('&');
  
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) throw new Error(`Fetch ${table} failed: ${res.status}`);
  return res.json();
}

async function sbUpsert(table, rows, conflict = 'symbol,pillar') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upsert ${table} failed: ${res.status} ${text}`);
  }
  return res;
}

// ============ MAIN ============

async function main() {
  console.log('🔄 Refreshing Sterling Intelligence...');
  console.log(`   Symbols: ${SYMBOLS.join(', ')}`);
  
  // Fetch technicals from Supabase
  let technicalsMap = {};
  try {
    const technicals = await sbFetch('sterling_technicals', { order: 'updated_at.desc' });
    technicals.forEach(t => { technicalsMap[t.symbol] = t; });
    console.log(`   ✓ Loaded ${technicals.length} technical records`);
  } catch (e) {
    console.log(`   ⚠ Could not load technicals: ${e.message}`);
  }
  
  // Fetch news from Supabase (last 3 per symbol)
  let newsMap = {};
  try {
    const news = await sbFetch('sterling_news', { order: 'published_at.desc', limit: '50' });
    for (const sym of SYMBOLS) {
      newsMap[sym] = news.filter(n => n.symbol === sym).slice(0, 3);
    }
    console.log(`   ✓ Loaded ${news.length} news records`);
  } catch (e) {
    console.log(`   ⚠ Could not load news: ${e.message}`);
  }
  
  // Build intelligence rows
  const rows = [];
  const now = new Date().toISOString();
  
  for (const sym of SYMBOLS) {
    const fundData = FUNDAMENTALS_DATA[sym];
    const fundPoints = FUNDAMENTALS_POINTS[sym];
    const fundSources = FUNDAMENTALS_SOURCES[sym];
    const tech = technicalsMap[sym];
    const newsItems = newsMap[sym] || [];
    
    // Fundamentals pillar
    rows.push({
      symbol: sym,
      pillar: 'fundamentals',
      verdict: fundData.verdict,
      ai_summary: genFundamentalsSummary(sym, fundData),
      points: fundPoints,
      sources: fundSources,
      analyzed_at: now
    });
    
    // Technicals pillar — beginner-friendly bullet points
    const rsiVal = tech ? (tech.rsi14 || tech.rsi_14 || 'N/A') : 'N/A';
    const rsiNum = parseFloat(rsiVal);
    const rsiMeaning = isNaN(rsiNum) ? 'Updating' : rsiNum < 30 ? 'Deeply oversold — possible bounce zone 🟢' : rsiNum < 40 ? 'Weak — losing energy 🔴' : rsiNum < 60 ? 'Neutral — no strong signal 🟡' : rsiNum < 70 ? 'Strong — buyers in control 🟢' : 'Overheated — may cool down ⚠️';
    const macdMeaning = !tech ? 'Updating' : tech.macd_signal === 'Buy' ? 'Buying momentum picking up 🟢' : tech.macd_signal === 'Sell' ? 'Selling pressure increasing 🔴' : tech.macd_signal && tech.macd_signal.includes('Weakening sell') ? 'Selling slowing down — watch for reversal 🟡' : tech.macd_signal && tech.macd_signal.includes('Weakening buy') ? 'Buying slowing down — be cautious 🟡' : 'Neutral 🟡';
    const maBuy = tech ? (tech.ma_buy_count || 0) : 0;
    const maSell = tech ? (tech.ma_sell_count || 0) : 0;
    const maTotal = maBuy + maSell || 12;
    const maMeaning = maBuy > maSell ? `${maBuy}/${maTotal} trend lines pointing UP — longer-term trend is positive` : maBuy < maSell ? `Only ${maBuy}/${maTotal} trend lines pointing up — most trends still going down` : `${maBuy}/${maTotal} trend lines mixed — no clear direction`;
    const overallMeaning = !tech ? 'Updating' : tech.overall_signal === 'Strong Buy' ? '✅ Strong Buy — most indicators positive' : tech.overall_signal === 'Buy' ? '🟢 Buy — more good signs than bad' : tech.overall_signal === 'Neutral' ? '🟡 Neutral — wait and watch' : tech.overall_signal === 'Sell' ? '🔴 Sell signal — not a good time to add' : tech.overall_signal === 'Strong Sell' ? '⛔ Strong Sell — most indicators negative' : tech.overall_signal || 'Hold';

    const techPoints = tech ? [
      `Energy Level (RSI ${rsiVal}): ${rsiMeaning}`,
      `Momentum (MACD): ${macdMeaning}`,
      `Trend Check: ${maMeaning}`,
      `Overall Verdict: ${overallMeaning}`
    ] : [
      'Price data is being updated — check back soon',
      'Signals will appear here once data loads'
    ];
    
    rows.push({
      symbol: sym,
      pillar: 'technicals',
      verdict: tech?.overall_signal || 'Updating',
      ai_summary: genTechnicalsSummary(sym, tech),
      points: techPoints,
      sources: [{name:'TradingView', url:`https://www.tradingview.com/symbols/PSE-${sym}/technicals/`}, {name:'Investing.com', url:'https://www.investing.com'}],
      analyzed_at: now
    });
    
    // News pillar
    const newsPoints = newsItems.length > 0 
      ? newsItems.map(n => n.headline || n.title || 'News item')
      : ['No recent news', 'Monitor PSE Edge for disclosures'];
    
    const newsVerdict = newsItems.length > 0 ? 'Active' : 'Quiet';
    
    rows.push({
      symbol: sym,
      pillar: 'news',
      verdict: newsVerdict,
      ai_summary: genNewsSummary(sym, newsItems),
      points: newsPoints,
      sources: [{name:'PSE Edge', url:'https://edge.pse.com.ph'}, {name:'BusinessWorld', url:'https://bworldonline.com'}],
      analyzed_at: now
    });
  }
  
  // Upsert to Supabase
  console.log(`   📤 Upserting ${rows.length} intelligence rows...`);
  await sbUpsert('sterling_intelligence', rows);
  
  console.log(`✅ Sterling Intelligence refreshed: ${rows.length} rows (${SYMBOLS.length} symbols × 3 pillars)`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
