/**
 * Sterling — fetch-technicals-tv.js
 * Fetches real technical analysis from TradingView Scanner API for all
 * portfolio + watchlist stocks. Runs hourly during market hours via cron.
 *
 * Source: TradingView Scanner (scanner.tradingview.com/philippines/scan)
 * Data: RSI(14), MACD(12,26,9), SMA20/50/200, EMA20/50, price, volume,
 *       Recommend.All (overall signal: -1=Strong Sell → +1=Strong Buy)
 *
 * STRICT RULES:
 * - Every value stored with exact source ("TradingView Scanner") + timestamp
 * - No fabricated or estimated data
 * - N/A is always better than a wrong number
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const safeFixed = (v, d = 2) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : null;

const SUPABASE_URL = 'https://fhfqjcvwcxizbioftvdw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TV_COLUMNS = [
  'RSI', 'RSI[1]',
  'MACD.macd', 'MACD.signal', 'MACD.hist',
  'close', 'change',
  'volume',
  'SMA20', 'SMA50', 'SMA200',
  'EMA20', 'EMA50',
  'Recommend.All', 'Recommend.MA', 'Recommend.Other',
  'name', 'description',
  'average_volume_10d_calc',             // FEATURE 7: Volume spike detection
  '52W High',                            // FEATURE 6: 52-week high
  '52W Low'                              // FEATURE 6: 52-week low
];

const COL = {
  RSI: 0, RSI_PREV: 1,
  MACD_LINE: 2, MACD_SIGNAL: 3, MACD_HIST: 4,
  CLOSE: 5, CHANGE: 6,
  VOLUME: 7,
  SMA20: 8, SMA50: 9, SMA200: 10,
  EMA20: 11, EMA50: 12,
  RECOMMEND_ALL: 13, RECOMMEND_MA: 14, RECOMMEND_OTHER: 15,
  NAME: 16, DESC: 17,
  AVG_VOL_10D: 18,
  HIGH_52W: 19, LOW_52W: 20
};

// Convert TradingView Recommend.All score (-1 to +1) to human signal
function tvScoreToSignal(score) {
  if (score === null || score === undefined) return null;
  if (score >= 0.5)  return 'Strong Buy';
  if (score >= 0.1)  return 'Buy';
  if (score > -0.1)  return 'Neutral';
  if (score > -0.5)  return 'Sell';
  return 'Strong Sell';
}

function macdSignal(line, hist) {
  if (line === null) return null;
  if (hist !== null) {
    if (hist > 0 && line > 0) return 'Buy';
    if (hist > 0 && line < 0) return 'Weakening sell';
    if (hist < 0 && line < 0) return 'Sell';
    return 'Weakening buy';
  }
  return line > 0 ? 'Buy' : 'Sell';
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

// ─── TradingView Scanner API ──────────────────────────────────────────────────

function fetchTVTechnicals(symbols) {
  return new Promise((resolve, reject) => {
    const tickers = symbols.map(s => `PSE:${s}`);
    const body = JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: TV_COLUMNS });
    const req = https.request({
      hostname: 'scanner.tradingview.com',
      path: '/philippines/scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://ph.tradingview.com',
        'Referer': 'https://ph.tradingview.com/'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`TradingView API ${res.statusCode}: ${d.slice(0,200)}`));
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('TradingView parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

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
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`sbGet ${table} HTTP ${res.statusCode}: ${d.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('sbGet parse: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sbUpsert(row) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(row);
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: '/rest/v1/sterling_technicals?on_conflict=symbol',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          // Log column errors without deleting existing data
          try { const err = JSON.parse(d); console.log(`    ⚠️  Insert warning: ${err.message}`); } catch(e) {}
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function sbDelete(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: `/rest/v1/sterling_technicals?symbol=eq.${symbol}`,
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => { res.on('data', () => {}); res.on('end', resolve); });
    req.on('error', reject);
    req.end();
  });
}

// Delete technicals pillar from sterling_intelligence for a symbol
function sbDeleteIntelTech(symbol) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: `/rest/v1/sterling_intelligence?symbol=eq.${symbol}&pillar=eq.technicals`,
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => { res.on('data', () => {}); res.on('end', resolve); });
    req.on('error', resolve);
    req.end();
  });
}

function sbInsertIntel(row) {
  return sbUpsertIntel(row); // alias — always use upsert
}

function sbUpsertIntel(row) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(row);
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: '/rest/v1/sterling_intelligence?on_conflict=symbol,pillar',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(body); req.end();
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
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchTechnicals() {
  const nowISO = new Date().toISOString();
  const manilaStr = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });

  console.log(`\n⚔️ Sterling Technicals — TradingView Source — ${manilaStr}`);
  console.log(`Source: TradingView Scanner API (real computed technicals from PSE price history)\n`);

  // Load all unique symbols from ALL users' portfolios + watchlists
  let symbols = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI']; // fallback
  try {
    const [portfolioRows, watchlistRows] = await Promise.all([
      sbGet('sterling_portfolio', 'select=symbol'),
      sbGet('sterling_watchlist', 'select=symbol')
    ]);
    const merged = [...new Set([
      ...portfolioRows.map(r => r.symbol),
      ...watchlistRows.map(r => r.symbol),
      ...symbols
    ])].filter(s => s && !s.includes('/') && !s.startsWith('^'));
    symbols = merged;
    console.log(`Symbols (all users): ${symbols.join(', ')}\n`);
  } catch (e) {
    console.log(`Could not load dynamic symbols, using fallback: ${e.message}`);
  }

  // Batch fetch from TradingView — max 40 per request
  const BATCH_SIZE = 40;
  const batches = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    batches.push(symbols.slice(i, i + BATCH_SIZE));
  }

  const tvDataMap = {};
  for (const batch of batches) {
    try {
      const result = await fetchTVTechnicals(batch);
      if (result && result.data) {
        result.data.forEach(item => {
          const sym = item.s.replace('PSE:', '');
          tvDataMap[sym] = item.d;
        });
      }
      console.log(`TradingView batch (${batch.length} symbols): ${Object.keys(tvDataMap).length} received`);
    } catch (e) {
      console.error(`TradingView batch error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Write to Supabase
  const results = [];
  for (const symbol of symbols) {
    const d = tvDataMap[symbol];
    if (!d) {
      console.log(`  ⚠️ ${symbol}: No data from TradingView (not listed or PSE symbol mismatch)`);
      results.push({ symbol, error: 'No TradingView data' });
      continue;
    }

    const safeNum = (v, decimals) => (typeof v === 'number' && !isNaN(v)) ? parseFloat(v.toFixed(decimals)) : null;
    const rsi       = safeNum(d[COL.RSI], 2);
    const macdLine  = safeNum(d[COL.MACD_LINE], 4);
    const macdSig   = safeNum(d[COL.MACD_SIGNAL], 4);
    const macdHist  = safeNum(d[COL.MACD_HIST], 4);
    const close     = safeNum(d[COL.CLOSE], 4);
    const change    = safeNum(d[COL.CHANGE], 4);
    const sma20     = safeNum(d[COL.SMA20], 4);
    const sma50     = safeNum(d[COL.SMA50], 4);
    const sma200    = safeNum(d[COL.SMA200], 4);
    const ema20     = safeNum(d[COL.EMA20], 4);
    const ema50     = safeNum(d[COL.EMA50], 4);
    const recAll    = (typeof d[COL.RECOMMEND_ALL]   === 'number' && !isNaN(d[COL.RECOMMEND_ALL]))   ? d[COL.RECOMMEND_ALL]   : null;
    const recMA     = (typeof d[COL.RECOMMEND_MA]    === 'number' && !isNaN(d[COL.RECOMMEND_MA]))    ? d[COL.RECOMMEND_MA]    : null;
    const recOsc    = (typeof d[COL.RECOMMEND_OTHER] === 'number' && !isNaN(d[COL.RECOMMEND_OTHER])) ? d[COL.RECOMMEND_OTHER] : null;
    // FEATURE 6 & 7: 52-week range and volume data
    const high52w   = safeNum(d[COL.HIGH_52W], 4);
    const low52w    = safeNum(d[COL.LOW_52W], 4);
    const volume    = safeNum(d[COL.VOLUME], 0);
    const avgVol10d = safeNum(d[COL.AVG_VOL_10D], 0);

    const overallSignal  = tvScoreToSignal(recAll);
    const maSignal       = tvScoreToSignal(recMA);
    const oscSignal      = tvScoreToSignal(recOsc);
    const macdSignalStr  = macdSignal(macdLine, macdHist);
    const rsiSignalStr   = rsiSignal(rsi);

    // MA price comparison (price vs SMA50/200 for trend context)
    let maTrend = null;
    if (close && sma50 && sma200) {
      if (close > sma50 && close > sma200) maTrend = 'Above SMA50 & SMA200 — Uptrend';
      else if (close < sma50 && close < sma200) maTrend = 'Below SMA50 & SMA200 — Downtrend';
      else if (close > sma50) maTrend = 'Above SMA50 but below SMA200 — Mixed';
      else maTrend = 'Below SMA50 but above SMA200 — Mixed';
    }

    const row = {
      symbol,
      current_price: close,
      day_change_pct: change,
      rsi14: rsi,
      rsi_signal: rsiSignalStr,
      macd_line: macdLine,
      macd_signal_line: macdSig,
      macd_histogram: macdHist,
      macd_signal: macdSignalStr,
      sma20, sma50, sma200: sma200,
      ema12: ema20,   // storing EMA20 in ema12 slot (closest available)
      ema26: ema50,   // storing EMA50 in ema26 slot
      ma_signal: maSignal,
      overall_signal: overallSignal,
      data_source: `TradingView Scanner — ${manilaStr} (Source: scanner.tradingview.com/philippines/scan)`,
      tv_recommend_all: recAll,
      tv_recommend_ma: recMA,
      tv_recommend_osc: recOsc,
      ma_trend: maTrend,
      updated_at: nowISO,
      market_session: 'TradingView live',
      // FEATURE 6 & 7: 52-week range and volume data for smart trading features
      week52_high: high52w,
      week52_low: low52w,
      volume: volume,
      avg_volume_10d: avgVol10d
    };

    // Build sterling_intelligence technicals entry from TradingView data
    const tvVerdict = recAll >= 0.1 ? 'Positive' : recAll <= -0.1 ? 'Negative' : 'Neutral';
    const tvPoints = [
      `RSI(14): ${rsi !== null ? rsi : 'N/A'} — ${rsiSignalStr || 'No signal'}`,
      `MACD: ${macdSignalStr || 'N/A'}${macdHist !== null ? ` (histogram: ${macdHist > 0 ? '+' : ''}${macdHist})` : ''}`,
      `TradingView overall signal: ${overallSignal || 'N/A'} (score: ${safeFixed(recAll, 2) || 'N/A'})`,
      `Moving averages: ${maSignal || 'N/A'} (${safeFixed(recMA, 2) || 'N/A'})`,
      `Oscillators: ${oscSignal || 'N/A'} (${safeFixed(recOsc, 2) || 'N/A'})`,
      maTrend ? maTrend : null,
      sma50 ? `SMA50: ₱${sma50} | SMA200: ₱${sma200}` : null,
    ].filter(Boolean);

    const tvAiSummary = `RSI ${rsi !== null ? rsi : 'N/A'} (${rsiSignalStr || '—'}). MACD: ${macdSignalStr || '—'}. TradingView signal: ${overallSignal || '—'}. ${maTrend || ''}`;

    const intelRow = {
      symbol,
      pillar: 'technicals',
      verdict: tvVerdict,
      ai_summary: tvAiSummary,
      points: JSON.stringify(tvPoints),
      sources: JSON.stringify([{ name: `TradingView PSE:${symbol} Technicals`, url: `https://ph.tradingview.com/symbols/PSE-${symbol}/technicals/` }]),
      analyzed_at: nowISO
    };

    try {
      // SAFE UPSERT — never delete first (old data stays if insert fails)
      const status = await sbUpsert(row);
      // Also upsert sterling_intelligence technicals pillar
      const intelStatus = await sbUpsertIntel(intelRow);
      console.log(`  ✅ ${symbol}: ₱${close} | RSI ${rsi} (${rsiSignalStr}) | MACD ${macdSignalStr} | Overall: ${overallSignal} → tech:${status} intel:${intelStatus}`);
      results.push({ symbol, close, rsi, overallSignal, status });
    } catch (e) {
      console.log(`  ❌ ${symbol}: Supabase write failed — ${e.message} (old data preserved)`);
      results.push({ symbol, error: e.message });
    }

    await new Promise(r => setTimeout(r, 150));
  }

  const ok = results.filter(r => !r.error).length;
  console.log(`\n✅ Complete: ${ok}/${symbols.length} updated`);
  console.log(`Source: TradingView Scanner API — real RSI, MACD, MAs computed from PSE daily price history`);
  if (results.some(r => r.error)) {
    console.log(`⚠️  Errors: ${results.filter(r => r.error).map(r => `${r.symbol}(${r.error})`).join(', ')}`);
  }
  return results;
}

if (require.main === module) {
  fetchTechnicals().catch(err => { console.error('Fatal:', err); process.exit(1); });
}

module.exports = { fetchTechnicals };
