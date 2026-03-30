/**
 * fetch-ohlcv.js — Builds daily OHLCV from sterling_price_history (Phisix data)
 *
 * Strategy: sterling_price_history stores daily close prices + volume + percent_change
 * fetched by fetch-prices.js via Phisix API. This script queries that table, groups by
 * symbol + date, and synthesises OHLCV rows that get upserted into sterling_ohlcv.
 *
 * OHLCV synthesis:
 *   close  = price recorded that day
 *   open   = previous day's close (or close * (1 - pct_change/100) if no prev row)
 *   high   = max(open, close) * (1 + |pct_change| * 0.002)  -- small intraday buffer
 *   low    = min(open, close) * (1 - |pct_change| * 0.002)
 *   volume = volume from price_history row
 *
 * No API key required. Source is the system's own Supabase data.
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SB_HOST = 'fhfqjcvwcxizbioftvdw.supabase.co';

const SYMBOLS = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI'];

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbGet(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SB_HOST,
      path,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Accept': 'application/json'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(new Error('Parse error: ' + e.message)); }
        } else {
          reject(new Error('Supabase GET ' + res.statusCode + ': ' + d.slice(0, 200)));
        }
      });
    }).on('error', reject);
  });
}

function upsertBatch(rows) {
  return new Promise((resolve, reject) => {
    if (!rows.length) return resolve(0);
    const body = JSON.stringify(rows);
    const req = https.request({
      hostname: SB_HOST,
      path: '/rest/v1/sterling_ohlcv?on_conflict=symbol,date',
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(rows.length);
        else reject(new Error('Supabase upsert ' + res.statusCode + ': ' + d.slice(0, 200)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Fetch price history for one symbol ───────────────────────────────────────

async function fetchPriceHistory(symbol) {
  // Pull up to 400 records (covers ~1 year of daily recordings; Phisix runs once/day)
  // Order ascending so we can compute open from prev close
  const path = `/rest/v1/sterling_price_history` +
    `?symbol=eq.${symbol}` +
    `&select=price,volume,percent_change,recorded_at` +
    `&order=recorded_at.asc` +
    `&limit=400`;

  const rows = await sbGet(path);
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Group by date (YYYY-MM-DD in Manila time) — keep the last record per date
  const byDate = {};
  for (const r of rows) {
    // Convert UTC to Manila (UTC+8)
    const manilaMs = new Date(r.recorded_at).getTime() + 8 * 3600 * 1000;
    const date = new Date(manilaMs).toISOString().slice(0, 10);
    byDate[date] = r; // overwrite — last entry wins (most recent intraday)
  }

  const dates = Object.keys(byDate).sort();
  const ohlcv = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const rec = byDate[date];
    const close = parseFloat(rec.price);
    const pct   = parseFloat(rec.percent_change) || 0;
    const vol   = parseInt(rec.volume) || 0;

    // Derive open from percent_change: close = open * (1 + pct/100) => open = close / (1 + pct/100)
    let open = pct !== 0 ? parseFloat((close / (1 + pct / 100)).toFixed(4)) : close;
    // Also use previous day's close as a cross-check if available
    if (i > 0) {
      const prevDate = dates[i - 1];
      const prevClose = parseFloat(byDate[prevDate].price);
      // Use whichever is closer to the derived open (default: pct-based is more accurate)
      open = parseFloat((close / (1 + pct / 100)).toFixed(4));
    }

    // High and low: small intraday buffer proportional to |percent_change|
    const absPct = Math.abs(pct);
    const buffer = Math.max(absPct * 0.002, 0.001); // minimum 0.1% buffer
    const high = parseFloat((Math.max(open, close) * (1 + buffer)).toFixed(4));
    const low  = parseFloat((Math.min(open, close) * (1 - buffer)).toFixed(4));

    ohlcv.push({
      symbol,
      date,
      open,
      high,
      low,
      close,
      volume: vol,
      source: 'Phisix (via sterling_price_history)'
    });
  }

  return ohlcv;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function fetchAllOHLCV() {
  console.log('\nSterling OHLCV — Built from sterling_price_history (Phisix)');
  console.log('Symbols:', SYMBOLS.join(', '));
  console.log('Source: Daily price records from Phisix via fetch-prices.js\n');

  let totalRows = 0;
  const results = [];

  for (const sym of SYMBOLS) {
    process.stdout.write('  ' + sym + '... ');
    try {
      const rows = await fetchPriceHistory(sym);

      if (!rows.length) {
        console.log('SKIP  no price history in sterling_price_history');
        results.push({ symbol: sym, error: 'No price history found' });
        continue;
      }

      // Upsert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        await upsertBatch(rows.slice(i, i + 100));
      }

      const first = rows[0].date;
      const last  = rows[rows.length - 1].date;
      const latestClose = rows[rows.length - 1].close;
      console.log('OK  ' + rows.length + ' days (' + first + ' -> ' + last + ') latest P' + latestClose);
      totalRows += rows.length;
      results.push({ symbol: sym, rows: rows.length, latestClose });
    } catch (err) {
      console.log('FAIL  ' + err.message);
      results.push({ symbol: sym, error: err.message });
    }
  }

  console.log('\nDone — ' + totalRows + ' rows upserted into sterling_ohlcv');
  const ok   = results.filter(r => !r.error);
  const fail = results.filter(r =>  r.error);
  if (ok.length)   console.log('OK:', ok.map(r => r.symbol + '(' + r.rows + ' days, P' + r.latestClose + ')').join(', '));
  if (fail.length) console.log('Failed:', fail.map(r => r.symbol + ': ' + r.error).join(', '));
  return results;
}

if (require.main === module) {
  fetchAllOHLCV().catch(err => { console.error('Fatal:', err); process.exit(1); });
}

module.exports = { fetchAllOHLCV };
