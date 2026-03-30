/**
 * Sterling — Live Technicals Updater
 * Runs twice daily: 10AM + 2PM Manila (market hours, Mon-Fri)
 *
 * Data pipeline:
 * 1. Fetch price history from our own sterling_price_history table (Phisix, collected every 10min)
 * 2. Calculate RSI(14), MACD(12,26,9), SMA20/50/100/200 from real collected prices
 * 3. Get live current price from Phisix API
 * 4. Write results to sterling_technicals with source + timestamp
 * 5. If insufficient history (<14 trading days), store seed data from analysis-data.js
 *    clearly labeled as "Research — March 2, 2026" until real data accumulates
 *
 * STRICT RULES (Carlo's requirement):
 * - No fabricated or estimated data
 * - Every value stored with exact source and timestamp
 * - If data is insufficient, say so explicitly — do NOT guess
 * - N/A is always better than a wrong number
 */

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const analysisData = require('./analysis-data');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fhfqjcvwcxizbioftvdw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// Dynamically loaded from Supabase — picks up ALL users' holdings automatically
let PORTFOLIO_SYMBOLS = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI']; // fallback
const MIN_CANDLES_FOR_RSI = 15;   // Need at least 15 days for RSI(14)
const MIN_CANDLES_FOR_MACD = 35;  // Need at least 35 days for MACD(26)+signal(9)

// ─── MATH (same as before) ────────────────────────────────────────────────────

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(4));
}

function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return parseFloat(ema.toFixed(4));
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const recent = changes.slice(-(period * 2));
  let avgGain = 0, avgLoss = 0;
  recent.slice(0, period).forEach(c => { if (c > 0) avgGain += c; else avgLoss += Math.abs(c); });
  avgGain /= period; avgLoss /= period;
  for (let i = period; i < recent.length; i++) {
    const c = recent[i];
    avgGain = (avgGain * (period - 1) + Math.max(c, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-c, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
}

function calcMACD(closes) {
  if (closes.length < MIN_CANDLES_FOR_MACD) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (!ema12 || !ema26) return null;
  const macdLine = ema12 - ema26;
  const macdSeries = [];
  for (let i = 26; i <= closes.length; i++) {
    const e12 = calcEMA(closes.slice(0, i), 12);
    const e26 = calcEMA(closes.slice(0, i), 26);
    if (e12 && e26) macdSeries.push(e12 - e26);
  }
  const signalLine = calcEMA(macdSeries, 9);
  return {
    line: parseFloat(macdLine.toFixed(4)),
    signal: signalLine ? parseFloat(signalLine.toFixed(4)) : null,
    histogram: signalLine ? parseFloat((macdLine - signalLine).toFixed(4)) : null,
    ema12, ema26
  };
}

function rsiSignal(rsi) {
  if (rsi === null) return null;
  if (rsi >= 70) return 'Overbought';
  if (rsi >= 60) return 'Strong momentum';
  if (rsi >= 50) return 'Bullish';
  if (rsi >= 40) return 'Neutral';
  if (rsi >= 30) return 'Bearish';
  return 'Oversold';
}

function macdSignalStr(macd) {
  if (!macd || macd.line === null) return null;
  if (macd.histogram !== null) {
    if (macd.histogram > 0 && macd.line > 0) return 'Buy';
    if (macd.histogram > 0 && macd.line < 0) return 'Weakening sell';
    if (macd.histogram < 0 && macd.line < 0) return 'Sell';
    return 'Weakening buy';
  }
  return macd.line > 0 ? 'Buy' : 'Sell';
}

function overallSignal(maBuyCount, totalMAs, rsi, macdSig) {
  const maScore = totalMAs > 0 ? (maBuyCount / totalMAs >= 0.75 ? 2 : maBuyCount / totalMAs >= 0.5 ? 1 : 0) : 0;
  const rsiScore = rsi !== null && rsi >= 50 ? 1 : 0;
  const macdScore = macdSig && macdSig.includes('Buy') ? 1 : 0;
  const total = maScore + rsiScore + macdScore;
  if (total >= 3) return 'Strong Buy';
  if (total === 2) return 'Buy';
  if (total === 1) return 'Neutral';
  return 'Sell';
}

// ─── FETCH LIVE PRICE (Phisix) ────────────────────────────────────────────────

function fetchPhisixPrice(symbol) {
  return new Promise(resolve => {
    http.get(`http://phisix-api3.appspot.com/stocks/${symbol}.json`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const stock = j.stock[0];
          resolve({ price: parseFloat(stock.price.amount), change: parseFloat(stock.percentChange || stock.percent_change || 0) });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── FETCH OHLCV FROM SUPABASE (Real Yahoo Finance daily candles) ─────────────

function fetchOHLCV(symbol) {
  return new Promise((resolve) => {
    // Get last 300 days of OHLCV data, ordered by date ascending
    const path = `/rest/v1/sterling_ohlcv?symbol=eq.${symbol}&order=date.asc&limit=300&select=date,open,high,low,close,volume`;
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const rows = JSON.parse(d);
          if (!Array.isArray(rows)) return resolve([]);
          // Return full OHLCV objects for support/resistance calculation
          resolve(rows.filter(r => r.close !== null));
        } catch (e) { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// ─── CALCULATE SUPPORT/RESISTANCE FROM OHLCV ──────────────────────────────────

function calcSupportResistance(ohlcv) {
  if (!ohlcv || ohlcv.length < 20) return { support1: null, support2: null, resistance1: null, resistance2: null };
  
  const last20 = ohlcv.slice(-20);
  const last60 = ohlcv.slice(-60);
  
  const support1 = Math.min(...last20.map(d => parseFloat(d.low)));
  const support2 = Math.min(...last60.map(d => parseFloat(d.low)));
  const resistance1 = Math.max(...last20.map(d => parseFloat(d.high)));
  const resistance2 = Math.max(...last60.map(d => parseFloat(d.high)));
  
  return {
    support1: parseFloat(support1.toFixed(4)),
    support2: parseFloat(support2.toFixed(4)),
    resistance1: parseFloat(resistance1.toFixed(4)),
    resistance2: parseFloat(resistance2.toFixed(4))
  };
}

// ─── SUPABASE WRITE ───────────────────────────────────────────────────────────

function sbDelete(symbol) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: `/rest/v1/sterling_technicals?symbol=eq.${symbol}`,
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => { res.on('data', () => {}); res.on('end', resolve); });
    req.on('error', resolve);
    req.end();
  });
}

function sbInsert(row) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(row);
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: '/rest/v1/sterling_technicals',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── SUPABASE HELPERS (GET / PATCH) ──────────────────────────────────────────

function sbGet(table, query) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: `/rest/v1/${table}?${query}`,
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('sbGet parse error: ' + d)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sbPatch(table, id, updates) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(updates);
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: `/rest/v1/${table}?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { res.on('data', () => {}); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function updateTechnicals() {
  const now = new Date();
  const manilaStr = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });
  const session = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }) <= '12' ? 'morning (10AM)' : 'afternoon (2PM)';

  console.log(`\n⚔️ Sterling Technicals Updater — ${manilaStr}`);
  console.log(`Data sources: Supabase price_history (primary) + Phisix live + analysis-data.js seed`);
  console.log(`Strict mode: No fabricated data. N/A if insufficient.\n`);

  // Dynamically load all unique symbols from ALL users' portfolios + watchlists
  try {
    const portfolioRows = await sbGet('sterling_portfolio', 'select=symbol');
    const watchlistRows = await sbGet('sterling_watchlist', 'select=symbol');
    const allSymbols = [...new Set([
      ...portfolioRows.map(r => r.symbol),
      ...watchlistRows.map(r => r.symbol),
      ...PORTFOLIO_SYMBOLS // always include fallback set
    ])].filter(Boolean);
    PORTFOLIO_SYMBOLS = allSymbols;
    console.log(`Symbols to analyze (all users): ${PORTFOLIO_SYMBOLS.join(', ')}\n`);
  } catch(e) {
    console.log(`Could not load dynamic symbols, using fallback: ${e.message}`);
  }

  const results = [];

  for (const symbol of PORTFOLIO_SYMBOLS) {
    console.log(`Processing ${symbol}...`);
    try {
      // 1. Fetch live price (Phisix)
      const live = await fetchPhisixPrice(symbol);

      // 2. Fetch OHLCV from sterling_ohlcv (real Yahoo Finance daily candles)
      const ohlcv = await fetchOHLCV(symbol);
      const closes = ohlcv.map(d => parseFloat(d.close));
      console.log(`  OHLCV: ${ohlcv.length} daily candles from sterling_ohlcv (Yahoo Finance)`);

      // Append live price as latest if available and different from last close
      if (live && closes.length > 0 && live.price !== closes[closes.length - 1]) {
        closes.push(live.price);
      }
      const hasEnoughForRSI = closes.length >= MIN_CANDLES_FOR_RSI;
      const hasEnoughForMACD = closes.length >= MIN_CANDLES_FOR_MACD;

      // 3. Seed data from analysis-data.js (research from March 2, 2026)
      const seed = analysisData.stocks[symbol];

      // 4. Calculate what we can from real data
      const rsi = hasEnoughForRSI ? calcRSI(closes, 14) : null;
      const macd = hasEnoughForMACD ? calcMACD(closes) : null;
      const sma20 = calcSMA(closes, 20);
      const sma50 = calcSMA(closes, 50);
      const sma100 = calcSMA(closes, 100);
      const sma200 = calcSMA(closes, 200);

      const currentPrice = live ? live.price : (seed ? seed.currentPrice : null);
      const dayChangePct = live ? live.change : null;

      // MA signals (only if we have the MA calculated)
      let maBuyCount = 0, maSellCount = 0;
      [sma20, sma50, sma100, sma200].forEach(ma => {
        if (!ma || !currentPrice) return;
        if (currentPrice > ma) maBuyCount++;
        else maSellCount++;
      });
      const totalMAs = maBuyCount + maSellCount;
      const maSignal = totalMAs > 0 ?
        (maBuyCount / totalMAs >= 0.75 ? 'Strong Buy' : maBuyCount / totalMAs >= 0.5 ? 'Buy' : 'Sell') : null;

      // 5. Determine data sources per field
      const calculatedFromReal = hasEnoughForRSI;
      let dataSource, rsiValue, macdData;

      if (calculatedFromReal) {
        dataSource = `Calculated from ${ohlcv.length} days of Yahoo Finance OHLCV (sterling_ohlcv) + live Phisix`;
        rsiValue = rsi;
        macdData = macd;
      } else {
        // Use seed data from analysis-data.js but flag it clearly
        dataSource = `⚠️ Seed data — Research from March 2, 2026 (Investing.com). Real calculation needs ${MIN_CANDLES_FOR_RSI - closes.length} more trading days. Run fetch-ohlcv.js to populate.`;
        rsiValue = seed ? seed.technical.rsi14 : null;
        macdData = seed ? { line: seed.technical.macd, signal: null, histogram: null } : null;
        console.log(`  ⚠️ Using seed data — only ${closes.length}/${MIN_CANDLES_FOR_RSI} days of OHLCV. Run fetch-ohlcv.js first.`);
      }

      const rsiSig = rsiSignal(rsiValue);
      const macdSig = macdSignalStr(macdData);

      // Calculate support/resistance from real OHLCV data
      let support1, support2, resistance1, resistance2;
      const sr = calcSupportResistance(ohlcv);
      if (sr.support1 !== null) {
        support1 = sr.support1;
        support2 = sr.support2;
        resistance1 = sr.resistance1;
        resistance2 = sr.resistance2;
        console.log(`  S/R calculated from OHLCV: S1=${support1} S2=${support2} R1=${resistance1} R2=${resistance2}`);
      } else if (seed && seed.technical) {
        // Fallback to seed data only if OHLCV insufficient
        support1 = seed.technical.support1;
        support2 = seed.technical.support2;
        resistance1 = seed.technical.resistance1;
        resistance2 = seed.technical.resistance2;
        console.log(`  S/R from seed data (insufficient OHLCV)`);
      }

      const overall = (rsiValue !== null && totalMAs > 0) ?
        overallSignal(maBuyCount, totalMAs, rsiValue, macdSig) :
        (seed ? seed.technical.overallSignal : null);

      const row = {
        symbol,
        current_price: currentPrice,
        day_change_pct: dayChangePct,
        rsi14: rsiValue,
        rsi_signal: rsiSig,
        macd_line: macdData ? macdData.line : null,
        macd_signal_line: macdData ? macdData.signal : null,
        macd_histogram: macdData ? macdData.histogram : null,
        macd_signal: macdSig,
        sma20, sma50, sma100, sma200,
        ema12: macdData ? macdData.ema12 : null,
        ema26: macdData ? macdData.ema26 : null,
        ma_buy_count: maBuyCount || null,
        ma_sell_count: maSellCount || null,
        ma_signal: maSignal,
        support1, support2, resistance1, resistance2,
        overall_signal: overall,
        data_source: dataSource,
        candles_used: closes.length,
        updated_at: new Date().toISOString(),
        market_session: session
      };

      await sbDelete(symbol);
      const status = await sbInsert(row);

      console.log(`  ✅ ${symbol}: Price ₱${currentPrice} | RSI ${rsiValue || 'N/A'} | MACD ${macdSig || 'N/A'} | MAs ${maBuyCount}/${totalMAs} | Overall: ${overall} → ${status}`);
      results.push({ symbol, rsi: rsiValue, overall, candles: closes.length, status });

    } catch (err) {
      console.log(`  ❌ ${symbol}: ${err.message} — SKIPPED`);
      results.push({ symbol, error: err.message });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const ok = results.filter(r => !r.error).length;
  console.log(`\n✅ Complete: ${ok}/${PORTFOLIO_SYMBOLS.length} updated in Supabase`);
  if (results.some(r => r.error)) {
    console.log(`❌ Errors: ${results.filter(r => r.error).map(r => `${r.symbol}(${r.error})`).join(', ')}`);
  }
  return results;
}

// Process on-demand analysis queue from browser trade logs
async function processAnalysisQueue() {
  try {
    const pending = await sbGet('sterling_analysis_queue', 'select=*&status=eq.pending&order=requested_at.asc&limit=10');
    if (!pending || !pending.length) { console.log('No queued analysis requests.'); return; }
    console.log(`Processing ${pending.length} queued analysis request(s)...`);
    for (const req of pending) {
      if (!PORTFOLIO_SYMBOLS.includes(req.symbol)) PORTFOLIO_SYMBOLS.push(req.symbol);
      await sbPatch('sterling_analysis_queue', req.id, { status: 'processing' });
    }
    await updateTechnicals();
    // Mark all as done
    for (const req of pending) {
      await sbPatch('sterling_analysis_queue', req.id, { status: 'done', processed_at: new Date().toISOString() });
    }
    console.log('Queue processed.');
  } catch(e) { console.error('Queue error:', e.message); }
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === 'queue') {
    processAnalysisQueue().catch(err => { console.error('Fatal:', err); process.exit(1); });
  } else {
    updateTechnicals().catch(err => { console.error('Fatal:', err); process.exit(1); });
  }
}

module.exports = { updateTechnicals };
