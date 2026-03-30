/**
 * fetch-ohlcv.js — Fetches daily OHLCV from Alpha Vantage
 * PSE symbol format: MBT.PSE, KEEPR.PSE, etc.
 * Free tier: 25 requests/day — enough for 7 stocks + PSEi
 * Upserts into Supabase sterling_ohlcv
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AV_KEY       = process.env.ALPHA_VANTAGE_KEY;

if (!AV_KEY) { console.error('ALPHA_VANTAGE_KEY not set in .env'); process.exit(1); }

const SYMBOLS = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchAV(symbol) {
  return new Promise((resolve, reject) => {
    const avSym = symbol + '.PSE';
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${avSym}&outputsize=compact&apikey=${AV_KEY}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json['Note'])      return reject(new Error('API rate limit hit — wait 1 min'));
          if (json['Information']) return reject(new Error('API limit: ' + json['Information'].substring(0, 80)));
          const ts = json['Time Series (Daily)'];
          if (!ts) return reject(new Error('No time series data — symbol may not exist on AV: ' + avSym));

          const rows = Object.entries(ts)
            .map(([date, v]) => ({
              symbol,
              date,
              open:   parseFloat(v['1. open']),
              high:   parseFloat(v['2. high']),
              low:    parseFloat(v['3. low']),
              close:  parseFloat(v['4. close']),
              volume: parseInt(v['5. volume']) || 0,
              source: 'Alpha Vantage'
            }))
            .filter(r => r.close > 0)
            .sort((a, b) => a.date.localeCompare(b.date)); // ascending

          resolve(rows);
        } catch (e) { reject(new Error('Parse error: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

function upsertBatch(rows) {
  return new Promise((resolve, reject) => {
    if (!rows.length) return resolve(0);
    const body = JSON.stringify(rows);
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path: '/rest/v1/sterling_ohlcv',
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
        else reject(new Error(`Supabase ${res.statusCode}: ${d.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchAllOHLCV() {
  console.log('\n⚔️  Sterling OHLCV — Alpha Vantage');
  console.log(`Symbols: ${SYMBOLS.join(', ')}`);
  console.log('Note: Free tier = 25 req/day, 1 req per 12s\n');

  let totalRows = 0;
  const results = [];

  for (const sym of SYMBOLS) {
    process.stdout.write(`  ${sym}.PSE... `);
    try {
      const rows = await fetchAV(sym);

      // Upsert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        await upsertBatch(rows.slice(i, i + 100));
      }

      const first = rows[0]?.date;
      const last  = rows[rows.length - 1]?.date;
      const latestClose = rows[rows.length - 1]?.close;
      console.log(`✅  ${rows.length} days (${first} → ${last}) latest ₱${latestClose}`);
      totalRows += rows.length;
      results.push({ symbol: sym, rows: rows.length, latestClose });
    } catch (err) {
      console.log(`❌  ${err.message}`);
      results.push({ symbol: sym, error: err.message });
    }

    // Alpha Vantage free tier: max 5 req/min — wait 13s between calls
    if (SYMBOLS.indexOf(sym) < SYMBOLS.length - 1) {
      process.stdout.write('     (waiting 13s for rate limit...)\n');
      await sleep(13000);
    }
  }

  console.log(`\n✅  Done — ${totalRows} rows upserted into sterling_ohlcv`);
  const ok = results.filter(r => !r.error);
  const fail = results.filter(r => r.error);
  if (ok.length)   console.log('OK:', ok.map(r => `${r.symbol}(${r.rows} days, ₱${r.latestClose})`).join(', '));
  if (fail.length) console.log('Failed:', fail.map(r => `${r.symbol}: ${r.error}`).join(', '));
  return results;
}

if (require.main === module) {
  fetchAllOHLCV().catch(err => { console.error('Fatal:', err); process.exit(1); });
}

module.exports = { fetchAllOHLCV };
